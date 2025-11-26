#!/bin/bash
# 사용하지 않는 패키지 확인 및 삭제

echo "=== 사용하지 않는 패키지 확인 ==="
echo ""

# 1. 사용하지 않는 Python 패키지 확인
echo "[1/3] Python 패키지 확인:"
echo "  설치된 패키지 목록:"
pip3 list 2>/dev/null | head -20 || echo "  pip3 없음"
echo ""

# 2. 사용하지 않는 apt 패키지 확인
echo "[2/3] apt 패키지 확인:"
echo "  사용하지 않는 패키지:"
sudo apt-get -s autoremove 2>/dev/null | grep "Remv" | head -10 || echo "  없음"
echo ""

# 3. 큰 파일/디렉토리 확인
echo "[3/3] 큰 파일 찾기:"
echo "  /home에서 큰 디렉토리 (상위 5개):"
sudo du -h /home 2>/dev/null | sort -rh | head -5 || echo "  확인 불가"
echo ""
echo "  /opt에서 큰 디렉토리 (상위 5개):"
sudo du -h /opt 2>/dev/null | sort -rh | head -5 || echo "  확인 불가"
echo ""
echo "  /var에서 큰 디렉토리 (상위 5개):"
sudo du -h /var 2>/dev/null | sort -rh | head -5 || echo "  확인 불가"

echo ""
echo "=== 정리 명령어 ==="
echo "Python 패키지 정리: sudo pip3 autoremove (없을 수 있음)"
echo "apt 패키지 정리: sudo apt-get autoremove"
echo "로그 정리: sudo journalctl --vacuum-time=3d"
echo "전체 정리: sudo apt-get autoremove -y && sudo apt-get autoclean && sudo journalctl --vacuum-time=3d"

