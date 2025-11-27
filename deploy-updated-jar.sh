#!/bin/bash
# 업데이트된 JAR 배포

set -e

echo "=== 업데이트된 Spring Boot JAR 배포 ==="
echo ""

SPRINGBOOT_DIR="/opt/share-springboot"
JAR_FILE="share-0.0.1-SNAPSHOT.jar"
SERVICE_NAME="share-springboot"
HOME_DIR="/home/ubuntu"

echo "[1/6] 기존 서비스 중지..."
sudo systemctl stop $SERVICE_NAME 2>/dev/null || true
sudo pkill -9 -f "$JAR_FILE" 2>/dev/null || true
sleep 2

echo "[2/6] JAR 파일 확인..."
if [ ! -f "$HOME_DIR/$JAR_FILE" ]; then
    echo "오류: JAR 파일을 찾을 수 없습니다: $HOME_DIR/$JAR_FILE"
    exit 1
fi

echo "  JAR 파일 위치: $HOME_DIR/$JAR_FILE"
ls -lh "$HOME_DIR/$JAR_FILE" | head -1

echo "[3/6] application.yml 확인..."
if [ -f "$HOME_DIR/application.yml" ]; then
    echo "  application.yml 복사 중..."
    sudo cp "$HOME_DIR/application.yml" "$SPRINGBOOT_DIR/"
    echo "  업데이트된 설정:"
    sudo grep -A 2 "datasource:" "$SPRINGBOOT_DIR/application.yml" | grep -E "(username|password)"
else
    echo "  경고: application.yml이 없습니다. 기존 설정 사용"
fi

echo "[4/6] JAR 파일 복사..."
sudo mkdir -p "$SPRINGBOOT_DIR"
sudo cp "$HOME_DIR/$JAR_FILE" "$SPRINGBOOT_DIR/"
sudo chown ubuntu:ubuntu "$SPRINGBOOT_DIR/$JAR_FILE"

echo "[5/6] Spring Boot 시작..."
sudo systemctl daemon-reload
sudo systemctl start $SERVICE_NAME
sleep 5

echo "[6/6] 상태 확인..."
echo ""
echo "서비스 상태:"
sudo systemctl status $SERVICE_NAME --no-pager -l | head -12

echo ""
echo "포트 8001:"
sudo ss -tlnp | grep :8001 || echo "  ⚠ 포트 8001이 아직 리스닝하지 않음"

echo ""
echo "최근 로그:"
sudo journalctl -u $SERVICE_NAME -n 20 --no-pager | tail -10

echo ""
echo "=== 배포 완료 ==="
echo "연결 테스트:"
echo "  sudo journalctl -u share-springboot -f"

