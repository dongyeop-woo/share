#!/bin/bash
# EC2에서 직접 실행할 간단한 배포 스크립트
# 파일 전송이 실패한 경우, 이 스크립트를 직접 다운로드해서 사용

set -e

FRONTEND_DIR="/var/www/share"
BACKEND_DIR="/opt/share-backend"
BACKUP_DIR="/opt/share-backup/$(date +%Y%m%d_%H%M%S)"

echo "=== 간단 배포 스크립트 ==="
echo "이 스크립트는 파일이 이미 전송되어 있다고 가정합니다."
echo ""

# 파일 확인
if [ ! -f "/tmp/share-deploy.tar.gz" ]; then
    echo "오류: /tmp/share-deploy.tar.gz 파일을 찾을 수 없습니다."
    echo ""
    echo "먼저 로컬에서 파일을 전송하세요:"
    echo "  scp -i key.pem share-deploy.tar.gz ubuntu@54.253.167.33:/tmp/"
    exit 1
fi

# 기존 프로세스 종료
echo "[1/5] 기존 프로세스 종료 중..."
sudo pkill -f "python.*server.py" 2>/dev/null || true
sudo pkill -f "uvicorn.*app:app" 2>/dev/null || true
sleep 1

# 백업
echo "[2/5] 백업 생성 중..."
if [ -d "$FRONTEND_DIR" ] || [ -d "$BACKEND_DIR" ]; then
    sudo mkdir -p "$BACKUP_DIR"
    [ -d "$FRONTEND_DIR" ] && sudo cp -r "$FRONTEND_DIR" "$BACKUP_DIR/frontend" 2>/dev/null || true
    [ -d "$BACKEND_DIR" ] && sudo cp -r "$BACKEND_DIR" "$BACKUP_DIR/backend" 2>/dev/null || true
fi

# 압축 해제
echo "[3/5] 파일 압축 해제 중..."
DEPLOY_TEMP="/tmp/share-deploy-$(date +%s)"
sudo rm -rf "$DEPLOY_TEMP"
sudo mkdir -p "$DEPLOY_TEMP"
cd "$DEPLOY_TEMP"
sudo tar -xzf /tmp/share-deploy.tar.gz

# 파일 배치
echo "[4/5] 파일 배치 중..."
sudo mkdir -p "$FRONTEND_DIR" "$BACKEND_DIR"
sudo rm -rf "$FRONTEND_DIR"/* "$BACKEND_DIR"/*

[ -d "$DEPLOY_TEMP/assets" ] && sudo cp -r "$DEPLOY_TEMP/assets" "$FRONTEND_DIR/"
ls "$DEPLOY_TEMP"/*.html 2>/dev/null | xargs -I {} sudo cp {} "$FRONTEND_DIR/" || true
[ -f "$DEPLOY_TEMP/server.py" ] && sudo cp "$DEPLOY_TEMP/server.py" "$FRONTEND_DIR/" && sudo chmod +x "$FRONTEND_DIR/server.py"

[ -d "$DEPLOY_TEMP/backend" ] && sudo cp -r "$DEPLOY_TEMP/backend"/* "$BACKEND_DIR/"
[ -f "$DEPLOY_TEMP/run_backend.py" ] && sudo cp "$DEPLOY_TEMP/run_backend.py" "$BACKEND_DIR/" && sudo chmod +x "$BACKEND_DIR/run_backend.py"

# 의존성 설치
echo "[5/5] Python 의존성 설치 중..."
if [ -f "$BACKEND_DIR/requirements.txt" ]; then
    sudo pip3 install -q --upgrade pip 2>/dev/null || true
    sudo pip3 install -r "$BACKEND_DIR/requirements.txt" || {
        echo "경고: requirements.txt 실패, minimal 시도..."
        [ -f "$BACKEND_DIR/requirements-minimal.txt" ] && sudo pip3 install -r "$BACKEND_DIR/requirements-minimal.txt"
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

echo ""
echo "=== 배포 완료 ==="
sudo systemctl status share-frontend --no-pager -l | head -5
sudo systemctl status share-backend --no-pager -l | head -5

sudo rm -rf "$DEPLOY_TEMP"

