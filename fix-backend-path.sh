#!/bin/bash
# run_backend.py 수정 스크립트

echo "=== run_backend.py 수정 ==="
echo ""

cd /opt/share-backend

echo "[1/2] 현재 run_backend.py 백업:"
sudo cp run_backend.py run_backend.py.backup

echo "[2/2] run_backend.py 수정 중..."
# backend 디렉토리 참조를 현재 디렉토리로 변경
sudo sed -i "s|backend_dir = os.path.join(os.path.dirname(__file__), 'backend')|backend_dir = os.path.dirname(os.path.abspath(__file__))|g" run_backend.py

echo "수정 완료"
echo ""

echo "수정된 파일 확인:"
head -25 run_backend.py

echo ""
echo "백엔드 서비스 재시작:"
sudo systemctl restart share-backend
sleep 3

echo ""
echo "서비스 상태:"
sudo systemctl status share-backend --no-pager -l | head -20

echo ""
echo "포트 확인:"
sudo ss -tlnp | grep :8000 || echo "  포트 8000이 아직 리스닝하지 않음"

