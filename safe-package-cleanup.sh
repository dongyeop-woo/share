#!/bin/bash
# 안전한 패키지 정리 (확인 후 삭제)

set -e

echo "=== 안전한 패키지 정리 ==="
echo ""

# 1. 현재 디스크 사용량
echo "[1/5] 현재 디스크 사용량:"
df -h / | tail -1
echo ""

# 2. 사용하지 않는 apt 패키지 삭제
echo "[2/5] 사용하지 않는 apt 패키지 삭제 중..."
BEFORE=$(df / | tail -1 | awk '{print $3}')
sudo apt-get autoremove -y
AFTER=$(df / | tail -1 | awk '{print $3}')
echo "  완료"
echo ""

# 3. apt 캐시 정리
echo "[3/5] apt 캐시 정리 중..."
sudo apt-get clean
sudo apt-get autoclean
echo "  완료"
echo ""

# 4. 불필요한 Python 패키지 확인
echo "[4/5] Python 패키지 확인..."
echo "  설치된 패키지 수:"
pip3 list 2>/dev/null | wc -l || echo "  pip3 없음"
echo ""
echo "  큰 패키지 (torch, transformers 등은 용량이 큼):"
pip3 list 2>/dev/null | grep -E "torch|transformers|tensorflow|numpy|pandas" || echo "  없음"
echo ""

# 5. 최종 디스크 사용량
echo "[5/5] 정리 후 디스크 사용량:"
df -h / | tail -1
echo ""

echo "=== 정리 완료 ==="
echo ""
echo "추가로 Python 패키지를 정리하려면:"
echo "  pip3 list  # 전체 목록 보기"
echo "  sudo pip3 uninstall 패키지명  # 특정 패키지 삭제"

