#!/bin/bash
# 서비스 파일 확인 및 수정

echo "=== 서비스 파일 확인 ==="
echo ""

SERVICE_FILE="/etc/systemd/system/share-springboot.service"

echo "[1/3] 현재 서비스 파일:"
if [ -f "$SERVICE_FILE" ]; then
    cat "$SERVICE_FILE"
else
    echo "  ✗ 서비스 파일 없음"
    exit 1
fi

echo ""
echo "[2/3] 메모리 설정 확인..."
if grep -q "Xmx128m" "$SERVICE_FILE"; then
    echo "  ⚠ 메모리가 128MB로 너무 작습니다 (OOM 가능)"
    echo "  256MB 또는 512MB로 증가 권장"
fi

echo ""
echo "[3/3] JAR 파일 경로 확인..."
JAR_PATH=$(grep "ExecStart" "$SERVICE_FILE" | grep -o "/[^ ]*\.jar")
if [ -n "$JAR_PATH" ]; then
    echo "  JAR 경로: $JAR_PATH"
    if [ -f "$JAR_PATH" ]; then
        echo "  ✓ JAR 파일 존재"
        ls -lh "$JAR_PATH" | head -1
    else
        echo "  ✗ JAR 파일 없음!"
    fi
fi

echo ""
echo "=== 메모리 증가 필요시 ==="
echo "서비스 파일을 수정하려면:"
echo "  sudo nano $SERVICE_FILE"
echo ""
echo "Xmx128m -> Xmx512m 또는 Xmx256m으로 변경"

