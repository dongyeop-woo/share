#!/bin/bash
# Nginx 설정 확인 스크립트

echo "=== Nginx 상태 확인 ==="
echo ""

echo "[1/4] Nginx 서비스 상태:"
sudo systemctl status nginx --no-pager -l | head -10
echo ""

echo "[2/4] Nginx 설정 파일 위치:"
ls -la /etc/nginx/sites-available/ 2>/dev/null || echo "  sites-available 없음"
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || echo "  sites-enabled 없음"
echo ""

echo "[3/4] Nginx 설정 테스트:"
sudo nginx -t 2>&1
echo ""

echo "[4/4] 백엔드 프록시 설정 확인:"
echo ""
echo "현재 활성화된 Nginx 설정 파일:"
sudo ls -la /etc/nginx/sites-enabled/
echo ""
echo "백엔드 프록시 설정이 있는지 확인:"
sudo grep -r "proxy_pass.*8000" /etc/nginx/ 2>/dev/null || echo "  프록시 설정을 찾을 수 없음"
echo ""
echo "API 경로 설정 확인:"
sudo grep -r "location.*api" /etc/nginx/ 2>/dev/null || echo "  API 경로 설정을 찾을 수 없음"

