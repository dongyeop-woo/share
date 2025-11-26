# SSH 터미널 붙여넣기 팁

## 문제
Windows에서 복사한 텍스트를 SSH에서 Ctrl+V로 붙여넣으려고 하면 `^v`가 출력됨

## 해결 방법

### 방법 1: 파일로 전송 (권장) ✅

스크립트를 파일로 만들어서 전송하고 실행:

```powershell
# Windows PowerShell에서
cd C:\coding\share
.\deploy-simple.ps1
```

이 스크립트가 모든 파일을 EC2로 전송하고, SSH에서 실행할 명령어를 알려줍니다.

---

### 방법 2: SSH 터미널에서 올바른 붙여넣기 방법

**Ctrl+V 대신 사용:**

- **PuTTY**: 마우스 오른쪽 버튼 클릭
- **Windows Terminal**: `Ctrl+Shift+V`
- **대부분의 터미널**: `Shift+Insert`
- **일부 터미널**: 마우스 중간 버튼 클릭 (스크롤 휠 클릭)

---

### 방법 3: 스크립트를 한 줄씩 실행

긴 스크립트가 아니라면, 핵심 명령어만 직접 입력:

```bash
# 예시: 간단한 확인 명령어
ps aux | grep python
sudo ss -tlnp | grep -E "8080|8000"
ls -la ~/
```

---

## 추천 워크플로우

1. **Windows PowerShell에서 파일 전송:**
   ```powershell
   cd C:\coding\share
   .\deploy-simple.ps1
   ```

2. **SSH 터미널에서 실행:**
   ```bash
   cd /tmp
   chmod +x deploy-on-server.sh
   sudo ./deploy-on-server.sh
   ```

이 방법이 가장 확실하고 편리합니다!

