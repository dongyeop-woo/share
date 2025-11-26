#!/bin/bash
# 프로젝트에서 사용하지 않는 패키지만 안전하게 삭제

set -e

echo "=== 프로젝트 미사용 패키지 삭제 ==="
echo ""
echo "주의: 시스템 패키지는 삭제하지 않습니다."
echo ""

# 프로젝트에 필요한 패키지 (이건 절대 삭제하면 안 됨)
REQUIRED=(
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

# 시스템 필수 패키지 (절대 삭제하면 안 됨)
SYSTEM_ESSENTIAL=(
    "pip"
    "setuptools"
    "wheel"
    "certbot"
    "cloud-init"
    "python-apt"
    "python-debian"
)

# 현재 설치된 모든 패키지 목록 가져오기
echo "[1/3] 현재 디스크 사용량:"
df -h / | tail -1
echo ""

echo "[2/3] 삭제 가능한 패키지 확인 중..."
DELETABLE=()

# pip3 list에서 패키지 목록 가져오기
pip3 list --format=freeze | while IFS='==' read -r pkg version; do
    pkg_lower=$(echo "$pkg" | tr '[:upper:]' '[:lower:]' | tr '_' '-')
    
    is_required=false
    is_system=false
    
    # 필수 패키지인지 확인
    for req in "${REQUIRED[@]}"; do
        if [[ "$pkg_lower" == "$req" ]] || [[ "$pkg_lower" == *"$req"* ]]; then
            is_required=true
            break
        fi
    done
    
    # 시스템 패키지인지 확인
    for sys in "${SYSTEM_ESSENTIAL[@]}"; do
        if [[ "$pkg_lower" == *"$sys"* ]]; then
            is_system=true
            break
        fi
    done
    
    # 시스템 관련 패키지들도 제외
    if [[ "$pkg_lower" == *"certbot"* ]] || \
       [[ "$pkg_lower" == *"cloud-init"* ]] || \
       [[ "$pkg_lower" == *"ubuntu"* ]] || \
       [[ "$pkg_lower" == *"apt"* ]] || \
       [[ "$pkg_lower" == *"systemd"* ]] || \
       [[ "$pkg_lower" == *"debian"* ]] || \
       [[ "$pkg_lower" == *"launchpad"* ]] || \
       [[ "$pkg_lower" == *"command-not-found"* ]] || \
       [[ "$pkg_lower" == *"hibinit"* ]] || \
       [[ "$pkg_lower" == *"ec2"* ]]; then
        is_system=true
    fi
    
    if [ "$is_required" = false ] && [ "$is_system" = false ]; then
        echo "  $pkg - 삭제 가능 (프로젝트/시스템 필수 아님)"
        DELETABLE+=("$pkg")
    fi
done

echo ""
echo "[3/3] 결론:"
echo "현재 설치된 패키지들은 대부분 Ubuntu 시스템 패키지입니다."
echo "이들은 삭제하면 시스템이 제대로 작동하지 않을 수 있습니다."
echo ""
echo "디스크 공간 확보를 위해 다른 방법을 사용하세요:"
echo "  - 로그 파일 정리: sudo journalctl --vacuum-time=1d"
echo "  - apt 캐시 정리: sudo apt-get clean"
echo "  - 사용하지 않는 apt 패키지: sudo apt-get autoremove -y"
echo ""
echo "프로젝트 패키지는 배포 시 requirements.txt로 설치됩니다."

