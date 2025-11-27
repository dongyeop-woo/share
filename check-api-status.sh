#!/bin/bash
# API 상태 확인

echo "=== API 상태 확인 ==="
echo ""

echo "[1/5] 포트 8001 확인:"
if sudo ss -tlnp | grep :8001; then
    echo "  ✓ 포트 8001 리스닝 중"
else
    echo "  ✗ 포트 8001 리스닝 안 됨"
    exit 1
fi

echo ""
echo "[2/5] 서비스 상태:"
sudo systemctl status share-springboot --no-pager -l | head -10

echo ""
echo "[3/5] API 엔드포인트 테스트:"
echo "  /api/auth/me (GET):"
curl -s -w "\nHTTP Status: %{http_code}\n" http://localhost:8001/api/auth/me 2>&1 | head -5

echo ""
echo "[4/5] 로그인 API 확인:"
echo "  /api/auth/login 존재 확인..."
curl -s -X OPTIONS http://localhost:8001/api/auth/login -v 2>&1 | grep -E "(HTTP|Allow|Access-Control)" | head -5

echo ""
echo "[5/5] 최근 로그 (에러 확인):"
sudo journalctl -u share-springboot -n 50 --no-pager | grep -E "(ERROR|WARN|Exception|Failed)" | tail -10

echo ""
echo "=== Nginx 프록시 확인 ==="
echo "Nginx 프록시 테스트:"
curl -s -w "\nHTTP Status: %{http_code}\n" http://localhost/api/auth/me 2>&1 | head -5

