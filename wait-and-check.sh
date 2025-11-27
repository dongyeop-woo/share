#!/bin/bash
# Spring Boot 시작 대기 및 확인

echo "=== Spring Boot 시작 확인 ==="
echo ""

SERVICE_NAME="share-springboot"

echo "Spring Boot가 시작될 때까지 대기 중..."
echo "(최대 30초 대기)"
echo ""

for i in {1..30}; do
    sleep 1
    if sudo ss -tlnp | grep -q ":8001"; then
        echo ""
        echo "✓ 포트 8001이 리스닝 중입니다!"
        break
    fi
    echo -n "."
done

echo ""
echo ""
echo "=== 현재 상태 ==="
echo ""

echo "[1] 포트 8001:"
if sudo ss -tlnp | grep :8001; then
    echo "  ✓ 리스닝 중"
else
    echo "  ✗ 리스닝 안 됨"
fi

echo ""
echo "[2] 서비스 상태:"
sudo systemctl status $SERVICE_NAME --no-pager -l | head -12

echo ""
echo "[3] 최근 로그:"
sudo journalctl -u $SERVICE_NAME -n 30 --no-pager | tail -20

echo ""
echo "[4] 데이터베이스 연결 테스트:"
if sudo ss -tlnp | grep -q ":8001"; then
    echo "  API 테스트:"
    curl -s http://localhost:8001/api/auth/me 2>&1 | head -3
fi

