# 502 Bad Gateway 문제 진단 및 해결

## 현재 문제
- 프론트엔드는 정상 작동
- 백엔드 API 호출 시 502 에러 발생
- `https://weektalk.co.kr/api/...` 요청 실패

## 원인
1. 백엔드 서비스가 실행되지 않음
2. Nginx가 백엔드(포트 8000)로 프록시하지 못함
3. 백엔드가 포트 8000에서 리스닝하지 않음

## 해결 단계

### Step 1: 백엔드 상태 확인

SSH에서 실행:

```bash
cd ~
chmod +x check-backend-status.sh
sudo ./check-backend-status.sh
```

또는 직접 확인:

```bash
# 백엔드 서비스 상태
sudo systemctl status share-backend

# 백엔드 로그
sudo journalctl -u share-backend -n 50

# 포트 확인
sudo ss -tlnp | grep :8000

# 프로세스 확인
ps aux | grep python | grep 8000
```

### Step 2: 백엔드 수정 및 재시작

```bash
# finance-datareader 설치 (아직 안 했으면)
cd /opt/share-backend
sudo pip3 install finance-datareader==0.9.96

# 백엔드 수동 실행 테스트
python3 run_backend.py
```

### Step 3: Nginx 설정 확인

```bash
# Nginx 설정 파일 확인
sudo cat /etc/nginx/sites-available/default
# 또는
sudo cat /etc/nginx/nginx.conf

# Nginx 상태 확인
sudo systemctl status nginx

# Nginx 설정 테스트
sudo nginx -t

# Nginx 재시작
sudo systemctl restart nginx
```

### Step 4: 백엔드 서비스 재시작

```bash
sudo systemctl restart share-backend
sudo systemctl status share-backend
```

## 예상되는 Nginx 설정

Nginx가 백엔드로 프록시하려면 다음과 같은 설정이 필요합니다:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 빠른 해결 방법

1. 백엔드 상태 확인
2. 백엔드가 실행되지 않으면 로그 확인 후 수정
3. Nginx 설정 확인 및 재시작

