#!/bin/bash
# 기존 프로세스 완전 종료

echo "=== 기존 프로세스 종료 ==="
echo ""

echo "[1] 실행 중인 모든 share-0.0.1-SNAPSHOT.jar 프로세스 찾기..."
ps aux | grep "share-0.0.1-SNAPSHOT.jar" | grep -v grep

echo ""
echo "[2] 프로세스 종료 중..."
sudo pkill -9 -f "share-0.0.1-SNAPSHOT.jar" 2>/dev/null || true
sleep 2

echo ""
echo "[3] 시스템 서비스 중지..."
sudo systemctl stop share-springboot 2>/dev/null || true

echo ""
echo "[4] 확인:"
ps aux | grep "share-0.0.1-SNAPSHOT.jar" | grep -v grep || echo "  모든 프로세스 종료됨"

