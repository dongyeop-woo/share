#!/bin/bash
# Spring Boot 최종 재시작 및 확인

set -e

echo "=== Spring Boot 최종 재시작 ==="
echo ""

SPRINGBOOT_DIR="/opt/share-springboot"
JAR_FILE="share-0.0.1-SNAPSHOT.jar"
SERVICE_NAME="share-springboot"

echo "[1/6] 기존 프로세스 완전 종료..."
sudo systemctl stop $SERVICE_NAME 2>/dev/null || true
sudo pkill -9 -f "share-0.0.1-SNAPSHOT.jar" 2>/dev/null || true
sleep 3

echo "[2/6] 포트 8001 정리..."
sudo fuser -k 8001/tcp 2>/dev/null || true
sleep 2

echo "[3/6] JAR 파일 확인..."
if [ ! -f "$SPRINGBOOT_DIR/$JAR_FILE" ]; then
    if [ -f "/home/ubuntu/$JAR_FILE" ]; then
        echo "  JAR 파일 복사 중..."
        sudo cp "/home/ubuntu/$JAR_FILE" "$SPRINGBOOT_DIR/"
    else
        echo "오류: JAR 파일을 찾을 수 없습니다"
        exit 1
    fi
fi
ls -lh "$SPRINGBOOT_DIR/$JAR_FILE" | head -1

echo "[4/6] application.yml 확인..."
if [ -f "$SPRINGBOOT_DIR/application.yml" ]; then
    echo "  RDS 설정:"
    sudo grep "url:" "$SPRINGBOOT_DIR/application.yml" | head -1
fi

echo "[5/6] Spring Boot 시작..."
sudo systemctl daemon-reload
sudo systemctl start $SERVICE_NAME
sleep 5

echo "[6/6] 상태 확인..."
echo ""
echo "서비스 상태:"
sudo systemctl status $SERVICE_NAME --no-pager -l | head -10

echo ""
echo "포트 8001:"
sudo ss -tlnp | grep :8001 || echo "  포트 8001이 리스닝하지 않음!"

echo ""
echo "최근 로그 (중요):"
sudo journalctl -u $SERVICE_NAME -n 30 --no-pager | tail -15

