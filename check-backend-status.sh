#!/bin/bash
# 백엔드 상태 확인 스크립트

echo "=== 백엔드 상태 확인 ==="
echo ""

echo "[1/5] 백엔드 서비스 상태:"
sudo systemctl status share-backend --no-pager -l | head -20
echo ""

echo "[2/5] 백엔드 로그 (최근 30줄):"
sudo journalctl -u share-backend -n 30 --no-pager
echo ""

echo "[3/5] 포트 8000 상태:"
sudo ss -tlnp | grep :8000 || echo "  포트 8000이 리스닝하지 않음"
echo ""

echo "[4/5] 백엔드 프로세스:"
ps aux | grep -E "python.*run_backend|uvicorn" | grep -v grep || echo "  실행 중인 백엔드 프로세스 없음"
echo ""

echo "[5/5] 백엔드 파일 확인:"
ls -la /opt/share-backend/ | head -10
echo ""

echo "=== 문제 해결 ==="
echo ""
echo "백엔드가 실행되지 않으면:"
echo "  cd /opt/share-backend"
echo "  python3 run_backend.py"
echo ""
echo "에러 확인 후 수정하세요."

