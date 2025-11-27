# RDS 접근 문제 해결 가이드

## 현재 문제

```
ERROR 1045 (28000): Access denied for user 'root'@'172.31.29.228' (using password: YES)
```

## 원인

1. **RDS 보안 그룹 설정 문제** (가능성 높음)
   - EC2 인스턴스의 IP 또는 보안 그룹이 RDS 보안 그룹의 인바운드 규칙에 없음

2. **데이터베이스 자격 증명 문제**
   - 사용자명 `root`가 존재하지 않거나
   - 비밀번호 `skdus4972@@`가 잘못됨

## 해결 방법

### 방법 1: RDS 보안 그룹 수정 (권장)

**AWS 콘솔에서:**

1. RDS 콘솔 → 데이터베이스 → `share-db` 선택
2. "연결 및 보안" 탭 클릭
3. "보안" → 보안 그룹 클릭
4. "인바운드 규칙" → "편집"
5. 다음 규칙 추가:
   - **Type:** MySQL/Aurora
   - **Port:** 3306
   - **Source:** 
     - EC2 인스턴스의 보안 그룹 ID 선택, 또는
     - Custom: `172.31.29.228/32` (EC2 Private IP)
   - **Description:** "Allow EC2 access"

### 방법 2: RDS 사용자/비밀번호 확인

SSH에서 다음 스크립트 실행:
```bash
sudo ./check-rds-issue.sh
```

### 방법 3: 올바른 자격 증명 알려주기

만약 사용자명이나 비밀번호가 다르다면 알려주세요. `application.yml`을 수정하겠습니다.

## 현재 설정

- **RDS 호스트:** `share-db.cb2yuq22wu31.ap-southeast-2.rds.amazonaws.com`
- **사용자명:** `root`
- **비밀번호:** `skdus4972@@`
- **EC2 Private IP:** `172.31.29.228`

## 다음 단계

1. 먼저 `check-rds-issue.sh` 실행하여 네트워크 정보 확인
2. AWS 콘솔에서 RDS 보안 그룹 수정
3. 수정 후 다시 연결 테스트

