# 모바일 로그인 "load failed" 문제 해결

## 가능한 원인

1. **Spring Boot가 실행되지 않음**
   - 포트 8001이 리스닝하지 않음
   - 서비스가 시작되지 않음

2. **Nginx 프록시 문제**
   - `/api/auth` 경로가 제대로 프록시되지 않음
   - 502 Bad Gateway

3. **CORS 문제**
   - 모바일 브라우저에서 CORS 헤더가 누락됨

4. **세션/Cookie 문제**
   - HTTPS/HTTP 혼용 문제
   - SameSite 쿠키 설정 문제

## 확인 단계

### 1단계: API 상태 확인

```bash
cd ~
chmod +x check-api-status.sh
sudo ./check-api-status.sh
```

### 2단계: 로그인 API 테스트

```bash
chmod +x test-login-api.sh
sudo ./test-login-api.sh
```

### 3단계: Spring Boot 로그 확인

```bash
sudo journalctl -u share-springboot -n 100 | grep -E "(ERROR|Exception)"
```

### 4단계: Nginx 에러 로그 확인

```bash
sudo tail -50 /var/log/nginx/error.log
```

## 예상 해결 방법

1. Spring Boot 재시작
2. Nginx 프록시 설정 확인
3. CORS 설정 확인
4. Cookie 설정 확인 (SameSite=None, Secure)

