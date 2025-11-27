#!/bin/bash
# 모바일 세션 문제 해결을 위한 설정 확인

echo "=== 모바일 세션 문제 해결 ==="
echo ""

echo "[1/4] 현재 application.yml 확인:"
if [ -f "/opt/share-springboot/application.yml" ]; then
    echo "  세션 설정:"
    sudo grep -A 5 "session:" /opt/share-springboot/application.yml | head -6
else
    echo "  ✗ application.yml 없음"
fi

echo ""
echo "[2/4] Spring Boot 로그 (세션 관련):"
sudo journalctl -u share-springboot -n 100 --no-pager | grep -E "(session|Session|SESSION|cookie|Cookie)" | tail -10

echo ""
echo "[3/4] 최근 에러 로그:"
sudo journalctl -u share-springboot -n 100 --no-pager | grep -E "(ERROR|Exception|Failed)" | tail -10

echo ""
echo "[4/4] API 테스트 (세션 쿠키 포함):"
echo "  로그인 시도:"
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}' \
  -c /tmp/cookies.txt \
  -v 2>&1 | grep -E "(HTTP|Set-Cookie|JSESSIONID)" | head -5

if [ -f /tmp/cookies.txt ]; then
    echo ""
    echo "  쿠키 확인:"
    cat /tmp/cookies.txt | grep JSESSIONID
fi

echo ""
echo "=== 해결 방법 ==="
echo "1. application.yml의 세션 설정 확인"
echo "2. 새 JAR 빌드 및 배포 필요 (세션 타임아웃 증가 포함)"
echo "3. 브라우저에서 쿠키가 설정되는지 확인"

