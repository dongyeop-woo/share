# 기존 환경 확인 후 배포하기

## 현재 상황
- EC2에 SSH 접속 완료
- 기존 systemd 서비스 없음 확인
- 기존 파일 위치 파악 필요

## 1단계: 기존 환경 빠르게 확인

**SSH 접속된 터미널에서 바로 실행:**

```bash
# 실행 중인 프로세스 확인
ps aux | grep -E "python|node|npm" | grep -v grep

# 포트 확인
sudo lsof -i :8080 2>/dev/null || sudo ss -tlnp | grep :8080
sudo lsof -i :8000 2>/dev/null || sudo ss -tlnp | grep :8000

# 홈 디렉토리 확인
ls -la ~/

# 기존 프로젝트 디렉토리 확인
sudo find /home /var/www /opt -type d -name "*share*" -o -name "*frontend*" -o -name "*backend*" 2>/dev/null | head -10
```

## 2단계: 기존 프로세스 종료 (있는 경우)

```bash
# 실행 중인 Python 서버 종료
sudo pkill -f "python.*server.py" 2>/dev/null || true
sudo pkill -f "uvicorn" 2>/dev/null || true
sudo pkill -f "python.*app.py" 2>/dev/null || true

# 확인
ps aux | grep python | grep -v grep
```

## 3단계: 파일 전송 및 배포

### 옵션 A: 자동 배포 (권장)

**새 PowerShell 창에서:**

```powershell
cd C:\coding\share
.\deploy.ps1
```

### 옵션 B: 수동 배포

#### Step 1: 로컬에서 파일 준비

**새 PowerShell 창에서:**

```powershell
cd C:\coding\share

# 파일 압축
tar -czf deploy.tar.gz *.html server.py run_backend.py assets backend/app.py backend/requirements.txt backend/services backend/tests

# EC2로 전송
scp -i "C:\coding\share-backend-key.pem" deploy.tar.gz ubuntu@54.253.167.33:/tmp/
scp -i "C:\coding\share-backend-key.pem" deploy-on-server.sh ubuntu@54.253.167.33:/tmp/
scp -i "C:\coding\share-backend-key.pem" check-existing-service.sh ubuntu@54.253.167.33:/tmp/
```

#### Step 2: SSH 터미널에서 배포 실행

```bash
cd /tmp
chmod +x deploy-on-server.sh
sudo ./deploy-on-server.sh
```

## 4단계: 배포 후 확인

```bash
# 서비스 상태
sudo systemctl status share-frontend
sudo systemctl status share-backend

# 포트 확인
sudo ss -tlnp | grep -E "8080|8000"

# 로그 확인
sudo journalctl -u share-frontend -n 20
sudo journalctl -u share-backend -n 20

# 브라우저에서 테스트
# http://54.253.167.33:8080
# http://54.253.167.33:8000/docs
```

## 문제 발생 시

### 서비스가 시작되지 않음

```bash
# 로그 확인
sudo journalctl -u share-backend -f

# 수동 실행하여 에러 확인
cd /opt/share-backend
python3 run_backend.py
```

### 포트 충돌

```bash
# 프로세스 확인 및 종료
sudo lsof -i :8080
sudo kill -9 <PID>
```

