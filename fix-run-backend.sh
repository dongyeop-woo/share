#!/bin/bash
# run_backend.py 수정 스크립트

echo "=== run_backend.py 수정 ==="
echo ""

cd /opt/share-backend

echo "[1/2] 현재 run_backend.py 확인:"
head -30 run_backend.py
echo ""

echo "[2/2] run_backend.py 수정 중..."
# backend 디렉토리 참조를 제거하고 현재 디렉토리에서 직접 실행하도록 수정
sudo sed -i 's|backend_dir = os.path.join(os.path.dirname(__file__), '\''backend'\'')|backend_dir = os.path.dirname(os.path.abspath(__file__))|g' run_backend.py

# sys.path에 backend_dir을 추가하는 부분은 유지 (하지만 실제로는 현재 디렉토리가 됨)
# os.chdir(backend_dir) 전에 backend_dir이 존재하는지 확인하는 코드 추가

echo "수정 완료"
echo ""

echo "수정된 파일 확인:"
head -30 run_backend.py

echo ""
echo "백엔드 서비스 재시작:"
sudo systemctl restart share-backend
sleep 2

echo ""
echo "서비스 상태:"
sudo systemctl status share-backend --no-pager -l | head -15

