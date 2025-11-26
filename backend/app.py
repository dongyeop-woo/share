from __future__ import annotations

import asyncio
import datetime as dt
import os
import time
from typing import Dict, List, Optional, Tuple
from urllib.parse import quote_plus

import contextlib

import logging

import httpx
import requests
import pandas as pd
import numpy as np
import yfinance as yf
import FinanceDataReader as fdr
import feedparser
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.ai import rank_recommendations, summarize_headline, translate_to_korean
import subprocess
import sys

logger = logging.getLogger(__name__)

# Ollama 클라이언트 (선택적)
try:
    import ollama
    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_AVAILABLE = False
    logger.warning("ollama not available, chatbot will use fallback")

app = FastAPI(
    title="Breaking Share AI API",
    description="AI-powered helpers for the Breaking Share homepage.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SummarizeRequest(BaseModel):
    text: str = Field(..., description="뉴스 전문 또는 요약하고 싶은 한글 문장")
    max_tokens: Optional[int] = Field(
        180,
        ge=32,
        le=512,
        description="생성 요약의 최대 토큰 수 (기본 180)",
    )


class SummarizeResponse(BaseModel):
    summary: str


class ChartAnalysisRequest(BaseModel):
    image_url: Optional[str] = Field(None, description="차트 이미지 URL")
    image_base64: Optional[str] = Field(None, description="차트 이미지 Base64 인코딩 문자열")
    symbol: Optional[str] = Field(None, description="종목 심볼 (선택사항)")
    analysis_type: str = Field("full", description="분석 유형: full, pvg, trend, support_resistance")


class ChartAnalysisResponse(BaseModel):
    analysis: str
    pvg_detected: Optional[bool] = None
    trend: Optional[str] = None  # "상승", "하락", "횡보"
    support_levels: Optional[List[float]] = None
    resistance_levels: Optional[List[float]] = None
    recommendations: Optional[List[str]] = None


class ChatRequest(BaseModel):
    message: str = Field(..., description="사용자 메시지")
    include_market: bool = Field(True, description="시장 데이터 포함 여부")
    include_news: bool = Field(True, description="뉴스 데이터 포함 여부")
    max_news: int = Field(3, ge=0, le=10, description="포함할 최대 뉴스 개수")


class ChatSource(BaseModel):
    type: str  # "news", "market", "local_llm"
    title: Optional[str] = None
    url: Optional[str] = None
    content: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    sources: List[ChatSource] = Field(default_factory=list)


class RecommendationRequest(BaseModel):
    tickers: List[str] = Field(
        ...,
        min_length=1,
        description="스코어링을 진행할 티커 목록 (예: ['NVDA', 'AAPL'])",
    )
    weights: Optional[dict[str, float]] = Field(
        None,
        description="요소별 가중치. eps_growth, revenue_growth, momentum, volatility 중 일부/전부 지정 가능",
    )


class RecommendationItem(BaseModel):
    ticker: str
    composite_score: float
    eps_growth: float
    revenue_growth: float
    momentum: float
    volatility: float


class RecommendationResponse(BaseModel):
    generated_at: dt.datetime
    items: List[RecommendationItem]


class NewsArticle(BaseModel):
    headline: str
    headline_ko: Optional[str] = None
    summary: Optional[str] = None
    summary_ko: Optional[str] = None
    url: str
    source: Optional[str] = None
    published_at: dt.datetime
    symbols: List[str] = Field(default_factory=list)
    image: Optional[str] = None


class MarketQuote(BaseModel):
    symbol: str
    name: str
    current: float
    change: float
    percent: float
    high: Optional[float] = None
    low: Optional[float] = None
    open: Optional[float] = None
    previous_close: Optional[float] = None
    timestamp: dt.datetime


class SymbolSearchResult(BaseModel):
    symbol: str
    description: str
    type: Optional[str] = None
    exchange: Optional[str] = None


class CandleSeries(BaseModel):
    timestamps: List[int]
    opens: List[float]
    highs: List[float]
    lows: List[float]
    closes: List[float]
    volumes: List[float]


class CandleResponse(BaseModel):
    symbol: str
    resolution: str
    data: CandleSeries


# 차트 분석 관련 모델
class TechnicalIndicator(BaseModel):
    name: str
    value: float
    signal: str  # "buy", "sell", "neutral", "overbought", "oversold"
    description: str


class SupportResistance(BaseModel):
    level: float
    strength: float  # 0-1
    type: str  # "support" or "resistance"


class TrendLine(BaseModel):
    start_price: float
    end_price: float
    start_time: int
    end_time: int
    type: str  # "uptrend", "downtrend", "sideways"


class Pattern(BaseModel):
    name: str
    confidence: float  # 0-1
    description: str
    signal: str  # "bullish", "bearish", "neutral"


class TradingSignal(BaseModel):
    type: str  # "buy", "sell", "hold"
    confidence: float  # 0-1
    entry_price: Optional[float] = None
    target_price: Optional[float] = None
    stop_loss: Optional[float] = None
    reason: str


class ChartAnalysisRequest(BaseModel):
    symbol: str
    resolution: str = "D"
    range_days: int = 60


class ChartAnalysisResponse(BaseModel):
    symbol: str
    technical_indicators: List[TechnicalIndicator]
    support_resistance: List[SupportResistance]
    trend_lines: List[TrendLine]
    patterns: List[Pattern]
    trading_signal: TradingSignal
    risk_analysis: Dict
    summary: str


@app.post("/api/summarize", response_model=SummarizeResponse)
def summarize_news(payload: SummarizeRequest) -> SummarizeResponse:
    try:
        summary = summarize_headline(payload.text, max_tokens=payload.max_tokens)
        return SummarizeResponse(summary=summary)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/analyze-chart", response_model=ChartAnalysisResponse)
async def analyze_chart(payload: ChartAnalysisRequest) -> ChartAnalysisResponse:
    """
    차트 이미지를 AI로 분석합니다.
    PVG(Price Volume Gap), 상승/하락 라인, 지지/저항선 등을 분석합니다.
    """
    try:
        import base64
        import os
        
        # 이미지 데이터 준비
        image_data = None
        if payload.image_base64:
            # Base64 디코딩
            try:
                if payload.image_base64.startswith("data:image"):
                    # data:image/png;base64, 형태인 경우
                    image_data = payload.image_base64.split(",", 1)[1]
                else:
                    image_data = payload.image_base64
            except Exception as e:
                logger.warning(f"Base64 디코딩 실패: {e}")
        elif payload.image_url:
            # URL에서 이미지 다운로드
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(payload.image_url)
                    if response.status_code == 200:
                        import base64
                        image_data = base64.b64encode(response.content).decode('utf-8')
            except Exception as e:
                logger.warning(f"이미지 다운로드 실패: {e}")
        
        if not image_data:
            raise HTTPException(status_code=400, detail="이미지 데이터가 제공되지 않았습니다.")
        
        # Ollama Vision API를 사용한 차트 분석
        ollama_model = os.getenv("OLLAMA_MODEL", "qwen2.5:0.5b")
        ollama_host = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
        
        # Vision 모델이 있는지 확인 (llava, bakllava 등)
        vision_models = ["llava", "bakllava", "qwen2-vl", "llama3.2-vision"]
        model_to_use = ollama_model
        
        # Vision 모델 사용 시도
        for vision_model in vision_models:
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    # 모델 존재 확인
                    check_response = await client.get(f"{ollama_host}/api/tags")
                    if check_response.status_code == 200:
                        available_models = [m.get("name", "") for m in check_response.json().get("models", [])]
                        if any(vm in str(available_models) for vm in vision_models):
                            model_to_use = vision_model
                            break
            except Exception:
                continue
        
        # 차트 분석 프롬프트
        analysis_prompt = f"""다음 주식 차트 이미지를 분석해주세요.

분석해야 할 항목:
1. PVG (Price Volume Gap): 가격과 거래량의 괴리 여부
2. 추세선: 상승 추세선, 하락 추세선, 횡보 여부
3. 지지선과 저항선: 주요 지지선과 저항선의 위치
4. 패턴: 차트 패턴 (삼각형, 헤드앤숄더, 더블탑/바텀 등)
5. 거래 추천: 현재 차트를 기반으로 한 매수/매도/보유 추천

종목: {payload.symbol or "알 수 없음"}

다음 형식으로 한국어로 답변해주세요:
- PVG 감지: [예/아니오 및 설명]
- 추세: [상승/하락/횡보 및 설명]
- 지지선: [주요 지지선 위치 설명]
- 저항선: [주요 저항선 위치 설명]
- 패턴: [감지된 차트 패턴 설명]
- 추천: [매수/매도/보유 및 이유]

상세한 분석을 제공해주세요."""
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                # Vision 모델 사용 시도
                if model_to_use in vision_models:
                    response = await client.post(
                        f"{ollama_host}/api/generate",
                        json={
                            "model": model_to_use,
                            "prompt": analysis_prompt,
                            "images": [image_data],
                            "stream": False,
                            "options": {
                                "temperature": 0.3,
                                "num_predict": 1000,
                            }
                        }
                    )
                else:
                    # Vision 모델이 없으면 텍스트 기반 분석
                    response = await client.post(
                        f"{ollama_host}/api/chat",
                        json={
                            "model": ollama_model,
                            "messages": [
                                {
                                    "role": "system",
                                    "content": "당신은 주식 차트 분석 전문가입니다. 차트 이미지를 분석하여 PVG, 추세선, 지지/저항선 등을 분석합니다."
                                },
                                {
                                    "role": "user",
                                    "content": f"{analysis_prompt}\n\n참고: 이미지 데이터가 제공되었지만 현재 모델은 텍스트만 처리할 수 있습니다. 일반적인 차트 분석 가이드라인을 제공해주세요."
                                }
                            ],
                            "stream": False,
                            "options": {
                                "temperature": 0.3,
                                "num_predict": 1000,
                            }
                        }
                    )
                
                if response.status_code == 200:
                    data = response.json()
                    if "response" in data:
                        analysis_text = data["response"].strip()
                    elif "message" in data and "content" in data["message"]:
                        analysis_text = data["message"]["content"].strip()
                    else:
                        analysis_text = str(data)
                    
                    # 간단한 파싱 (더 정교한 파싱은 필요시 개선)
                    pvg_detected = "PVG" in analysis_text.upper() or "가격과 거래량" in analysis_text
                    trend = None
                    if "상승" in analysis_text:
                        trend = "상승"
                    elif "하락" in analysis_text:
                        trend = "하락"
                    elif "횡보" in analysis_text:
                        trend = "횡보"
                    
                    # 추천 추출
                    recommendations = []
                    if "매수" in analysis_text:
                        recommendations.append("매수 고려")
                    if "매도" in analysis_text:
                        recommendations.append("매도 고려")
                    if "보유" in analysis_text:
                        recommendations.append("보유 권장")
                    
                    return ChartAnalysisResponse(
                        analysis=analysis_text,
                        pvg_detected=pvg_detected,
                        trend=trend,
                        support_levels=None,  # 추후 개선 가능
                        resistance_levels=None,  # 추후 개선 가능
                        recommendations=recommendations if recommendations else None
                    )
                else:
                    raise HTTPException(status_code=response.status_code, detail=f"Ollama API 오류: {response.text}")
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="차트 분석 시간 초과")
        except Exception as e:
            logger.error(f"차트 분석 실패: {e}")
            raise HTTPException(status_code=500, detail=f"차트 분석 실패: {str(e)}")
            
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("차트 분석 중 오류 발생")
        raise HTTPException(status_code=500, detail=f"차트 분석 중 오류: {str(exc)}")


