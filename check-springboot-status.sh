#!/bin/bash
# Spring Boot 상태 확인

echo "=== Spring Boot 상태 확인 ==="
echo ""

SERVICE_NAME="share-springboot"

echo "[1/4] 서비스 상태:"
sudo systemctl status $SERVICE_NAME --no-pager -l | head -15

echo ""
echo "[2/4] 포트 8001 확인:"
sudo ss -tlnp | grep :8001 || echo "  ✗ 포트 8001이 리스닝하지 않음"

echo ""
echo "[3/4] Java 프로세스:"
ps aux | grep "share-0.0.1-SNAPSHOT.jar" | grep -v grep || echo "  ✗ 실행 중인 프로세스 없음"

echo ""
echo "[4/4] 최근 로그 (에러 포함):"
echo "---"
sudo journalctl -u $SERVICE_NAME -n 50 --no-pager | tail -30

echo ""
echo "실시간 로그 보기:"
echo "  sudo journalctl -u share-springboot -f"

