#!/bin/bash
# 기존 서비스 중지 및 새 파일로 교체

set -e

FRONTEND_DIR="/var/www/breaking-share"
BACKEND_DIR="/home/ubuntu/fastapi"
BACKEND_NEW="/opt/share-backend"
DEPLOY_TEMP="/tmp/share-deploy"
ARCHIVE_PATH="/tmp/share-deploy.tar.gz"

echo "=== 기존 서비스 중지 및 교체 ==="
echo ""

# 1. 기존 서비스 중지
echo "[1/6] 기존 서비스 중지 중..."
echo "  gunicorn 프로세스 종료 중..."

# gunicorn 프로세스 찾아서 종료
GUNICORN_PIDS=$(pgrep -f "gunicorn.*8000" || true)
if [ -n "$GUNICORN_PIDS" ]; then
    echo "  PID: $GUNICORN_PIDS"
    sudo kill -TERM $GUNICORN_PIDS 2>/dev/null || true
    sleep 2
    # 강제 종료
    sudo pkill -9 -f "gunicorn.*8000" 2>/dev/null || true
    echo "  완료"
else
    echo "  실행 중인 gunicorn 없음"
fi

# 다른 Python 서버 종료
sudo pkill -f "python.*server.py" 2>/dev/null || true
sudo pkill -f "uvicorn.*app:app" 2>/dev/null || true

sleep 2
echo ""

# 2. 포트 확인
echo "[2/6] 포트 확인:"
if sudo lsof -i :8000 2>/dev/null || sudo ss -tlnp | grep :8000; then
    echo "  경고: 포트 8000이 아직 사용 중입니다!"
    echo "  강제 종료 중..."
    sudo fuser -k 8000/tcp 2>/dev/null || true
    sleep 1
else
    echo "  포트 8000 사용 가능"
fi
echo ""

# 3. 기존 파일 백업 (선택사항)
echo "[3/6] 기존 파일 백업 중..."
BACKUP_DIR="/opt/share-backup/$(date +%Y%m%d_%H%M%S)"
if [ -d "$BACKEND_DIR" ] || [ -d "$FRONTEND_DIR" ]; then
    sudo mkdir -p "$BACKUP_DIR"
    
    if [ -d "$BACKEND_DIR" ]; then
        echo "  백엔드 백업: $BACKEND_DIR -> $BACKUP_DIR/backend"
        sudo cp -r "$BACKEND_DIR" "$BACKUP_DIR/backend" 2>/dev/null || true
    fi
    
    if [ -d "$FRONTEND_DIR" ]; then
        echo "  프론트엔드 백업: $FRONTEND_DIR -> $BACKUP_DIR/frontend"
        sudo cp -r "$FRONTEND_DIR" "$BACKUP_DIR/frontend" 2>/dev/null || true
    fi
fi
echo ""

# 4. 기존 파일 삭제
echo "[4/6] 기존 파일 삭제 중..."
if [ -d "$BACKEND_DIR" ]; then
    echo "  백엔드 삭제: $BACKEND_DIR"
    sudo rm -rf "$BACKEND_DIR"
fi

if [ -d "$FRONTEND_DIR" ]; then
    echo "  프론트엔드 삭제: $FRONTEND_DIR"
    sudo rm -rf "$FRONTEND_DIR"
fi
echo ""

# 5. 배포 파일 확인 및 압축 해제
echo "[5/6] 새 파일 준비 중..."
if [ ! -f "$ARCHIVE_PATH" ]; then
    if [ -f ~/share-deploy.tar.gz ]; then
        echo "  홈 디렉토리에서 파일 발견, /tmp로 복사..."
        sudo cp ~/share-deploy.tar.gz "$ARCHIVE_PATH"
    else
        echo "오류: 배포 파일을 찾을 수 없습니다."
        echo "  필요: $ARCHIVE_PATH 또는 ~/share-deploy.tar.gz"
        exit 1
    fi
fi

sudo rm -rf "$DEPLOY_TEMP"
sudo mkdir -p "$DEPLOY_TEMP"
cd "$DEPLOY_TEMP"
echo "  압축 해제 중..."
sudo tar -xzf "$ARCHIVE_PATH"
echo ""

# 6. 새 파일 배치
echo "[6/6] 새 파일 배치 중..."

# 프론트엔드 배치
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

# 백엔드 배치 (새 위치)
sudo mkdir -p "$BACKEND_NEW"
if [ -d "$DEPLOY_TEMP/backend" ]; then
    sudo cp -r "$DEPLOY_TEMP/backend"/* "$BACKEND_NEW/"
fi
if [ -f "$DEPLOY_TEMP/run_backend.py" ]; then
    sudo cp "$DEPLOY_TEMP/run_backend.py" "$BACKEND_NEW/"
    sudo chmod +x "$BACKEND_NEW/run_backend.py"
fi

sudo rm -rf "$DEPLOY_TEMP"

echo ""
echo "=== 교체 완료 ==="
echo "프론트엔드: $FRONTEND_DIR"
echo "백엔드: $BACKEND_NEW"
echo ""
echo "다음 단계:"
echo "  1. Python 의존성 설치: cd $BACKEND_NEW && sudo pip3 install -r requirements.txt"
echo "  2. 서비스 시작: cleanup-and-deploy.sh 실행 또는 수동으로 systemd 설정"