@app.post("/api/chat", response_model=ChatResponse)
async def chat_with_llm(payload: ChatRequest) -> ChatResponse:
    """
    LLM API (Ollama)를 사용하여 챗봇 응답을 생성합니다.
    Local LLM (transformers)을 사용하여 뉴스 요약도 함께 제공합니다.
    """
    sources: List[ChatSource] = []
    context_parts = []
    
    # 1. 시장 데이터 수집 (요청된 경우)
    market_info = ""
    if payload.include_market:
        try:
            async with MARKET_CACHE_LOCK:
                market_quotes = []
                for symbol, name in MARKET_OVERVIEW_SYMBOLS[:3]:  # 주요 지수 3개만
                    entry = MARKET_CACHE.get(symbol.upper())
                    if entry:
                        quote = entry["quote"]  # type: ignore[index]
                        market_quotes.append(f"{name}: {quote.current:.2f} ({quote.percent:+.2f}%)")
            
            if market_quotes:
                market_info = "주요 시장 지수:\n" + "\n".join(market_quotes)
                sources.append(ChatSource(
                    type="market",
                    title="시장 데이터",
                    content=market_info
                ))
        except Exception as e:
            logger.warning(f"시장 데이터 수집 실패: {e}")
    
    # 2. 뉴스 데이터 수집 (요청된 경우) - AI 분석 질문일 때는 생략하여 속도 개선
    news_info = ""
    user_message = payload.message  # 먼저 정의
    is_ai_analysis_question = "손절" in user_message or "익절" in user_message or "AI 분석" in user_message or "반복" in user_message
    
    if payload.include_news and not is_ai_analysis_question:
        try:
            articles_list = await _fetch_usa_news()
            articles = articles_list[:payload.max_news] if isinstance(articles_list, list) else list(articles_list)[:payload.max_news]
            if articles:
                news_items = []
                for article in articles:
                    headline = article.headline_ko or article.headline
                    # Local LLM을 사용하여 요약 (transformers) - 타임아웃 설정
                    summary = article.summary_ko or article.summary
                    if summary:
                        try:
                            # Local LLM으로 요약 생성 (빠른 응답을 위해 짧게)
                            summary_short = summarize_headline(summary, max_tokens=30)
                            news_items.append(f"- {headline}: {summary_short}")
                        except Exception:
                            news_items.append(f"- {headline}")
                    else:
                        news_items.append(f"- {headline}")
                    
                    sources.append(ChatSource(
                        type="news",
                        title=headline,
                        url=article.url,
                        content=summary or headline
                    ))
                
                news_info = "최신 경제 뉴스:\n" + "\n".join(news_items)
                sources.append(ChatSource(
                    type="local_llm",
                    title="Local LLM 요약",
                    content="transformers를 사용하여 뉴스 요약 생성"
                ))
        except Exception as e:
            logger.warning(f"뉴스 데이터 수집 실패: {e}")
    
    # 3. 컨텍스트 구성
    context = ""
    if market_info:
        context += market_info + "\n\n"
    if news_info:
        context += news_info + "\n\n"
    
    # 4. LLM API (Ollama)를 사용하여 응답 생성
    # user_message는 이미 위에서 정의됨
    
    # AI 분석 기능에 대한 질문인지 확인 (이미 위에서 확인함)
    ai_analysis_context = ""
    if is_ai_analysis_question:
        ai_analysis_context = """
        
TradeNote의 AI 분석 기능에 대한 정보:
1. "손절 시 반복되는 문제점 찾기" 기능:
   - 매매일지에서 손절한 거래의 '손절한 이유'를 분석합니다
   - 자주 반복되는 패턴과 문제점을 찾아드립니다
   - 최소 매매일지가 1개 이상 있어야 작동합니다
   - 손절 사유를 기록하면 더 정확한 분석이 가능합니다
   
2. "익절 시 반복되는 좋은 습관 찾기" 기능:
   - 매매일지에서 익절한 거래의 '익절한 이유'를 분석합니다
   - 반복되는 좋은 습관과 패턴을 찾아드립니다
   - 최소 매매일지가 1개 이상 있어야 작동합니다
   - 익절 사유를 기록하면 더 정확한 분석이 가능합니다

이 기능들은 사용자의 매매 패턴을 분석하여 개선점을 찾아주는 데 도움을 줍니다.
"""
    
    system_prompt = """당신은 TradeNote의 AI 어시스턴트입니다. 주식 시장, 경제 뉴스, 그리고 TradeNote의 AI 분석 기능에 대해 도움을 주는 전문가입니다.
사용자의 질문에 정확하고 도움이 되는 답변을 제공하세요.
제공된 시장 데이터와 뉴스 정보를 활용하여 답변하세요.
AI 분석 기능에 대한 질문이 있으면 상세하고 친절하게 설명해주세요."""
    
    prompt = f"{system_prompt}{ai_analysis_context}\n\n{context}사용자 질문: {user_message}\n\n답변:"
    
    reply = ""
    try:
        if OLLAMA_AVAILABLE:
            # Ollama API 사용 (로컬 LLM API)
            ollama_model = os.getenv("OLLAMA_MODEL", "qwen2.5:0.5b")  # 기본값: 작은 모델
            try:
                # httpx를 사용하여 Ollama API 직접 호출 (더 안정적)
                ollama_url = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
                # 타임아웃을 120초로 늘림 (모델 로딩 시간 포함)
                async with httpx.AsyncClient(timeout=120.0) as client:
                    response = await client.post(
                        f"{ollama_url}/api/chat",
                        json={
                            "model": ollama_model,
                            "messages": [
                                {"role": "system", "content": system_prompt + ai_analysis_context},
                                {"role": "user", "content": f"{context}질문: {user_message}" if context else f"질문: {user_message}"}
                            ],
                            "options": {
                                "temperature": 0.7,
                                "num_predict": 200 if is_ai_analysis_question else 300,
                            },
                            "stream": False
                        }
                    )
                    if response.status_code == 200:
                        data = response.json()
                        reply = data.get("message", {}).get("content", "")
                        if not reply or len(reply.strip()) == 0:
                            raise ValueError("Ollama 응답이 비어있습니다")
                        sources.append(ChatSource(
                            type="local_llm",
                            title="Ollama LLM API",
                            content=f"모델: {ollama_model}"
                        ))
                        logger.info(f"Ollama API 성공: {len(reply)}자 응답 생성")
                    else:
                        raise HTTPException(status_code=response.status_code, detail=f"Ollama API 오류: {response.text}")
            except httpx.TimeoutException:
                logger.warning("Ollama API 타임아웃, fallback 사용")
                reply = _generate_fallback_reply(user_message, market_info, news_info)
            except Exception as e:
                logger.warning(f"Ollama API 호출 실패: {e}, fallback 사용")
                reply = _generate_fallback_reply(user_message, market_info, news_info)
        else:
            # Ollama가 없으면 즉시 fallback 사용
            reply = _generate_fallback_reply(user_message, market_info, news_info)
    except Exception as e:
        logger.error(f"LLM 응답 생성 실패: {e}")
        reply = _generate_fallback_reply(user_message, market_info, news_info)
    
    if not reply:
        reply = "죄송합니다. 답변을 생성하지 못했습니다. 다시 시도해주세요."
    
    return ChatResponse(reply=reply, sources=sources)


def _generate_fallback_reply(message: str, market_info: str, news_info: str) -> str:
    """Ollama가 없을 때 사용하는 빠른 fallback 응답"""
    # 간단한 인사말 처리
    message_lower = message.lower().strip()
    if message_lower in ["안녕", "안녕하세요", "hi", "hello", "안녕하세요!", "안녕!"]:
        return "안녕하세요! TradeNote AI 어시스턴트입니다. 주식 시장, 경제 뉴스, 그리고 AI 분석 기능에 대해 도움을 드릴 수 있습니다. 무엇을 도와드릴까요?"
    
    reply_parts = []
    
    # AI 분석 기능에 대한 질문 처리 (가장 빠르게 응답)
    if "손절" in message or "익절" in message or "AI 분석" in message or "반복" in message or "문제점" in message or "습관" in message:
        if "손절" in message or "문제점" in message:
            reply_parts.append("""손절 시 반복되는 문제점 찾기 기능에 대해 설명드리겠습니다.

📊 **기능 설명:**
이 기능은 매매일지에서 손절한 거래의 '손절한 이유'를 분석하여 자주 반복되는 패턴과 문제점을 찾아드립니다.

🔧 **사용 방법:**
1. 매매일지에서 손절 거래를 기록하세요
2. 각 거래의 '손절한 이유'를 상세히 기록하세요
3. AI 분석 페이지에서 '손절 시 반복되는 문제점 찾기' 버튼을 클릭하세요

📝 **필요한 데이터:**
- 최소 매매일지 1개 이상
- 손절 거래의 손절 사유 기록

💡 **활용 방법:**
반복되는 문제점을 발견하면, 해당 문제를 해결하기 위한 구체적인 행동 계획을 수립하세요. 매매 전 체크리스트를 만들어 실수를 방지할 수 있습니다.""")
        elif "익절" in message or "습관" in message:
            reply_parts.append("""익절 시 반복되는 좋은 습관 찾기 기능에 대해 설명드리겠습니다.

📊 **기능 설명:**
이 기능은 매매일지에서 익절한 거래의 '익절한 이유'를 분석하여 반복되는 좋은 습관과 패턴을 찾아드립니다.

🔧 **사용 방법:**
1. 매매일지에서 익절 거래를 기록하세요
2. 각 거래의 '익절한 이유'를 상세히 기록하세요
3. AI 분석 페이지에서 '익절 시 반복되는 좋은 습관 찾기' 버튼을 클릭하세요

📝 **필요한 데이터:**
- 최소 매매일지 1개 이상
- 익절 거래의 익절 사유 기록

💡 **활용 방법:**
반복되는 좋은 습관을 발견하면, 이를 더욱 체계화하고 일관되게 적용하세요. 성공 패턴을 강화하여 승률을 높일 수 있습니다.""")
        else:
            reply_parts.append("""AI 분석 기능에 대해 설명드리겠습니다.

TradeNote의 AI 분석 기능은 두 가지가 있습니다:

1️⃣ **손절 시 반복되는 문제점 찾기**
   - 손절 거래의 패턴을 분석하여 개선점을 찾습니다
   - 매매일지에서 손절 사유를 기록하면 더 정확한 분석이 가능합니다

2️⃣ **익절 시 반복되는 좋은 습관 찾기**
   - 익절 거래의 패턴을 분석하여 성공 요인을 찾습니다
   - 매매일지에서 익절 사유를 기록하면 더 정확한 분석이 가능합니다

💡 **팁:** 더 자세한 정보를 원하시면 각 기능의 도움말 버튼(💬)을 클릭하세요.""")
        return "\n\n".join(reply_parts)
    
    # 시장 데이터 관련 질문
    if "시장" in message or "지수" in message or "주가" in message:
        if market_info:
            reply_parts.append(market_info)
        else:
            reply_parts.append("시장 데이터를 가져올 수 없습니다.")
    
    # 뉴스 관련 질문
    if "뉴스" in message or "소식" in message:
        if news_info:
            reply_parts.append(news_info)
        else:
            reply_parts.append("뉴스 데이터를 가져올 수 없습니다.")
    
    # 기본 응답 - 더 자연스럽게 개선
    if not reply_parts:
        # 질문 유형에 따른 응답
        if any(word in message for word in ["시장", "주가", "지수", "주식"]):
            reply_parts.append("시장 정보에 대해 질문해주셨네요. 현재 시장 데이터를 가져올 수 없어 정확한 답변을 드리기 어렵습니다.")
            reply_parts.append("시장 데이터 기능이 활성화되면 더 자세한 정보를 제공할 수 있습니다.")
        elif any(word in message for word in ["뉴스", "소식", "이슈"]):
            reply_parts.append("뉴스에 대해 질문해주셨네요. 현재 뉴스 데이터를 가져올 수 없어 최신 정보를 제공하기 어렵습니다.")
            reply_parts.append("뉴스 기능이 활성화되면 최신 경제 뉴스를 제공할 수 있습니다.")
        else:
            reply_parts.append(f"'{message}'에 대해 질문해주셨네요.")
            reply_parts.append("다음 주제에 대해 도움을 드릴 수 있습니다:")
            reply_parts.append("• AI 분석 기능 (손절/익절 패턴 분석)")
            reply_parts.append("• 주식 시장 정보")
            reply_parts.append("• 경제 뉴스")
            reply_parts.append("원하시는 주제를 선택해주시면 더 자세히 설명해드리겠습니다.")
    
    return "\n\n".join(reply_parts)


@app.post("/api/recommendations", response_model=RecommendationResponse)
def generate_recommendations(payload: RecommendationRequest) -> RecommendationResponse:
    try:
        history = yf.download(
            payload.tickers,
            period="6mo",
            interval="1d",
            group_by="ticker",
            auto_adjust=True,
            progress=False,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"데이터 수집 실패: {exc}") from exc

    if history.empty:
        raise HTTPException(status_code=404, detail="다운로드한 시세 데이터가 없습니다.")

    metrics = []
    for ticker in payload.tickers:
        try:
            ticker_history = history[ticker] if len(payload.tickers) > 1 else history
            close_prices = ticker_history["Close"].dropna()
            if close_prices.empty:
                continue

            returns = close_prices.pct_change().dropna()
            momentum = (close_prices.iloc[-1] / close_prices.iloc[0]) - 1
            volatility = returns.std()

            earnings = yf.Ticker(ticker).get_earnings_dates(limit=4)
            revenue_growth = 0.0
            eps_growth = 0.0
            if earnings is not None and hasattr(earnings, 'empty') and not earnings.empty:
                earnings = earnings.sort_index()
                if "Revenue" in earnings.columns and len(earnings["Revenue"].dropna()) >= 2:
                    revenue_growth = (
                        earnings["Revenue"].iloc[-1] - earnings["Revenue"].iloc[-2]
                    ) / abs(earnings["Revenue"].iloc[-2])
                if "EPS" in earnings.columns and len(earnings["EPS"].dropna()) >= 2:
                    eps_growth = (
                        earnings["EPS"].iloc[-1] - earnings["EPS"].iloc[-2]
                    ) / abs(earnings["EPS"].iloc[-2])

            metrics.append(
                {
                    "ticker": ticker,
                    "momentum": float(momentum),
                    "volatility": float(volatility),
                    "revenue_growth": float(revenue_growth),
                    "eps_growth": float(eps_growth),
                }
            )
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=500, detail=f"{ticker} 분석 실패: {exc}") from exc

    if not metrics:
        raise HTTPException(status_code=404, detail="평가 가능한 종목 데이터가 없습니다.")

    default_weights = {
        "momentum": 0.4,
        "volatility": -0.2,  # 낮을수록 좋음
        "revenue_growth": 0.2,
        "eps_growth": 0.2,
    }

    if payload.weights:
        default_weights.update(payload.weights)

    ranked = rank_recommendations(metrics, weights=default_weights)
    return RecommendationResponse(
        generated_at=dt.datetime.utcnow(),
        items=[RecommendationItem(**item) for item in ranked],
    )


