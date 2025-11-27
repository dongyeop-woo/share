#!/bin/bash
# 모든 문제 해결 및 서비스 시작

set -e

echo "=== Spring Boot 완전 복구 ==="
echo ""

SERVICE_NAME="share-springboot"
JAR_FILE="share-0.0.1-SNAPSHOT.jar"
SERVICE_FILE="/etc/systemd/system/share-springboot.service"

echo "[1/7] 수동 실행 프로세스 종료..."
MANUAL_PIDS=$(ps aux | grep "$JAR_FILE" | grep -v grep | grep -v "systemd" | awk '{print $2}' || true)
if [ -n "$MANUAL_PIDS" ]; then
    for PID in $MANUAL_PIDS; do
        echo "  프로세스 $PID 종료..."
        sudo kill -9 $PID 2>/dev/null || true
    done
    sleep 2
fi

echo "[2/7] 시스템 서비스 중지..."
sudo systemctl stop $SERVICE_NAME 2>/dev/null || true
sleep 2

echo "[3/7] 모든 프로세스 정리..."
sudo pkill -9 -f "$JAR_FILE" 2>/dev/null || true
sleep 2

echo "[4/7] 포트 8001 정리..."
sudo fuser -k 8001/tcp 2>/dev/null || true
sleep 2

echo "[5/7] 메모리 설정 증가..."
if [ -f "$SERVICE_FILE" ]; then
    sudo sed -i 's/-Xmx128m/-Xmx512m/g' "$SERVICE_FILE"
    sudo sed -i 's/-Xms64m/-Xms256m/g' "$SERVICE_FILE"
    echo "  ✓ 메모리 설정 변경 완료"
    sudo systemctl daemon-reload
else
    echo "  ⚠ 서비스 파일 없음"
fi

echo "[6/7] JAR 파일 확인..."
SPRINGBOOT_DIR="/opt/share-springboot"
if [ ! -f "$SPRINGBOOT_DIR/$JAR_FILE" ]; then
    if [ -f "/home/ubuntu/$JAR_FILE" ]; then
        echo "  JAR 파일 복사 중..."
        sudo mkdir -p "$SPRINGBOOT_DIR"
        sudo cp "/home/ubuntu/$JAR_FILE" "$SPRINGBOOT_DIR/"
    fi
fi

echo "[7/7] 서비스 시작..."
sudo systemctl start $SERVICE_NAME
sleep 8

echo ""
echo "=== 결과 확인 ==="
echo ""
echo "서비스 상태:"
sudo systemctl status $SERVICE_NAME --no-pager -l | head -12

echo ""
echo "포트 8001:"
if sudo ss -tlnp | grep :8001; then
    echo "  ✓ 포트 8001 리스닝 중!"
else
    echo "  ✗ 포트 8001 리스닝 안 됨"
    echo ""
    echo "로그 확인:"
    sudo journalctl -u $SERVICE_NAME -n 30 --no-pager | tail -20
fi

