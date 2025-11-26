#!/bin/bash
# 백엔드 수정 및 재시작

echo "=== 백엔드 수정 및 재시작 ==="
echo ""

# 1. requirements.txt 수정
echo "[1/3] requirements.txt 수정 중..."
cd /opt/share-backend
sudo sed -i 's/finance-datareader==3.1.0/finance-datareader==0.9.96/g' requirements.txt
echo "  완료"

# 2. finance-datareader 설치
echo "[2/3] finance-datareader 설치 중..."
sudo pip3 install finance-datareader==0.9.96
echo "  완료"

# 3. 백엔드 서비스 재시작
echo "[3/3] 백엔드 서비스 재시작 중..."
sudo systemctl restart share-backend
sleep 2

# 서비스 상태 확인
echo ""
echo "=== 서비스 상태 ==="
sudo systemctl status share-backend --no-pager -l | head -15

echo ""
echo "로그 확인:"
echo "  sudo journalctl -u share-backend -f"

