# 배포 및 포트 관련 답변

## 8001 포트는 필요 없습니다

현재 프로젝트는 **Python 백엔드만** 사용하므로:
- ✅ **포트 8000**: Python FastAPI 백엔드
- ✅ **포트 8080**: 프론트엔드 정적 파일 서버
- ❌ **포트 8001**: Spring Boot (사용 안 함)

## 배포 진행

배포 스크립트가 아직 실행되지 않았습니다. SSH에서 실행하세요:

```bash
cd ~
chmod +x cleanup-and-deploy.sh
sudo cp ~/share-deploy.tar.gz /tmp/share-deploy.tar.gz
sudo ./cleanup-and-deploy.sh
```

## 인증 API 참고사항

프론트엔드 코드에서 Spring Boot 인증 API(`AUTH_API_BASE`)를 사용하고 있지만:
- 현재는 Python 백엔드만 배포
- 인증 기능이 Python 백엔드에 구현되어 있는지 확인 필요
- 필요하면 나중에 프론트엔드 코드 수정 가능

일단 배포를 진행하고, 문제가 생기면 확인하겠습니다!

