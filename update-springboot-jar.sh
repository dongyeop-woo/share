#!/bin/bash
# Spring Boot JAR 업데이트 스크립트

echo "=== Spring Boot JAR 업데이트 ==="
echo ""

SPRINGBOOT_DIR="/opt/share-springboot"
JAR_FILE="share-0.0.1-SNAPSHOT.jar"
SERVICE_NAME="share-springboot"

echo "[1/4] 기존 서비스 중지 중..."
sudo systemctl stop $SERVICE_NAME
sleep 2

echo "[2/4] JAR 파일 확인 및 복사 중..."
UBUNTU_HOME="/home/ubuntu"

if [ -f "$UBUNTU_HOME/$JAR_FILE" ]; then
    echo "  홈 디렉토리에서 JAR 파일 복사..."
    sudo cp "$UBUNTU_HOME/$JAR_FILE" "$SPRINGBOOT_DIR/"
    echo "  완료"
else
    echo "오류: JAR 파일을 찾을 수 없습니다: $UBUNTU_HOME/$JAR_FILE"
    echo "  현재 위치 파일 확인:"
    sudo ls -lh $UBUNTU_HOME/share-*.jar 2>/dev/null || echo "    없음"
    exit 1
fi

echo "[3/4] JAR 파일 권한 확인..."
sudo chown ubuntu:ubuntu "$SPRINGBOOT_DIR/$JAR_FILE"
ls -lh "$SPRINGBOOT_DIR/$JAR_FILE"

echo "[4/4] Spring Boot 서비스 재시작 중..."
sudo systemctl start $SERVICE_NAME
sleep 3

echo ""
echo "=== 업데이트 완료 ==="
echo ""
echo "서비스 상태:"
sudo systemctl status $SERVICE_NAME --no-pager -l | head -15

echo ""
echo "포트 확인:"
sudo ss -tlnp | grep :8001 || echo "  포트 8001이 아직 리스닝하지 않음"

echo ""
echo "로그 확인:"
echo "  sudo journalctl -u $SERVICE_NAME -f"

