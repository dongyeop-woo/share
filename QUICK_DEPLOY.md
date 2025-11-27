# 빠른 배포 가이드

## 현재 상황
EC2 인스턴스에 SSH로 접속했고, 기존 프론트엔드/백엔드를 현재 프로젝트로 업데이트하고 싶음.

## 가장 빠른 방법 (권장)

### 1단계: 로컬 Windows에서 파일 전송 준비

PowerShell에서 실행:

```powershell
cd C:\coding\share
.\deploy.ps1 -InstanceIP "54.253.167.33" -KeyPath "C:\coding\share-backend-key.pem"
```

이 스크립트가 자동으로:
- 필요한 파일만 모아서 압축
- EC2로 전송
- 서버에서 배포 실행

### 2단계: 수동 확인 (필요시)

SSH 접속 후:

```bash
# 서비스 상태 확인
sudo systemctl status share-frontend
sudo systemctl status share-backend

# 로그 확인
sudo journalctl -u share-backend -f
```

## 수동 배포 방법 (스크립트가 작동하지 않는 경우)

### 1. 로컬에서 파일 압축

PowerShell:

```powershell
cd C:\coding\share

# tar가 없는 경우 7-Zip 사용
# 또는 WinRAR로 수동 압축 (ZIP 형식)

# tar 사용 (Windows 10+)
tar -czf deploy.tar.gz *.html server.py run_backend.py assets backend/app.py backend/requirements.txt backend/services backend/tests
```

### 2. EC2로 전송

새 PowerShell 창에서:

```powershell
scp -i "C:\coding\share-backend-key.pem" deploy.tar.gz ubuntu@54.253.167.33:/tmp/
scp -i "C:\coding\share-backend-key.pem" deploy-on-server.sh ubuntu@54.253.167.33:/tmp/
```

### 3. EC2에서 실행

SSH 접속한 터미널에서:

```bash
cd /tmp
chmod +x deploy-on-server.sh
sudo ./deploy-on-server.sh
```

## 문제 발생 시

### 서비스가 시작되지 않음

```bash
# 수동으로 백엔드 실행하여 에러 확인
cd /opt/share-backend
python3 run_backend.py

# 또는 직접 uvicorn 실행
cd /opt/share-backend
python3 -m uvicorn app:app --host 0.0.0.0 --port 8000
```

### 포트가 이미 사용 중

```bash
# 포트 사용 중인 프로세스 확인
sudo lsof -i :8080
sudo lsof -i :8000

# 프로세스 종료
sudo kill -9 <PID>
```

### 기존 파일 위치가 다른 경우

`deploy-on-server.sh` 파일의 다음 부분을 수정:

```bash
FRONTEND_DIR="/var/www/share"  # 실제 프론트엔드 경로로 변경
BACKEND_DIR="/opt/share-backend"  # 실제 백엔드 경로로 변경
```

## 참고

- 프론트엔드: 포트 8080 (server.py)
- 백엔드 API: 포트 8000 (FastAPI/uvicorn)
- 로그: `sudo journalctl -u share-frontend -f` 또는 `-u share-backend -f`

