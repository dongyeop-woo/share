# EC2 배포 가이드

이 문서는 EC2 인스턴스에 현재 프로젝트를 배포하는 방법을 설명합니다.

## 전제 조건

1. EC2 인스턴스에 SSH 접속 가능
2. 로컬에 프로젝트 파일이 준비되어 있음
3. EC2 인스턴스에 Python 3, pip 설치되어 있음

## 배포 방법

### 방법 1: 자동 배포 스크립트 사용 (권장)

#### Windows에서 실행:

```powershell
# PowerShell에서 실행
.\deploy.ps1 -InstanceIP "54.253.167.33" -KeyPath "C:\coding\share-backend-key.pem"
```

### 방법 2: 수동 배포

#### 1단계: 로컬에서 파일 압축 및 전송

```powershell
# PowerShell에서
cd C:\coding\share

# 필요한 파일들만 압축 (테스트 파일 제외)
tar -czf deploy.tar.gz ^
    *.html ^
    server.py ^
    run_backend.py ^
    backend/app.py ^
    backend/requirements.txt ^
    backend/services/ai.py ^
    assets/

# EC2로 전송
scp -i "C:\coding\share-backend-key.pem" deploy.tar.gz ubuntu@54.253.167.33:/tmp/
```

#### 2단계: EC2에서 배포 스크립트 실행

SSH로 접속한 후:

```bash
# 배포 스크립트 다운로드 (또는 직접 작성)
# 아래의 deploy-on-server.sh 내용을 EC2에서 실행

# 실행 권한 부여
chmod +x /tmp/deploy-on-server.sh

# 배포 실행
sudo /tmp/deploy-on-server.sh
```

## EC2 서비스 구조

배포 스크립트는 다음을 가정합니다:

- **프론트엔드 서버**: `/var/www/share` (포트 8080)
- **백엔드 API**: `/opt/share-backend` (포트 8000)
- **서비스 관리**: systemd 사용
- **사용자**: `ubuntu`

## 배포 후 확인

```bash
# 서비스 상태 확인
sudo systemctl status share-frontend
sudo systemctl status share-backend

# 로그 확인
sudo journalctl -u share-frontend -f
sudo journalctl -u share-backend -f

# 포트 확인
sudo netstat -tlnp | grep -E "8080|8000"
```

## 문제 해결

### 서비스가 시작되지 않는 경우

```bash
# 서비스 로그 확인
sudo journalctl -u share-backend -n 50

# 수동으로 실행하여 에러 확인
cd /opt/share-backend
python3 -m uvicorn app:app --host 0.0.0.0 --port 8000
```

### 포트 충돌

```bash
# 기존 프로세스 확인
sudo lsof -i :8080
sudo lsof -i :8000

# 프로세스 종료
sudo kill -9 <PID>
```

## 롤백 방법

```bash
# 백업된 파일 복원
cd /opt/share-backend
sudo rm -rf current
sudo mv backup_* current

# 서비스 재시작
sudo systemctl restart share-backend
```

