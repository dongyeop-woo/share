#!/bin/bash
# RDS 연결 설정 업데이트 스크립트

echo "=== RDS 연결 설정 업데이트 ==="
echo ""

APP_YML="/opt/share-springboot/application.yml"

echo "[1/3] 현재 application.yml 확인:"
if [ -f "$APP_YML" ]; then
    echo "현재 데이터베이스 URL:"
    sudo grep -A 3 "datasource:" "$APP_YML" | grep "url:" || echo "  없음"
else
    echo "  application.yml 파일이 없습니다."
    exit 1
fi
echo ""

echo "[2/3] RDS 엔드포인트를 입력하세요:"
echo "  예시: your-db-instance.xxxxx.us-east-1.rds.amazonaws.com:3306"
read -p "RDS 엔드포인트 (엔터만 누르면 건너뜀): " RDS_ENDPOINT

if [ -z "$RDS_ENDPOINT" ]; then
    echo "  건너뜀"
else
    echo "[3/3] application.yml 업데이트 중..."
    # 기존 URL 백업
    sudo cp "$APP_YML" "${APP_YML}.backup.$(date +%Y%m%d_%H%M%S)"
    
    # RDS 엔드포인트로 변경
    sudo sed -i "s|jdbc:mysql://localhost:3306/share|jdbc:mysql://${RDS_ENDPOINT}/share|g" "$APP_YML"
    
    echo "  업데이트 완료"
    echo ""
    echo "변경된 설정:"
    sudo grep -A 3 "datasource:" "$APP_YML" | grep "url:"
    
    echo ""
    echo "Spring Boot 재시작:"
    sudo systemctl restart share-springboot
    sleep 3
    
    echo ""
    echo "서비스 상태:"
    sudo systemctl status share-springboot --no-pager -l | head -10
fi

