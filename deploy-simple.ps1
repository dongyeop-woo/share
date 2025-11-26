# 간단한 배포 스크립트 - 파일 전송만 수행
param(
    [string]$InstanceIP = "54.253.167.33",
    [string]$KeyPath = "C:\coding\share-backend-key.pem",
    [string]$RemoteUser = "ubuntu"
)

$ErrorActionPreference = "Stop"

Write-Host "=== 파일 전송 중 ===" -ForegroundColor Green

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

# 1. 배포 파일 압축
Write-Host "`n[1/3] 파일 압축 중..." -ForegroundColor Yellow

$TempDir = Join-Path $env:TEMP "share-deploy-$(Get-Date -Format 'yyyyMMddHHmmss')"
New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

# 필요한 파일 복사
Copy-Item -Path "*.html" -Destination $TempDir -ErrorAction SilentlyContinue
Copy-Item -Path "server.py" -Destination $TempDir -ErrorAction SilentlyContinue
Copy-Item -Path "run_backend.py" -Destination $TempDir -ErrorAction SilentlyContinue

# assets 디렉토리
if (Test-Path "assets") {
    Copy-Item -Path "assets" -Destination $TempDir -Recurse -Exclude "__pycache__","*.pyc"
}

# backend 디렉토리 (필요한 파일만)
$BackendDest = Join-Path $TempDir "backend"
New-Item -ItemType Directory -Path $BackendDest -Force | Out-Null
Copy-Item -Path "backend\app.py" -Destination $BackendDest -ErrorAction SilentlyContinue
Copy-Item -Path "backend\requirements.txt" -Destination $BackendDest -ErrorAction SilentlyContinue
Copy-Item -Path "backend\requirements-minimal.txt" -Destination $BackendDest -ErrorAction SilentlyContinue

if (Test-Path "backend\services") {
    $ServicesDest = Join-Path $BackendDest "services"
    New-Item -ItemType Directory -Path $ServicesDest -Force | Out-Null
    Copy-Item -Path "backend\services\*.py" -Destination $ServicesDest -Exclude "__pycache__"
}

# 압축
$ArchivePath = Join-Path $env:TEMP "share-deploy-$(Get-Date -Format 'yyyyMMddHHmmss').tar.gz"
tar -czf $ArchivePath -C $TempDir .

Write-Host "압축 완료: $ArchivePath" -ForegroundColor Green

# 2. EC2로 전송
Write-Host "`n[2/3] EC2로 파일 전송 중..." -ForegroundColor Yellow

# 홈 디렉토리로 전송 (권한 문제 회피)
$FilesToTransfer = @(
    @{Local="cleanup-and-deploy.sh"; Remote="~/cleanup-and-deploy.sh"},
    @{Local="remove-unused-packages.sh"; Remote="~/remove-unused-packages.sh"},
    @{Local=$ArchivePath; Remote="~/share-deploy.tar.gz"},
    @{Local="check-existing-service.sh"; Remote="~/check-existing-service.sh"}
)

foreach ($file in $FilesToTransfer) {
    if (Test-Path $file.Local) {
        Write-Host "  전송: $($file.Local) -> $($file.Remote)"
        scp -i $KeyPath -o StrictHostKeyChecking=no $file.Local "${RemoteUser}@${InstanceIP}:$($file.Remote)"
    } else {
        Write-Host "  경고: 파일 없음 - $($file.Local)" -ForegroundColor Yellow
    }
}

Write-Host "`n[3/3] 전송 완료!" -ForegroundColor Green
Write-Host "`n다음 명령을 SSH 터미널에서 실행하세요:" -ForegroundColor Cyan
Write-Host "  cd ~" -ForegroundColor White
Write-Host "  chmod +x cleanup-and-deploy.sh remove-unused-packages.sh" -ForegroundColor White
Write-Host "  sudo mv ~/share-deploy.tar.gz /tmp/share-deploy.tar.gz  # (필요시)" -ForegroundColor White
Write-Host "  sudo ./remove-unused-packages.sh     # 사용하지 않는 패키지 확인" -ForegroundColor White
Write-Host "  sudo ./cleanup-and-deploy.sh         # 정리 + 배포 실행" -ForegroundColor White

# 임시 파일 정리
Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "`n압축 파일은 보관됩니다: $ArchivePath" -ForegroundColor Gray

