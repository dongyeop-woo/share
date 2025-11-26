# TradeNote - 주식 매매일지 및 분석 플랫폼

## 📋 프로젝트 개요

TradeNote는 주식 투자자들을 위한 매매일지 관리 및 기술적 분석 플랫폼입니다.

## 🏗️ 시스템 아키텍처

시스템 아키텍처 다이어그램은 `docs/` 폴더를 참고하세요.

- [시스템 아키텍처 다이어그램](docs/README.md)
- [AWS 아키텍처 작성 가이드](AWS_ARCHITECTURE_GUIDE.md)
- [데이터베이스 ERD](docs/DATABASE_ERD_GUIDE.md)

## 🚀 빠른 시작

### 프론트엔드
```bash
# 정적 파일 서버 실행 (포트 8080)
python -m http.server 8080
```

### 백엔드
```bash
# Python FastAPI (포트 8000)
cd backend
python run_backend.py

# Java Spring Boot (포트 8001)
cd tradenote-backend
./gradlew bootRun
```

## 📁 프로젝트 구조

```
share/
├── assets/          # 프론트엔드 리소스
│   ├── app.js       # 메인 JavaScript
│   ├── styles.css   # 스타일시트
│   └── *.js         # 기타 스크립트
├── backend/         # Python FastAPI 백엔드
│   ├── app.py       # 메인 애플리케이션
│   ├── services/    # 서비스 모듈
│   └── tests/       # 테스트 파일
├── docs/            # 문서
│   ├── architecture-diagram.mmd
│   └── database-erd.mmd
└── *.html           # HTML 페이지

tradenote-backend/   # Java Spring Boot 백엔드
└── src/main/java/   # 소스 코드
```

## 📖 주요 기능

- 📊 실시간 주식 차트 및 기술적 분석
- 📝 매매일지 작성 및 관리
- 🤖 AI 기반 뉴스 분석 및 추천
- 📈 기술적 지표 신뢰도 테스트
- ⭐ 즐겨찾기 종목 관리
- 📅 캘린더 기반 매매 내역 조회

## 🛠️ 기술 스택

### Frontend
- HTML5, CSS3, JavaScript (ES6+)
- TradingView Lightweight Charts
- 반응형 디자인

### Backend
- Python FastAPI (AI 분석, 시장 데이터)
- Java Spring Boot (인증, 사용자 관리)
- MySQL (AWS RDS)

### Infrastructure
- AWS EC2
- AWS RDS (Multi-AZ)
- Cloudflare (CDN, DDoS 보호)

## 📝 문서

- [리팩토링 요약](REFACTORING_SUMMARY.md)
- [배포 체크리스트](DEPLOYMENT_CHECKLIST.md)
- [AWS 아키텍처 가이드](AWS_ARCHITECTURE_GUIDE.md)

## 📄 라이선스

이 프로젝트는 개인 프로젝트입니다.


