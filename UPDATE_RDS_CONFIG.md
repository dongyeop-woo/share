# AWS RDS 연결 설정

## 현재 문제

Spring Boot가 로컬 MySQL(`localhost:3306`)에 연결하려고 하지만, 실제로는 AWS RDS를 사용해야 합니다.

## RDS 엔드포인트 확인

AWS 콘솔에서 RDS 엔드포인트를 확인하거나, 환경 변수로 설정되어 있을 수 있습니다.

## 해결 방법

### 방법 1: application.yml 직접 수정

SSH에서:

```bash
# RDS 엔드포인트 확인 (환경 변수 또는 AWS 콘솔)
# 예시: your-db.xxxxx.us-east-1.rds.amazonaws.com

# application.yml 수정
sudo nano /opt/share-springboot/application.yml
# 또는
sudo vi /opt/share-springboot/application.yml
```

다음 줄을 찾아서:
```yaml
url: ${DB_URL:jdbc:mysql://localhost:3306/share?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Seoul&characterEncoding=UTF-8}
```

RDS 엔드포인트로 변경:
```yaml
url: ${DB_URL:jdbc:mysql://your-rds-endpoint.xxxxx.us-east-1.rds.amazonaws.com:3306/share?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Seoul&characterEncoding=UTF-8}
```

또는 환경 변수 사용:
```yaml
url: ${DB_URL:jdbc:mysql://localhost:3306/share?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Seoul&characterEncoding=UTF-8}
```

환경 변수 설정:
```bash
sudo systemctl edit share-springboot
```

다음 추가:
```ini
[Service]
Environment="DB_URL=jdbc:mysql://your-rds-endpoint.xxxxx.us-east-1.rds.amazonaws.com:3306/share?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Seoul&characterEncoding=UTF-8"
```

### 방법 2: 스크립트 사용

```bash
cd ~
chmod +x update-rds-config.sh
sudo ./update-rds-config.sh
```

## RDS 보안 그룹 확인

RDS 보안 그룹에서 EC2 인스턴스의 IP 또는 보안 그룹으로부터의 접근을 허용해야 합니다.

## 변경 후

```bash
# Spring Boot 재시작
sudo systemctl restart share-springboot

# 로그 확인
sudo journalctl -u share-springboot -f
```

