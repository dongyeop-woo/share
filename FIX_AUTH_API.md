# 인증 API 문제 해결

## 현재 문제

1. **8001 포트 사용**: 개발 환경에서 Spring Boot 포트(8001)를 사용하려고 함
2. **프로덕션에서도 포트 번호 포함**: URL에 포트 번호가 잘못 포함됨
3. **인증 API 없음**: Python 백엔드에 인증 API가 구현되어 있지 않을 수 있음

## 수정 내용

1. **AUTH_API_BASE를 API_BASE와 동일하게 변경**
   - Spring Boot 없이 Python FastAPI만 사용
   - 개발: `http://localhost:8000`
   - 프로덕션: `https://tradenotekr.com`

2. **프로덕션 환경 감지 확인**
   - `window.location.hostname === 'tradenotekr.com'` 확인

## 추가 작업 필요

### 인증 API가 없는 경우

Python 백엔드에 인증 API를 추가해야 합니다:

- `/api/auth/register` - 회원가입
- `/api/auth/login` - 로그인
- `/api/auth/logout` - 로그아웃
- `/api/auth/me` - 현재 사용자 정보
- `/api/auth/password` - 비밀번호 변경
- `/api/auth/display-name` - 닉네임 변경
- `/api/trades` - 매매일지 API
- `/api/favorites` - 즐겨찾기 API

또는 기존 Spring Boot 백엔드를 배포해야 할 수도 있습니다.

## 다음 단계

1. 변경된 파일 배포
2. 백엔드에 인증 API 구현 확인
3. 필요한 경우 인증 API 추가 또는 Spring Boot 배포

