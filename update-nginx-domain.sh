#!/bin/bash
# Nginx 도메인 변경 스크립트

echo "=== Nginx 도메인 변경 ==="
echo ""

NGINX_CONF="/etc/nginx/sites-available/default"

echo "[1/4] 현재 Nginx 설정 백업..."
sudo cp "$NGINX_CONF" "${NGINX_CONF}.backup.$(date +%Y%m%d_%H%M%S)"
echo "  백업 완료"
echo ""

echo "[2/4] 현재 server_name 확인:"
sudo grep -n "server_name" "$NGINX_CONF" | head -5
echo ""

echo "[3/4] 도메인 변경 중..."
# weektalk.co.kr을 tradenotekr.com으로 변경
sudo sed -i 's/weektalk\.co\.kr/tradenotekr.com/g' "$NGINX_CONF"
sudo sed -i 's/www\.weektalk\.co\.kr/www.tradenotekr.com/g' "$NGINX_CONF"
echo "  변경 완료"
echo ""

echo "[4/4] 변경된 server_name 확인:"
sudo grep -n "server_name" "$NGINX_CONF" | head -5
echo ""

echo "=== Nginx 설정 테스트 ==="
sudo nginx -t
echo ""

echo "설정이 정상이면 다음 명령어로 Nginx 재시작:"
echo "  sudo systemctl reload nginx"
echo ""
echo "또는"
echo "  sudo systemctl restart nginx"

