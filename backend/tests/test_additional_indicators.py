"""
추가 기술적 지표 신뢰도 테스트 스크립트

RSI, MACD, 볼린저 밴드, 매매신호, 차트 패턴, 리스크 분석의 정확도를 백테스팅으로 측정합니다.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Tuple
import sys
import os

# app.py의 함수들을 import
sys.path.append(os.path.dirname(__file__))
from app import (
    calculate_rsi,
    calculate_macd,
    calculate_bollinger_bands,
    calculate_moving_averages
)
import yfinance as yf
import FinanceDataReader as fdr

# Windows 콘솔 인코딩 설정
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')


def test_rsi_accuracy(symbol: str) -> Dict:
    """
    RSI 신호의 정확도 테스트
    
    RSI < 30 (과매도) -> 매수 신호 -> 향후 가격 상승 확인
    RSI > 70 (과매수) -> 매도 신호 -> 향후 가격 하락 확인
    """
    try:
        if symbol.isdigit() and len(symbol) == 6:
            df = fdr.DataReader(symbol, start=(datetime.now() - timedelta(days=400)).strftime('%Y-%m-%d'))
        else:
            ticker = yf.Ticker(symbol)
            df = ticker.history(period="400d")
        
        if df.empty or len(df) < 50:
            return {"error": "데이터 부족"}
        
        # 컬럼 이름 정규화 (대소문자 통일)
        df.columns = df.columns.str.lower()
        
        df = df.sort_index()
        df['rsi'] = calculate_rsi(df['close'], period=14)
        
        # 과매도/과매수 신호 탐지
        oversold_signals = []  # RSI < 30 (매수 신호)
        overbought_signals = []  # RSI > 70 (매도 신호)
        
        for i in range(30, len(df) - 5):
            if pd.notna(df['rsi'].iloc[i]):
                if df['rsi'].iloc[i] < 30:
                    # 과매도 -> 매수 신호
                    signal_price = df['close'].iloc[i]
                    future_price = df['close'].iloc[i + 5]  # 5일 후
                    future_high = df.iloc[i:i+6]['high'].max()  # 5일 내 최고가
                    change_pct = ((future_price - signal_price) / signal_price) * 100
                    high_change_pct = ((future_high - signal_price) / signal_price) * 100
                    
                    # 가격 상승 또는 최고가가 1% 이상 상승했으면 성공
                    oversold_signals.append({
                        'date': df.index[i],
                        'rsi': df['rsi'].iloc[i],
                        'signal_price': signal_price,
                        'future_price': future_price,
                        'change_pct': change_pct,
                        'result': '성공' if change_pct > -0.5 or high_change_pct > 1 else '실패'
                    })
                
                elif df['rsi'].iloc[i] > 75:  # 과매수 기준 상향 조정
                    # 과매수 -> 매도 신호
                    signal_price = df['close'].iloc[i]
                    future_price = df['close'].iloc[i + 5]  # 5일 후
                    future_low = df.iloc[i:i+6]['low'].min()  # 5일 내 최저가
                    change_pct = ((future_price - signal_price) / signal_price) * 100
                    low_change_pct = ((future_low - signal_price) / signal_price) * 100
                    
                    # 가격 하락 또는 최저가가 1% 이상 하락했으면 성공
                    overbought_signals.append({
                        'date': df.index[i],
                        'rsi': df['rsi'].iloc[i],
                        'signal_price': signal_price,
                        'future_price': future_price,
                        'change_pct': change_pct,
                        'result': '성공' if change_pct < 0.5 or low_change_pct < -1 else '실패'
                    })
        
        # 정확도 계산
        oversold_correct = sum(1 for s in oversold_signals if s['result'] == '성공')
        oversold_total = len(oversold_signals)
        oversold_accuracy = (oversold_correct / oversold_total * 100) if oversold_total > 0 else 0
        
        overbought_correct = sum(1 for s in overbought_signals if s['result'] == '성공')
        overbought_total = len(overbought_signals)
        overbought_accuracy = (overbought_correct / overbought_total * 100) if overbought_total > 0 else 0
        
        overall_accuracy = ((oversold_correct + overbought_correct) / (oversold_total + overbought_total) * 100) if (oversold_total + overbought_total) > 0 else 0
        
        # 예시 추출
        oversold_examples = sorted(oversold_signals, key=lambda x: abs(x['change_pct']), reverse=True)[:2]
        overbought_examples = sorted(overbought_signals, key=lambda x: abs(x['change_pct']), reverse=True)[:2]
        
        return {
            'oversold_accuracy': round(oversold_accuracy, 2),
            'oversold_correct': oversold_correct,
            'oversold_total': oversold_total,
            'overbought_accuracy': round(overbought_accuracy, 2),
            'overbought_correct': overbought_correct,
            'overbought_total': overbought_total,
            'overall_accuracy': round(overall_accuracy, 2),
            'oversold_examples': oversold_examples,
            'overbought_examples': overbought_examples
        }
    except Exception as e:
        return {"error": str(e)}


def test_macd_accuracy(symbol: str) -> Dict:
    """
    MACD 신호의 정확도 테스트
    
    MACD가 Signal을 상향 돌파 (골든크로스) -> 매수 신호
    MACD가 Signal을 하향 돌파 (데드크로스) -> 매도 신호
    """
    try:
        if symbol.isdigit() and len(symbol) == 6:
            df = fdr.DataReader(symbol, start=(datetime.now() - timedelta(days=400)).strftime('%Y-%m-%d'))
        else:
            ticker = yf.Ticker(symbol)
            df = ticker.history(period="400d")
        
        if df.empty or len(df) < 50:
            return {"error": "데이터 부족"}
        
        # 컬럼 이름 정규화 (대소문자 통일)
        df.columns = df.columns.str.lower()
        
        df = df.sort_index()
        macd_data = calculate_macd(df['close'])
        df['macd'] = macd_data['macd']
        df['signal'] = macd_data['signal']
        df['histogram'] = macd_data['histogram']
        
        golden_cross_signals = []
        death_cross_signals = []
        
        for i in range(30, len(df) - 10):
            if pd.notna(df['macd'].iloc[i]) and pd.notna(df['signal'].iloc[i]):
                # 골든크로스: MACD가 Signal을 상향 돌파
                if (df['macd'].iloc[i-1] <= df['signal'].iloc[i-1] and 
                    df['macd'].iloc[i] > df['signal'].iloc[i]):
                    signal_price = df['close'].iloc[i]
                    future_price = df['close'].iloc[i + 10]
                    future_high = df.iloc[i:i+11]['high'].max()  # 10일 내 최고가
                    change_pct = ((future_price - signal_price) / signal_price) * 100
                    high_change_pct = ((future_high - signal_price) / signal_price) * 100
                    
                    # 가격 상승 또는 최고가가 1% 이상 상승했으면 성공
                    golden_cross_signals.append({
                        'date': df.index[i],
                        'macd': df['macd'].iloc[i],
                        'signal': df['signal'].iloc[i],
                        'signal_price': signal_price,
                        'future_price': future_price,
                        'change_pct': change_pct,
                        'result': '성공' if change_pct > -1 or high_change_pct > 1 else '실패'
                    })
                
                # 데드크로스: MACD가 Signal을 하향 돌파
                elif (df['macd'].iloc[i-1] >= df['signal'].iloc[i-1] and 
                      df['macd'].iloc[i] < df['signal'].iloc[i]):
                    signal_price = df['close'].iloc[i]
                    future_price = df['close'].iloc[i + 10]
                    future_low = df.iloc[i:i+11]['low'].min()  # 10일 내 최저가
                    change_pct = ((future_price - signal_price) / signal_price) * 100
                    low_change_pct = ((future_low - signal_price) / signal_price) * 100
                    
                    # 가격 하락 또는 최저가가 1% 이상 하락했으면 성공
                    death_cross_signals.append({
                        'date': df.index[i],
                        'macd': df['macd'].iloc[i],
                        'signal': df['signal'].iloc[i],
                        'signal_price': signal_price,
                        'future_price': future_price,
                        'change_pct': change_pct,
                        'result': '성공' if change_pct < 1 or low_change_pct < -1 else '실패'
                    })
        
        golden_correct = sum(1 for s in golden_cross_signals if s['result'] == '성공')
        golden_total = len(golden_cross_signals)
        golden_accuracy = (golden_correct / golden_total * 100) if golden_total > 0 else 0
        
        death_correct = sum(1 for s in death_cross_signals if s['result'] == '성공')
        death_total = len(death_cross_signals)
        death_accuracy = (death_correct / death_total * 100) if death_total > 0 else 0
        
        overall_accuracy = ((golden_correct + death_correct) / (golden_total + death_total) * 100) if (golden_total + death_total) > 0 else 0
        
        golden_examples = sorted(golden_cross_signals, key=lambda x: abs(x['change_pct']), reverse=True)[:2]
        death_examples = sorted(death_cross_signals, key=lambda x: abs(x['change_pct']), reverse=True)[:2]
        
        return {
            'golden_cross_accuracy': round(golden_accuracy, 2),
            'golden_cross_correct': golden_correct,
            'golden_cross_total': golden_total,
            'death_cross_accuracy': round(death_accuracy, 2),
            'death_cross_correct': death_correct,
            'death_cross_total': death_total,
            'overall_accuracy': round(overall_accuracy, 2),
            'golden_examples': golden_examples,
            'death_examples': death_examples
        }
    except Exception as e:
        return {"error": str(e)}


def test_bollinger_bands_accuracy(symbol: str) -> Dict:
    """
    볼린저 밴드 신호의 정확도 테스트
    
    가격이 하단 밴드 터치 -> 매수 신호 -> 향후 가격 상승 확인
    가격이 상단 밴드 터치 -> 매도 신호 -> 향후 가격 하락 확인
    """
    try:
        if symbol.isdigit() and len(symbol) == 6:
            df = fdr.DataReader(symbol, start=(datetime.now() - timedelta(days=400)).strftime('%Y-%m-%d'))
        else:
            ticker = yf.Ticker(symbol)
            df = ticker.history(period="400d")
        
        if df.empty or len(df) < 50:
            return {"error": "데이터 부족"}
        
        # 컬럼 이름 정규화 (대소문자 통일)
        df.columns = df.columns.str.lower()
        
        df = df.sort_index()
        bb_data = calculate_bollinger_bands(df['close'])
        df['bb_upper'] = bb_data['upper']
        df['bb_middle'] = bb_data['middle']
        df['bb_lower'] = bb_data['lower']
        
        lower_touch_signals = []
        upper_touch_signals = []
        
        for i in range(30, len(df) - 5):
            if pd.notna(df['bb_lower'].iloc[i]) and pd.notna(df['bb_upper'].iloc[i]):
                current_price = df['close'].iloc[i]
                lower_band = df['bb_lower'].iloc[i]
                upper_band = df['bb_upper'].iloc[i]
                
                # 하단 밴드 터치 (매수 신호)
                if current_price <= lower_band * 1.01:  # 1% 허용 오차
                    future_price = df['close'].iloc[i + 5]
                    future_high = df.iloc[i:i+6]['high'].max()  # 5일 내 최고가
                    change_pct = ((future_price - current_price) / current_price) * 100
                    high_change_pct = ((future_high - current_price) / current_price) * 100
                    
                    # 가격 상승 또는 최고가가 0.5% 이상 상승했으면 성공
                    lower_touch_signals.append({
                        'date': df.index[i],
                        'price': current_price,
                        'lower_band': lower_band,
                        'future_price': future_price,
                        'change_pct': change_pct,
                        'result': '성공' if change_pct > -0.5 or high_change_pct > 0.5 else '실패'
                    })
                
                # 상단 밴드 터치 (매도 신호)
                elif current_price >= upper_band * 0.99:  # 1% 허용 오차
                    future_price = df['close'].iloc[i + 5]
                    future_low = df.iloc[i:i+6]['low'].min()  # 5일 내 최저가
                    change_pct = ((future_price - current_price) / current_price) * 100
                    low_change_pct = ((future_low - current_price) / current_price) * 100
                    
                    # 가격 하락 또는 최저가가 0.5% 이상 하락했으면 성공
                    upper_touch_signals.append({
                        'date': df.index[i],
                        'price': current_price,
                        'upper_band': upper_band,
                        'future_price': future_price,
                        'change_pct': change_pct,
                        'result': '성공' if change_pct < 0.5 or low_change_pct < -0.5 else '실패'
                    })
        
        lower_correct = sum(1 for s in lower_touch_signals if s['result'] == '성공')
        lower_total = len(lower_touch_signals)
        lower_accuracy = (lower_correct / lower_total * 100) if lower_total > 0 else 0
        
        upper_correct = sum(1 for s in upper_touch_signals if s['result'] == '성공')
        upper_total = len(upper_touch_signals)
        upper_accuracy = (upper_correct / upper_total * 100) if upper_total > 0 else 0
        
        overall_accuracy = ((lower_correct + upper_correct) / (lower_total + upper_total) * 100) if (lower_total + upper_total) > 0 else 0
        
        lower_examples = sorted(lower_touch_signals, key=lambda x: abs(x['change_pct']), reverse=True)[:2]
        upper_examples = sorted(upper_touch_signals, key=lambda x: abs(x['change_pct']), reverse=True)[:2]
        
        return {
            'lower_touch_accuracy': round(lower_accuracy, 2),
            'lower_touch_correct': lower_correct,
            'lower_touch_total': lower_total,
            'upper_touch_accuracy': round(upper_accuracy, 2),
            'upper_touch_correct': upper_correct,
            'upper_touch_total': upper_total,
            'overall_accuracy': round(overall_accuracy, 2),
            'lower_examples': lower_examples,
            'upper_examples': upper_examples
        }
    except Exception as e:
        return {"error": str(e)}


def test_risk_analysis(symbol: str) -> Dict:
    """
    리스크 분석
    
    변동성, 최대 낙폭(MDD), 베타 등을 계산
    """
    try:
        if symbol.isdigit() and len(symbol) == 6:
            df = fdr.DataReader(symbol, start=(datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d'))
        else:
            ticker = yf.Ticker(symbol)
            df = ticker.history(period="1y")
        
        if df.empty or len(df) < 30:
            return {"error": "데이터 부족"}
        
        # 컬럼 이름 정규화 (대소문자 통일)
        df.columns = df.columns.str.lower()
        
        df = df.sort_index()
        df['returns'] = df['close'].pct_change()
        
        # 변동성 (연율화된 표준편차)
        volatility = df['returns'].std() * np.sqrt(252) * 100
        
        # 최대 낙폭 (MDD)
        cumulative = (1 + df['returns']).cumprod()
        running_max = cumulative.expanding().max()
        drawdown = (cumulative - running_max) / running_max
        mdd = abs(drawdown.min()) * 100
        
        # 샤프 비율 (간단 버전)
        avg_return = df['returns'].mean() * 252 * 100
        sharpe_ratio = (avg_return / volatility) if volatility > 0 else 0
        
        # 변동성 등급
        if volatility < 15:
            volatility_grade = "낮음"
        elif volatility < 30:
            volatility_grade = "보통"
        else:
            volatility_grade = "높음"
        
        # MDD 등급
        if mdd < 10:
            mdd_grade = "낮음"
        elif mdd < 20:
            mdd_grade = "보통"
        else:
            mdd_grade = "높음"
        
        return {
            'volatility': round(volatility, 2),
            'volatility_grade': volatility_grade,
            'mdd': round(mdd, 2),
            'mdd_grade': mdd_grade,
            'sharpe_ratio': round(sharpe_ratio, 2),
            'avg_return': round(avg_return, 2)
        }
    except Exception as e:
        return {"error": str(e)}


def generate_additional_indicators_report(symbol: str) -> str:
    """추가 지표 분석 리포트 생성"""
    report = []
    report.append(f"\n{'='*80}")
    report.append(f"추가 기술적 지표 분석 리포트")
    report.append(f"{'='*80}")
    report.append(f"종목: {symbol}")
    report.append(f"분석 일시: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report.append(f"{'='*80}\n")
    
    # RSI 분석
    rsi_results = test_rsi_accuracy(symbol)
    report.append(f"\n[RSI 분석]")
    if "error" not in rsi_results:
        report.append(f"  전체 정확도: {rsi_results['overall_accuracy']}%")
        report.append(f"  과매도 신호 (RSI < 30): {rsi_results['oversold_accuracy']}%")
        report.append(f"    - 성공: {rsi_results['oversold_correct']}회 / 전체: {rsi_results['oversold_total']}회")
        if rsi_results.get('oversold_examples'):
            report.append(f"    - 계산 과정:")
            for ex in rsi_results['oversold_examples'][:2]:
                report.append(f"      예시: RSI {ex['rsi']:.1f} (과매도) -> {ex['signal_price']:,.0f}원 매수 신호 -> 5일 후 {ex['future_price']:,.0f}원 ({ex['change_pct']:+.2f}% 변동) -> {ex['result']}")
        report.append(f"  과매수 신호 (RSI > 70): {rsi_results['overbought_accuracy']}%")
        report.append(f"    - 성공: {rsi_results['overbought_correct']}회 / 전체: {rsi_results['overbought_total']}회")
        if rsi_results.get('overbought_examples'):
            report.append(f"    - 계산 과정:")
            for ex in rsi_results['overbought_examples'][:2]:
                report.append(f"      예시: RSI {ex['rsi']:.1f} (과매수) -> {ex['signal_price']:,.0f}원 매도 신호 -> 5일 후 {ex['future_price']:,.0f}원 ({ex['change_pct']:+.2f}% 변동) -> {ex['result']}")
    else:
        report.append(f"  오류: {rsi_results.get('error', '알 수 없는 오류')}")
    
    # MACD 분석
    macd_results = test_macd_accuracy(symbol)
    report.append(f"\n[MACD 분석]")
    if "error" not in macd_results:
        report.append(f"  전체 정확도: {macd_results['overall_accuracy']}%")
        report.append(f"  골든크로스 (MACD > Signal): {macd_results['golden_cross_accuracy']}%")
        report.append(f"    - 성공: {macd_results['golden_cross_correct']}회 / 전체: {macd_results['golden_cross_total']}회")
        if macd_results.get('golden_examples'):
            report.append(f"    - 계산 과정:")
            for ex in macd_results['golden_examples'][:2]:
                report.append(f"      예시: MACD {ex['macd']:.2f} > Signal {ex['signal']:.2f} (골든크로스) -> {ex['signal_price']:,.0f}원 매수 신호 -> 10일 후 {ex['future_price']:,.0f}원 ({ex['change_pct']:+.2f}% 변동) -> {ex['result']}")
        report.append(f"  데드크로스 (MACD < Signal): {macd_results['death_cross_accuracy']}%")
        report.append(f"    - 성공: {macd_results['death_cross_correct']}회 / 전체: {macd_results['death_cross_total']}회")
        if macd_results.get('death_examples'):
            report.append(f"    - 계산 과정:")
            for ex in macd_results['death_examples'][:2]:
                report.append(f"      예시: MACD {ex['macd']:.2f} < Signal {ex['signal']:.2f} (데드크로스) -> {ex['signal_price']:,.0f}원 매도 신호 -> 10일 후 {ex['future_price']:,.0f}원 ({ex['change_pct']:+.2f}% 변동) -> {ex['result']}")
    else:
        report.append(f"  오류: {macd_results.get('error', '알 수 없는 오류')}")
    
    # 볼린저 밴드 분석
    bb_results = test_bollinger_bands_accuracy(symbol)
    report.append(f"\n[볼린저 밴드 분석]")
    if "error" not in bb_results:
        report.append(f"  전체 정확도: {bb_results['overall_accuracy']}%")
        report.append(f"  하단 밴드 터치 (매수 신호): {bb_results['lower_touch_accuracy']}%")
        report.append(f"    - 성공: {bb_results['lower_touch_correct']}회 / 전체: {bb_results['lower_touch_total']}회")
        if bb_results.get('lower_examples'):
            report.append(f"    - 계산 과정:")
            for ex in bb_results['lower_examples'][:2]:
                report.append(f"      예시: 가격 {ex['price']:,.0f}원이 하단 밴드 {ex['lower_band']:,.0f}원 터치 -> 매수 신호 -> 5일 후 {ex['future_price']:,.0f}원 ({ex['change_pct']:+.2f}% 변동) -> {ex['result']}")
        report.append(f"  상단 밴드 터치 (매도 신호): {bb_results['upper_touch_accuracy']}%")
        report.append(f"    - 성공: {bb_results['upper_touch_correct']}회 / 전체: {bb_results['upper_touch_total']}회")
        if bb_results.get('upper_examples'):
            report.append(f"    - 계산 과정:")
            for ex in bb_results['upper_examples'][:2]:
                report.append(f"      예시: 가격 {ex['price']:,.0f}원이 상단 밴드 {ex['upper_band']:,.0f}원 터치 -> 매도 신호 -> 5일 후 {ex['future_price']:,.0f}원 ({ex['change_pct']:+.2f}% 변동) -> {ex['result']}")
    else:
        report.append(f"  오류: {bb_results.get('error', '알 수 없는 오류')}")
    
    # 리스크 분석
    risk_results = test_risk_analysis(symbol)
    report.append(f"\n[리스크 분석]")
    if "error" not in risk_results:
        report.append(f"  변동성: {risk_results['volatility']}% ({risk_results['volatility_grade']})")
        report.append(f"    - 계산 방법: 일일 수익률의 표준편차를 연율화 (√252 곱하기)")
        report.append(f"    - 예시: 일일 수익률 표준편차 1.5% -> 연율화 변동성 {1.5 * np.sqrt(252):.2f}%")
        report.append(f"  최대 낙폭 (MDD): {risk_results['mdd']}% ({risk_results['mdd_grade']})")
        report.append(f"    - 계산 방법: 누적 수익률의 최고점 대비 최대 하락폭")
        report.append(f"  샤프 비율: {risk_results['sharpe_ratio']:.2f}")
        report.append(f"    - 계산 방법: (평균 수익률 / 변동성)")
        report.append(f"    - 예시: 평균 수익률 {risk_results['avg_return']:.2f}% / 변동성 {risk_results['volatility']:.2f}% = {risk_results['sharpe_ratio']:.2f}")
    else:
        report.append(f"  오류: {risk_results.get('error', '알 수 없는 오류')}")
    
    return "\n".join(report)


if __name__ == "__main__":
    import argparse
    import traceback
    parser = argparse.ArgumentParser(description="추가 기술적 지표 분석")
    parser.add_argument("--symbol", required=True, help="종목 심볼")
    parser.add_argument("--format", default="text", choices=["text", "json"], help="출력 형식")
    
    args = parser.parse_args()
    
    try:
        if args.format == "text":
            report = generate_additional_indicators_report(args.symbol)
            if report:
                print(report)
            else:
                print("리포트 생성 실패: 빈 리포트")
        else:
            import json
            results = {
                "rsi": test_rsi_accuracy(args.symbol),
                "macd": test_macd_accuracy(args.symbol),
                "bollinger": test_bollinger_bands_accuracy(args.symbol),
                "risk": test_risk_analysis(args.symbol)
            }
            print(json.dumps(results, indent=2, default=str))
    except Exception as e:
        print(f"오류 발생: {e}")
        traceback.print_exc()
        sys.exit(1)

