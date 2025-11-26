# 긴급 디스크 정리 (디스크 100% 상태)

## 현재 문제
- 디스크 100% 사용 중
- 파일 전송 불가 (쓰기 공간 없음)
- 먼저 디스크 공간 확보 필요

## 즉시 실행할 명령어

**SSH 터미널에서 바로 실행하세요:**

### 1단계: 큰 파일/디렉토리 찾기

```bash
# 가장 큰 디렉토리 찾기
sudo du -h --max-depth=1 / 2>/dev/null | sort -rh | head -20

# 홈 디렉토리 확인
du -h ~ | sort -rh | head -10

# /var 확인 (로그 파일이 많을 수 있음)
sudo du -h /var 2>/dev/null | sort -rh | head -10
```

### 2단계: 즉시 정리 (안전한 것부터)

```bash
# 로그 파일 정리 (가장 안전)
sudo journalctl --vacuum-time=1d
sudo journalctl --vacuum-size=100M

# apt 캐시 정리
sudo apt-get clean
sudo apt-get autoclean

# 임시 파일 정리
sudo rm -rf /tmp/* 2>/dev/null
sudo rm -rf /var/tmp/* 2>/dev/null

# Python 캐시 정리
sudo find / -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
sudo find / -name "*.pyc" -delete 2>/dev/null

# pip 캐시 정리
rm -rf ~/.cache/pip/* 2>/dev/null
sudo rm -rf /root/.cache/pip/* 2>/dev/null
```

### 3단계: 기존 프로젝트 파일 삭제 (가장 큰 공간 확보)

```bash
# 기존 서비스 중지
sudo systemctl stop share-frontend 2>/dev/null || true
sudo systemctl stop share-backend 2>/dev/null || true
sudo pkill -f "python.*server" 2>/dev/null || true
sudo pkill -f "uvicorn" 2>/dev/null || true

# 기존 파일 삭제
sudo rm -rf /var/www/share
sudo rm -rf /opt/share-backend
sudo rm -rf /opt/share-backup
sudo rm -rf ~/share 2>/dev/null
sudo rm -rf ~/backend 2>/dev/null

# 사용하지 않는 패키지 삭제
sudo apt-get autoremove -y
```

### 4단계: 공간 확인

```bash
df -h
```

### 5단계: 충분한 공간이 확보되면 (최소 500MB 이상)

그때 파일을 전송하세요.

## 한 줄로 실행 (빠른 정리)

```bash
sudo journalctl --vacuum-time=1d && sudo apt-get clean && sudo apt-get autoremove -y && sudo rm -rf /tmp/* /var/tmp/* ~/.cache/* && sudo find / -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null && sudo systemctl stop share-frontend share-backend 2>/dev/null && sudo rm -rf /var/www/share /opt/share-backend /opt/share-backup && df -h
```

## 공간 확보 후

```bash
# 공간 확인 (최소 500MB 이상 확보 필요)
df -h

# 공간이 확보되면 파일 전송
# (PowerShell에서 다시 scp 실행)
```

