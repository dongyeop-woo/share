#!/bin/bash
# RDS 문제 진단 및 해결

echo "=== RDS 접근 문제 진단 ==="
echo ""

echo "[1/5] EC2 네트워크 정보:"
echo "  Private IP:"
PRIVATE_IP=$(curl -s http://169.254.169.254/latest/meta-data/local-ipv4 2>/dev/null)
echo "    $PRIVATE_IP"

echo "  Public IP:"
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null)
echo "    $PUBLIC_IP"

echo "  보안 그룹 ID:"
SG_ID=$(curl -s http://169.254.169.254/latest/meta-data/security-groups 2>/dev/null)
echo "    $SG_ID"

echo ""
echo "[2/5] RDS 연결 테스트 (다른 비밀번호 시도)..."
RDS_HOST="share-db.cb2yuq22wu31.ap-southeast-2.rds.amazonaws.com"

echo "  원래 비밀번호로 테스트:"
mysql -h "$RDS_HOST" -u root -p"skdus4972@@" -e "SELECT 1;" 2>&1 | head -3

echo ""
echo "[3/5] 네트워크 연결 테스트:"
timeout 5 bash -c "echo > /dev/tcp/$RDS_HOST/3306" 2>&1 && echo "  ✓ 포트 3306 연결 가능" || echo "  ✗ 포트 3306 연결 불가 (보안 그룹 문제 가능)"

echo ""
echo "[4/5] RDS 엔드포인트 확인:"
echo "  $RDS_HOST"

echo ""
echo "[5/5] 해결 방법:"
echo ""
echo "1. AWS 콘솔에서 RDS 보안 그룹 확인:"
echo "   - RDS 인스턴스 → 연결 및 보안 → 보안 그룹"
echo "   - 인바운드 규칙에 다음 추가:"
echo "     Type: MySQL/Aurora (3306)"
echo "     Source: EC2 보안 그룹 ID ($SG_ID) 또는 EC2 IP ($PRIVATE_IP)"
echo ""
echo "2. RDS 사용자 확인:"
echo "   - RDS 데이터베이스에 연결"
echo "   - 사용자 'root' 존재 확인"
echo "   - 비밀번호 확인: 'skdus4972@@'"
echo ""
echo "3. 임시 해결 (환경 변수 사용):"
echo "   - application.yml에서 비밀번호를 환경 변수로 변경 가능"

