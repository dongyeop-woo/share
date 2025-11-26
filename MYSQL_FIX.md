# MySQL 연결 문제 해결

## 현재 문제

Spring Boot가 MySQL 데이터베이스에 연결할 수 없습니다:
- `Connection refused` 에러
- 포트 8001이 다른 프로세스에 의해 사용 중

## 해결 방법

### 방법 1: 자동 스크립트 실행

SSH에서:

```bash
cd ~
chmod +x fix-springboot-db.sh
sudo ./fix-springboot-db.sh
```

### 방법 2: 수동으로 해결

```bash
# 1. 기존 프로세스 종료
sudo pkill -9 -f "share-0.0.1-SNAPSHOT.jar"

# 2. MySQL 서비스 확인
sudo systemctl status mysql
# 또는
sudo systemctl status mariadb

# 3. MySQL 시작 (실행 안 되면)
sudo systemctl start mysql
# 또는
sudo systemctl start mariadb

# 4. MySQL 포트 확인
sudo ss -tlnp | grep :3306

# 5. Spring Boot 재시작
sudo systemctl restart share-springboot

# 6. 로그 확인
sudo journalctl -u share-springboot -f
```

## MySQL 설치 확인

MySQL이 설치되어 있지 않을 수 있습니다:

```bash
# MySQL 설치 확인
mysql --version

# 설치되어 있지 않으면
sudo apt update
sudo apt install mysql-server -y

# MySQL 시작 및 활성화
sudo systemctl start mysql
sudo systemctl enable mysql

# root 비밀번호 설정 (처음 설치 시)
sudo mysql_secure_installation
```

## 데이터베이스 생성

application.yml에서 `share` 데이터베이스를 사용하므로:

```bash
sudo mysql -u root -p
```

SQL:
```sql
CREATE DATABASE IF NOT EXISTS share CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

