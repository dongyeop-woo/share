# RDS 접근 문제 해결

## 현재 문제

```
Access denied for user 'root'@'172.31.29.228' (using password: YES)
```

Spring Boot가 RDS에 접근할 수 없습니다.

## 해결 방법

### 1. RDS 보안 그룹 확인

AWS 콘솔에서:
- RDS 보안 그룹 확인
- EC2 인스턴스의 보안 그룹 또는 IP가 포트 3306 접근을 허용해야 함
- EC2 인스턴스 IP: `172.31.29.228` (private IP)

### 2. RDS 사용자 확인

현재 설정:
- 호스트: `share-db.cb2yuq22wu31.ap-southeast-2.rds.amazonaws.com`
- 사용자: `root`
- 비밀번호: `skdus4972@@`

RDS에서:
- 사용자명이 `root`인지 확인
- 비밀번호가 올바른지 확인
- 호스트 제한이 있는지 확인 (`%` 또는 특정 IP 허용)

### 3. application.yml 확인

현재 설정을 확인하고 필요시 수정:
```bash
sudo cat /opt/share-springboot/application.yml
```

### 4. 임시 해결: 로컬 MySQL 사용 (테스트용)

RDS 연결이 안 되면 임시로 로컬 MySQL 사용 가능하지만, 실제 운영에는 RDS 필요.

