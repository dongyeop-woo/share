#!/bin/bash
# application.yml 비밀번호 업데이트 및 배포 스크립트

echo "=== application.yml 비밀번호 업데이트 ==="
echo ""

NEW_PASSWORD="$1"

if [ -z "$NEW_PASSWORD" ]; then
    echo "사용법: $0 <새비밀번호>"
    echo "예: $0 'MyNewPassword123!@#'"
    exit 1
fi

APPLICATION_YML="/opt/share-springboot/application.yml"

echo "[1/3] application.yml 백업..."
sudo cp "$APPLICATION_YML" "${APPLICATION_YML}.backup.$(date +%Y%m%d_%H%M%S)"

echo "[2/3] 비밀번호 업데이트..."
sudo sed -i "s/password:.*/password: $NEW_PASSWORD/" "$APPLICATION_YML"

echo "[3/3] 변경 확인..."
sudo grep "password:" "$APPLICATION_YML"

echo ""
echo "비밀번호가 업데이트되었습니다."
echo "Spring Boot를 재시작하세요:"
echo "  sudo systemctl restart share-springboot"

