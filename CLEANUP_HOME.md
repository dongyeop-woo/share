# 홈 디렉토리 정리 가이드

## 현재 홈 디렉토리 파일 목록

```
check-and-remove-packages.sh
check-existing-service.sh
cleanup-and-deploy.sh
config/
fastapi/
final-disk-cleanup.sh
remove-unused-packages.sh
safe-package-cleanup.sh
share-0.0.1-SNAPSHOT.jar  ← 삭제 가능
share-deploy.tar.gz        ← 배포 파일 (배포 후 삭제)
tmp/                       ← 삭제 가능
```

## 삭제 가능한 파일

### 1. Spring Boot JAR 파일
- `share-0.0.1-SNAPSHOT.jar`
- 이유: 현재 프로젝트는 Python 백엔드만 사용
- 삭제: `rm -f ~/share-0.0.1-SNAPSHOT.jar`

### 2. 임시 디렉토리
- `tmp/`
- 삭제: `rm -rf ~/tmp`

### 3. fastapi 디렉토리
- 내용 확인 후 결정
- 확인: `ls -la ~/fastapi`

### 4. 배포 스크립트들
- 배포 완료 후 정리 가능
- 삭제: `rm -f ~/*.sh`

## 빠른 정리 방법

### 방법 1: 자동 정리 스크립트

**PowerShell에서 전송:**
```powershell
cd C:\coding\share
scp -i "C:\coding\share-backend-key.pem" quick-cleanup-home.sh ubuntu@54.253.167.33:~/
```

**SSH에서 실행:**
```bash
chmod +x ~/quick-cleanup-home.sh
~/quick-cleanup-home.sh
```

### 방법 2: 수동 삭제

```bash
# Spring Boot JAR 삭제
rm -f ~/share-0.0.1-SNAPSHOT.jar

# 임시 디렉토리 삭제
rm -rf ~/tmp

# fastapi 디렉토리 확인
ls -la ~/fastapi

# 내용이 없거나 필요 없으면 삭제
rm -rf ~/fastapi
```

## 배포 후 정리

배포가 완료되면:

```bash
# 배포 파일 삭제
rm -f ~/share-deploy.tar.gz

# 스크립트 파일들 정리
rm -f ~/*.sh

# 공간 확인
df -h
```

