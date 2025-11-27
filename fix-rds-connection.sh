#!/bin/bash
# RDS 연결 문제 해결

echo "=== RDS 연결 문제 해결 ==="
echo ""

echo "[1/4] 기존 프로세스 완전 종료..."
sudo pkill -9 -f "share-0.0.1-SNAPSHOT.jar" 2>/dev/null || true
sleep 2

echo "[2/4] RDS 연결 테스트..."
RDS_HOST="share-db.cb2yuq22wu31.ap-southeast-2.rds.amazonaws.com"
RDS_USER="root"
RDS_PASS="skdus4972@@"

echo "  RDS 호스트: $RDS_HOST"
echo "  사용자: $RDS_USER"
echo ""

# MySQL 클라이언트가 있으면 연결 테스트
if command -v mysql &> /dev/null; then
    echo "  MySQL 클라이언트로 연결 테스트 중..."
    mysql -h "$RDS_HOST" -u "$RDS_USER" -p"$RDS_PASS" -e "SELECT 1;" 2>&1 | head -5
else
    echo "  MySQL 클라이언트 없음. 설치 필요할 수 있습니다."
fi

echo ""
echo "[3/4] RDS 보안 그룹 확인 필요:"
echo "  AWS 콘솔에서 RDS 보안 그룹 확인"
echo "  EC2 인스턴스 IP 또는 보안 그룹이 허용되어야 합니다"
echo "  현재 EC2 IP:"
curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "  공인 IP 확인 실패"
echo ""

echo "[4/4] application.yml 확인:"
if [ -f "/opt/share-springboot/application.yml" ]; then
    echo "  데이터베이스 설정:"
    sudo grep -A 3 "datasource:" /opt/share-springboot/application.yml | head -4
else
    echo "  application.yml 없음"
fi

echo ""
echo "=== 해결 방법 ==="
echo ""
echo "1. RDS 보안 그룹에서 EC2 접근 허용 확인"
echo "2. RDS 사용자명/비밀번호 확인"
echo "3. application.yml의 데이터베이스 정보 확인"

