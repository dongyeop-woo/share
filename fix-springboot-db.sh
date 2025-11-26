#!/bin/bash
# Spring Boot 데이터베이스 문제 해결

echo "=== Spring Boot 데이터베이스 문제 해결 ==="
echo ""

# 1. 기존 프로세스 종료
echo "[1/4] 기존 Java 프로세스 종료 중..."
OLD_PID=$(ps aux | grep "share-0.0.1-SNAPSHOT.jar" | grep -v grep | awk '{print $2}')
if [ -n "$OLD_PID" ]; then
    echo "  기존 프로세스 종료: PID $OLD_PID"
    sudo kill -9 $OLD_PID 2>/dev/null || true
    sleep 2
fi

# systemd 서비스 중지
sudo systemctl stop share-springboot 2>/dev/null || true
sleep 2

echo "  완료"
echo ""

# 2. MySQL 서비스 확인
echo "[2/4] MySQL 서비스 확인 중..."
if systemctl is-active --quiet mysql; then
    echo "  MySQL 실행 중"
elif systemctl is-active --quiet mariadb; then
    echo "  MariaDB 실행 중"
else
    echo "  MySQL/MariaDB 실행 안 함. 시작 시도 중..."
    sudo systemctl start mysql 2>/dev/null || sudo systemctl start mariadb 2>/dev/null || true
    sleep 2
fi

# MySQL 상태 확인
if systemctl is-active --quiet mysql || systemctl is-active --quiet mariadb; then
    echo "  MySQL/MariaDB 실행 중 ✓"
else
    echo "  경고: MySQL/MariaDB가 실행되지 않습니다."
fi
echo ""

# 3. 포트 확인
echo "[3/4] 포트 8001 확인:"
sudo ss -tlnp | grep :8001 || echo "  포트 8001 사용 가능"
echo ""

# 4. Spring Boot 서비스 재시작
echo "[4/4] Spring Boot 서비스 재시작 중..."
sudo systemctl start share-springboot
sleep 3

echo ""
echo "=== 상태 확인 ==="
sudo systemctl status share-springboot --no-pager -l | head -15

echo ""
echo "포트 확인:"
sudo ss -tlnp | grep :8001 || echo "  포트 8001이 아직 리스닝하지 않음"

echo ""
echo "최근 로그:"
sudo journalctl -u share-springboot -n 20 --no-pager

