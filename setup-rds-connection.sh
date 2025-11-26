#!/bin/bash
# RDS 연결 설정 스크립트

echo "=== RDS 연결 설정 ==="
echo ""

APP_YML="/opt/share-springboot/application.yml"

echo "현재 application.yml 설정:"
if [ -f "$APP_YML" ]; then
    sudo grep -A 5 "datasource:" "$APP_YML"
else
    echo "  application.yml이 없습니다."
    exit 1
fi
echo ""

echo "RDS 엔드포인트를 입력하세요:"
echo "  예시: your-db-instance.xxxxx.us-east-1.rds.amazonaws.com"
read -p "RDS 엔드포인트 (또는 엔터로 건너뜀): " RDS_ENDPOINT

if [ -z "$RDS_ENDPOINT" ]; then
    echo "건너뜀. 환경 변수 DB_URL을 사용합니다."
    echo ""
    echo "환경 변수 설정 방법:"
    echo "  sudo systemctl edit share-springboot"
    echo ""
    echo "다음 추가:"
    echo "  [Service]"
    echo "  Environment=\"DB_URL=jdbc:mysql://your-rds-endpoint:3306/share?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Seoul&characterEncoding=UTF-8\""
    exit 0
fi

echo ""
echo "application.yml 업데이트 중..."

# 백업
sudo cp "$APP_YML" "${APP_YML}.backup.$(date +%Y%m%d_%H%M%S)"

# RDS 엔드포인트로 변경 (localhost를 RDS 엔드포인트로)
sudo sed -i "s|jdbc:mysql://localhost:3306|jdbc:mysql://${RDS_ENDPOINT}:3306|g" "$APP_YML"

echo "업데이트 완료"
echo ""

echo "변경된 설정:"
sudo grep -A 5 "datasource:" "$APP_YML"

echo ""
echo "Spring Boot 재시작:"
sudo systemctl restart share-springboot
sleep 3

echo ""
echo "서비스 상태:"
sudo systemctl status share-springboot --no-pager -l | head -15

