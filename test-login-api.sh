#!/bin/bash
# 로그인 API 테스트

echo "=== 로그인 API 테스트 ==="
echo ""

echo "[1/4] Spring Boot 포트 확인:"
if sudo ss -tlnp | grep :8001; then
    echo "  ✓ 포트 8001 리스닝 중"
else
    echo "  ✗ 포트 8001 리스닝 안 됨 - Spring Boot가 실행되지 않음"
    exit 1
fi

echo ""
echo "[2/4] 로컬 API 직접 테스트:"
echo "  POST /api/auth/login:"
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}' \
  -v 2>&1 | grep -E "(HTTP|401|200|400)" | head -5

echo ""
echo "[3/4] Nginx 프록시 테스트:"
echo "  POST /api/auth/login (via Nginx):"
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}' \
  -v 2>&1 | grep -E "(HTTP|401|200|400|502)" | head -5

echo ""
echo "[4/4] CORS 헤더 확인:"
curl -X OPTIONS http://localhost:8001/api/auth/login \
  -H "Origin: https://tradenotekr.com" \
  -H "Access-Control-Request-Method: POST" \
  -v 2>&1 | grep -E "(HTTP|Access-Control)" | head -5

echo ""
echo "[5/5] 최근 에러 로그:"
sudo journalctl -u share-springboot -n 100 --no-pager | grep -E "(ERROR|Exception|Failed|WARN)" | tail -10

