# 백엔드 상태 확인 및 수정

## 현재 상태
- ✅ 프론트엔드: 정상 실행 중 (포트 8080)
- ❌ 백엔드: 시작 실패 (auto-restart)

## 확인해야 할 사항

### 1. 백엔드 로그 확인

SSH에서 실행:

```bash
sudo journalctl -u share-backend -n 50
```

### 2. 수동으로 백엔드 실행 테스트

```bash
cd /opt/share-backend
python3 run_backend.py
```

### 3. requirements.txt 수정 필요

`finance-datareader==3.1.0` 버전이 존재하지 않습니다. 최신 버전은 0.9.96입니다.

수정 필요:
- finance-datareader==3.1.0 → finance-datareader==0.9.96 (또는 최신 버전)

## 수정 방법

### SSH에서 직접 수정:

```bash
sudo nano /opt/share-backend/requirements.txt
```

다음 줄을:
```
finance-datareader==3.1.0
```

다음으로 변경:
```
finance-datareader==0.9.96
```

그 다음 설치:
```bash
cd /opt/share-backend
sudo pip3 install finance-datareader==0.9.96
sudo systemctl restart share-backend
```

