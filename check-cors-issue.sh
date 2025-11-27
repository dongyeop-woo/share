#!/bin/bash
# CORS 문제 진단 스크립트

echo "=== CORS 문제 진단 ==="
echo ""

echo "[1/4] Spring Boot 서비스 상태:"
sudo systemctl status share-springboot --no-pager -l | head -10
echo ""

echo "[2/4] 포트 8001 확인:"
sudo ss -tlnp | grep :8001 || echo "  포트 8001이 리스닝하지 않음"
echo ""

echo "[3/4] Spring Boot 최근 로그 (CORS 관련):"
sudo journalctl -u share-springboot -n 30 --no-pager | grep -i "cors\|origin\|403\|forbidden" || echo "  CORS 관련 로그 없음"
echo ""

echo "[4/4] Nginx 프록시 설정 확인:"
echo "  /api/auth 경로 설정:"
sudo grep -A 10 "location /api/auth" /etc/nginx/sites-available/default | head -15 || echo "  설정 없음"
echo ""

echo "=== 해결 방법 ==="
echo ""
echo "1. Spring Boot가 실행 중인지 확인"
echo "2. 포트 8001이 리스닝하는지 확인"
echo "3. Nginx가 /api/auth 경로를 포트 8001로 프록시하는지 확인"

