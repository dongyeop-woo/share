#!/bin/bash
# 홈 디렉토리 빠른 정리

set -e

echo "=== 홈 디렉토리 정리 시작 ==="
echo ""

BEFORE=$(du -sh ~ 2>/dev/null | cut -f1)
echo "정리 전 홈 디렉토리 크기: $BEFORE"
echo ""

echo "[1/3] 불필요한 파일 삭제 중..."

# Spring Boot JAR 삭제 (프로젝트에서 사용하지 않음)
if [ -f ~/share-0.0.1-SNAPSHOT.jar ]; then
    SIZE=$(du -h ~/share-0.0.1-SNAPSHOT.jar | cut -f1)
    echo "  Spring Boot JAR 삭제: share-0.0.1-SNAPSHOT.jar ($SIZE)"
    rm -f ~/share-0.0.1-SNAPSHOT.jar
fi

# 임시 디렉토리 삭제
if [ -d ~/tmp ]; then
    SIZE=$(du -sh ~/tmp 2>/dev/null | cut -f1 || echo "0")
    echo "  임시 디렉토리 삭제: tmp/ ($SIZE)"
    rm -rf ~/tmp
fi

# fastapi 디렉토리 확인 후 삭제 (빈 디렉토리이거나 사용하지 않으면)
if [ -d ~/fastapi ]; then
    if [ -z "$(ls -A ~/fastapi 2>/dev/null)" ]; then
        echo "  빈 fastapi 디렉토리 삭제"
        rmdir ~/fastapi 2>/dev/null || true
    else
        SIZE=$(du -sh ~/fastapi 2>/dev/null | cut -f1 || echo "?")
        echo "  fastapi/ 디렉토리 있음 ($SIZE) - 수동 확인 필요 (삭제 안 함)"
    fi
fi

echo "  완료"
echo ""

echo "[2/3] 압축 파일 확인..."
if [ -f ~/share-deploy.tar.gz ]; then
    SIZE=$(du -h ~/share-deploy.tar.gz | cut -f1)
    echo "  share-deploy.tar.gz ($SIZE) - 배포 파일, 배포 후 삭제 가능"
fi
echo ""

echo "[3/3] 정리 후 상태:"
AFTER=$(du -sh ~ 2>/dev/null | cut -f1)
echo "정리 후 홈 디렉토리 크기: $AFTER"
echo ""

echo "=== 정리 완료 ==="
echo ""
echo "남은 파일들:"
ls -lh ~ | grep -v "^total" | grep -v "^d" | head -10
echo ""
echo "배포 완료 후 다음 명령으로 스크립트 파일 정리 가능:"
echo "  rm -f ~/*.sh"

