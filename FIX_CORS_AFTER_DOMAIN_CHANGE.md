# 도메인 변경 후 CORS 문제 해결

## 문제
- `weektalk.co.kr`에서 `tradenotekr.com`으로 변경 후 CORS 오류 발생
- Spring Boot가 새 JAR로 배포되지 않았을 가능성
- Nginx 프록시 설정 확인 필요

## 해결 단계

### 1. Spring Boot 새 JAR 배포 확인

SSH에서:
```bash
# Spring Boot 상태 확인
sudo systemctl status share-springboot

# 새 JAR 파일로 업데이트
sudo systemctl stop share-springboot
sudo cp /home/ubuntu/share-0.0.1-SNAPSHOT.jar /opt/share-springboot/
sudo systemctl start share-springboot

# 로그 확인
sudo journalctl -u share-springboot -f
```

### 2. Nginx 프록시 설정 확인

```bash
cd ~
chmod +x check-nginx-proxy.sh
sudo ./check-nginx-proxy.sh
```

Nginx가 `/api/auth` 경로를 포트 8001로 프록시하는지 확인합니다.

### 3. Nginx 재시작 (필요시)

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 가능한 원인

1. Spring Boot가 새 CORS 설정이 적용된 JAR로 실행되지 않음
2. Nginx 프록시 설정이 올바르지 않음
3. Spring Boot가 포트 8001에서 실행되지 않음

