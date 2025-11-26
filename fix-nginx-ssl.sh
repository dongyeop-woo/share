#!/bin/bash
# Nginx SSL 설정 수정 스크립트

echo "=== Nginx SSL 설정 수정 ==="
echo ""

NGINX_CONF="/etc/nginx/sites-available/default"

echo "[1/4] 현재 SSL 인증서 확인:"
sudo ls -la /etc/letsencrypt/live/ 2>/dev/null || echo "  인증서 디렉토리 없음"
echo ""

echo "[2/4] 현재 SSL 설정 확인:"
sudo grep -A 5 "ssl_certificate" "$NGINX_CONF" | head -10
echo ""

echo "[3/4] 옵션 선택:"
echo "  1. 임시로 SSL 설정 주석 처리 (HTTP만 사용)"
echo "  2. 기존 인증서 경로 확인 후 수정"
echo ""
read -p "선택 (1 또는 2): " choice

if [ "$choice" = "1" ]; then
    echo "SSL 설정을 임시로 주석 처리합니다..."
    # SSL 관련 라인 주석 처리
    sudo sed -i 's/^[[:space:]]*ssl_certificate/#ssl_certificate/g' "$NGINX_CONF"
    sudo sed -i 's/^[[:space:]]*ssl_certificate_key/#ssl_certificate_key/g' "$NGINX_CONF"
    sudo sed -i 's/^[[:space:]]*ssl_protocols/#ssl_protocols/g' "$NGINX_CONF"
    sudo sed -i 's/^[[:space:]]*ssl_ciphers/#ssl_ciphers/g' "$NGINX_CONF"
    sudo sed -i 's/^[[:space:]]*ssl_prefer_server_ciphers/#ssl_prefer_server_ciphers/g' "$NGINX_CONF"
    echo "  완료"
elif [ "$choice" = "2" ]; then
    echo "기존 인증서를 확인합니다..."
    OLD_CERT=$(sudo grep "ssl_certificate" "$NGINX_CONF" | head -1 | grep -o "/etc/letsencrypt/live/[^/]*" | head -1)
    if [ -n "$OLD_CERT" ]; then
        echo "  기존 인증서 경로: $OLD_CERT"
        echo "  새 인증서를 발급받아야 합니다."
    fi
fi

echo ""
echo "[4/4] Nginx 설정 테스트:"
sudo nginx -t
echo ""

if [ $? -eq 0 ]; then
    echo "설정이 정상입니다. Nginx를 재시작합니다..."
    sudo systemctl reload nginx
    echo "  완료"
else
    echo "설정에 오류가 있습니다. 수동으로 확인하세요."
fi

