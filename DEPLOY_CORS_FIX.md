# CORS 수정 완료

## 변경 사항

Spring Boot CORS 설정을 모든 Origin 허용으로 변경했습니다 (`setAllowedOriginPatterns(List.of("*"))`).

## 배포 방법

### 1. 새 JAR 파일이 이미 전송되었습니다

### 2. SSH에서 배포

```bash
sudo systemctl stop share-springboot
sudo cp /home/ubuntu/share-0.0.1-SNAPSHOT.jar /opt/share-springboot/
sudo systemctl start share-springboot
sudo systemctl status share-springboot
```

### 3. 확인

```bash
# 포트 확인
sudo ss -tlnp | grep :8001

# 로그 확인
sudo journalctl -u share-springboot -f
```

## 참고

- 현재는 모든 Origin을 허용하도록 설정했습니다
- 나중에 보안을 강화하려면 특정 도메인만 허용하도록 변경 가능