FINNHUB_NEWS_URL = "https://finnhub.io/api/v1/news"
FINNHUB_QUOTE_URL = "https://finnhub.io/api/v1/quote"
FINNHUB_SEARCH_URL = "https://finnhub.io/api/v1/search"
FINNHUB_CANDLE_URL = "https://finnhub.io/api/v1/stock/candle"

MARKET_OVERVIEW_SYMBOLS = [
    ("SPY", "S&P 500 ETF"),
    ("QQQ", "NASDAQ 100 ETF"),
    ("DIA", "Dow Jones 30 ETF"),
    ("IWM", "Russell 2000 ETF"),
    ("XLF", "Financial Select Sector"),
    ("XLE", "Energy Select Sector"),
    ("XLK", "Technology Select Sector"),
]

CACHE_TTL_SECONDS = 300
QUOTE_CACHE: Dict[str, tuple[MarketQuote, float]] = {}
CANDLE_CACHE: Dict[Tuple[str, str, int], tuple[CandleResponse, float]] = {}
ALPHAVANTAGE_URL = "https://www.alphavantage.co/query"
ALPHA_CACHE_TTL = 300
ALPHA_SERIES_CACHE: Dict[str, tuple[List[dict], float]] = {}
SYMBOL_ALIAS_MAP: Dict[str, Tuple[str, Optional[str]]] = {
    "KOSPI": ("^KS11", "KOSPI 지수"),
    "KOSDAQ": ("^KQ11", "KOSDAQ 지수"),
    "KOSPI200": ("^KS200", "KOSPI 200"),
    "NASDAQ": ("^IXIC", "NASDAQ Composite"),
    "DOW": ("^DJI", "Dow Jones Industrial Average"),
    "S&P500": ("^GSPC", "S&P 500 Index"),
}
MARKET_REFRESH_INTERVAL = 180
NEWS_REFRESH_INTERVAL = 300
MARKET_CACHE: Dict[str, Dict[str, object]] = {}
MARKET_CACHE_LOCK = asyncio.Lock()
NEWS_CACHE: Dict[str, tuple[List[NewsArticle], float]] = {}
NEWS_CACHE_LOCK = asyncio.Lock()
MARKET_REFRESH_TASK: Optional[asyncio.Task] = None
NEWS_REFRESH_TASK: Optional[asyncio.Task] = None
NEWS_CATEGORIES = ["general"]

# RSS 피드 URL 목록 (확장)
KOREA_NEWS_RSS = [
    "https://www.hankyung.com/feed/economy",  # 한국경제
    "https://www.mk.co.kr/rss/30000041/",  # 매일경제 경제
    "https://biz.chosun.com/rss/site_biz.xml",  # 조선비즈
    "https://rss.etnews.com/Section901.xml",  # 전자신문
    "https://www.edaily.co.kr/rss/industry.xml",  # 이데일리 산업
    "https://www.fnnews.com/rss/section?section=economy",  # 파이낸셜뉴스 경제
    "https://www.yna.co.kr/rss/economy.xml",  # 연합뉴스 경제
    "https://www.hani.co.kr/rss/economy/",  # 한겨레 경제
    "https://www.donga.com/rss/economy.xml",  # 동아일보 경제
    "https://www.joongang.co.kr/rss/economy.xml",  # 중앙일보 경제
    "https://www.seoul.co.kr/rss/economy.xml",  # 서울신문 경제
    "https://www.khan.co.kr/rss/economy.xml",  # 경향신문 경제
    "https://www.mt.co.kr/rss/",  # 머니투데이
    "https://www.asiae.co.kr/rss/economy.xml",  # 아시아경제
]

USA_NEWS_RSS = [
    "https://rss.cnn.com/rss/money_latest.rss",  # CNN Money
    "https://feeds.bloomberg.com/markets/news.rss",  # Bloomberg Markets
    "https://www.cnbc.com/id/100003114/device/rss/rss.html",  # CNBC News
    "https://www.marketwatch.com/rss/topstories",  # MarketWatch
    "https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC&region=US&lang=en-US",  # Yahoo Finance S&P 500
    "https://feeds.reuters.com/reuters/businessNews",  # Reuters Business
    "https://feeds.reuters.com/reuters/marketsNews",  # Reuters Markets
    "https://www.wsj.com/xml/rss/3_7085.xml",  # Wall Street Journal
    "https://feeds.finance.yahoo.com/rss/2.0/headline?s=^DJI&region=US&lang=en-US",  # Yahoo Finance Dow Jones
    "https://feeds.finance.yahoo.com/rss/2.0/headline?s=^IXIC&region=US&lang=en-US",  # Yahoo Finance NASDAQ
    "https://www.forbes.com/real-time/feed2/",  # Forbes Real-Time
    "https://feeds.fool.com/fool/investing",  # Motley Fool
]


async def _fetch_finnhub_news(category: str) -> List[NewsArticle]:
    api_key = os.getenv("FINNHUB_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Finnhub API 키가 설정되지 않았습니다.")

    params = {"category": category, "token": api_key}

    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.get(FINNHUB_NEWS_URL, params=params)

    if response.status_code == 429:
        raise HTTPException(status_code=429, detail="Finnhub 호출 제한을 초과했습니다. 잠시 후 다시 시도하세요.")

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Finnhub 요청 실패: {response.text}")

    data = response.json()
    articles: List[NewsArticle] = []
    for item in data[:12]:
        published_epoch = item.get("datetime")
        published_at = (
            dt.datetime.fromtimestamp(published_epoch, tz=dt.timezone.utc)
            if isinstance(published_epoch, (int, float))
            else dt.datetime.utcnow()
        )
        related_raw = item.get("related") or ""
        symbols = [symbol for symbol in related_raw.split(",") if symbol]
        headline = item.get("headline", "").strip()
        summary = (item.get("summary") or "").strip()

        # Try translation with timeout protection
        headline_ko = None
        summary_ko = None
        try:
            headline_ko = translate_to_korean(headline) or None
        except Exception:
            pass
        try:
            summary_ko = translate_to_korean(summary) or None
        except Exception:
            pass
        
        articles.append(
            NewsArticle(
                headline=headline,
                headline_ko=headline_ko,
                summary=summary or None,
                summary_ko=summary_ko,
                url=item.get("url", ""),
                source=item.get("source"),
                published_at=published_at,
                symbols=symbols,
                image=item.get("image"),
            )
        )

    if not articles:
        raise HTTPException(status_code=404, detail="Finnhub에서 뉴스 데이터를 받지 못했습니다.")

    return articles


async def _fetch_rss_news(rss_urls: List[str], translate: bool = False) -> List[NewsArticle]:
    """RSS 피드에서 뉴스를 가져옵니다.
    
    Args:
        rss_urls: RSS 피드 URL 목록
        translate: True이면 번역 시도 (미국 뉴스용)
    """
    articles: List[NewsArticle] = []
    
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        for rss_url in rss_urls:
            try:
                response = await client.get(rss_url, headers={"User-Agent": "Mozilla/5.0 (compatible; RSS Reader)"})
                if response.status_code != 200:
                    logger.debug(f"RSS 피드 응답 실패 ({rss_url}): HTTP {response.status_code}")
                    continue
                
                feed = feedparser.parse(response.text)
                
                # 피드가 유효한지 확인
                if not hasattr(feed, 'entries') or not feed.entries:
                    logger.debug(f"RSS 피드에 항목이 없음 ({rss_url})")
                    continue
                
                for entry in feed.entries[:30]:  # 각 피드에서 최대 30개 (더 많은 뉴스 수집)
                    # 날짜 파싱
                    published_at = dt.datetime.utcnow()
                    if hasattr(entry, 'published_parsed') and entry.published_parsed:
                        try:
                            published_at = dt.datetime(*entry.published_parsed[:6], tzinfo=dt.timezone.utc)
                        except Exception:
                            pass
                    elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
                        try:
                            published_at = dt.datetime(*entry.updated_parsed[:6], tzinfo=dt.timezone.utc)
                        except Exception:
                            pass
                    
                    headline = entry.get("title", "").strip()
                    # summary, description, content 등에서 요약 추출 시도
                    summary = (
                        entry.get("summary", "").strip() 
                        or entry.get("description", "").strip()
                        or (entry.get("content", [{}])[0].get("value", "").strip() if entry.get("content") and len(entry.get("content", [])) > 0 else "")
                    )
                    url = entry.get("link", "")
                    source = entry.get("source", {}).get("title", "") if hasattr(entry, "source") else feed.feed.get("title", "")
                    
                    # 이미지 추출
                    image = None
                    if hasattr(entry, 'media_content') and entry.media_content:
                        image = entry.media_content[0].get('url')
                    elif hasattr(entry, 'enclosures') and entry.enclosures:
                        for enc in entry.enclosures:
                            if enc.get('type', '').startswith('image'):
                                image = enc.get('href')
                                break
                    
                    # summary가 빈 문자열이면 None으로 설정
                    final_summary = summary if summary else None
                    
                    # 번역이 필요한 경우 (미국 뉴스)
                    headline_ko = None
                    summary_ko = None
                    if translate:
                        # 번역은 나중에 _fetch_usa_news에서 처리
                        headline_ko = None
                        summary_ko = None
                    else:
                        # 한국 뉴스는 이미 한국어
                        headline_ko = headline
                        summary_ko = final_summary
                    
                    articles.append(
                        NewsArticle(
                            headline=headline,
                            headline_ko=headline_ko,
                            summary=final_summary,
                            summary_ko=summary_ko,
                            url=url,
                            source=source,
                            published_at=published_at,
                            symbols=[],
                            image=image,
                        )
                    )
            except Exception as e:
                logger.warning(f"RSS 피드 파싱 실패 ({rss_url}): {e}")
                continue
    
    # 날짜순으로 정렬 (최신순)
    articles.sort(key=lambda x: x.published_at, reverse=True)
    return articles[:50]  # 최대 50개 반환 (더 많은 뉴스 수집)


async def _fetch_korea_news() -> List[NewsArticle]:
    """한국 경제 뉴스를 RSS 피드에서 가져옵니다."""
    articles = await _fetch_rss_news(KOREA_NEWS_RSS, translate=False)
    
    # 요약이 없는 기사에 대해 처리
    result = []
    for article in articles:
        # RSS 피드에 요약이 없으면 헤드라인을 요약으로 사용
        # (한국 뉴스 RSS 피드는 대부분 요약을 제공하지 않음)
        summary_value = article.summary if article.summary else article.headline
        summary_ko_value = article.summary_ko if article.summary_ko else article.headline
        
        # 새로운 객체 생성 (Pydantic 모델은 불변일 수 있음)
        result.append(
            NewsArticle(
                headline=article.headline,
                headline_ko=article.headline_ko,
                summary=summary_value,
                summary_ko=summary_ko_value,
                url=article.url,
                source=article.source,
                published_at=article.published_at,
                symbols=article.symbols,
                image=article.image,
            )
        )
    
    return result


async def _fetch_usa_news() -> List[NewsArticle]:
    """미국 경제 뉴스를 RSS 피드에서 가져옵니다."""
    articles = []
    
    # RSS 피드 시도
    try:
        articles = await _fetch_rss_news(USA_NEWS_RSS, translate=True)
        logger.info(f"RSS 피드에서 {len(articles)}개의 미국 뉴스를 가져왔습니다.")
    except Exception as e:
        logger.warning(f"RSS 피드 가져오기 실패: {e}")
    
    # RSS 피드에서 뉴스를 가져오지 못한 경우 Finnhub 사용
    if not articles or len(articles) == 0:
        logger.info("RSS 피드에서 미국 뉴스를 가져오지 못해 Finnhub를 사용합니다.")
        try:
            finnhub_articles = await _fetch_finnhub_news("general")
            # Finnhub 뉴스 중 미국 관련 뉴스 필터링 (간단히 처음 20개 사용)
            articles = finnhub_articles[:20]
            logger.info(f"Finnhub에서 {len(articles)}개의 미국 뉴스를 가져왔습니다.")
        except Exception as e:
            logger.warning(f"Finnhub에서도 미국 뉴스를 가져오지 못했습니다: {e}")
            # 최소한 빈 배열이 아닌 기본 메시지라도 반환
            if not articles:
                return []
    
    # 미국 뉴스는 영어이므로 번역 시도 (번역 실패해도 원문 반환)
    for article in articles:
        if article.headline and not article.headline_ko:
            try:
                translated = translate_to_korean(article.headline)
                article.headline_ko = translated if translated and translated != article.headline else article.headline
            except Exception as e:
                logger.debug(f"헤드라인 번역 실패 (원문 사용): {e}")
                article.headline_ko = article.headline
        
        if article.summary and not article.summary_ko:
            try:
                translated = translate_to_korean(article.summary)
                article.summary_ko = translated if translated and translated != article.summary else article.summary
            except Exception as e:
                logger.debug(f"요약 번역 실패 (원문 사용): {e}")
                article.summary_ko = article.summary
    
    return articles if articles else []


