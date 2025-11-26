#!/bin/bash
# Spring Boot 로그 확인 스크립트

echo "=== Spring Boot 로그 확인 ==="
echo ""

echo "[1/3] 최근 로그 (50줄):"
sudo journalctl -u share-springboot -n 50 --no-pager
echo ""

echo "[2/3] 에러 로그:"
sudo journalctl -u share-springboot -p err --no-pager | tail -20
echo ""

echo "[3/3] 프로세스 및 포트 확인:"
ps aux | grep java | grep share-0.0.1-SNAPSHOT.jar
echo ""
sudo ss -tlnp | grep :8001 || echo "  포트 8001이 리스닝하지 않음"
echo ""

echo "실시간 로그 확인:"
echo "  sudo journalctl -u share-springboot -f"

