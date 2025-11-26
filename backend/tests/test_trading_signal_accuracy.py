"""
매매 신호 생성 알고리즘 정확도 테스트 스크립트

이 스크립트는 매매 신호 생성 알고리즘의 정확도를 백테스팅으로 측정합니다.
PPT 발표용 테스트 결과를 생성합니다.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Tuple
import sys
import os
import argparse

# app.py의 함수들을 import
backend_dir = os.path.dirname(os.path.dirname(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
from app import (
    generate_trading_signal,
    calculate_rsi,
    calculate_macd,
    detect_support_resistance,
    calculate_moving_averages
)
import yfinance as yf
import FinanceDataReader as fdr


def test_trading_signal_accuracy(
    symbol: str,
    test_periods: int = 20,
    lookback_days: int = 365
) -> Dict:
    """
    매매 신호 정확도 테스트
    
    Args:
        symbol: 종목 코드
        test_periods: 테스트할 기간 수
        lookback_days: 과거 데이터 조회 기간
    
    Returns:
        테스트 결과 딕셔너리
    """
    print(f"\n=== 매매 신호 정확도 테스트: {symbol} ===")
    
    # 한국 주식 데이터 가져오기
    is_korean_stock = symbol.isdigit() and len(symbol) == 6
    if is_korean_stock:
        df = fdr.DataReader(symbol, start=(datetime.now() - timedelta(days=lookback_days)).strftime('%Y-%m-%d'))
        if df.empty:
            return {"error": "데이터를 가져올 수 없습니다."}
        df.columns = df.columns.str.lower()
    else:
        df = yf.download(symbol, period=f"{lookback_days}d", interval="1d", progress=False)
        if df.empty:
            return {"error": "데이터를 가져올 수 없습니다."}
    
    if 'close' not in df.columns:
        return {"error": "종가 데이터가 없습니다."}
    
    closes = df['close']
    highs = df['high'] if 'high' in df.columns else closes
    lows = df['low'] if 'low' in df.columns else closes
    
    # 테스트 기간 설정 (최근 N일)
    test_start_idx = max(0, len(df) - test_periods)
    test_data = df.iloc[test_start_idx:]
    
    buy_signals = []
    sell_signals = []
    hold_signals = []
    
    buy_success = 0
    buy_fail = 0
    sell_success = 0
    sell_fail = 0
    
    examples = []
    
    for i in range(len(test_data) - 10):  # 최소 10일 후 결과 확인
        current_idx = test_start_idx + i
        if current_idx < 20:  # 최소 20일 데이터 필요
            continue
        
        # 현재 시점까지의 데이터로 분석
        historical_data = df.iloc[:current_idx + 1]
        historical_closes = historical_data['close']
        historical_highs = historical_data['high'] if 'high' in historical_data.columns else historical_closes
        historical_lows = historical_data['low'] if 'low' in historical_data.columns else historical_closes
        
        # 기술적 지표 계산
        rsi = calculate_rsi(historical_closes, period=14)
        macd_data = calculate_macd(historical_closes)
        supports, resistances = detect_support_resistance(historical_closes, historical_highs, historical_lows)
        ma_data = calculate_moving_averages(historical_closes)
        
        if len(rsi) == 0 or len(macd_data['macd']) == 0:
            continue
        
        rsi_current = rsi.iloc[-1]
        macd_current = macd_data['macd'].iloc[-1]
        signal_current = macd_data['signal'].iloc[-1]
        macd_histogram = macd_data['histogram'].iloc[-1]
        
        current_price = historical_closes.iloc[-1]
        
        # 매매 신호 생성
        patterns = []  # 패턴은 간단히 생략
        macd_dict = {
            'macd': pd.Series([macd_current]),
            'signal': pd.Series([signal_current]),
            'histogram': pd.Series([macd_histogram])
        }
        trading_signal = generate_trading_signal(
            rsi=rsi_current,
            macd=macd_dict,
            closes=historical_closes,
            supports=supports,
            resistances=resistances,
            patterns=patterns
        )
        
        signal_type = trading_signal.type
        signal_score = trading_signal.confidence
        signal_reason = trading_signal.reason
        
        # 10일 후 결과 확인
        future_idx = current_idx + 10
        if future_idx >= len(df):
            continue
        
        future_price = df.iloc[future_idx]['close']
        future_high = df.iloc[current_idx+1:future_idx+1]['high'].max() if 'high' in df.columns else future_price
        future_low = df.iloc[current_idx+1:future_idx+1]['low'].min() if 'low' in df.columns else future_price
        
        price_change_pct = ((future_price - current_price) / current_price) * 100
        high_change_pct = ((future_high - current_price) / current_price) * 100
        low_change_pct = ((future_low - current_price) / current_price) * 100
        
        # 성공/실패 판정
        is_success = False
        
        if signal_type == "buy":
            buy_signals.append({
                'date': df.index[current_idx],
                'price': current_price,
                'score': signal_score,
                'reason': signal_reason
            })
            # 매수 신호 성공: 10일 후 가격이 상승했거나 최고가가 3% 이상 상승
            if price_change_pct > 0 or high_change_pct > 3:
                buy_success += 1
                is_success = True
            else:
                buy_fail += 1
                
        elif signal_type == "sell":
            sell_signals.append({
                'date': df.index[current_idx],
                'price': current_price,
                'score': signal_score,
                'reason': signal_reason
            })
            # 매도 신호 성공: 10일 후 가격이 하락했거나 최저가가 3% 이상 하락
            if price_change_pct < 0 or low_change_pct < -3:
                sell_success += 1
                is_success = True
            else:
                sell_fail += 1
        else:
            hold_signals.append({
                'date': df.index[current_idx],
                'price': current_price,
                'score': signal_score
            })
            continue  # HOLD는 성공/실패 판정 안 함
        
        # 예시 저장 (최대 3개)
        if len(examples) < 3:
            examples.append({
                'signal_type': signal_type,
                'date': df.index[current_idx].strftime('%Y-%m-%d') if hasattr(df.index[current_idx], 'strftime') else str(df.index[current_idx]),
                'price': current_price,
                'score': signal_score,
                'reason': signal_reason,
                'future_price': future_price,
                'price_change_pct': price_change_pct,
                'is_success': is_success
            })
    
    # 정확도 계산
    total_buy = buy_success + buy_fail
    total_sell = sell_success + sell_fail
    
    buy_accuracy = (buy_success / total_buy * 100) if total_buy > 0 else 0
    sell_accuracy = (sell_success / total_sell * 100) if total_sell > 0 else 0
    overall_accuracy = ((buy_success + sell_success) / (total_buy + total_sell) * 100) if (total_buy + total_sell) > 0 else 0
    
    return {
        'symbol': symbol,
        'buy_accuracy': buy_accuracy,
        'sell_accuracy': sell_accuracy,
        'overall_accuracy': overall_accuracy,
        'buy_success': buy_success,
        'buy_fail': buy_fail,
        'sell_success': sell_success,
        'sell_fail': sell_fail,
        'total_buy_signals': total_buy,
        'total_sell_signals': total_sell,
        'total_hold_signals': len(hold_signals),
        'examples': examples
    }


def generate_report(results: Dict, format: str = "text") -> str:
    """테스트 결과 리포트 생성"""
    if 'error' in results:
        return f"오류: {results['error']}"
    
    report = []
    report.append("=" * 80)
    report.append("매매 신호 생성 알고리즘 정확도 테스트 리포트")
    report.append("=" * 80)
    report.append(f"테스트 일시: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report.append("=" * 80)
    report.append(f"종목: {results['symbol']}")
    report.append("=" * 80)
    report.append("")
    report.append("[매매 신호 정확도]")
    report.append(f"  전체 정확도: {results['overall_accuracy']:.2f}%")
    report.append(f"  매수 신호 정확도: {results['buy_accuracy']:.2f}%")
    report.append(f"    - 성공: {results['buy_success']}회")
    report.append(f"    - 실패: {results['buy_fail']}회")
    report.append(f"    - 전체: {results['total_buy_signals']}회")
    report.append(f"  매도 신호 정확도: {results['sell_accuracy']:.2f}%")
    report.append(f"    - 성공: {results['sell_success']}회")
    report.append(f"    - 실패: {results['sell_fail']}회")
    report.append(f"    - 전체: {results['total_sell_signals']}회")
    report.append(f"  보유 신호: {results['total_hold_signals']}회")
    report.append("")
    
    if results['examples']:
        report.append("  계산 과정:")
        for i, ex in enumerate(results['examples'], 1):
            signal_name = "매수" if ex['signal_type'] == 'buy' else "매도"
            result_text = "성공" if ex['is_success'] else "실패"
            report.append(f"    예시 {i}: {ex['date']} {ex['price']:.0f}원에서 {signal_name} 신호 (점수: {ex['score']:.2f}, 이유: {ex['reason']})")
            report.append(f"            -> 10일 후 {ex['future_price']:.0f}원 ({ex['price_change_pct']:+.2f}%) -> {result_text}")
    
    report.append("")
    report.append("=" * 80)
    
    return "\n".join(report)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="매매 신호 정확도 테스트")
    parser.add_argument("--symbol", type=str, required=True, help="종목 코드")
    parser.add_argument("--format", type=str, default="text", choices=["text", "json"], help="출력 형식")
    parser.add_argument("--test-periods", type=int, default=20, help="테스트 기간 수")
    
    args = parser.parse_args()
    
    results = test_trading_signal_accuracy(args.symbol, test_periods=args.test_periods)
    
    if args.format == "json":
        import json
        print(json.dumps(results, indent=2, ensure_ascii=False, default=str))
    else:
        print(generate_report(results))

