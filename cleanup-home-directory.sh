#!/bin/bash
# 홈 디렉토리 정리 스크립트

echo "=== 홈 디렉토리 정리 ==="
echo ""

echo "[1/4] 현재 홈 디렉토리 파일:"
ls -lh ~ | grep -E "\.sh$|\.tar\.gz$|\.jar$|fastapi|tmp|config"
echo ""

echo "[2/4] 디스크 사용량:"
du -sh ~/* 2>/dev/null | sort -rh | head -10
echo ""

echo "[3/4] 삭제 가능한 파일 확인:"
echo ""

# Spring Boot JAR 파일 확인
if [ -f ~/share-0.0.1-SNAPSHOT.jar ]; then
    SIZE=$(du -h ~/share-0.0.1-SNAPSHOT.jar | cut -f1)
    echo "  share-0.0.1-SNAPSHOT.jar ($SIZE) - Spring Boot JAR, 삭제 가능"
fi

# tmp 디렉토리 확인
if [ -d ~/tmp ]; then
    SIZE=$(du -sh ~/tmp 2>/dev/null | cut -f1)
    echo "  tmp/ ($SIZE) - 임시 디렉토리, 삭제 가능"
fi

# fastapi 디렉토리 확인
if [ -d ~/fastapi ]; then
    SIZE=$(du -sh ~/fastapi 2>/dev/null | cut -f1)
    echo "  fastapi/ ($SIZE) - 확인 필요"
    echo "    내용:"
    ls -la ~/fastapi 2>/dev/null | head -5
fi

# config 디렉토리 확인
if [ -d ~/config ]; then
    SIZE=$(du -sh ~/config 2>/dev/null | cut -f1)
    echo "  config/ ($SIZE) - 확인 필요"
fi

echo ""
echo "[4/4] 안전하게 삭제할 수 있는 파일:"
echo ""
echo "다음 명령어로 삭제 가능:"
echo ""
echo "  # Spring Boot JAR 삭제 (프로젝트에서 사용 안 함)"
echo "  rm -f ~/share-0.0.1-SNAPSHOT.jar"
echo ""
echo "  # 임시 디렉토리 삭제"
echo "  rm -rf ~/tmp"
echo ""
echo "  # fastapi 디렉토리 확인 후 삭제 (필요 없으면)"
echo "  # rm -rf ~/fastapi"
echo ""
echo "  # 스크립트 파일들은 배포 후 정리 가능"
echo "  # 배포 후 정리: rm -f ~/*.sh"

