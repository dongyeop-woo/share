#!/bin/bash
# CORS 문제 강제 해결

set -e

echo "=== CORS 문제 강제 해결 ==="
echo ""

SPRINGBOOT_DIR="/opt/share-springboot"
JAR_FILE="share-0.0.1-SNAPSHOT.jar"
SERVICE_NAME="share-springboot"

echo "[1/5] 기존 프로세스 완전 종료..."
sudo systemctl stop $SERVICE_NAME 2>/dev/null || true
sudo pkill -9 -f "share-0.0.1-SNAPSHOT.jar" 2>/dev/null || true
sleep 2

echo "[2/5] JAR 파일 확인 및 복사..."
if [ -f "/home/ubuntu/$JAR_FILE" ]; then
    sudo cp "/home/ubuntu/$JAR_FILE" "$SPRINGBOOT_DIR/"
    sudo chown ubuntu:ubuntu "$SPRINGBOOT_DIR/$JAR_FILE"
    echo "  JAR 파일 복사 완료"
    ls -lh "$SPRINGBOOT_DIR/$JAR_FILE"
else
    echo "오류: JAR 파일 없음: /home/ubuntu/$JAR_FILE"
    exit 1
fi

echo ""
echo "[3/5] application.yml 확인..."
if [ -f "/home/ubuntu/application.yml" ]; then
    sudo cp "/home/ubuntu/application.yml" "$SPRINGBOOT_DIR/"
    echo "  application.yml 복사 완료"
fi
sudo grep "url:" "$SPRINGBOOT_DIR/application.yml" | head -1

echo ""
echo "[4/5] 포트 정리..."
sudo fuser -k 8001/tcp 2>/dev/null || true
sleep 1

echo ""
echo "[5/5] Spring Boot 재시작..."
sudo systemctl daemon-reload
sudo systemctl start $SERVICE_NAME
sleep 5

echo ""
echo "=== 상태 확인 ==="
echo ""
echo "서비스 상태:"
sudo systemctl status $SERVICE_NAME --no-pager -l | head -15

echo ""
echo "포트 확인:"
sudo ss -tlnp | grep :8001

echo ""
echo "최근 로그 (에러 확인):"
sudo journalctl -u $SERVICE_NAME -n 20 --no-pager | tail -10

