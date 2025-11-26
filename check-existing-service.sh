#!/bin/bash
# 기존 서비스 및 파일 위치 확인 스크립트

echo "=== 기존 서비스 확인 ==="
echo ""

echo "1. systemd 서비스 목록:"
sudo systemctl list-units --type=service | grep -E "share|frontend|backend|python" || echo "  관련 서비스 없음"

echo ""
echo "2. 실행 중인 Python 프로세스:"
ps aux | grep -E "python.*server|python.*uvicorn|python.*app" | grep -v grep || echo "  실행 중인 Python 서버 없음"

echo ""
echo "3. 포트 사용 현황:"
echo "  포트 8080:"
sudo lsof -i :8080 2>/dev/null || sudo ss -tlnp | grep :8080 || echo "    사용 중이지 않음"
echo "  포트 8000:"
sudo lsof -i :8000 2>/dev/null || sudo ss -tlnp | grep :8000 || echo "    사용 중이지 않음"

echo ""
echo "4. 기존 파일 위치 찾기:"
echo "  server.py:"
sudo find /home /var/www /opt /usr/local -name "server.py" -type f 2>/dev/null | head -5 || echo "    없음"
echo "  app.py:"
sudo find /home /var/www /opt /usr/local -name "app.py" -type f 2>/dev/null | head -5 || echo "    없음"

echo ""
echo "5. 홈 디렉토리 구조:"
ls -la ~/ | head -20

echo ""
echo "6. 웹 루트 디렉토리 확인:"
ls -la /var/www/ 2>/dev/null || echo "  /var/www/ 디렉토리 없음"

echo ""
echo "=== 확인 완료 ==="

