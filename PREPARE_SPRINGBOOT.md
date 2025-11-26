# Spring Boot 배포 준비

## 현재 상황
- ✅ AUTH_API_BASE 설정 복구 (8001 포트 사용)
- ❌ Spring Boot 서비스 미배포

## 배포 단계

### Step 1: Spring Boot JAR 파일 전송

PowerShell에서:

```powershell
cd C:\coding\tradenote-backend

# 이미 빌드된 JAR 파일이 있으면
scp -i "C:\coding\share-backend-key.pem" build/libs/share-0.0.1-SNAPSHOT.jar ubuntu@54.253.167.33:~/

# JAR 파일이 없으면 빌드 필요
.\gradlew.bat bootJar
scp -i "C:\coding\share-backend-key.pem" build/libs/share-0.0.1-SNAPSHOT.jar ubuntu@54.253.167.33:~/
```

### Step 2: application.yml 전송 (필요시)

데이터베이스 설정 확인 후 전송:

```powershell
scp -i "C:\coding\share-backend-key.pem" src/main/resources/application.yml ubuntu@54.253.167.33:~/
```

**주의**: application.yml에 데이터베이스 비밀번호가 포함되어 있습니다. 배포 후 보안 설정을 확인하세요.

### Step 3: SSH에서 배포

SSH에서:

```bash
cd ~
chmod +x deploy-springboot.sh
sudo ./deploy-springboot.sh
```

## 필요 사항 확인

### Java 21 설치 확인

SSH에서:

```bash
java -version
```

Java가 없으면:

```bash
sudo apt update
sudo apt install openjdk-21-jdk -y
```

### MySQL 데이터베이스 확인

application.yml에서 데이터베이스 설정 확인:
- URL: `jdbc:mysql://localhost:3306/share`
- 사용자: `root`
- 비밀번호: `skdus4972@@`

## 배포 후 확인

```bash
# 서비스 상태
sudo systemctl status share-springboot

# 포트 확인
sudo ss -tlnp | grep :8001

# 로그 확인
sudo journalctl -u share-springboot -f
```

## Nginx 프록시 확인

Nginx가 `/api/auth` 경로를 포트 8001로 프록시하는지 확인:

```bash
sudo grep -A 10 "location /api/auth" /etc/nginx/sites-available/default
```