@app.get("/api/news", response_model=List[NewsArticle])
async def get_news(category: str = "general") -> List[NewsArticle]:
    await _ensure_news_cached(category)
    key = category.lower()

    async with NEWS_CACHE_LOCK:
        entry = NEWS_CACHE.get(key)
        if not entry and key != "general":
            entry = NEWS_CACHE.get("general")

    if not entry:
        raise HTTPException(status_code=503, detail="뉴스 데이터가 준비되지 않았습니다. 잠시 후 다시 시도해주세요.")

    return entry[0]


@app.get("/api/news/korea", response_model=List[NewsArticle])
async def get_korea_news() -> List[NewsArticle]:
    """한국 경제 뉴스를 반환합니다."""
    key = "korea"
    # 캐시 무시하고 항상 최신 뉴스 가져오기 (요약 포함)
    articles = await _fetch_korea_news()
    async with NEWS_CACHE_LOCK:
        NEWS_CACHE[key] = (articles, time.time())
    
    return articles


@app.get("/api/news/usa", response_model=List[NewsArticle])
async def get_usa_news() -> List[NewsArticle]:
    """미국 경제 뉴스를 반환합니다."""
    key = "usa"
    async with NEWS_CACHE_LOCK:
        entry = NEWS_CACHE.get(key)
        if entry and time.time() - entry[1] < NEWS_REFRESH_INTERVAL:
            return entry[0]
    
    articles = await _fetch_usa_news()
    async with NEWS_CACHE_LOCK:
        NEWS_CACHE[key] = (articles, time.time())
    
    return articles


@app.get("/api/news/symbol/{symbol}", response_model=List[NewsArticle])
async def get_news_by_symbol(symbol: str) -> List[NewsArticle]:
    """특정 종목에 관련된 뉴스를 반환합니다.
    
    Args:
        symbol: 종목 심볼 (예: "005930", "AAPL")
    """
    # 심볼 정규화 (005930.KS -> 005930)
    normalized_symbol = symbol.upper().replace(".KS", "").replace(".KQ", "")
    
    # 한국 종목인지 확인 (6자리 숫자)
    is_korean = normalized_symbol.isdigit() and len(normalized_symbol) == 6
    
    # 한국 종목인 경우 한국 뉴스, 그 외는 미국 뉴스
    if is_korean:
        all_articles = await _fetch_korea_news()
        # 한국 종목명 가져오기 (KOREAN_STOCKS는 {name: symbol} 형태이므로 역방향 검색)
        stock_name = ""
        for name, sym in KOREAN_STOCKS.items():
            if sym == normalized_symbol:
                stock_name = name
                break
    else:
        all_articles = await _fetch_usa_news()
        stock_name = symbol
    
    # 종목명이나 심볼이 포함된 뉴스 필터링
    filtered_articles = []
    logger.info(f"종목별 뉴스 필터링 시작: symbol={normalized_symbol}, stock_name={stock_name}, 총 뉴스 수={len(all_articles)}")
    
    for article in all_articles:
        # symbols 필드에 심볼이 포함되어 있는지 확인 (가장 확실한 방법)
        if article.symbols and normalized_symbol in article.symbols:
            filtered_articles.append(article)
            logger.debug(f"심볼 매칭: {article.headline[:50]}")
            continue
        
        # 헤드라인과 요약 텍스트 준비
        headline_text = (article.headline_ko or article.headline or "").lower()
        summary_text = (article.summary_ko or article.summary or "").lower()
        full_text = f"{headline_text} {summary_text}"
        
        match_targets = []
        if stock_name:
            match_targets.append(stock_name.lower())
        match_targets.extend([normalized_symbol.lower(), symbol.lower()])
        
        if any(target and target in full_text for target in match_targets):
            filtered_articles.append(article)
            logger.debug(f"종목 키워드 매칭: {article.headline[:50]}")
            continue
        
    logger.info(f"필터링 완료: {len(filtered_articles)}개 뉴스 발견")
    
    # 항상 외부 뉴스 소스에서도 검색 (RSS 피드만으로는 부족할 수 있음)
    try:
        # Google News 검색 또는 NewsAPI를 사용하여 추가 뉴스 가져오기
        additional_news = await _fetch_stock_news_from_external(stock_name or symbol, is_korean)
        # 중복 제거
        existing_urls = {article.url for article in filtered_articles}
        for news in additional_news:
            if news.url not in existing_urls:
                filtered_articles.append(news)
                existing_urls.add(news.url)
                if len(filtered_articles) >= 20:
                    break
        logger.info(f"외부 뉴스 소스에서 {len(additional_news)}개 추가, 총 {len(filtered_articles)}개")
    except Exception as e:
        logger.warning(f"외부 뉴스 소스에서 뉴스를 가져오는 중 오류 발생: {e}")
    
    # 최대 20개까지 반환 (더 많은 뉴스 제공)
    return filtered_articles[:20]


async def _fetch_stock_news_from_external(stock_query: str, is_korean: bool) -> List[NewsArticle]:
    """외부 뉴스 소스에서 종목별 뉴스를 가져옵니다.
    
    Args:
        stock_query: 종목명 또는 심볼
        is_korean: 한국 종목 여부
    """
    articles: List[NewsArticle] = []
    logger.info(f"외부 뉴스 소스 검색 시작: stock_query={stock_query}, is_korean={is_korean}")
    
    try:
        # NewsAPI 사용 (환경 변수에 NEWS_API_KEY가 있는 경우)
        news_api_key = os.getenv("NEWS_API_KEY")
        if news_api_key:
            try:
                # NewsAPI로 종목별 뉴스 검색
                if is_korean:
                    # 한국 뉴스 검색
                    query = f"{stock_query} 주가 OR {stock_query} 주식"
                    url = f"https://newsapi.org/v2/everything"
                    params = {
                        "q": query,
                        "language": "ko",
                        "sortBy": "publishedAt",
                        "pageSize": 20,
                        "apiKey": news_api_key
                    }
                else:
                    # 미국 뉴스 검색
                    query = f"{stock_query} stock OR {stock_query} shares"
                    url = f"https://newsapi.org/v2/everything"
                    params = {
                        "q": query,
                        "language": "en",
                        "sortBy": "publishedAt",
                        "pageSize": 20,
                        "apiKey": news_api_key
                    }
                
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(url, params=params)
                    if response.status_code == 200:
                        data = response.json()
                        if data.get("status") == "ok" and data.get("articles"):
                            for item in data["articles"][:20]:
                                # 제목과 설명에 종목명이 정확히 포함되어 있는지 확인
                                title = (item.get("title") or "").lower()
                                description = (item.get("description") or "").lower()
                                content = (item.get("content") or "").lower()
                                full_text = f"{title} {description} {content}"
                                
                                stock_lower = stock_query.lower()
                                
                                # 종목명이 정확히 포함되어 있고, 관련 키워드도 있는지 확인
                                related_keywords = [
                                    "주가", "주식", "기업", "회사", "증권", "투자", "시장",
                                    "상승", "하락", "급등", "급락", "매수", "매도", "목표가",
                                    "실적", "영업", "매출", "이익", "배당", "인수", "합병",
                                    "stock", "shares", "price", "trading", "market", "earnings"
                                ]
                                
                                if stock_lower in full_text:
                                    has_related = any(keyword in full_text for keyword in related_keywords)
                                    if has_related or stock_lower in title:
                                        published_at = None
                                        if item.get("publishedAt"):
                                            try:
                                                published_at = dt.datetime.fromisoformat(
                                                    item["publishedAt"].replace("Z", "+00:00")
                                                )
                                            except Exception:
                                                pass
                                        
                                        articles.append(
                                            NewsArticle(
                                                headline=item.get("title", ""),
                                                headline_ko=item.get("title", "") if is_korean else None,
                                                summary=item.get("description", ""),
                                                summary_ko=item.get("description", "") if is_korean else None,
                                                url=item.get("url", ""),
                                                source=item.get("source", {}).get("name", "NewsAPI"),
                                                published_at=published_at,
                                                symbols=None,
                                                image=item.get("urlToImage"),
                                            )
                                        )
            except Exception as e:
                logger.warning(f"NewsAPI에서 뉴스를 가져오는 중 오류 발생: {e}")
        
        # Google News RSS 피드 사용 (API 키 불필요) - 항상 실행
        try:
            google_queries = set()
            if is_korean:
                google_queries.update(
                    filter(
                        None,
                        [
                            stock_query,
                            f"{stock_query} 주가",
                            f"{stock_query} 주식",
                            f"{stock_query} 실적",
                            f"{stock_query} 전망",
                            f"{stock_query} 공시",
                            f"{stock_query} 뉴스",
                        ],
                    )
                )
                lang = "ko"
                region = "KR"
            else:
                google_queries.update(
                    filter(
                        None,
                        [
                            stock_query,
                            f"{stock_query} stock",
                            f"{stock_query} shares",
                            f"{stock_query} earnings",
                            f"{stock_query} forecast",
                            f"{stock_query} news",
                        ],
                    )
                )
                lang = "en"
                region = "US"
            
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                for query_text in google_queries:
                    query = quote_plus(query_text)
                    google_news_rss = (
                        f"https://news.google.com/rss/search?q={query}&hl={lang}&gl={region}&ceid={region}:{lang}"
                    )
                    logger.info(f"Google News RSS 요청: {google_news_rss}")
                    response = await client.get(
                        google_news_rss,
                        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
                    )
                    logger.info(f"Google News RSS 응답: status={response.status_code}")
                    if response.status_code != 200:
                        continue
        
                    feed = feedparser.parse(response.text)
                    logger.info(f"Google News RSS 파싱: entries={len(feed.entries) if hasattr(feed, 'entries') else 0}")
                    if hasattr(feed, 'entries') and feed.entries:
                        logger.info(f"Google News RSS에서 {len(feed.entries)}개 뉴스 발견 (query={query_text})")
                        for entry in feed.entries[:30]:  # 더 많이 가져와서 필터링
                            published_at = None
                            if hasattr(entry, 'published_parsed') and entry.published_parsed:
                                try:
                                    published_at = dt.datetime(*entry.published_parsed[:6], tzinfo=dt.timezone.utc)
                                except Exception:
                                    pass
                            
                            url = entry.get("link", "")
                            if not url:
                                continue
                            
                            if not any(a.url == url for a in articles):
                                articles.append(
                                    NewsArticle(
                                        headline=entry.get("title", ""),
                                        headline_ko=entry.get("title", "") if is_korean else None,
                                        summary=entry.get("summary", "") or entry.get("description", ""),
                                        summary_ko=(entry.get("summary", "") or entry.get("description", "")) if is_korean else None,
                                        url=url,
                                        source=entry.get("source", {}).get("title", "Google News") if hasattr(entry, 'source') else "Google News",
                                        published_at=published_at,
                                        symbols=None,
                                        image=None,
                                    )
                                )
                                logger.debug(f"Google News 매칭: {entry.get('title', '')[:50]}")
                                if len(articles) >= 30:
                                    break
        except Exception as e:
            logger.warning(f"Google News RSS에서 뉴스를 가져오는 중 오류 발생: {e}")
    
    except Exception as e:
        logger.error(f"외부 뉴스 소스에서 뉴스를 가져오는 중 오류 발생: {e}")
    
    return articles


def _get_finnhub_api_key() -> str:
    api_key = os.getenv("FINNHUB_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Finnhub API 키가 설정되지 않았습니다.")
    return api_key


def _extract_error_message(response: httpx.Response) -> str:
    try:
        data = response.json()
        if isinstance(data, dict):
            return data.get("error") or data.get("detail") or response.text
    except Exception:  # noqa: BLE001
        pass
    return response.text


def _get_alpha_api_key() -> str:
    api_key = os.getenv("ALPHAVANTAGE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Alpha Vantage API 키가 설정되지 않았습니다.")
    return api_key


