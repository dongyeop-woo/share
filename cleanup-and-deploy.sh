#!/bin/bash
# 디스크 정리 및 배포 스크립트

set -e

FRONTEND_DIR="/var/www/breaking-share"
BACKEND_DIR="/opt/share-backend"
DEPLOY_TEMP="/tmp/share-deploy"
ARCHIVE_PATH="/tmp/share-deploy.tar.gz"

echo "=== 디스크 정리 및 배포 ==="
echo ""

# 1. 디스크 공간 확인
echo "[1/7] 현재 디스크 사용량:"
df -h / | tail -1
echo ""

# 2. 기존 서비스 중지
echo "[2/7] 기존 서비스 중지 중..."
sudo systemctl stop share-frontend 2>/dev/null || echo "  share-frontend 없음"
sudo systemctl stop share-backend 2>/dev/null || echo "  share-backend 없음"

# gunicorn 프로세스 종료
GUNICORN_PIDS=$(pgrep -f "gunicorn.*8000" || true)
if [ -n "$GUNICORN_PIDS" ]; then
    echo "  gunicorn 프로세스 종료 중 (PID: $GUNICORN_PIDS)"
    sudo kill -TERM $GUNICORN_PIDS 2>/dev/null || true
    sleep 2
    sudo pkill -9 -f "gunicorn.*8000" 2>/dev/null || true
fi

sudo pkill -f "python.*server.py" 2>/dev/null || true
sudo pkill -f "uvicorn.*app:app" 2>/dev/null || true
sleep 2

# 포트 해제
sudo fuser -k 8000/tcp 2>/dev/null || true
sleep 1

# 3. 기존 파일 삭제 (백엔드, 프론트엔드)
echo "[3/7] 기존 파일 삭제 중..."

# 기존 백엔드 위치 삭제
OLD_BACKEND="/home/ubuntu/fastapi"
if [ -d "$OLD_BACKEND" ]; then
    echo "  기존 백엔드 삭제: $OLD_BACKEND"
    sudo rm -rf "$OLD_BACKEND"
    echo "  삭제 완료"
fi

if [ -d "$FRONTEND_DIR" ]; then
    echo "  프론트엔드 삭제: $FRONTEND_DIR"
    sudo rm -rf "$FRONTEND_DIR"
    echo "  삭제 완료"
fi

if [ -d "$BACKEND_DIR" ]; then
    echo "  백엔드 삭제: $BACKEND_DIR"
    sudo rm -rf "$BACKEND_DIR"
    echo "  삭제 완료"
fi

# 4. 불필요한 파일 정리
echo "[4/7] 불필요한 파일 정리 중..."

# 임시 파일 정리
sudo find /tmp -type f -mtime +7 -delete 2>/dev/null || true
sudo find /var/tmp -type f -mtime +7 -delete 2>/dev/null || true

# 로그 파일 정리
sudo journalctl --vacuum-time=3d 2>/dev/null || true

# apt 캐시 정리
sudo apt-get clean 2>/dev/null || true
sudo apt-get autoclean 2>/dev/null || true

