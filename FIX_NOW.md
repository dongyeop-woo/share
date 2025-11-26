# 즉시 해결 방법

## 현재 문제
파일 전송 실패 - `/tmp` 디렉토리에 쓰기 실패

## 빠른 해결책

### Step 1: EC2에서 상태 확인

**SSH 터미널에서 바로 실행:**

```bash
# 디스크 공간 확인
df -h

# /tmp 정리
sudo rm -f /tmp/share-deploy*.tar.gz 2>/dev/null
sudo rm -f /tmp/*.sh 2>/dev/null

# /tmp 권한 확인
ls -ld /tmp
```

### Step 2: 홈 디렉토리로 다시 전송

**Windows PowerShell에서:**

```powershell
cd C:\coding\share

# 홈 디렉토리(~)로 전송
scp -i "C:\coding\share-backend-key.pem" deploy-on-server.sh ubuntu@54.253.167.33:~/
scp -i "C:\coding\share-backend-key.pem" check-existing-service.sh ubuntu@54.253.167.33:~/

# 압축 파일 준비 (이미 만들어졌을 수 있음)
if (Test-Path "C:\Users\dongy\AppData\Local\Temp\share-deploy-20251126125026.tar.gz") {
    scp -i "C:\coding\share-backend-key.pem" "C:\Users\dongy\AppData\Local\Temp\share-deploy-20251126125026.tar.gz" ubuntu@54.253.167.33:~/share-deploy.tar.gz
} else {
    # 새로 압축
    tar -czf share-deploy.tar.gz *.html server.py run_backend.py assets backend/app.py backend/requirements.txt backend/services
    scp -i "C:\coding\share-backend-key.pem" share-deploy.tar.gz ubuntu@54.253.167.33:~/
}
```

### Step 3: SSH에서 실행

**SSH 터미널에서:**

```bash
# 파일 확인
ls -lh ~/deploy-* ~/share-*

# /tmp로 이동 (관리자 권한 필요)
sudo mv ~/share-deploy.tar.gz /tmp/share-deploy.tar.gz
sudo mv ~/deploy-on-server.sh /tmp/deploy-on-server.sh
sudo mv ~/check-existing-service.sh /tmp/check-existing-service.sh

# 실행
cd /tmp
chmod +x deploy-on-server.sh check-existing-service.sh
sudo ./check-existing-service.sh    # 선택사항: 기존 환경 확인
sudo ./deploy-on-server.sh          # 배포 실행
```

## 또는 더 간단하게

**홈 디렉토리에서 직접 실행하는 방법:**

SSH 터미널에서 `deploy-on-server.sh`를 홈 디렉토리에서 실행하도록 수정:

```bash
cd ~
chmod +x deploy-on-server.sh

# deploy-on-server.sh 파일 수정 (경로만 변경)
sed -i 's|/tmp/share-deploy.tar.gz|~/share-deploy.tar.gz|g' deploy-on-server.sh
sed -i 's|ARCHIVE_PATH="/tmp/share-deploy.tar.gz"|ARCHIVE_PATH="$HOME/share-deploy.tar.gz"|g' deploy-on-server.sh

# 직접 실행
sudo bash deploy-on-server.sh
```

## 추천 방법

**가장 안전한 방법:**

1. PowerShell에서 홈 디렉토리로 전송
2. SSH에서 파일 확인 후 /tmp로 복사
3. 배포 실행

이 방법이 가장 확실합니다!

