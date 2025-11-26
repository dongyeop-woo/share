#!/bin/bash
# 설치된 패키지 확인 및 사용하지 않는 패키지 삭제

echo "=== 패키지 확인 및 정리 ==="
echo ""

# 1. 설치된 Python 패키지 확인
echo "[1/4] 설치된 Python 패키지:"
echo "  (많으면 일부만 표시)"
pip3 list 2>/dev/null | head -30 || echo "  pip3 없음"
echo ""

# 2. apt 패키지 확인
echo "[2/4] 설치된 apt 패키지 (일부):"
dpkg -l | grep -E "^ii" | head -20
echo ""
echo "  전체 패키지 수:"
dpkg -l | grep -E "^ii" | wc -l
echo ""

# 3. 사용하지 않는 apt 패키지 확인
echo "[3/4] 삭제 가능한 패키지 (autoremove 대상):"
sudo apt-get -s autoremove 2>/dev/null | grep "Remv" || echo "  없음"
echo ""

# 4. 큰 패키지 찾기
echo "[4/4] 용량이 큰 패키지 (상위 10개):"
dpkg-query -Wf '${Installed-Size}\t${Package}\n' | sort -rn | head -10
echo ""

echo "=== 정리 옵션 ==="
echo ""
echo "1. 사용하지 않는 패키지 자동 삭제:"
echo "   sudo apt-get autoremove -y"
echo ""
echo "2. Python 패키지 전체 목록 보기:"
echo "   pip3 list"
echo ""
echo "3. 특정 Python 패키지 삭제 (예시):"
echo "   sudo pip3 uninstall 패키지명"
echo ""
echo "4. apt 패키지 검색:"
echo "   dpkg -l | grep 검색어"
echo ""

