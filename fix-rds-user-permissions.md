# RDS MySQL 사용자 권한 문제 해결

## 문제 확인

MySQL Workbench와 Spring Boot 모두에서 동일한 오류:
- `Access denied for user 'root'@'IP_ADDRESS'`

이는 MySQL 사용자 권한 문제입니다.

## 해결 방법

### 옵션 1: RDS에서 새 사용자 생성 (권장)

AWS RDS 콘솔에서:
1. RDS 콘솔 → Parameter Groups
2. 새 파라미터 그룹 생성 (또는 기존 것 사용)
3. 다음 파라미터 설정:
   - `sql_mode`: 필요한 모드 설정
4. 데이터베이스 → 수정 → 파라미터 그룹 변경

**또는 MySQL Workbench에서 직접:**

1. RDS 마스터 사용자로 연결 (아마 다른 사용자명)
2. 다음 SQL 실행:

```sql
-- 새 사용자 생성 (모든 호스트에서 접근 허용)
CREATE USER 'root'@'%' IDENTIFIED BY 'skdus4972@@';

-- 또는 특정 IP에서만 접근 허용
CREATE USER 'root'@'172.31.29.228' IDENTIFIED BY 'skdus4972@@';
CREATE USER 'root'@'211.204.202.110' IDENTIFIED BY 'skdus4972@@';

-- 권한 부여
GRANT ALL PRIVILEGES ON share.* TO 'root'@'%';
-- 또는
GRANT ALL PRIVILEGES ON share.* TO 'root'@'172.31.29.228';
GRANT ALL PRIVILEGES ON share.* TO '211.204.202.110';

FLUSH PRIVILEGES;
```

### 옵션 2: 기존 사용자 호스트 추가

```sql
-- 현재 사용자 확인
SELECT user, host FROM mysql.user WHERE user='root';

-- 새 호스트 추가
CREATE USER 'root'@'172.31.29.228' IDENTIFIED BY 'skdus4972@@';
GRANT ALL PRIVILEGES ON share.* TO 'root'@'172.31.29.228';

CREATE USER 'root'@'211.204.202.110' IDENTIFIED BY 'skdus4972@@';
GRANT ALL PRIVILEGES ON share.* TO 'root'@'211.204.202.110';

FLUSH PRIVILEGES;
```

### 옵션 3: application.yml에서 다른 사용자 사용

RDS에 다른 사용자가 있다면 그 사용자 사용:
- 예: `admin`, `appuser` 등

