#!/bin/bash
# 중복 프로세스 정리 및 재시작

set -e

echo "=== 중복 프로세스 정리 ==="
echo ""

SERVICE_NAME="share-springboot"
JAR_FILE="share-0.0.1-SNAPSHOT.jar"

echo "[1/6] 수동 실행 프로세스 찾기..."
MANUAL_PIDS=$(ps aux | grep "$JAR_FILE" | grep -v grep | grep -v "systemd" | awk '{print $2}')
if [ -n "$MANUAL_PIDS" ]; then
    echo "  발견된 수동 프로세스: $MANUAL_PIDS"
    for PID in $MANUAL_PIDS; do
        echo "  프로세스 $PID 종료 중..."
        sudo kill -9 $PID 2>/dev/null || true
    done
    sleep 2
else
    echo "  수동 프로세스 없음"
fi

echo "[2/6] 시스템 서비스 중지..."
sudo systemctl stop $SERVICE_NAME 2>/dev/null || true
sleep 2

echo "[3/6] 모든 Java 프로세스 정리..."
sudo pkill -9 -f "$JAR_FILE" 2>/dev/null || true
sleep 2

echo "[4/6] 포트 8001 정리..."
sudo fuser -k 8001/tcp 2>/dev/null || true
sleep 2

echo "[5/6] 확인: 남은 프로세스..."
REMAINING=$(ps aux | grep "$JAR_FILE" | grep -v grep | wc -l)
if [ "$REMAINING" -gt 0 ]; then
    echo "  ⚠ 아직 실행 중인 프로세스:"
    ps aux | grep "$JAR_FILE" | grep -v grep
else
    echo "  ✓ 모든 프로세스 종료됨"
fi

echo "[6/6] 포트 8001 확인..."
if sudo ss -tlnp | grep :8001; then
    echo "  ⚠ 포트 8001이 여전히 사용 중"
else
    echo "  ✓ 포트 8001 사용 가능"
fi

echo ""
echo "=== 다음 단계 ==="
echo "이제 시스템 서비스를 시작하세요:"
echo "  sudo systemctl start $SERVICE_NAME"
echo "  sudo systemctl status $SERVICE_NAME"

