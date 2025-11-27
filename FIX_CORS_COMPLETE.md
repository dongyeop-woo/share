# CORS 문제 완전 해결 가이드

## 현재 문제
- Spring Boot CORS 설정에 `tradenotekr.com` 추가됨
- 하지만 여전히 "Invalid CORS request" 오류 발생

## 확인 사항

### 1. Spring Boot가 새 JAR로 실행되었는지 확인

SSH에서:
```bash
cd ~
chmod +x check-cors-issue.sh
sudo ./check-cors-issue.sh
```

### 2. Spring Boot JAR 파일 업데이트 확인

```bash
# 직접 업데이트
sudo systemctl stop share-springboot
sudo cp /home/ubuntu/share-0.0.1-SNAPSHOT.jar /opt/share-springboot/
sudo systemctl start share-springboot

# 서비스 상태 확인
sudo systemctl status share-springboot

# 포트 확인
sudo ss -tlnp | grep :8001
```

### 3. Nginx 프록시 설정 확인

```bash
sudo grep -A 10 "location /api/auth" /etc/nginx/sites-available/default
```

Nginx가 `/api/auth` 경로를 포트 8001로 프록시해야 합니다.

### 4. CORS를 완전히 허용하도록 설정 변경 (임시 해결)

Spring Boot CORS 설정을 더 관대하게 변경:
- 모든 Origin 허용 또는
- Wildcard 사용

## 빠른 해결

Spring Boot가 실행 중이고 포트가 열려있는데도 CORS 오류가 발생하면, CORS 설정을 더 관대하게 변경해야 할 수 있습니다.

