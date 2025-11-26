#!/bin/bash
# EC2 서버에서 실행할 배포 스크립트

set -e  # 에러 발생 시 중단

INSTANCE_IP="54.253.167.33"
FRONTEND_DIR="/var/www/share"
BACKEND_DIR="/opt/share-backend"
DEPLOY_TEMP="/tmp/share-deploy"
ARCHIVE_PATH="/tmp/share-deploy.tar.gz"
BACKUP_DIR="/opt/share-backup/$(date +%Y%m%d_%H%M%S)"

echo "=== EC2 서버 배포 시작 ==="

# 1. 기존 서비스 중지
echo "[1/8] 기존 서비스 중지 중..."
sudo systemctl stop share-frontend 2>/dev/null || echo "  share-frontend 서비스가 없거나 이미 중지됨"
sudo systemctl stop share-backend 2>/dev/null || echo "  share-backend 서비스가 없거나 이미 중지됨"

# 잠시 대기
sleep 2

# 2. 기존 프로세스 강제 종료 (혹시 모를 경우)
echo "[2/8] 기존 프로세스 확인 및 종료 중..."
sudo pkill -f "python.*server.py" 2>/dev/null || true
sudo pkill -f "uvicorn.*app:app" 2>/dev/null || true
sleep 1

# 3. 백업 생성
echo "[3/8] 기존 파일 백업 중..."
if [ -d "$FRONTEND_DIR" ] || [ -d "$BACKEND_DIR" ]; then
    sudo mkdir -p "$BACKUP_DIR"
    
    if [ -d "$FRONTEND_DIR" ]; then
        echo "  프론트엔드 백업: $FRONTEND_DIR -> $BACKUP_DIR/frontend"
        sudo cp -r "$FRONTEND_DIR" "$BACKUP_DIR/frontend" 2>/dev/null || true
    fi
    
    if [ -d "$BACKEND_DIR" ]; then
        echo "  백엔드 백업: $BACKEND_DIR -> $BACKUP_DIR/backend"
        sudo cp -r "$BACKEND_DIR" "$BACKUP_DIR/backend" 2>/dev/null || true
    fi
fi

# 4. 압축 파일 확인
if [ ! -f "$ARCHIVE_PATH" ]; then
    echo "오류: 배포 파일을 찾을 수 없습니다: $ARCHIVE_PATH"
    exit 1
fi

# 5. 압축 해제
echo "[4/8] 배포 파일 압축 해제 중..."
sudo rm -rf "$DEPLOY_TEMP"
sudo mkdir -p "$DEPLOY_TEMP"
sudo tar -xzf "$ARCHIVE_PATH" -C "$DEPLOY_TEMP"

# 6. 기존 디렉토리 정리 및 새 파일 배치
echo "[5/8] 파일 배치 중..."

# 프론트엔드 배치
sudo mkdir -p "$FRONTEND_DIR"
sudo rm -rf "$FRONTEND_DIR"/*

if [ -d "$DEPLOY_TEMP/assets" ]; then
    sudo cp -r "$DEPLOY_TEMP"/assets "$FRONTEND_DIR/"
fi

if ls "$DEPLOY_TEMP"/*.html 1> /dev/null 2>&1; then
    sudo cp "$DEPLOY_TEMP"/*.html "$FRONTEND_DIR/"
fi

if [ -f "$DEPLOY_TEMP/server.py" ]; then
    sudo cp "$DEPLOY_TEMP/server.py" "$FRONTEND_DIR/"
    sudo chmod +x "$FRONTEND_DIR/server.py"
fi

# 백엔드 배치
sudo mkdir -p "$BACKEND_DIR"
sudo rm -rf "$BACKEND_DIR"/*

if [ -d "$DEPLOY_TEMP/backend" ]; then
    sudo cp -r "$DEPLOY_TEMP/backend"/* "$BACKEND_DIR/"
fi

if [ -f "$DEPLOY_TEMP/run_backend.py" ]; then
    sudo cp "$DEPLOY_TEMP/run_backend.py" "$BACKEND_DIR/"
    sudo chmod +x "$BACKEND_DIR/run_backend.py"
fi

# 7. Python 의존성 설치
echo "[6/8] Python 의존성 설치 중..."
if [ -f "$BACKEND_DIR/requirements.txt" ]; then
    sudo pip3 install --upgrade pip 2>/dev/null || true
    sudo pip3 install -r "$BACKEND_DIR/requirements.txt" || {
        echo "경고: 일부 패키지 설치 실패. requirements-minimal.txt 시도..."
        if [ -f "$BACKEND_DIR/requirements-minimal.txt" ]; then
            sudo pip3 install -r "$BACKEND_DIR/requirements-minimal.txt"
        fi
    }
fi

# 8. systemd 서비스 파일 생성/업데이트
echo "[7/8] systemd 서비스 설정 중..."

# 프론트엔드 서비스
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
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# 백엔드 서비스
sudo tee /etc/systemd/system/share-backend.service > /dev/null <<EOF
[Unit]
Description=Share Backend API Server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=$BACKEND_DIR
Environment="PATH=/usr/bin:/usr/local/bin"
ExecStart=/usr/bin/python3 $BACKEND_DIR/run_backend.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# systemd 데몬 리로드
sudo systemctl daemon-reload

# 9. 서비스 시작 및 활성화
echo "[8/8] 서비스 시작 중..."

sudo systemctl enable share-frontend
sudo systemctl enable share-backend

sudo systemctl start share-frontend
sleep 2
sudo systemctl start share-backend
sleep 2

# 서비스 상태 확인
echo ""
echo "=== 서비스 상태 ==="
sudo systemctl status share-frontend --no-pager -l || true
echo ""
sudo systemctl status share-backend --no-pager -l || true

# 10. 포트 확인
echo ""
echo "=== 포트 확인 ==="
sudo netstat -tlnp | grep -E "8080|8000" || sudo ss -tlnp | grep -E "8080|8000" || echo "포트 정보 확인 실패 (netstat/ss 없음)"

# 11. 정리
echo ""
echo "[완료] 임시 파일 정리 중..."
sudo rm -rf "$DEPLOY_TEMP"
# 압축 파일은 보관 (다시 배포할 수 있도록)
# sudo rm -f "$ARCHIVE_PATH"

echo ""
echo "=== 배포 완료 ==="
echo "프론트엔드: http://$INSTANCE_IP:8080"
echo "백엔드 API: http://$INSTANCE_IP:8000"
echo ""
echo "백업 위치: $BACKUP_DIR"
echo ""
echo "로그 확인:"
echo "  sudo journalctl -u share-frontend -f"
echo "  sudo journalctl -u share-backend -f"

