# Spring Boot 배포 가이드

## 현재 상황
- Python FastAPI: 포트 8000 (주식 데이터, AI 분석)
- Spring Boot: 포트 8001 (인증, 사용자 관리) - **배포 필요**

## 배포 방법

### Step 1: Spring Boot JAR 파일 빌드

로컬에서 JAR 파일 생성:

```powershell
cd C:\coding\tradenote-backend
.\gradlew.bat bootJar
```

빌드된 JAR 파일 위치:
- `build/libs/share-0.0.1-SNAPSHOT.jar`

### Step 2: JAR 파일 전송

PowerShell에서:

```powershell
cd C:\coding\tradenote-backend
scp -i "C:\coding\share-backend-key.pem" build/libs/share-0.0.1-SNAPSHOT.jar ubuntu@54.253.167.33:~/
```

### Step 3: application.yml 확인 및 전송

Spring Boot 설정 파일 확인:

```powershell
cd C:\coding\tradenote-backend
scp -i "C:\coding\share-backend-key.pem" src/main/resources/application.yml ubuntu@54.253.167.33:~/
```

### Step 4: 배포 스크립트 전송

```powershell
cd C:\coding\share
scp -i "C:\coding\share-backend-key.pem" deploy-springboot.sh ubuntu@54.253.167.33:~/
```

### Step 5: SSH에서 배포 실행

SSH에서:

```bash
cd ~
chmod +x deploy-springboot.sh
sudo ./deploy-springboot.sh
```

## 확인

```bash
# 서비스 상태
sudo systemctl status share-springboot

# 포트 확인
sudo ss -tlnp | grep :8001

# 로그 확인
sudo journalctl -u share-springboot -f
```

## 필요 사항

1. Java 21 설치 확인:
   ```bash
   java -version
   ```

2. MySQL 데이터베이스 연결 확인 (application.yml에서 설정)

3. Nginx 프록시 설정 확인 (`/api/auth` 경로가 포트 8001로 프록시되는지)

