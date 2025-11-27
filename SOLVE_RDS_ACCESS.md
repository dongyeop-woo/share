# RDS 접근 문제 해결 - 최종 가이드

## 문제 상황

- Spring Boot: `Access denied for user 'root'@'172.31.29.228'`
- MySQL Workbench: `Access denied for user 'root'@'211.204.202.110'`

**원인:** RDS MySQL에서 `root` 사용자가 해당 IP에서 접근할 권한이 없음

## 해결 방법

### 방법 1: RDS 마스터 사용자로 새 사용자 생성 (권장)

**1단계: RDS 마스터 사용자 확인**
- AWS RDS 콘솔 → 데이터베이스 → `share-db` 선택
- "구성" 탭에서 **마스터 사용자 이름** 확인
- 보통 `admin`, `root`, 또는 다른 이름

**2단계: MySQL Workbench에서 마스터 사용자로 연결**
- 마스터 사용자명과 비밀번호로 연결 시도
- 성공하면 다음 SQL 실행:

```sql
-- 모든 호스트에서 접근 가능한 사용자 생성
CREATE USER 'appuser'@'%' IDENTIFIED BY 'skdus4972@@';
GRANT ALL PRIVILEGES ON share.* TO 'appuser'@'%';
FLUSH PRIVILEGES;

-- 또는 root 사용자에 권한 부여
GRANT ALL PRIVILEGES ON share.* TO 'root'@'%';
FLUSH PRIVILEGES;
```

**3단계: application.yml 수정**
사용자를 `appuser`로 변경하거나, `root@'%'` 권한이 있으면 그대로 사용

### 방법 2: 특정 IP에서 접근 허용

```sql
-- EC2 IP 허용
CREATE USER IF NOT EXISTS 'root'@'172.31.29.228' IDENTIFIED BY 'skdus4972@@';
GRANT ALL PRIVILEGES ON share.* TO 'root'@'172.31.29.228';

-- MySQL Workbench IP 허용
CREATE USER IF NOT EXISTS 'root'@'211.204.202.110' IDENTIFIED BY 'skdus4972@@';
GRANT ALL PRIVILEGES ON share.* TO 'root'@'211.204.202.110';

FLUSH PRIVILEGES;
```

### 방법 3: RDS 파라미터로 사용자 생성

일부 RDS 설정에서는 다음을 시도:

```sql
-- 현재 사용자 확인
SELECT user, host FROM mysql.user;

-- root 사용자에 모든 호스트 권한 부여
UPDATE mysql.user SET host='%' WHERE user='root' AND host='localhost';
FLUSH PRIVILEGES;
```

## application.yml 업데이트 필요할 수 있음

새 사용자를 사용하는 경우:
```yaml
spring:
  datasource:
    username: appuser  # 또는 다른 사용자명
    password: skdus4972@@
```

## 다음 단계

1. AWS 콘솔에서 RDS 마스터 사용자명 확인
2. MySQL Workbench로 마스터 사용자로 연결
3. 위 SQL 실행하여 권한 부여
4. Spring Boot 재시작

결과를 알려주세요!

