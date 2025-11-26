#!/bin/bash
# 파일 전송 문제 해결 스크립트

echo "=== EC2 상태 확인 ==="

echo "1. 디스크 공간 확인:"
df -h

echo ""
echo "2. /tmp 디렉토리 권한 확인:"
ls -ld /tmp

echo ""
echo "3. /tmp 디렉토리 공간 확인:"
df -h /tmp

echo ""
echo "4. 기존 파일 확인:"
ls -lh /tmp/share-* /tmp/deploy-* 2>/dev/null || echo "  파일 없음"

echo ""
echo "=== 문제 해결 ==="
echo "디스크 공간 부족 시 기존 파일 정리:"
echo "  sudo rm -f /tmp/share-deploy*.tar.gz"
echo "  sudo rm -f /tmp/*.sh"
echo ""
echo "권한 문제 시:"
echo "  sudo chmod 777 /tmp"

