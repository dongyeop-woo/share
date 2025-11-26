# 현재 문제 및 해결 방법

## 문제 1: Spring Boot 포트 8001이 리스닝하지 않음

Spring Boot가 시작되었지만 포트가 열리지 않았습니다. 로그를 확인해야 합니다.

**SSH에서 확인:**

```bash
cd ~
chmod +x check-springboot-log.sh
sudo ./check-springboot-log.sh
```

또는 직접:

```bash
sudo journalctl -u share-springboot -n 100
```

가능한 원인:
- 데이터베이스 연결 실패
- 포트 충돌
- 설정 오류

## 문제 2: 프론트엔드가 프로덕션에서도 포트 번호 포함

프론트엔드가 프로덕션 환경에서도 `http://tradenotekr.com:8001`로 요청하고 있습니다.

프로덕션에서는:
- `https://tradenotekr.com/api/auth/...` (Nginx 프록시 통해)
- 포트 번호 없이 사용해야 함

현재 `AUTH_API_BASE` 설정:
- 프로덕션: `https://tradenotekr.com` ✅ (올바름)
- 개발: `http://localhost:8001` ✅ (올바름)

하지만 실제 요청이 `:8001`을 포함하고 있으므로, 프로덕션 환경 감지가 제대로 되지 않거나 다른 문제가 있을 수 있습니다.

## 해결 순서

1. **Spring Boot 로그 확인** - 왜 포트가 열리지 않는지 확인
2. **프로덕션 환경 감지 확인** - `isProduction` 변수가 제대로 작동하는지
3. **Nginx 프록시 설정 확인** - `/api/auth` 경로가 포트 8001로 프록시되는지

