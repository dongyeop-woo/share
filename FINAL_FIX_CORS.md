# CORS 문제 최종 해결

## 즉시 실행할 명령어

SSH에서 순서대로 실행:

### Step 1: Nginx 프록시 설정 확인
```bash
sudo grep -A 10 "location /api/auth" /etc/nginx/sites-available/default
```

### Step 2: Spring Boot 강제 재시작
```bash
cd ~
chmod +x force-fix-cors.sh
sudo ./force-fix-cors.sh
```

### Step 3: Nginx 재시작
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 핵심 문제

Nginx가 `/api/auth` 경로를 포트 8001로 프록시하지 않거나, Spring Boot가 새 JAR로 실행되지 않았을 가능성이 높습니다.

