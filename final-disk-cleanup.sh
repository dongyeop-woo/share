#!/bin/bash
# 최종 안전한 디스크 정리 (시스템 패키지는 보존)

set -e

echo "=== 안전한 디스크 정리 (시스템 패키지 보존) ==="
echo ""

echo "[1/5] 현재 디스크 사용량:"
df -h / | tail -1
echo ""

echo "[2/5] apt 패키지 정리 (사용하지 않는 패키지만):"
sudo apt-get autoremove -y
sudo apt-get clean
sudo apt-get autoclean
echo "  완료"
echo ""

echo "[3/5] 로그 파일 정리:"
sudo journalctl --vacuum-time=1d
sudo journalctl --vacuum-size=100M
echo "  완료"
echo ""

echo "[4/5] Python 캐시 정리:"
sudo find /home /opt /var/www -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
sudo find /home /opt /var/www -name "*.pyc" -delete 2>/dev/null || true
rm -rf ~/.cache/pip/* 2>/dev/null || true
sudo rm -rf /root/.cache/pip/* 2>/dev/null || true
echo "  완료"
echo ""

echo "[5/5] 임시 파일 정리:"
sudo rm -rf /tmp/* 2>/dev/null || true
sudo rm -rf /var/tmp/* 2>/dev/null || true
echo "  완료"
echo ""

echo "=== 정리 완료 ==="
echo ""
echo "정리 후 디스크 사용량:"
df -h / | tail -1
echo ""
echo "주의: pip3 패키지는 삭제하지 않았습니다."
echo "현재 설치된 패키지들은 시스템 패키지이므로 보존했습니다."
echo ""
echo "프로젝트 배포 후 requirements.txt로 필요한 패키지만 추가 설치됩니다."

