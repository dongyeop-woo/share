#!/bin/bash
# 빠른 디스크 정리 스크립트 (SSH에서 직접 실행)

echo "=== 긴급 디스크 정리 시작 ==="
echo ""

echo "현재 디스크 사용량:"
df -h / | tail -1
echo ""

echo "[1/6] 로그 파일 정리..."
sudo journalctl --vacuum-time=1d 2>/dev/null || true
sudo journalctl --vacuum-size=100M 2>/dev/null || true
echo "  완료"

echo ""
echo "[2/6] apt 캐시 정리..."
sudo apt-get clean 2>/dev/null || true
sudo apt-get autoclean 2>/dev/null || true
echo "  완료"

echo ""
echo "[3/6] 임시 파일 정리..."
sudo rm -rf /tmp/* 2>/dev/null || true
sudo rm -rf /var/tmp/* 2>/dev/null || true
echo "  완료"

echo ""
echo "[4/6] Python 캐시 정리..."
sudo find /home /opt /var/www -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
sudo find /home /opt /var/www -name "*.pyc" -delete 2>/dev/null || true
rm -rf ~/.cache/pip/* 2>/dev/null || true
sudo rm -rf /root/.cache/pip/* 2>/dev/null || true
echo "  완료"

echo ""
echo "[5/6] 기존 서비스 중지 및 파일 삭제..."
sudo systemctl stop share-frontend 2>/dev/null || true
sudo systemctl stop share-backend 2>/dev/null || true
sudo pkill -f "python.*server" 2>/dev/null || true
sudo pkill -f "uvicorn" 2>/dev/null || true

sudo rm -rf /var/www/share 2>/dev/null || true
sudo rm -rf /opt/share-backend 2>/dev/null || true
sudo rm -rf /opt/share-backup 2>/dev/null || true
sudo rm -rf ~/share ~/backend 2>/dev/null || true
echo "  완료"

echo ""
echo "[6/6] 사용하지 않는 패키지 삭제..."
sudo apt-get autoremove -y 2>/dev/null || true
echo "  완료"

echo ""
echo "=== 정리 완료 ==="
echo ""
echo "현재 디스크 사용량:"
df -h / | tail -1
echo ""
echo "확보된 공간이 충분하면 파일 전송을 진행하세요."

