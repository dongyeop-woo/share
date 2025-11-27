#!/bin/bash
# Nginx /api/auth 프록시 설정 확인 및 수정

echo "=== Nginx /api/auth 프록시 확인 ==="
echo ""

NGINX_CONF="/etc/nginx/sites-available/default"

echo "[1/3] 현재 /api/auth 설정:"
sudo grep -B 2 -A 10 "location /api/auth" "$NGINX_CONF" || echo "  /api/auth 설정 없음"
echo ""

echo "[2/3] 전체 location /api 설정:"
sudo grep -B 2 -A 10 "location /api" "$NGINX_CONF"
echo ""

echo "[3/3] 프록시 설정 확인:"
sudo grep "proxy_pass.*8001" "$NGINX_CONF" || echo "  포트 8001 프록시 설정 없음"

echo ""
echo "=== 필요한 설정 ==="
echo ""
echo "Nginx에 다음 설정이 필요합니다:"
echo ""
echo "location /api/auth {"
echo "    proxy_pass http://127.0.0.1:8001;"
echo "    proxy_set_header Host \$host;"
echo "    proxy_set_header X-Real-IP \$remote_addr;"
echo "    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;"
echo "    proxy_set_header X-Forwarded-Proto \$scheme;"
echo "}"

