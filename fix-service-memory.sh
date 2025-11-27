#!/bin/bash
# 서비스 메모리 설정 수정

set -e

SERVICE_FILE="/etc/systemd/system/share-springboot.service"

echo "=== 서비스 메모리 설정 수정 ==="
echo ""

if [ ! -f "$SERVICE_FILE" ]; then
    echo "오류: 서비스 파일 없음: $SERVICE_FILE"
    exit 1
fi

echo "[1/3] 백업 생성..."
sudo cp "$SERVICE_FILE" "${SERVICE_FILE}.backup.$(date +%Y%m%d_%H%M%S)"

echo "[2/3] 메모리 설정 변경..."
# Xmx128m -> Xmx512m
# Xms64m -> Xms256m
sudo sed -i 's/-Xmx128m/-Xmx512m/g' "$SERVICE_FILE"
sudo sed -i 's/-Xms64m/-Xms256m/g' "$SERVICE_FILE"

echo "[3/3] 변경 확인..."
echo "  변경된 설정:"
grep -E "(Xmx|Xms)" "$SERVICE_FILE" || echo "  메모리 설정 없음"

echo ""
echo "daemon-reload 실행 중..."
sudo systemctl daemon-reload

echo ""
echo "✓ 완료! 이제 서비스를 시작하세요:"
echo "  sudo systemctl start share-springboot"

