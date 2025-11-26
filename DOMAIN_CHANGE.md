# 도메인 변경 완료

## 변경 내용

도메인을 `weektalk.co.kr`에서 `tradenotekr.com`으로 변경했습니다.

## 변경된 파일

1. **assets/app.js**
   - 프로덕션 환경 감지: `weektalk.co.kr` → `tradenotekr.com`
   - API_BASE: `https://weektalk.co.kr` → `https://tradenotekr.com`
   - AUTH_API_BASE: `https://weektalk.co.kr` → `https://tradenotekr.com`

2. **news.html**
   - 프로덕션 환경 감지: `weektalk.co.kr` → `tradenotekr.com`
   - API_BASE: `https://weektalk.co.kr` → `https://tradenotekr.com`

## 추가 작업 필요

### 1. Nginx 설정 변경

SSH에서 Nginx 설정 파일을 확인하고 수정해야 합니다:

```bash
sudo nano /etc/nginx/sites-available/default
```

`server_name` 부분을 수정:
```nginx
server_name tradenotekr.com www.tradenotekr.com;
```

### 2. SSL 인증서 재발급 (Let's Encrypt)

```bash
sudo certbot --nginx -d tradenotekr.com -d www.tradenotekr.com
```

### 3. DNS 설정

도메인 DNS에 A 레코드를 EC2 인스턴스 IP로 설정:
- `tradenotekr.com` → `54.253.167.33`
- `www.tradenotekr.com` → `54.253.167.33`

### 4. 배포

변경된 파일을 배포해야 합니다:

```powershell
# PowerShell에서
cd C:\coding\share
.\deploy-simple.ps1
```

SSH에서:
```bash
cd ~
sudo cp ~/share-deploy.tar.gz /tmp/share-deploy.tar.gz
sudo ./cleanup-and-deploy.sh
```

## 참고

- 기존 `weektalk.co.kr` 도메인은 더 이상 사용되지 않습니다.
- 모든 API 요청이 새로운 도메인으로 전송됩니다.
- Nginx 설정과 SSL 인증서도 업데이트해야 합니다.

