#!/bin/bash
# 임시로 SSL 비활성화 (HTTP만 사용)

echo "=== SSL 설정 임시 비활성화 ==="
echo ""

NGINX_CONF="/etc/nginx/sites-available/default"

echo "[1/3] SSL 설정 주석 처리 중..."
# SSL 인증서 관련 라인 주석 처리
sudo sed -i 's/^[[:space:]]*ssl_certificate/#ssl_certificate/g' "$NGINX_CONF"
sudo sed -i 's/^[[:space:]]*ssl_certificate_key/#ssl_certificate_key/g' "$NGINX_CONF"
sudo sed -i 's/^[[:space:]]*ssl_protocols/#ssl_protocols/g' "$NGINX_CONF"
sudo sed -i 's/^[[:space:]]*ssl_ciphers/#ssl_ciphers/g' "$NGINX_CONF"
sudo sed -i 's/^[[:space:]]*ssl_prefer_server_ciphers/#ssl_prefer_server_ciphers/g' "$NGINX_CONF"

# HTTPS 리다이렉트도 주석 처리
sudo sed -i 's/^[[:space:]]*return 301 https/#return 301 https/g' "$NGINX_CONF"

echo "  완료"
echo ""

echo "[2/3] 변경 사항 확인:"
sudo grep -E "ssl_certificate|return 301" "$NGINX_CONF" | head -5
echo ""

echo "[3/3] Nginx 설정 테스트:"
sudo nginx -t
echo ""

if [ $? -eq 0 ]; then
    echo "설정이 정상입니다. Nginx를 재시작합니다..."
    sudo systemctl reload nginx
    echo ""
    echo "=== 완료 ==="
    echo "이제 HTTP로 접속 가능합니다."
    echo "SSL 인증서를 발급받으려면:"
    echo "  sudo certbot --nginx -d tradenotekr.com -d www.tradenotekr.com"
else
    echo "설정에 오류가 있습니다."
fi

