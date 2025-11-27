-- RDS 연결 테스트 및 사용자 권한 확인 SQL

-- 1. 현재 사용자 확인
SELECT user, host FROM mysql.user WHERE user='root';

-- 2. 데이터베이스 확인
SHOW DATABASES;

-- 3. 권한 확인
SHOW GRANTS FOR 'root'@'localhost';
SHOW GRANTS FOR 'root'@'%';

-- 4. 새 사용자 생성 (모든 호스트에서 접근)
-- 주의: RDS에서 마스터 사용자로만 실행 가능
CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY 'skdus4972@@';
GRANT ALL PRIVILEGES ON share.* TO 'root'@'%';
FLUSH PRIVILEGES;

-- 5. 특정 IP에서 접근하는 사용자 생성
CREATE USER IF NOT EXISTS 'root'@'172.31.29.228' IDENTIFIED BY 'skdus4972@@';
GRANT ALL PRIVILEGES ON share.* TO 'root'@'172.31.29.228';
FLUSH PRIVILEGES;

CREATE USER IF NOT EXISTS 'root'@'211.204.202.110' IDENTIFIED BY 'skdus4972@@';
GRANT ALL PRIVILEGES ON share.* TO 'root'@'211.204.202.110';
FLUSH PRIVILEGES;

