# 단계별 배포 가이드 (디스크 100% 해결)

## 현재 상황
- 디스크 100% 사용 중
- 기존 파일 삭제 필요
- 새 파일로 교체 필요

## 해결 방법

### Step 1: 파일 전송 (PowerShell)

**새 PowerShell 창에서:**

```powershell
cd C:\coding\share
.\deploy-simple.ps1
```

또는 이미 압축 파일이 있다면:

```powershell
cd C:\coding\share

# 새로 압축 파일 만들기
tar -czf share-deploy.tar.gz *.html server.py run_backend.py assets backend/app.py backend/requirements.txt backend/services backend/tests

# 스크립트와 압축 파일 전송
scp -i "C:\coding\share-backend-key.pem" cleanup-and-deploy.sh ubuntu@54.253.167.33:~/
scp -i "C:\coding\share-backend-key.pem" remove-unused-packages.sh ubuntu@54.253.167.33:~/
scp -i "C:\coding\share-backend-key.pem" share-deploy.tar.gz ubuntu@54.253.167.33:~/
```

### Step 2: SSH에서 실행

**SSH 터미널에서:**

```bash
# 1. 파일 확인
cd ~
ls -lh cleanup-and-deploy.sh remove-unused-packages.sh share-deploy.tar.gz

# 2. 실행 권한 부여
chmod +x cleanup-and-deploy.sh remove-unused-packages.sh

# 3. 사용하지 않는 패키지 확인 (선택사항)
sudo ./remove-unused-packages.sh

# 4. 압축 파일을 /tmp로 복사
sudo cp ~/share-deploy.tar.gz /tmp/share-deploy.tar.gz

# 5. 정리 + 배포 실행 (이 스크립트가 모든 걸 처리합니다)
sudo ./cleanup-and-deploy.sh
```

## cleanup-and-deploy.sh가 하는 일

1. ✅ 기존 서비스 중지
2. ✅ 기존 프론트엔드 파일 삭제 (`/var/www/share`)
3. ✅ 기존 백엔드 파일 삭제 (`/opt/share-backend`)
4. ✅ 불필요한 파일 정리 (로그, 캐시, 임시 파일)
5. ✅ 디스크 공간 확보 확인
6. ✅ 새 파일 배치
7. ✅ Python 의존성 설치
8. ✅ systemd 서비스 설정 및 시작

## 예상 결과

- 디스크 공간 확보 (100% → 약 60-70%)
- 기존 파일 완전 제거
- 새 파일로 교체
- 서비스 자동 시작

## 배포 후 확인

```bash
# 디스크 공간 확인
df -h

# 서비스 상태
sudo systemctl status share-frontend
sudo systemctl status share-backend

# 포트 확인
sudo ss -tlnp | grep -E "8080|8000"

# 로그 확인
sudo journalctl -u share-backend -n 20
```

## 문제 발생 시

```bash
# 로그 확인
sudo journalctl -u share-backend -f

# 수동 실행 테스트
cd /opt/share-backend
python3 run_backend.py
```

