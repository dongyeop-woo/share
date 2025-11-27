#!/bin/bash
# Spring Boot 재시작

set -e

echo "=== Spring Boot 재시작 ==="
echo ""

SERVICE_NAME="share-springboot"
SPRINGBOOT_DIR="/opt/share-springboot"
JAR_FILE="share-0.0.1-SNAPSHOT.jar"

echo "[1/5] 기존 프로세스 종료..."
sudo systemctl stop $SERVICE_NAME 2>/dev/null || true
sudo pkill -9 -f "$JAR_FILE" 2>/dev/null || true
sleep 3

echo "[2/5] 포트 정리..."
sudo fuser -k 8001/tcp 2>/dev/null || true
sleep 2

echo "[3/5] application.yml 확인..."
if [ -f "$SPRINGBOOT_DIR/application.yml" ]; then
    echo "  현재 설정:"
    sudo grep -A 2 "datasource:" "$SPRINGBOOT_DIR/application.yml" | grep -E "(username|password)"
fi

echo "[4/5] Spring Boot 시작..."
sudo systemctl daemon-reload
sudo systemctl start $SERVICE_NAME
sleep 8

echo "[5/5] 상태 확인..."
echo ""
echo "서비스 상태:"
sudo systemctl status $SERVICE_NAME --no-pager -l | head -12

echo ""
echo "포트 8001:"
if sudo ss -tlnp | grep :8001; then
    echo "  ✓ 포트 8001 리스닝 중"
else
    echo "  ✗ 포트 8001이 아직 리스닝하지 않음"
    echo ""
    echo "로그 확인:"
    sudo journalctl -u $SERVICE_NAME -n 30 --no-pager | tail -20
fi

