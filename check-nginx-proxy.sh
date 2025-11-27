#!/bin/bash
# Nginx 프록시 설정 확인

echo "=== Nginx 프록시 설정 확인 ==="
echo ""

echo "[1/3] /api/auth 경로 프록시 설정:"
sudo grep -B 5 -A 10 "location /api/auth" /etc/nginx/sites-available/default | head -20
echo ""

echo "[2/3] /api/ 경로 프록시 설정:"
sudo grep -B 5 -A 10 "location /api/" /etc/nginx/sites-available/default | head -20
echo ""

echo "[3/3] 전체 Nginx 설정 확인:"
sudo cat /etc/nginx/sites-available/default | grep -A 20 "server {" | head -30

