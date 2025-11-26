# SSL 인증서 오류 해결 방법

## 현재 문제
- 도메인은 `tradenotekr.com`으로 변경 완료
- SSL 인증서가 아직 `tradenotekr.com`에 발급되지 않음
- Nginx가 SSL 인증서 파일을 찾을 수 없어 에러 발생

## 해결 방법

### 방법 1: 임시로 SSL 비활성화 (HTTP만 사용) - 빠른 해결

SSH에서 실행:

```bash
cd ~
chmod +x disable-ssl-temp.sh
sudo ./disable-ssl-temp.sh
```

이렇게 하면 HTTP로 접속 가능합니다.

### 방법 2: SSL 인증서 발급 (권장)

먼저 DNS가 올바르게 설정되어 있어야 합니다:

```bash
# DNS 확인
nslookup tradenotekr.com
dig tradenotekr.com

# SSL 인증서 발급
sudo certbot --nginx -d tradenotekr.com -d www.tradenotekr.com
```

### 방법 3: 수동으로 SSL 설정 주석 처리

```bash
sudo sed -i 's/^[[:space:]]*ssl_certificate/#ssl_certificate/g' /etc/nginx/sites-available/default
sudo sed -i 's/^[[:space:]]*ssl_certificate_key/#ssl_certificate_key/g' /etc/nginx/sites-available/default
sudo sed -i 's/^[[:space:]]*return 301 https/#return 301 https/g' /etc/nginx/sites-available/default

sudo nginx -t
sudo systemctl reload nginx
```

## SSL 인증서 발급 전 확인사항

1. **DNS 설정 확인**
   - `tradenotekr.com` → EC2 IP (54.253.167.33)
   - `www.tradenotekr.com` → EC2 IP (54.253.167.33)

2. **포트 80, 443 열려있는지 확인**
   ```bash
   sudo ufw status
   sudo ufw allow 80
   sudo ufw allow 443
   ```

3. **Nginx가 포트 80, 443 리스닝하는지 확인**
   ```bash
   sudo ss -tlnp | grep -E "80|443"
   ```

## 추천 순서

1. **먼저 임시로 SSL 비활성화** (HTTP로 접속 가능하게)
2. **DNS 설정 확인 및 적용 대기** (최대 24시간 소요 가능)
3. **SSL 인증서 발급** (DNS가 올바르게 설정된 후)