async def _fetch_alpha_series(symbol: str) -> List[dict]:
    cache_entry = ALPHA_SERIES_CACHE.get(symbol.upper())
    if cache_entry:
        series, cached_at = cache_entry
        if time.time() - cached_at < ALPHA_CACHE_TTL:
            return series

    params = {
        "function": "TIME_SERIES_DAILY_ADJUSTED",
        "symbol": symbol,
        "apikey": _get_alpha_api_key(),
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(ALPHAVANTAGE_URL, params=params)

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Alpha Vantage 호출 실패: {response.text}")

    payload = response.json()
    series_raw = payload.get("Time Series (Daily)")
    if not series_raw:
        note = payload.get("Note") or payload.get("Information")
        error_message = payload.get("Error Message")
        if note:
            status = 429 if "frequency" in note.lower() else 404
            raise HTTPException(status_code=status, detail=note)
        if error_message:
            raise HTTPException(status_code=404, detail=error_message)
        raise HTTPException(status_code=404, detail=f"{symbol.upper()} 데이터가 없습니다.")

    series: List[dict] = []
    for date_str, values in series_raw.items():
        try:
            date = dt.datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=dt.timezone.utc)
        except ValueError:
            continue

        try:
            record = {
                "date": date,
                "open": float(values["1. open"]),
                "high": float(values["2. high"]),
                "low": float(values["3. low"]),
                "close": float(values["4. close"]),
                "adjusted_close": float(values.get("5. adjusted close", values["4. close"])),
                "volume": float(values["6. volume"]),
            }
        except (KeyError, ValueError):
            continue

        series.append(record)

    if not series:
        raise HTTPException(status_code=404, detail=f"{symbol.upper()} 데이터가 충분하지 않습니다.")

    series.sort(key=lambda item: item["date"], reverse=True)
    series = series[:500]
    ALPHA_SERIES_CACHE[symbol.upper()] = (series, time.time())
    return series


def _normalize_symbol(symbol: str, fallback_name: Optional[str] = None) -> Tuple[str, Optional[str]]:
    alias = SYMBOL_ALIAS_MAP.get(symbol.upper())
    if alias:
        provider_symbol, alias_name = alias
        return provider_symbol, alias_name or fallback_name
    return symbol, fallback_name


async def _fetch_quote(symbol: str, name: Optional[str] = None) -> MarketQuote:
    display_symbol = symbol.upper()
    provider_symbol, alias_name = _normalize_symbol(display_symbol, name)
    display_name = alias_name or name

    cache_entry = QUOTE_CACHE.get(provider_symbol.upper())
    if cache_entry:
        cached_quote, cached_at = cache_entry
        if time.time() - cached_at < CACHE_TTL_SECONDS:
            return cached_quote

    try:
        alpha_series = await _fetch_alpha_series(provider_symbol)
        quote = _quote_from_alpha_series(provider_symbol, display_symbol, display_name, alpha_series)
        QUOTE_CACHE[provider_symbol.upper()] = (quote, time.time())
        return quote
    except HTTPException as exc:
        if exc.status_code not in (404, 429):
            raise
        try:
            quote = await asyncio.to_thread(
                _fallback_quote_yfinance, provider_symbol, display_symbol, display_name
            )
            QUOTE_CACHE[provider_symbol.upper()] = (quote, time.time())
            return quote
        except HTTPException:
            raise
        except Exception as fallback_exc:  # noqa: BLE001
            if cache_entry:
                return cache_entry[0]
            raise HTTPException(status_code=exc.status_code, detail=str(fallback_exc)) from fallback_exc


def _quote_from_alpha_series(
    provider_symbol: str, display_symbol: str, display_name: Optional[str], series: List[dict]
) -> MarketQuote:
    latest = series[0]
    prev = series[1] if len(series) > 1 else latest

    current = latest["close"]
    prev_close = prev["close"]

    if prev_close:
        change = current - prev_close
        percent = (change / prev_close) * 100 if prev_close != 0 else 0.0
    else:
        change = 0.0
        percent = 0.0

    return MarketQuote(
        symbol=display_symbol,
        name=display_name or display_symbol,
        current=current,
        change=change,
        percent=percent,
        high=latest["high"],
        low=latest["low"],
        open=latest["open"],
        previous_close=prev_close,
        timestamp=latest["date"],
    )


def _candles_from_series(
    display_symbol: str, series: List[dict], range_days: int, resolution: str = "D"
) -> CandleResponse:
    lookback = max(range_days, 1)
    subset = series[:lookback]
    ordered = list(reversed(subset))

    return CandleResponse(
        symbol=display_symbol,
        resolution=resolution,
        data=CandleSeries(
            timestamps=[int(record["date"].timestamp()) for record in ordered],
            opens=[record["open"] for record in ordered],
            highs=[record["high"] for record in ordered],
            lows=[record["low"] for record in ordered],
            closes=[record["close"] for record in ordered],
            volumes=[record["volume"] for record in ordered],
        ),
    )


async def _refresh_symbol(symbol: str, name: Optional[str] = None) -> Optional[Dict[str, object]]:
    display_symbol = symbol.upper()
    provider_symbol, alias_name = _normalize_symbol(display_symbol, name)
    label = alias_name or name

    try:
        series = await _fetch_alpha_series(provider_symbol)
        quote = _quote_from_alpha_series(provider_symbol, display_symbol, label, series)
    except HTTPException as exc:
        if exc.status_code not in (404, 429):
            logger.warning("Alpha Vantage 업데이트 실패 (%s): %s", display_symbol, exc.detail)
            return None
        logger.info("Alpha Vantage 제한으로 yfinance 사용 (%s)", display_symbol)
        try:
            quote = await asyncio.to_thread(
                _fallback_quote_yfinance, provider_symbol, display_symbol, label
            )
            series, candles = await asyncio.to_thread(
                _fallback_candles_yfinance, provider_symbol, display_symbol, "D", 60
            )
        except HTTPException as fallback_exc:
            logger.warning("yfinance 업데이트 실패 (%s): %s", display_symbol, fallback_exc.detail)
            return None
    else:
        candles = _candles_from_series(display_symbol, series, 60)
    CANDLE_CACHE[(provider_symbol.upper(), "D", 60)] = (candles, time.time())
    return {
        "quote": quote,
        "series": series,
        "updated_at": dt.datetime.utcnow(),
    }


async def _ensure_symbol_cached(symbol: str, name: Optional[str] = None) -> None:
    display_symbol = symbol.upper()
    async with MARKET_CACHE_LOCK:
        entry = MARKET_CACHE.get(display_symbol)
        if entry:
            updated_at: dt.datetime = entry["updated_at"]  # type: ignore[assignment]
            if (dt.datetime.utcnow() - updated_at).total_seconds() < CACHE_TTL_SECONDS:
                return

    refreshed = await _refresh_symbol(symbol, name)
    if refreshed:
        async with MARKET_CACHE_LOCK:
            MARKET_CACHE[display_symbol] = refreshed


async def _refresh_market_cache_once() -> None:
    for symbol, name in MARKET_OVERVIEW_SYMBOLS:
        refreshed = await _refresh_symbol(symbol, name)
        if refreshed:
            async with MARKET_CACHE_LOCK:
                MARKET_CACHE[symbol.upper()] = refreshed
        await asyncio.sleep(15)


async def _refresh_news_category(category: str) -> Optional[List[NewsArticle]]:
    try:
        articles = await _fetch_finnhub_news(category)
    except HTTPException as exc:
        logger.warning("뉴스 갱신 실패(%s): %s", category, exc.detail)
        return None

    async with NEWS_CACHE_LOCK:
        NEWS_CACHE[category.lower()] = (articles, time.time())
    return articles


async def _refresh_news_cache_once() -> None:
    for category in NEWS_CATEGORIES:
        await _refresh_news_category(category)


async def _market_refresh_loop() -> None:
    while True:
        try:
            await _refresh_market_cache_once()
        except Exception as exc:  # noqa: BLE001
            logger.exception("시장 데이터 갱신 루프 오류: %s", exc)
        await asyncio.sleep(MARKET_REFRESH_INTERVAL)


async def _news_refresh_loop() -> None:
    while True:
        try:
            await _refresh_news_cache_once()
        except Exception as exc:  # noqa: BLE001
            logger.exception("뉴스 데이터 갱신 루프 오류: %s", exc)
        await asyncio.sleep(NEWS_REFRESH_INTERVAL)


async def _ensure_news_cached(category: str) -> None:
    key = category.lower()
    async with NEWS_CACHE_LOCK:
        entry = NEWS_CACHE.get(key)
        if entry and time.time() - entry[1] < NEWS_REFRESH_INTERVAL:
            return
    await _refresh_news_category(category)


@app.get("/api/market/overview", response_model=List[MarketQuote])
async def market_overview() -> List[MarketQuote]:
    async with MARKET_CACHE_LOCK:
        results = []
        missing: List[Tuple[str, str]] = []
        for symbol, name in MARKET_OVERVIEW_SYMBOLS:
            entry = MARKET_CACHE.get(symbol.upper())
            if entry:
                results.append(entry["quote"])  # type: ignore[index]
            else:
                missing.append((symbol, name))

    for symbol, name in missing:
        asyncio.create_task(_refresh_symbol(symbol, name))

    if not results:
        raise HTTPException(status_code=503, detail="시장 데이터가 준비되지 않았습니다. 잠시 후 다시 시도해주세요.")
    return results


@app.get("/api/market/quote", response_model=MarketQuote)
async def market_quote(symbol: str = Query(..., description="조회할 종목 티커")) -> MarketQuote:
    # 한국 주식인지 확인
    is_korean_stock = symbol.isdigit() and len(symbol) == 6
    
    if is_korean_stock:
        try:
            return await _fetch_korean_stock_quote(symbol)
        except Exception as e:
            logger.warning(f"한국 주식 시세 가져오기 실패: {e}, 미국 주식 API로 폴백")
    
    await _ensure_symbol_cached(symbol)

    async with MARKET_CACHE_LOCK:
        entry = MARKET_CACHE.get(symbol.upper())

    if not entry:
        raise HTTPException(status_code=404, detail=f"{symbol.upper()} 데이터가 준비되지 않았습니다.")

    return entry["quote"]  # type: ignore[index]


async def _fetch_korean_stock_quote(symbol: str) -> MarketQuote:
    """
    한국 주식 시세를 가져옵니다.
    FinanceDataReader를 사용합니다.
    """
    try:
        # 종목 코드 정리 (005930.KS -> 005930)
        target_symbol = symbol.split('.')[0]
        
        # 최근 7일 데이터 조회 (전일 종가 계산을 위해)
        end_date = dt.datetime.now()
        start_date = end_date - dt.timedelta(days=7)
        
        # FinanceDataReader는 동기 함수이므로 실행
        # 비동기 환경에서 블로킹을 피하기 위해 run_in_executor 사용 권장되지만,
        # 여기서는 간단히 직접 호출 (부하가 크지 않다고 가정)
        df = fdr.DataReader(target_symbol, start=start_date, end=end_date)
        
        if df is None or df.empty:
            raise HTTPException(status_code=404, detail=f"{symbol} 데이터를 찾을 수 없습니다.")
            
        last = df.iloc[-1]
        prev = df.iloc[-2] if len(df) > 1 else last
        
        prev_close = float(prev["Close"]) if not pd.isna(prev["Close"]) else None
        current = float(last["Close"])
        
        if prev_close and prev_close != 0:
            change = current - prev_close
            percent = (change / prev_close) * 100
        else:
            change = 0.0
            percent = 0.0
            
        timestamp = df.index[-1]
        if isinstance(timestamp, pd.Timestamp):
            timestamp = timestamp.to_pydatetime()
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=dt.timezone.utc)
            
        return MarketQuote(
            symbol=symbol,
            name=symbol, # 이름은 별도 매핑이나 API 필요, 일단 심볼로 대체
            current=current,
            change=change,
            percent=percent,
            high=float(last["High"]) if not pd.isna(last["High"]) else None,
            low=float(last["Low"]) if not pd.isna(last["Low"]) else None,
            open=float(last["Open"]) if not pd.isna(last["Open"]) else None,
            previous_close=prev_close,
            timestamp=timestamp,
        )
    except Exception as e:
        logger.error(f"한국 주식 시세 가져오기 오류: {e}")
        raise HTTPException(status_code=500, detail=f"한국 주식 시세 가져오기 실패: {str(e)}")


# 주요 한국 주식 종목명-심볼 매핑
KOREAN_STOCKS = {
    "삼성전자": "005930",
    "SK하이닉스": "000660",
    "NAVER": "035420",
    "카카오": "035720",
    "LG전자": "066570",
    "현대차": "005380",
    "기아": "000270",
    "POSCO홀딩스": "005490",
    "셀트리온": "068270",
    "KB금융": "105560",
    "신한지주": "055550",
    "하나금융지주": "086790",
    "LG화학": "051910",
    "아모레퍼시픽": "090430",
    "삼성SDI": "006400",
    "한화솔루션": "009830",
    "LG생활건강": "051900",
    "롯데케미칼": "011170",
    "한화": "000880",
    "두산에너빌": "034020",
}

