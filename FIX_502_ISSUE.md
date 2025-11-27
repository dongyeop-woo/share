# 502 Bad Gateway 문제 해결

## 문제 분석

1. **중복 프로세스**: 수동 실행 프로세스가 포트 8001 사용 중
   - PID 136088: `/home/ubuntu/share-0.0.1-SNAPSHOT.jar` (수동 실행)
   
2. **시스템 서비스 실패**: KILL 신호로 종료됨
   - 메모리 부족 가능성 (Xmx128m이 너무 작음)
   - 데이터베이스 연결 중 종료됨

3. **포트 충돌**: 두 프로세스가 같은 포트 사용 시도

## 해결 단계

### 1단계: 중복 프로세스 정리

```bash
cd ~
chmod +x fix-duplicate-process.sh
sudo ./fix-duplicate-process.sh
```

### 2단계: 서비스 파일 확인

```bash
chmod +x check-and-fix-service.sh
sudo ./check-and-fix-service.sh
```

### 3단계: 메모리 증가 (필요시)

서비스 파일 수정:
```bash
sudo sed -i 's/-Xmx128m/-Xmx512m/g' /etc/systemd/system/share-springboot.service
sudo sed -i 's/-Xms64m/-Xms256m/g' /etc/systemd/system/share-springboot.service
sudo systemctl daemon-reload
```

### 4단계: 서비스 재시작

```bash
sudo systemctl start share-springboot
sudo systemctl status share-springboot
```

### 5단계: 확인

```bash
sudo ss -tlnp | grep :8001
curl http://localhost:8001/api/auth/me
```

