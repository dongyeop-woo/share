#!/bin/bash
# RDS 엔드포인트로 application.yml 업데이트

echo "=== RDS 엔드포인트 업데이트 ==="
echo ""

APP_YML="/opt/share-springboot/application.yml"
RDS_ENDPOINT="share-db.cb2yuq22wu31.ap-southeast-2.rds.amazonaws.com"

if [ ! -f "$APP_YML" ]; then
    echo "오류: application.yml을 찾을 수 없습니다."
    exit 1
fi

echo "[1/3] 현재 설정 확인:"
sudo grep "url:" "$APP_YML" | head -1
echo ""

echo "[2/3] RDS 엔드포인트로 업데이트 중..."
# 백업
sudo cp "$APP_YML" "${APP_YML}.backup.$(date +%Y%m%d_%H%M%S)"

# localhost를 RDS 엔드포인트로 변경
sudo sed -i "s|jdbc:mysql://localhost:3306|jdbc:mysql://${RDS_ENDPOINT}:3306|g" "$APP_YML"

echo "  완료"
echo ""

echo "[3/3] 변경된 설정 확인:"
sudo grep "url:" "$APP_YML" | head -1
echo ""

echo "Spring Boot 재시작 중..."
sudo systemctl restart share-springboot
sleep 3

echo ""
echo "=== 서비스 상태 ==="
sudo systemctl status share-springboot --no-pager -l | head -15

echo ""
echo "포트 확인:"
sudo ss -tlnp | grep :8001 || echo "  포트 8001이 아직 리스닝하지 않음"

echo ""
echo "로그 확인:"
echo "  sudo journalctl -u share-springboot -f"