@app.get("/api/market/search", response_model=List[SymbolSearchResult])
async def market_search(query: str = Query(..., min_length=1, description="심볼 또는 종목명 검색어")) -> List[SymbolSearchResult]:
    results = []
    
    # 한국 주식 검색 (6자리 숫자)
    if query.isdigit() and len(query) == 6:
        results.append(SymbolSearchResult(
            symbol=query,
            description=query,
            type="EQUITY",
            exchange="KRX",
        ))
        return results
    
    # 한국 주식 종목명 검색 (항상 실행)
    query_normalized = query.strip()
    
    # KOREAN_STOCKS 딕셔너리 직접 검색
    for name, symbol in KOREAN_STOCKS.items():
        # 정확한 일치 또는 부분 일치
        try:
            if query_normalized in name or name in query_normalized:
                # 중복 체크
                if not any(r.symbol == symbol for r in results):
                    results.append(SymbolSearchResult(
                        symbol=symbol,
                        description=name,
                        type="EQUITY",
                        exchange="KRX",
                    ))
        except Exception:
            continue
    
    # 한국 주식 검색 결과가 있으면 즉시 반환
    if results:
        return results[:15]
    
    # Finnhub API 사용 (API 키가 있는 경우)
    try:
        api_key = os.getenv("FINNHUB_API_KEY")
        if api_key:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(FINNHUB_SEARCH_URL, params={"q": query, "token": api_key})
            
            if response.status_code == 200:
                payload = response.json()
                finnhub_results = payload.get("result") or []
                
                formatted = [
                    SymbolSearchResult(
                        symbol=item.get("symbol", "").upper(),
                        description=item.get("description", "").strip(),
                        type=item.get("type"),
                        exchange=item.get("exchange"),
                    )
                    for item in finnhub_results
                    if item.get("symbol")
                ]
                results.extend(formatted)
    except Exception as e:
        logger.warning(f"Finnhub 검색 실패: {e}")
    
    # yfinance를 사용한 기본 검색 (미국 주식)
    if not results:
        try:
            # 일반적인 주식 심볼 검색
            ticker = yf.Ticker(query.upper())
            info = ticker.info
            # 실제로 존재하는 종목인지 확인 (info가 있고 symbol이 있는 경우)
            if info and info.get("symbol") and info.get("symbol") != "N/A":
                # 실제 데이터가 있는지 확인 (최소한의 정보가 있어야 함)
                if info.get("longName") or info.get("shortName") or info.get("name"):
                    results.append(SymbolSearchResult(
                        symbol=info.get("symbol", query.upper()),
                        description=info.get("longName") or info.get("shortName") or info.get("name") or query,
                        type="EQUITY",
                        exchange=info.get("exchange", "NASDAQ"),
                    ))
        except Exception as e:
            logger.warning(f"yfinance 검색 실패: {e}")
    
    # 검색 결과 반환 (검증은 이미 수행됨)
    # 한국 주식은 이미 검증되었고, 미국 주식도 검증되었으므로 그대로 반환
    logger.info(f"최종 검색 결과: {len(results)}개")
    return results[:15]


# 기술적 지표 계산 함수들
def calculate_rsi(prices: pd.Series, period: int = 14) -> pd.Series:
    """RSI (Relative Strength Index) 계산"""
    delta = prices.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    return rsi


