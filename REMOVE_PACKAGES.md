# 패키지 확인 및 삭제 가이드

## 현재 상황
- 디스크 사용량: 92% (665MB 여유)
- 사용하지 않는 패키지 정리 필요

## 방법 1: 자동 정리 스크립트 (권장)

### Step 1: 파일 전송 (PowerShell)

```powershell
cd C:\coding\share
scp -i "C:\coding\share-backend-key.pem" safe-package-cleanup.sh ubuntu@54.253.167.33:~/
scp -i "C:\coding\share-backend-key.pem" check-and-remove-packages.sh ubuntu@54.253.167.33:~/
```

### Step 2: SSH에서 실행

```bash
cd ~
chmod +x check-and-remove-packages.sh safe-package-cleanup.sh

# 먼저 확인
./check-and-remove-packages.sh

# 안전하게 정리
sudo ./safe-package-cleanup.sh
```

## 방법 2: 직접 명령어 실행

### 패키지 확인

```bash
# Python 패키지 확인
pip3 list

# apt 패키지 확인
dpkg -l | head -30

# 사용하지 않는 패키지 확인
sudo apt-get -s autoremove
```

### 안전하게 삭제

```bash
# 1. 사용하지 않는 apt 패키지 삭제
sudo apt-get autoremove -y

# 2. apt 캐시 정리
sudo apt-get clean
sudo apt-get autoclean

# 3. Python 패키지 확인 후 수동 삭제
pip3 list
# 필요없는 패키지가 있다면:
# sudo pip3 uninstall 패키지명
```

## 주의사항

### 삭제하면 안 되는 패키지
- `python3`, `pip3` (Python 기본)
- `systemd`, `ssh`, `net-tools` (시스템 필수)
- 현재 프로젝트에서 사용하는 패키지:
  - `fastapi`, `uvicorn` (백엔드 필수)
  - `pandas`, `numpy` (데이터 처리)
  - `yfinance`, `finance-datareader` (주식 데이터)
  - 등등

### 안전하게 삭제 가능한 것들
- 사용하지 않는 라이브러리
- 오래된 패키지
- 테스트용 패키지
- 불필요한 개발 도구

## 추천 진행 순서

1. **먼저 확인:**
   ```bash
   ./check-and-remove-packages.sh
   ```

2. **안전하게 정리:**
   ```bash
   sudo ./safe-package-cleanup.sh
   ```

3. **공간 확인:**
   ```bash
   df -h
   ```

4. **필요하면 Python 패키지 수동 정리:**
   ```bash
   pip3 list
   # 큰 패키지 중 사용하지 않는 것만 삭제
   ```

