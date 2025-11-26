#!/bin/bash
# Spring Boot 배포 스크립트 (수정 버전)

set -e

SPRINGBOOT_DIR="/opt/share-springboot"
SPRINGBOOT_JAR="share-0.0.1-SNAPSHOT.jar"
SERVICE_NAME="share-springboot"

echo "=== Spring Boot 배포 ==="
echo ""

# 1. 기존 서비스 중지
echo "[1/5] 기존 서비스 중지 중..."
sudo systemctl stop $SERVICE_NAME 2>/dev/null || echo "  서비스 없음"
sudo pkill -f "java.*$SPRINGBOOT_JAR" 2>/dev/null || true
sleep 2

# 2. 디렉토리 생성
echo "[2/5] 디렉토리 준비 중..."
sudo mkdir -p "$SPRINGBOOT_DIR"
cd "$SPRINGBOOT_DIR"

# 3. JAR 파일 확인 및 복사
echo "[3/5] JAR 파일 확인 중..."
UBUNTU_HOME="/home/ubuntu"

if [ -f "$UBUNTU_HOME/$SPRINGBOOT_JAR" ]; then
    echo "  홈 디렉토리에서 JAR 파일 복사..."
    sudo cp "$UBUNTU_HOME/$SPRINGBOOT_JAR" "$SPRINGBOOT_DIR/"
    echo "  복사 완료"
elif [ -f "/opt/share-springboot/$SPRINGBOOT_JAR" ]; then
    echo "  이미 배치된 JAR 파일 확인"
else
    echo "오류: JAR 파일을 찾을 수 없습니다."
    echo "  홈 디렉토리 확인:"
    sudo ls -lh $UBUNTU_HOME/share-*.jar 2>/dev/null || echo "    없음"
    exit 1
fi

# 파일 존재 확인
if [ ! -f "$SPRINGBOOT_DIR/$SPRINGBOOT_JAR" ]; then
    echo "오류: JAR 파일 복사 실패"
    exit 1
fi

echo "  JAR 파일 확인 완료: $SPRINGBOOT_DIR/$SPRINGBOOT_JAR"

# 4. application.yml 확인 및 복사
echo "[4/5] 설정 파일 확인 중..."
if [ -f "$UBUNTU_HOME/application.yml" ]; then
    echo "  application.yml 복사..."
    sudo cp "$UBUNTU_HOME/application.yml" "$SPRINGBOOT_DIR/" || true
fi

# 5. systemd 서비스 설정
echo "[5/5] systemd 서비스 설정 중..."
sudo tee /etc/systemd/system/$SERVICE_NAME.service > /dev/null <<EOF
[Unit]
Description=Share Spring Boot Backend (Auth API)
After=network.target mysql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=$SPRINGBOOT_DIR
Environment="JAVA_HOME=/usr/lib/jvm/default-java"
ExecStart=/usr/bin/java -jar -Dspring.profiles.active=prod $SPRINGBOOT_DIR/$SPRINGBOOT_JAR --server.port=8001
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME
sudo systemctl start $SERVICE_NAME

sleep 3

echo ""
echo "=== 배포 완료 ==="
echo ""
echo "서비스 상태:"
sudo systemctl status $SERVICE_NAME --no-pager -l | head -15

echo ""
echo "포트 확인:"
sudo ss -tlnp | grep :8001 || echo "  포트 8001이 아직 리스닝하지 않음"

echo ""
echo "로그 확인:"
echo "  sudo journalctl -u $SERVICE_NAME -f"