def calculate_macd(prices: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> Dict[str, pd.Series]:
    """MACD 계산"""
    ema_fast = prices.ewm(span=fast, adjust=False).mean()
    ema_slow = prices.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    return {
        "macd": macd_line,
        "signal": signal_line,
        "histogram": histogram
    }


def calculate_bollinger_bands(prices: pd.Series, period: int = 20, std_dev: int = 2) -> Dict[str, pd.Series]:
    """볼린저 밴드 계산"""
    sma = prices.rolling(window=period).mean()
    std = prices.rolling(window=period).std()
    upper_band = sma + (std * std_dev)
    lower_band = sma - (std * std_dev)
    return {
        "middle": sma,
        "upper": upper_band,
        "lower": lower_band
    }


def calculate_moving_averages(prices: pd.Series) -> Dict[str, pd.Series]:
    """이동평균선 계산"""
    return {
        "ma5": prices.rolling(window=5).mean(),
        "ma20": prices.rolling(window=20).mean(),
        "ma60": prices.rolling(window=60).mean(),
        "ma120": prices.rolling(window=120).mean()
    }


def detect_support_resistance(highs: pd.Series, lows: pd.Series, closes: pd.Series, window: int = 20) -> Tuple[List[SupportResistance], List[SupportResistance]]:
    """지지선과 저항선 탐지 (개선된 버전)"""
    supports = []
    resistances = []
    
    # 피벗 포인트 기반 지지/저항선 탐지
    pivot_window = max(window // 2, 5)  # 피벗 포인트 윈도우
    
    # 지지선 탐지 (로컬 최저점)
    for i in range(pivot_window, len(lows) - pivot_window):
        # 피벗 로우 (양쪽 모두보다 낮은 점)
        if lows.iloc[i] == lows.iloc[i-pivot_window:i+pivot_window+1].min():
            level = float(lows.iloc[i])
            
            # 주변 가격대에서 같은 레벨 근처의 터치 횟수 계산 (강도)
            lookback = min(50, i)  # 최대 50일 전까지 확인
            nearby_touches = 0
            total_candles = 0
            
            for j in range(max(0, i - lookback), min(len(lows), i + 10)):
                total_candles += 1
                # ±3% 범위 내에서 터치 확인
                if abs(lows.iloc[j] - level) / level <= 0.03:
                    nearby_touches += 1
            
            strength = nearby_touches / total_candles if total_candles > 0 else 0
            
            # 최소 강도 0.2 이상인 것만 유지 (더 신뢰성 있는 지지선)
            if strength >= 0.2:
                supports.append(SupportResistance(
                    level=level,
                    strength=min(strength, 1.0),
                    type="support"
                ))
    
    # 저항선 탐지 (로컬 최고점)
    for i in range(pivot_window, len(highs) - pivot_window):
        # 피벗 하이 (양쪽 모두보다 높은 점)
        if highs.iloc[i] == highs.iloc[i-pivot_window:i+pivot_window+1].max():
            level = float(highs.iloc[i])
            
            # 주변 가격대에서 같은 레벨 근처의 터치 횟수 계산 (강도)
            lookback = min(50, i)
            nearby_touches = 0
            total_candles = 0
            
            for j in range(max(0, i - lookback), min(len(highs), i + 10)):
                total_candles += 1
                # ±3% 범위 내에서 터치 확인
                if abs(highs.iloc[j] - level) / level <= 0.03:
                    nearby_touches += 1
            
            strength = nearby_touches / total_candles if total_candles > 0 else 0
            
            # 최소 강도 0.2 이상인 것만 유지
            if strength >= 0.2:
                resistances.append(SupportResistance(
                    level=level,
                    strength=min(strength, 1.0),
                    type="resistance"
                ))
    
    def deduplicate_levels(level_items: List[SupportResistance], reverse: bool = False) -> List[SupportResistance]:
        unique_by_level: Dict[float, SupportResistance] = {}
        for item in level_items:
            # 같은 가격대(±2%)는 하나로 묶고, 강도가 더 높은 항목을 유지
            price_range = item.level * 0.02  # ±2%
            key = round(item.level / price_range) * price_range
            existing = unique_by_level.get(key)
            if existing is None or item.strength > existing.strength:
                unique_by_level[key] = item
        # 강도 순으로 정렬 후 상위 5개만 반환
        return sorted(unique_by_level.values(), key=lambda x: x.strength, reverse=True)[:5]
    
    supports = deduplicate_levels(supports, reverse=True)
    resistances = deduplicate_levels(resistances, reverse=False)
    
    return supports, resistances


def detect_trend_lines(timestamps: List[int], prices: pd.Series, window: int = 20) -> List[TrendLine]:
    """추세선 탐지"""
    trend_lines = []
    
    if len(prices) < window * 2:
        return trend_lines
    
    # 최근 데이터로 추세 분석
    recent_prices = prices.iloc[-window:]
    recent_timestamps = timestamps[-window:]
    
    # 선형 회귀로 추세 계산
    x = np.arange(len(recent_prices))
    y = recent_prices.values
    coeffs = np.polyfit(x, y, 1)
    slope = coeffs[0]
    
    start_price = float(recent_prices.iloc[0])
    end_price = float(recent_prices.iloc[-1])
    
    if slope > 0:
        trend_type = "uptrend"
    elif slope < 0:
        trend_type = "downtrend"
    else:
        trend_type = "sideways"
    
    trend_lines.append(TrendLine(
        start_price=start_price,
        end_price=end_price,
        start_time=recent_timestamps[0],
        end_time=recent_timestamps[-1],
        type=trend_type
    ))
    
    return trend_lines


def detect_patterns(highs: pd.Series, lows: pd.Series, closes: pd.Series) -> List[Pattern]:
    """차트 패턴 탐지"""
    patterns = []
    
    if len(closes) < 20:
        return patterns
    
    recent_closes = closes.iloc[-20:]
    recent_highs = highs.iloc[-20:]
    recent_lows = lows.iloc[-20:]
    
    # 헤드앤숄더 패턴 (간단한 버전)
    if len(recent_highs) >= 5:
        peaks = []
        for i in range(2, len(recent_highs) - 2):
            if recent_highs.iloc[i] > recent_highs.iloc[i-1] and recent_highs.iloc[i] > recent_highs.iloc[i+1]:
                peaks.append((i, recent_highs.iloc[i]))
        
        if len(peaks) >= 3:
            # 헤드앤숄더 패턴 확인
            peaks_sorted = sorted(peaks, key=lambda x: x[1], reverse=True)
            if peaks_sorted[0][1] > peaks_sorted[1][1] and peaks_sorted[0][1] > peaks_sorted[2][1]:
                patterns.append(Pattern(
                    name="헤드앤숄더",
                    confidence=0.6,
                    description="하락 반전 패턴이 감지되었습니다.",
                    signal="bearish"
                ))
    
    # 삼각형 패턴
    if len(recent_highs) >= 10:
        high_trend = np.polyfit(range(len(recent_highs)), recent_highs.values, 1)[0]
        low_trend = np.polyfit(range(len(recent_lows)), recent_lows.values, 1)[0]
        
        if high_trend < 0 and low_trend > 0:
            patterns.append(Pattern(
                name="수렴 삼각형",
                confidence=0.5,
                description="가격이 수렴하고 있으며 곧 방향성이 결정될 수 있습니다.",
                signal="neutral"
            ))
    
    return patterns


def generate_trading_signal(
    rsi: float,
    macd: Dict,
    closes: pd.Series,
    supports: List[SupportResistance],
    resistances: List[SupportResistance],
    patterns: List[Pattern]
) -> TradingSignal:
    """매매 신호 생성"""
    current_price = float(closes.iloc[-1])
    signals = []
    confidence_sum = 0
    
    # RSI 신호
    if rsi < 30:
        signals.append(("buy", 0.3, "RSI가 과매도 구간입니다."))
    elif rsi > 70:
        signals.append(("sell", 0.3, "RSI가 과매수 구간입니다."))
    
    # MACD 신호
    if macd["macd"].iloc[-1] > macd["signal"].iloc[-1] and macd["histogram"].iloc[-1] > 0:
        signals.append(("buy", 0.25, "MACD가 상승 신호를 보입니다."))
    elif macd["macd"].iloc[-1] < macd["signal"].iloc[-1] and macd["histogram"].iloc[-1] < 0:
        signals.append(("sell", 0.25, "MACD가 하락 신호를 보입니다."))
    
    # 지지/저항선 신호
    if supports:
        nearest_support = max([s.level for s in supports if s.level < current_price], default=None)
        if nearest_support and current_price <= nearest_support * 1.02:
            signals.append(("buy", 0.2, f"지지선 근처에서 매수 기회입니다."))
    
    if resistances:
        nearest_resistance = min([r.level for r in resistances if r.level > current_price], default=None)
        if nearest_resistance and current_price >= nearest_resistance * 0.98:
            signals.append(("sell", 0.2, f"저항선 근처에서 매도 기회입니다."))
    
    # 패턴 신호
    for pattern in patterns:
        if pattern.signal == "bullish":
            signals.append(("buy", pattern.confidence * 0.15, pattern.description))
        elif pattern.signal == "bearish":
            signals.append(("sell", pattern.confidence * 0.15, pattern.description))
    
    # 신호 집계
    buy_score = sum([conf for sig, conf, _ in signals if sig == "buy"])
    sell_score = sum([conf for sig, conf, _ in signals if sig == "sell"])
    
    if buy_score > sell_score and buy_score > 0.3:
        signal_type = "buy"
        confidence = min(buy_score, 1.0)
        target_price = current_price * 1.1 if resistances else current_price * 1.05
        stop_loss = current_price * 0.95
    elif sell_score > buy_score and sell_score > 0.3:
        signal_type = "sell"
        confidence = min(sell_score, 1.0)
        target_price = current_price * 0.9 if supports else current_price * 0.95
        stop_loss = current_price * 1.05
    else:
        signal_type = "hold"
        confidence = 0.5
        target_price = None
        stop_loss = None
    
    reason = " | ".join([desc for sig, _, desc in signals if sig == signal_type]) or "현재 추세 유지"
    
    return TradingSignal(
        type=signal_type,
        confidence=confidence,
        entry_price=current_price if signal_type != "hold" else None,
        target_price=target_price,
        stop_loss=stop_loss,
        reason=reason
    )


@app.post("/api/chart/analyze", response_model=ChartAnalysisResponse)
async def analyze_chart_data(payload: ChartAnalysisRequest) -> ChartAnalysisResponse:
    """차트 데이터를 분석하여 기술적 지표, 패턴, 신호 등을 제공"""
    try:
        # 캔들 데이터 가져오기
        is_korean_stock = payload.symbol.isdigit() and len(payload.symbol) == 6
        
        if is_korean_stock:
            candle_response = await _fetch_korean_stock_candles(payload.symbol, payload.resolution, payload.range_days)
        else:
            # 미국 주식은 market_candles 엔드포인트와 동일한 로직 사용
            candle_response = await market_candles(
                symbol=payload.symbol,
                resolution=payload.resolution,
                range_days=payload.range_days
            )
        
        if not candle_response.data.timestamps:
            raise HTTPException(status_code=404, detail="차트 데이터를 찾을 수 없습니다.")
        
        # DataFrame 생성
        df = pd.DataFrame({
            "timestamp": candle_response.data.timestamps,
            "open": candle_response.data.opens,
            "high": candle_response.data.highs,
            "low": candle_response.data.lows,
            "close": candle_response.data.closes,
            "volume": candle_response.data.volumes
        })
        
        df["date"] = pd.to_datetime(df["timestamp"], unit="s")
        df = df.set_index("date")
        
        closes = df["close"]
        highs = df["high"]
        lows = df["low"]
        volumes = df["volume"]
        
        # 기술적 지표 계산
        rsi = calculate_rsi(closes)
        rsi_current = float(rsi.iloc[-1]) if not pd.isna(rsi.iloc[-1]) else 50.0
        
        macd = calculate_macd(closes)
        macd_current = float(macd["macd"].iloc[-1]) if not pd.isna(macd["macd"].iloc[-1]) else 0.0
        
        bb = calculate_bollinger_bands(closes)
        bb_current = {
            "upper": float(bb["upper"].iloc[-1]) if not pd.isna(bb["upper"].iloc[-1]) else closes.iloc[-1] * 1.1,
            "middle": float(bb["middle"].iloc[-1]) if not pd.isna(bb["middle"].iloc[-1]) else closes.iloc[-1],
            "lower": float(bb["lower"].iloc[-1]) if not pd.isna(bb["lower"].iloc[-1]) else closes.iloc[-1] * 0.9
        }
        
        mas = calculate_moving_averages(closes)
        
        # 기술적 지표 신호 판단
        rsi_signal = "oversold" if rsi_current < 30 else "overbought" if rsi_current > 70 else "neutral"
        rsi_desc = f"RSI: {rsi_current:.2f} - {'과매도' if rsi_signal == 'oversold' else '과매수' if rsi_signal == 'overbought' else '중립'}"
        
        macd_signal = "buy" if macd["macd"].iloc[-1] > macd["signal"].iloc[-1] else "sell" if macd["macd"].iloc[-1] < macd["signal"].iloc[-1] else "neutral"
        macd_desc = f"MACD: {macd_current:.2f} - {'상승 신호' if macd_signal == 'buy' else '하락 신호' if macd_signal == 'sell' else '중립'}"
        
        bb_signal = "overbought" if closes.iloc[-1] > bb_current["upper"] else "oversold" if closes.iloc[-1] < bb_current["lower"] else "neutral"
        bb_desc = f"볼린저 밴드: 현재가가 {'상단' if bb_signal == 'overbought' else '하단' if bb_signal == 'oversold' else '중간'} 밴드에 위치"
        
        technical_indicators = [
            TechnicalIndicator(name="RSI", value=rsi_current, signal=rsi_signal, description=rsi_desc),
            TechnicalIndicator(name="MACD", value=macd_current, signal=macd_signal, description=macd_desc),
            TechnicalIndicator(name="Bollinger Bands", value=closes.iloc[-1], signal=bb_signal, description=bb_desc),
        ]
        
        # 지지/저항선 탐지
        supports, resistances = detect_support_resistance(highs, lows, closes)
        all_sr = supports + resistances
        
        # 추세선 탐지
        trend_lines = detect_trend_lines(candle_response.data.timestamps, closes)
        
        # 패턴 탐지
        patterns = detect_patterns(highs, lows, closes)
        
        # 매매 신호 생성
        trading_signal = generate_trading_signal(rsi_current, macd, closes, supports, resistances, patterns)
        
        # 리스크 분석
        volatility = float(closes.pct_change().std() * np.sqrt(252))  # 연간 변동성
        risk_level = "high" if volatility > 0.3 else "medium" if volatility > 0.2 else "low"
        
        risk_analysis = {
            "volatility": round(volatility * 100, 2),
            "risk_level": risk_level,
            "current_price": float(closes.iloc[-1]),
            "price_range_52w": {
                "high": float(highs.max()),
                "low": float(lows.min())
            }
        }
        
        # 요약 생성
        summary_parts = []
        summary_parts.append(f"현재가: {closes.iloc[-1]:.2f}")
        summary_parts.append(f"RSI: {rsi_current:.1f} ({rsi_signal})")
        summary_parts.append(f"추세: {trend_lines[0].type if trend_lines else '불명확'}")
        summary_parts.append(f"매매 신호: {trading_signal.type.upper()} (신뢰도: {trading_signal.confidence*100:.0f}%)")
        if patterns:
            summary_parts.append(f"패턴: {', '.join([p.name for p in patterns])}")
        
        summary = " | ".join(summary_parts)
        
        return ChartAnalysisResponse(
            symbol=payload.symbol,
            technical_indicators=technical_indicators,
            support_resistance=all_sr,
            trend_lines=trend_lines,
            patterns=patterns,
            trading_signal=trading_signal,
            risk_analysis=risk_analysis,
            summary=summary
        )
        
    except Exception as e:
        logger.error(f"차트 분석 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"차트 분석 실패: {str(e)}")


@app.get("/api/technical-indicators/test-additional")
async def test_additional_indicators(symbol: str = Query(..., description="종목 심볼")):
    """
    추가 기술적 지표 신뢰도 테스트 실행 (RSI, MACD, 볼린저 밴드, 리스크)
    """
    try:
        script_path = os.path.join(os.path.dirname(__file__), "tests", "test_additional_indicators.py")
        # 스크립트 실행 시 backend 디렉토리를 작업 디렉토리로 설정
        backend_dir = os.path.dirname(__file__)
        env = os.environ.copy()
        env['PYTHONIOENCODING'] = 'utf-8'
        result = subprocess.run(
            [sys.executable, script_path, "--symbol", symbol, "--format", "text"],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            timeout=180,
            env=env,
            cwd=backend_dir  # 작업 디렉토리를 backend로 설정
        )
        
        if result.returncode != 0:
            return {
                "success": False,
                "error": result.stderr or "테스트 실행 실패",
                "report": result.stdout
            }
        
        return {
            "success": True,
            "format": "text",
            "report": result.stdout
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": "테스트 실행 시간 초과 (3분 이상 소요)"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/api/technical-indicators/test")
async def test_technical_indicators(symbol: str = Query(..., description="종목 심볼")):
    """
    기술적 지표 신뢰도 테스트 실행
    """
    try:
        # test_technical_indicators.py 스크립트 실행
        script_path = os.path.join(os.path.dirname(__file__), "tests", "test_technical_indicators.py")
        
        # Python 스크립트를 실행하여 결과 가져오기
        # Windows에서 UTF-8 인코딩 강제
        env = os.environ.copy()
        env['PYTHONIOENCODING'] = 'utf-8'
        
        # 스크립트 실행 시 backend 디렉토리를 작업 디렉토리로 설정
        backend_dir = os.path.dirname(__file__)
        result = subprocess.run(
            [sys.executable, script_path, "--symbol", symbol, "--format", "text"],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',  # 인코딩 오류 시 대체 문자 사용
            timeout=180,  # 3분 타임아웃
            env=env,
            cwd=backend_dir  # 작업 디렉토리를 backend로 설정
        )
        
        if result.returncode != 0:
            return {
                "success": False,
                "error": result.stderr or "테스트 실행 실패",
                "output": result.stdout
            }
        
        # 텍스트 리포트 반환
        return {
            "success": True,
            "format": "text",
            "report": result.stdout
        }
            
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": "테스트 실행 시간이 초과되었습니다. (최대 3분)"
        }
    except Exception as e:
        logger.error(f"기술적 지표 테스트 오류: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e)
        }


@app.get("/api/market/orderbook")
async def get_orderbook(symbol: str):
    """
    네이버 금융에서 호가 데이터 스크래핑 (실시간 근접)
    """
    try:
        # Run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        data = await loop.run_in_executor(None, _fetch_naver_orderbook, symbol)
        return data
    except Exception as e:
        logger.error(f"Failed to fetch orderbook for {symbol}: {e}")
        raise HTTPException(status_code=500, detail="호가 데이터를 불러오는데 실패했습니다.")

def _fetch_naver_orderbook(symbol: str) -> Dict:
    url = f"https://finance.naver.com/item/sise.naver?code={symbol}"
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    try:
        # pandas read_html uses urllib/requests internally
        # We use requests to get text first to ensure headers are passed if needed, 
        # but pd.read_html can take a URL directly too. 
        # Using requests explicitly is safer for headers.
        response = requests.get(url, headers=headers)
        dfs = pd.read_html(response.text)
        
        if len(dfs) < 4:
            raise ValueError("Orderbook table not found")
            
        df = dfs[3] # Table 3 is usually the orderbook
        
        asks = []
        bids = []
        
        # Asks: Rows 1-5 (indices 1-5)
        # Column 1: Price, Column 0: Volume
        for i in range(1, 6):
            try:
                price = df.iloc[i, 1]
                volume = df.iloc[i, 0]
                if pd.notna(price) and pd.notna(volume):
                    asks.append({
                        "price": int(price),
                        "volume": int(volume),
                        "type": "ask"
                    })
            except:
                pass
                
        # Bids: Rows 8-12 (indices 8-12)
        # Column 3: Price, Column 4: Volume
        for i in range(8, 13):
            try:
                price = df.iloc[i, 3]
                volume = df.iloc[i, 4]
                if pd.notna(price) and pd.notna(volume):
                    bids.append({
                        "price": int(price),
                        "volume": int(volume),
                        "type": "bid"
                    })
            except:
                pass
        
        # Sort asks descending (highest price first - standard for display stack)
        # But for the list, we usually want lowest ask first? 
        # The table has 95300 -> 94900 (descending).
        # Usually orderbook displays:
        # Asks (High -> Low)
        # Bids (High -> Low)
        # So the table order is already correct for visual stacking.
        
        return {
            "symbol": symbol,
            "asks": asks, # 95300, 95200, ...
            "bids": bids  # 94800, 94700, ...
        }
        
    except Exception as e:
        logger.error(f"Error parsing orderbook: {e}")
        raise e

@app.get("/api/market/candles", response_model=CandleResponse)
async def market_candles(
    symbol: str = Query(..., description="조회할 종목 티커"),
    resolution: str = Query("15", description="Finnhub 캔들 해상도 (1,5,15,30,60,240,D,W,M)"),
    range_days: int = Query(5, ge=1, le=5000, description="조회 기간(일)"),
) -> CandleResponse:
    # 한국 주식인지 확인 (6자리 숫자로 시작)
    is_korean_stock = symbol.isdigit() and len(symbol) == 6
    
    if is_korean_stock:
        # 한국 주식 데이터 가져오기
        try:
            return await _fetch_korean_stock_candles(symbol, resolution, range_days)
        except HTTPException:
            # HTTPException은 그대로 전달
            raise
        except Exception as e:
            logger.error(f"한국 주식 데이터 가져오기 실패: {e}")
            # 한국 주식 검색 실패 시 일봉으로 폴백 시도
            try:
                return await _fetch_korean_stock_candles(symbol, "D", range_days)
            except Exception as e2:
                logger.error(f"한국 주식 일봉 데이터 가져오기 실패: {e2}")
                raise HTTPException(status_code=500, detail=f"한국 주식 데이터를 가져올 수 없습니다: {str(e)}")
    
    # 미국 주식인 경우
    # yfinance를 사용하여 분봉 데이터 가져오기 시도
    try:
        ticker = yf.Ticker(symbol.upper())
        
        # 해상도 매핑
        period_map = {
            "1": "1d", "5": "1d", "15": "5d", "30": "5d",
            "60": "1mo", "120": "3mo", "240": "6mo",
            "D": _period_from_days(range_days), "W": "1y", "M": "2y"
        }
        period = period_map.get(resolution, "1mo")
        
        interval_map = {
            "1": "1m", "5": "5m", "15": "15m", "30": "30m",
            "60": "1h", "120": "2h", "240": "4h", 
            "D": "1d", "W": "1wk", "M": "1mo"
        }
        interval = interval_map.get(resolution, "1d")
        
        hist = ticker.history(period=period, interval=interval)
        
        if hist.empty:
            # 일봉으로 폴백
            hist = ticker.history(period=_period_from_days(range_days), interval="1d")
        
        if hist.empty:
            raise HTTPException(status_code=404, detail=f"{symbol.upper()} 데이터를 찾을 수 없습니다.")
        
        # 데이터 변환
        timestamps = []
        opens = []
        highs = []
        lows = []
        closes = []
        volumes = []
        
        for idx, row in hist.iterrows():
            ts = idx
            if isinstance(ts, pd.Timestamp):
                ts = ts.to_pydatetime()
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=dt.timezone.utc)
            
            timestamps.append(int(ts.timestamp()))
            opens.append(float(row["Open"]))
            highs.append(float(row["High"]))
            lows.append(float(row["Low"]))
            closes.append(float(row["Close"]))
            volumes.append(float(row["Volume"]))
        
        return CandleResponse(
            symbol=symbol.upper(),
            resolution=resolution,
            data=CandleSeries(
                timestamps=timestamps,
                opens=opens,
                highs=highs,
                lows=lows,
                closes=closes,
                volumes=volumes,
            ),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"미국 주식 데이터 가져오기 실패: {e}")
        raise HTTPException(status_code=500, detail=f"차트 데이터를 가져올 수 없습니다: {str(e)}")


async def _fetch_korean_stock_candles(symbol: str, resolution: str, range_days: int) -> CandleResponse:
    """
    한국 주식 차트 데이터를 가져옵니다.
    FinanceDataReader를 사용합니다.
    """
    try:
        # 종목 코드 정리 (005930.KS -> 005930)
        target_symbol = symbol.split('.')[0]
        
        # 기간 설정
        end_date = dt.datetime.now()
        # start_date를 0시 0분 0초로 설정하여 해당 일자의 데이터를 포함하도록 함
        # range_days가 작을 경우(예: 1일), 주말이나 휴일을 고려하여 최소 7일 데이터를 가져옴
        days_to_subtract = max(range_days, 7)
        start_date = (end_date - dt.timedelta(days=days_to_subtract)).replace(hour=0, minute=0, second=0, microsecond=0)
        
        # FinanceDataReader 데이터 조회
        # 일봉 데이터만 제공됨 (분봉은 제한적)
        df = fdr.DataReader(target_symbol, start=start_date, end=end_date)
        
        if df is None or df.empty:
            raise HTTPException(status_code=404, detail=f"{symbol} 데이터를 찾을 수 없습니다.")
            
        # 데이터 변환
        # 해상도에 따른 리샘플링 (주봉, 월봉)
        if resolution == "W":
            df = df.resample('W').agg({
                'Open': 'first',
                'High': 'max',
                'Low': 'min',
                'Close': 'last',
                'Volume': 'sum'
            }).dropna()
        elif resolution == "M":
            df = df.resample('M').agg({
                'Open': 'first',
                'High': 'max',
                'Low': 'min',
                'Close': 'last',
                'Volume': 'sum'
            }).dropna()
        # 연봉은 필요시 추가 (resolution == "Y")
        elif resolution == "Y":
             df = df.resample('Y').agg({
                'Open': 'first',
                'High': 'max',
                'Low': 'min',
                'Close': 'last',
                'Volume': 'sum'
            }).dropna()

        timestamps = []
        opens = []
        highs = []
        lows = []
        closes = []
        volumes = []
        
        for idx, row in df.iterrows():
            ts = idx
            if isinstance(ts, pd.Timestamp):
                ts = ts.to_pydatetime()
            
            # 타임존 처리 (UTC로 통일)
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=dt.timezone.utc)
            
            timestamps.append(int(ts.timestamp()))
            opens.append(float(row["Open"]))
            highs.append(float(row["High"]))
            lows.append(float(row["Low"]))
            closes.append(float(row["Close"]))
            volumes.append(float(row["Volume"]))
            
        return CandleResponse(
            symbol=symbol,
            resolution=resolution,
            data=CandleSeries(
                timestamps=timestamps,
                opens=opens,
                highs=highs,
                lows=lows,
                closes=closes,
                volumes=volumes,
            ),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"한국 주식 데이터 가져오기 오류: {e}")
        raise HTTPException(status_code=500, detail=f"한국 주식 데이터 가져오기 실패: {str(e)}")