# pip 캐시 정리
sudo rm -rf ~/.cache/pip/* 2>/dev/null || true
sudo rm -rf /root/.cache/pip/* 2>/dev/null || true

# Python __pycache__ 정리
sudo find /home /opt /var/www -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
sudo find /home /opt /var/www -name "*.pyc" -delete 2>/dev/null || true

# 5. 디스크 공간 확인
echo ""
echo "[5/7] 정리 후 디스크 사용량:"
df -h / | tail -1
echo ""

# 6. 배포 파일 확인 및 압축 해제
echo "[6/7] 배포 파일 준비 중..."
if [ ! -f "$ARCHIVE_PATH" ]; then
    # 홈 디렉토리에서 찾기
    if [ -f ~/share-deploy.tar.gz ]; then
        echo "  홈 디렉토리에서 파일 발견, /tmp로 복사 중..."
        sudo cp ~/share-deploy.tar.gz "$ARCHIVE_PATH"
    else
        echo "오류: 배포 파일을 찾을 수 없습니다."
        echo "  /tmp/share-deploy.tar.gz 또는 ~/share-deploy.tar.gz 필요"
        exit 1
    fi
fi

# 압축 해제
sudo rm -rf "$DEPLOY_TEMP"
sudo mkdir -p "$DEPLOY_TEMP"
cd "$DEPLOY_TEMP"
echo "  압축 해제 중..."
sudo tar -xzf "$ARCHIVE_PATH"

# 7. 새 파일 배치
echo "[7/7] 새 파일 배치 중..."

# 프론트엔드
sudo mkdir -p "$FRONTEND_DIR"
if [ -d "$DEPLOY_TEMP/assets" ]; then
    sudo cp -r "$DEPLOY_TEMP/assets" "$FRONTEND_DIR/"
fi
if ls "$DEPLOY_TEMP"/*.html 1> /dev/null 2>&1; then
    sudo cp "$DEPLOY_TEMP"/*.html "$FRONTEND_DIR/"
fi
if [ -f "$DEPLOY_TEMP/server.py" ]; then
    sudo cp "$DEPLOY_TEMP/server.py" "$FRONTEND_DIR/"
    sudo chmod +x "$FRONTEND_DIR/server.py"
fi

# 백엔드
sudo mkdir -p "$BACKEND_DIR"
if [ -d "$DEPLOY_TEMP/backend" ]; then
    sudo cp -r "$DEPLOY_TEMP/backend"/* "$BACKEND_DIR/"
fi
if [ -f "$DEPLOY_TEMP/run_backend.py" ]; then
    sudo cp "$DEPLOY_TEMP/run_backend.py" "$BACKEND_DIR/"
    sudo chmod +x "$BACKEND_DIR/run_backend.py"
fi

# Python 의존성 설치 (필요한 것만)
echo ""
echo "[8/8] Python 의존성 설치 중..."
if [ -f "$BACKEND_DIR/requirements.txt" ]; then
    sudo pip3 install --upgrade pip 2>/dev/null || true
    # 필요한 패키지만 설치 (기존 패키지 재사용)
    sudo pip3 install -r "$BACKEND_DIR/requirements.txt" --no-cache-dir || {
        echo "  일부 패키지 설치 실패, minimal 시도..."
        if [ -f "$BACKEND_DIR/requirements-minimal.txt" ]; then
            sudo pip3 install -r "$BACKEND_DIR/requirements-minimal.txt" --no-cache-dir
        fi
    }
fi

# systemd 서비스 설정
sudo tee /etc/systemd/system/share-frontend.service > /dev/null <<EOF
[Unit]
Description=Share Frontend Server
After=network.target
[Service]
Type=simple
User=ubuntu
WorkingDirectory=$FRONTEND_DIR
ExecStart=/usr/bin/python3 $FRONTEND_DIR/server.py
Restart=always
RestartSec=10
[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/share-backend.service > /dev/null <<EOF
[Unit]
Description=Share Backend API Server
After=network.target
[Service]
Type=simple
User=ubuntu
WorkingDirectory=$BACKEND_DIR
ExecStart=/usr/bin/python3 $BACKEND_DIR/run_backend.py
Restart=always
RestartSec=10
[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable share-frontend share-backend
sudo systemctl start share-frontend share-backend

sleep 2

# 정리
sudo rm -rf "$DEPLOY_TEMP"

echo ""
echo "=== 배포 완료 ==="
echo ""
echo "디스크 사용량:"
df -h / | tail -1
echo ""
echo "서비스 상태:"
sudo systemctl status share-frontend --no-pager -l | head -3
sudo systemctl status share-backend --no-pager -l | head -3
echo ""
echo "포트 확인:"
sudo ss -tlnp | grep -E "8080|8000" || echo "포트 확인 중..."

