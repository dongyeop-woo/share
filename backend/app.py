from __future__ import annotations

import asyncio
import datetime as dt
import os
import time
from typing import Dict, List, Optional, Tuple

import contextlib

import logging

import httpx
import pandas as pd
import yfinance as yf
import feedparser
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.ai import rank_recommendations, summarize_headline, translate_to_korean

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


@app.post("/api/summarize", response_model=SummarizeResponse)
def summarize_news(payload: SummarizeRequest) -> SummarizeResponse:
    try:
        summary = summarize_headline(payload.text, max_tokens=payload.max_tokens)
        return SummarizeResponse(summary=summary)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


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

# RSS 피드 URL 목록
KOREA_NEWS_RSS = [
    "https://www.hankyung.com/feed/economy",  # 한국경제
    "https://www.mk.co.kr/rss/30000041/",  # 매일경제 경제
    "https://biz.chosun.com/rss/site_biz.xml",  # 조선비즈
    "https://rss.etnews.com/Section901.xml",  # 전자신문 (요약 포함 가능)
    "https://www.edaily.co.kr/rss/industry.xml",  # 이데일리 산업
]

USA_NEWS_RSS = [
    "https://rss.cnn.com/rss/money_latest.rss",  # CNN Money (가장 안정적)
    "https://feeds.bloomberg.com/markets/news.rss",  # Bloomberg Markets
    "https://www.cnbc.com/id/100003114/device/rss/rss.html",  # CNBC News
    "https://www.marketwatch.com/rss/topstories",  # MarketWatch
    "https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC&region=US&lang=en-US",  # Yahoo Finance S&P 500 (백업)
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
                
                for entry in feed.entries[:10]:  # 각 피드에서 최대 10개
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
    return articles[:20]  # 최대 20개 반환


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
    await _ensure_symbol_cached(symbol)

    async with MARKET_CACHE_LOCK:
        entry = MARKET_CACHE.get(symbol.upper())

    if not entry:
        raise HTTPException(status_code=404, detail=f"{symbol.upper()} 데이터가 준비되지 않았습니다.")

    return entry["quote"]  # type: ignore[index]


@app.get("/api/market/search", response_model=List[SymbolSearchResult])
async def market_search(query: str = Query(..., min_length=1, description="심볼 또는 종목명 검색어")) -> List[SymbolSearchResult]:
    api_key = _get_finnhub_api_key()
    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.get(FINNHUB_SEARCH_URL, params={"q": query, "token": api_key})

    if response.status_code == 429:
        raise HTTPException(status_code=429, detail="Finnhub 호출 제한을 초과했습니다. 잠시 후 다시 시도하세요.")
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Finnhub 검색 실패: {response.text}")

    payload = response.json()
    results = payload.get("result") or []

    formatted = [
        SymbolSearchResult(
            symbol=item.get("symbol", "").upper(),
            description=item.get("description", "").strip(),
            type=item.get("type"),
            exchange=item.get("exchange"),
        )
        for item in results
        if item.get("symbol")
    ]

    return formatted[:15]


@app.get("/api/market/candles", response_model=CandleResponse)
async def market_candles(
    symbol: str = Query(..., description="조회할 종목 티커"),
    resolution: str = Query("15", description="Finnhub 캔들 해상도 (1,5,15,30,60,240,D,W,M)"),
    range_days: int = Query(5, ge=1, le=60, description="조회 기간(일)"),
) -> CandleResponse:
    normalized_resolution = resolution.upper()
    if normalized_resolution not in {"D", "1D"}:
        raise HTTPException(status_code=400, detail="일봉(D) 해상도만 지원합니다.")

    await _ensure_symbol_cached(symbol)

    async with MARKET_CACHE_LOCK:
        entry = MARKET_CACHE.get(symbol.upper())

    if not entry:
        raise HTTPException(status_code=404, detail=f"{symbol.upper()} 데이터가 준비되지 않았습니다.")

    series: List[dict] = entry["series"]  # type: ignore[assignment]
    return _candles_from_series(symbol.upper(), series, range_days, normalized_resolution)


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