@app.get("/healthz")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.on_event("startup")
async def _on_startup() -> None:
    global MARKET_REFRESH_TASK, NEWS_REFRESH_TASK
    MARKET_REFRESH_TASK = asyncio.create_task(_market_refresh_loop())
    NEWS_REFRESH_TASK = asyncio.create_task(_news_refresh_loop())
    asyncio.create_task(_refresh_market_cache_once())
    asyncio.create_task(_refresh_news_cache_once())


@app.on_event("shutdown")
async def _on_shutdown() -> None:
    tasks = [MARKET_REFRESH_TASK, NEWS_REFRESH_TASK]
    for task in tasks:
        if task:
            task.cancel()
    for task in tasks:
        if task:
            with contextlib.suppress(asyncio.CancelledError):
                await task


def _fallback_quote_yfinance(
    provider_symbol: str, display_symbol: str, display_name: Optional[str]
) -> MarketQuote:
    cache_entry = QUOTE_CACHE.get(provider_symbol.upper())
    if cache_entry and time.time() - cache_entry[1] < CACHE_TTL_SECONDS:
        return cache_entry[0]

    try:
        df = _yf_download_with_retry(provider_symbol, "5d", "1d")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=404, detail=f"{display_symbol} 시세 데이터를 찾을 수 없습니다.") from exc

    if df.empty:
        raise HTTPException(status_code=404, detail=f"{display_symbol} 시세 데이터를 찾을 수 없습니다.")

    df = df.dropna()
    if df.empty:
        raise HTTPException(status_code=404, detail=f"{display_symbol} 시세 데이터를 찾을 수 없습니다.")

    last = df.iloc[-1]
    prev = df.iloc[-2] if len(df) > 1 else last

    prev_close = float(prev["Close"]) if not pd.isna(prev["Close"]) else None
    current = float(last["Close"])

    if prev_close and prev_close != 0:
        change = current - prev_close
        percent = (change / prev_close) * 100
    else:
        change = 0.0
        percent = 0.0

    timestamp = df.index[-1]
    if isinstance(timestamp, pd.Timestamp):
        timestamp = timestamp.to_pydatetime()
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=dt.timezone.utc)

    quote = MarketQuote(
        symbol=display_symbol,
        name=display_name or display_symbol,
        current=current,
        change=change,
        percent=percent,
        high=float(last["High"]) if not pd.isna(last["High"]) else None,
        low=float(last["Low"]) if not pd.isna(last["Low"]) else None,
        open=float(last["Open"]) if not pd.isna(last["Open"]) else None,
        previous_close=prev_close,
        timestamp=timestamp,
    )
    QUOTE_CACHE[provider_symbol.upper()] = (quote, time.time())
    return quote




def _fallback_quote_yfinance(
    provider_symbol: str, display_symbol: str, display_name: Optional[str]
) -> MarketQuote:
    # 한국 주식인 경우 FinanceDataReader 사용
    if provider_symbol.endswith(".KS") or provider_symbol.endswith(".KQ") or (provider_symbol.isdigit() and len(provider_symbol) == 6):
        return _fetch_korean_stock_quote(provider_symbol, display_name)

    cache_entry = QUOTE_CACHE.get(provider_symbol.upper())
    if cache_entry and time.time() - cache_entry[1] < CACHE_TTL_SECONDS:
        return cache_entry[0]

    try:
        df = _yf_download_with_retry(provider_symbol, "5d", "1d")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=404, detail=f"{display_symbol} 시세 데이터를 찾을 수 없습니다.") from exc

    if df.empty:
        raise HTTPException(status_code=404, detail=f"{display_symbol} 시세 데이터를 찾을 수 없습니다.")

    df = df.dropna()
    if df.empty:
        raise HTTPException(status_code=404, detail=f"{display_symbol} 시세 데이터를 찾을 수 없습니다.")

    last = df.iloc[-1]
    prev = df.iloc[-2] if len(df) > 1 else last

    prev_close = float(prev["Close"]) if not pd.isna(prev["Close"]) else None
    current = float(last["Close"])

    if prev_close and prev_close != 0:
        change = current - prev_close
        percent = (change / prev_close) * 100
    else:
        change = 0.0
        percent = 0.0

    timestamp = df.index[-1]
    if isinstance(timestamp, pd.Timestamp):
        timestamp = timestamp.to_pydatetime()
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=dt.timezone.utc)

    quote = MarketQuote(
        symbol=display_symbol,
        name=display_name or display_symbol,
        current=current,
        change=change,
        percent=percent,
        high=float(last["High"]) if not pd.isna(last["High"]) else None,
        low=float(last["Low"]) if not pd.isna(last["Low"]) else None,
        open=float(last["Open"]) if not pd.isna(last["Open"]) else None,
        previous_close=prev_close,
        timestamp=timestamp,
    )
    QUOTE_CACHE[provider_symbol.upper()] = (quote, time.time())
    return quote


def _map_interval_and_period(resolution: str, range_days: int) -> tuple[str, str]:
    res = resolution.upper()
    if res == "1":
        return "1m", "5d"
    if res == "5":
        return "5m", f"{min(range_days, 30)}d"
    if res == "15":
        return "15m", f"{min(range_days, 30)}d"
    if res == "30":
        return "30m", f"{min(range_days, 60)}d"
    if res == "60":
        return "60m", f"{min(range_days, 60)}d"
    if res == "240":
        return "1h", _period_from_days(range_days)
    if res in {"D", "1D"}:
        return "1d", _period_from_days(range_days)
    if res in {"W", "1W"}:
        return "1wk", _period_from_days(range_days)
    if res in {"M", "1M"}:
        return "1mo", _period_from_days(range_days)
    return "1d", _period_from_days(range_days)


def _period_from_days(days: int) -> str:
    if days <= 5:
        return "5d"
    if days <= 30:
        return "1mo"
    if days <= 90:
        return "3mo"
    if days <= 180:
        return "6mo"
    if days <= 365:
        return "1y"
    if days <= 730:
        return "2y"
    if days <= 1825:
        return "5y"
    return "10y"


def _fallback_candles_yfinance(
    provider_symbol: str, display_symbol: str, resolution: str, range_days: int
) -> tuple[List[dict], CandleResponse]:
    cache_key = (provider_symbol.upper(), resolution, range_days)
    cache_entry = CANDLE_CACHE.get(cache_key)
    if cache_entry and time.time() - cache_entry[1] < CACHE_TTL_SECONDS:
        candles = cache_entry[0]
        records = [
            {
                "date": dt.datetime.fromtimestamp(ts, tz=dt.timezone.utc),
                "open": opens,
                "high": highs,
                "low": lows,
                "close": closes,
                "volume": volumes,
            }
            for ts, opens, highs, lows, closes, volumes in zip(
                candles.data.timestamps,
                candles.data.opens,
                candles.data.highs,
                candles.data.lows,
                candles.data.closes,
                candles.data.volumes,
            )
        ]
        records.sort(key=lambda item: item["date"], reverse=True)
        return records, candles

    primary_interval, primary_period = _map_interval_and_period(resolution, range_days)
    fallback_candidates: List[tuple[str, str]] = [
        (primary_interval, primary_period),
    ]

    if primary_interval not in {"1d", "1wk", "1mo"}:
        fallback_candidates.append(("1d", _period_from_days(range_days)))
    fallback_candidates.append(("1wk", _period_from_days(max(range_days, 30))))

    last_error: Optional[Exception] = None

    for interval, period in fallback_candidates:
        try:
            df = _yf_download_with_retry(provider_symbol, period, interval)
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            continue

        if df.empty:
            last_error = ValueError("empty dataframe")
            continue

        df = df.dropna()
        if df.empty:
            last_error = ValueError("empty dataframe after dropna")
            continue

        timestamps: List[int] = []
        for idx in df.index:
            ts = idx.to_pydatetime() if isinstance(idx, pd.Timestamp) else pd.Timestamp(idx).to_pydatetime()
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=dt.timezone.utc)
            timestamps.append(int(ts.timestamp()))

        records = []
        for idx, ts_value in zip(df.index, timestamps):
            ts_dt = dt.datetime.fromtimestamp(ts_value, tz=dt.timezone.utc)
            row = df.loc[idx]
            records.append(
                {
                    "date": ts_dt,
                    "open": float(row["Open"]),
                    "high": float(row["High"]),
                    "low": float(row["Low"]),
                    "close": float(row["Close"]),
                    "volume": float(row["Volume"]),
                }
            )

        records.sort(key=lambda item: item["date"], reverse=True)
        candles = _candles_from_series(display_symbol, records, range_days, resolution)
        CANDLE_CACHE[cache_key] = (candles, time.time())
        return records, candles

    detail = f"{display_symbol} 차트 데이터를 찾을 수 없습니다."
    if last_error:
        detail = f"{detail} (fallback 실패: {last_error})"
    raise HTTPException(status_code=404, detail=detail)


def _yf_download_with_retry(symbol: str, period: str, interval: str, attempts: int = 3) -> pd.DataFrame:
    delay = 1.0
    last_exc: Optional[Exception] = None

    for _ in range(attempts):
        try:
            df = yf.download(
                symbol,
                period=period,
                interval=interval,
                progress=False,
                auto_adjust=False,
                threads=False,
            )
            return df
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            time.sleep(delay)
            delay *= 2

    if last_exc:
        raise last_exc
    return pd.DataFrame()

