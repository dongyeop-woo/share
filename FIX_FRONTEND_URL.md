# 프론트엔드 URL 문제 해결

## 현재 문제

프론트엔드가 프로덕션에서도 포트 번호를 포함한 URL을 사용:
- `http://tradenotekr.com:8001/api/auth/register`
- `https://tradenotekr.com:8001/api/auth/register`

프로덕션에서는:
- `https://tradenotekr.com/api/auth/register` (포트 없이, Nginx 프록시 통해)

## 원인

`isProduction`이 제대로 감지되지 않거나, 브라우저가 HTTP로 접속했을 수 있습니다.

## 해결 방법

### 1. 브라우저에서 HTTPS로 접속

`http://tradenotekr.com` 대신 `https://tradenotekr.com`으로 접속하세요.

### 2. 프로덕션 환경 감지 강화

현재 코드:
```javascript
const isProduction = window.location.hostname === 'tradenotekr.com' || 
                     window.location.hostname === 'www.tradenotekr.com';
```

이것은 정상입니다. 하지만 브라우저 콘솔에서 확인:
```javascript
console.log('isProduction:', isProduction);
console.log('AUTH_API_BASE:', AUTH_API_BASE);
console.log('window.location.hostname:', window.location.hostname);
```

### 3. Nginx 프록시 설정 확인

`/api/auth` 경로가 포트 8001로 프록시되는지 확인:
```bash
sudo grep -A 5 "location /api/auth" /etc/nginx/sites-available/default
```

### 4. 임시 해결: 프로덕션 감지 강화

포트 번호가 URL에 포함되지 않도록 확인 필요.

