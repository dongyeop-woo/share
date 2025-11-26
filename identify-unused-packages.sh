#!/bin/bash
# 프로젝트에서 사용하지 않는 패키지 확인

echo "=== 프로젝트 필요 패키지 vs 설치된 패키지 비교 ==="
echo ""

# 프로젝트에 필요한 패키지 목록
REQUIRED_PACKAGES=(
    "fastapi"
    "uvicorn"
    "transformers"
    "torch"
    "numpy"
    "pandas"
    "yfinance"
    "httpx"
    "feedparser"
    "ollama"
    "finance-datareader"
)

# 시스템 필수 패키지 (삭제하면 안 되는 것들)
SYSTEM_PACKAGES=(
    "pip"
    "setuptools"
    "wheel"
    "certbot"
    "certbot-nginx"
    "acme"
    "cloud-init"
    "python-apt"
    "python-debian"
    "ubuntu-pro-client"
    "unattended-upgrades"
    "command-not-found"
    "ec2-hibinit-agent"
    "hibagent"
)

echo "[1/3] 프로젝트에 필요한 패키지:"
for pkg in "${REQUIRED_PACKAGES[@]}"; do
    echo "  - $pkg"
done
echo ""

echo "[2/3] 현재 설치된 패키지 중 프로젝트 패키지 확인:"
INSTALLED_PROJECT_PACKAGES=()
for pkg in "${REQUIRED_PACKAGES[@]}"; do
    if pip3 show "$pkg" > /dev/null 2>&1; then
        echo "  ✓ $pkg (설치됨)"
        INSTALLED_PROJECT_PACKAGES+=("$pkg")
    else
        echo "  ✗ $pkg (설치 안 됨)"
    fi
done
echo ""

echo "[3/3] 설치된 패키지 전체 목록:"
pip3 list --format=freeze | while IFS='==' read -r pkg version; do
    pkg_name=$(echo "$pkg" | tr '[:upper:]' '[:lower:]')
    is_required=false
    is_system=false
    
    for req_pkg in "${REQUIRED_PACKAGES[@]}"; do
        if [[ "$pkg_name" == *"$req_pkg"* ]] || [[ "$req_pkg" == *"$pkg_name"* ]]; then
            is_required=true
            break
        fi
    done
    
    for sys_pkg in "${SYSTEM_PACKAGES[@]}"; do
        if [[ "$pkg_name" == *"$sys_pkg"* ]] || [[ "$sys_pkg" == *"$pkg_name"* ]]; then
            is_system=true
            break
        fi
    done
    
    if [ "$is_required" = false ] && [ "$is_system" = false ]; then
        echo "  ? $pkg ($version) - 확인 필요"
    fi
done

echo ""
echo "=== 결론 ==="
echo "현재 pip3 list에 표시된 패키지들은 대부분 Ubuntu 시스템 패키지입니다."
echo "이들은 삭제하면 시스템이 제대로 작동하지 않을 수 있습니다."
echo ""
echo "프로젝트 패키지가 아직 설치되지 않은 것 같습니다."
echo "배포 후 requirements.txt로 설치할 예정입니다."

