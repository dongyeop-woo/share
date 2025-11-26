# Nginx 도메인 변경 가이드

## 방법 1: 자동 스크립트 (권장)

SSH에서 실행:

```bash
cd ~
chmod +x update-nginx-domain.sh
sudo ./update-nginx-domain.sh
```

설정 테스트가 성공하면:

```bash
sudo systemctl reload nginx
```

## 방법 2: sed 명령어로 직접 변경

```bash
# 백업
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup

# 도메인 변경
sudo sed -i 's/weektalk\.co\.kr/tradenotekr.com/g' /etc/nginx/sites-available/default
sudo sed -i 's/www\.weektalk\.co\.kr/www.tradenotekr.com/g' /etc/nginx/sites-available/default

# 설정 확인
sudo nginx -t

# 재시작
sudo systemctl reload nginx
```

## 방법 3: vi/vim 사용

```bash
sudo vi /etc/nginx/sites-available/default
```

vi 명령어:
- `i` - 편집 모드 진입
- `Esc` - 명령 모드로 돌아가기
- `:wq` - 저장하고 종료
- `:q!` - 저장하지 않고 종료
- `/weektalk` - weektalk 검색

## 변경 후 확인

```bash
# 설정 확인
sudo nginx -t

# 변경 사항 확인
sudo grep "server_name" /etc/nginx/sites-available/default

# Nginx 재시작
sudo systemctl reload nginx
```

## SSL 인증서 재발급 (Let's Encrypt)

도메인 변경 후 SSL 인증서를 새로 받아야 합니다:

```bash
sudo certbot --nginx -d tradenotekr.com -d www.tradenotekr.com
```

## DNS 설정 확인

도메인이 EC2로 올바르게 연결되는지 확인:

```bash
# DNS 확인
nslookup tradenotekr.com
dig tradenotekr.com
```

