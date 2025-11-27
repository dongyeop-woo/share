# EC2 배포 스크립트 (Windows PowerShell)
param(
    [string]$InstanceIP = "54.253.167.33",
    [string]$KeyPath = "C:\coding\share-backend-key.pem",
    [string]$RemoteUser = "ubuntu",
    [string]$RemoteDir = "/opt/share-deploy"
)

$ErrorActionPreference = "Stop"

Write-Host "=== EC2 배포 시작 ===" -ForegroundColor Green

# 1. 현재 디렉토리 확인
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

Write-Host "`n[1/6] 프로젝트 파일 준비 중..." -ForegroundColor Yellow

# 2. 배포용 임시 디렉토리 생성
$TempDir = Join-Path $env:TEMP "share-deploy-$(Get-Date -Format 'yyyyMMddHHmmss')"
New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

Write-Host "임시 디렉토리: $TempDir"

# 3. 필요한 파일들 복사 (테스트 파일 제외)
$FilesToInclude = @(
    "*.html",
    "server.py",
    "run_backend.py"
)

$DirectoriesToInclude = @(
    "assets",
    "backend"
)

foreach ($pattern in $FilesToInclude) {
    Copy-Item -Path $pattern -Destination $TempDir -Recurse -ErrorAction SilentlyContinue
}

foreach ($dir in $DirectoriesToInclude) {
    # backend 디렉토리: 특정 파일만 복사
    if ($dir -eq "backend") {
        $destDir = Join-Path $TempDir $dir
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        
        $BackendFiles = @(
            "app.py",
            "requirements.txt",
            "requirements-minimal.txt"
        )
        
        foreach ($file in $BackendFiles) {
            $src = Join-Path $dir $file
            if (Test-Path $src) {
                Copy-Item -Path $src -Destination $destDir
            }
        }
        
        # services 디렉토리
        if (Test-Path "backend\services") {
            $servicesDest = Join-Path $destDir "services"
            New-Item -ItemType Directory -Path $servicesDest -Force | Out-Null
            Copy-Item -Path "backend\services\*.py" -Destination $servicesDest -Exclude "__pycache__"
        }
        
        # tests 디렉토리 (테스트 파일 포함)
        if (Test-Path "backend\tests") {
            $testsDest = Join-Path $destDir "tests"
            New-Item -ItemType Directory -Path $testsDest -Force | Out-Null
            Copy-Item -Path "backend\tests\*.py" -Destination $testsDest -Exclude "__pycache__"
            # README 파일도 복사
            if (Test-Path "backend\tests\*.md") {
                Copy-Item -Path "backend\tests\*.md" -Destination $testsDest
            }
        }
    } else {
        # assets 디렉토리: 전체 복사 (이미 존재하면 덮어쓰기)
        if (Test-Path $dir) {
            Copy-Item -Path $dir -Destination $TempDir -Recurse -Exclude "__pycache__","*.pyc" -Force
        }
    }
}

# 4. .gitignore 파일 생성 (배포 시 제외할 파일)
$GitIgnoreContent = @"
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
*.so
*.egg
*.egg-info/
dist/
build/
.env
*.log
debug_*.py
inspect_*.py
docs/
*.md
!README.md
"@

$GitIgnoreContent | Out-File -FilePath (Join-Path $TempDir ".deployignore") -Encoding UTF8

Write-Host "`n[2/6] 파일 압축 중..." -ForegroundColor Yellow

# 5. tar.gz 파일 생성
$ArchivePath = Join-Path $env:TEMP "share-deploy-$(Get-Date -Format 'yyyyMMddHHmmss').tar.gz"

# Windows에서 tar 사용
tar -czf $ArchivePath -C $TempDir .

Write-Host "압축 파일: $ArchivePath"

Write-Host "`n[3/6] EC2로 파일 전송 중..." -ForegroundColor Yellow

# 6. EC2로 전송 (홈 디렉토리 사용 - 권한 문제 해결)
$RemoteTempPath = "~/share-deploy.tar.gz"

try {
    scp -i $KeyPath -o StrictHostKeyChecking=no $ArchivePath "${RemoteUser}@${InstanceIP}:${RemoteTempPath}"
    Write-Host "전송 완료" -ForegroundColor Green
} catch {
    Write-Host "전송 실패: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n[4/6] 배포 스크립트 전송 중..." -ForegroundColor Yellow

# 7. 배포 스크립트 전송 (줄바꿈 변환: CRLF -> LF)
$DeployScript = Join-Path $ProjectRoot "deploy-on-server.sh"
if (Test-Path $DeployScript) {
    # 임시 파일 생성 (LF 줄바꿈)
    $TempScript = Join-Path $env:TEMP "deploy-on-server-lf.sh"
    $content = Get-Content $DeployScript -Raw
    $content = $content -replace "`r`n", "`n" -replace "`r", "`n"
    [System.IO.File]::WriteAllText($TempScript, $content, [System.Text.UTF8Encoding]::new($false))
    
    scp -i $KeyPath -o StrictHostKeyChecking=no $TempScript "${RemoteUser}@${InstanceIP}:~/deploy-on-server.sh"
    Remove-Item $TempScript -Force -ErrorAction SilentlyContinue
    Write-Host "전송 완료" -ForegroundColor Green
} else {
    Write-Host "경고: deploy-on-server.sh 파일을 찾을 수 없습니다. 수동으로 실행해야 합니다." -ForegroundColor Yellow
}

Write-Host "`n[5/6] EC2에서 배포 실행 중..." -ForegroundColor Yellow

# 8. EC2에서 배포 스크립트 실행 (홈 디렉토리 사용)
$DeployCommand = "cd ~ && chmod +x deploy-on-server.sh && sudo cp ~/share-deploy.tar.gz /tmp/share-deploy.tar.gz && sudo ~/deploy-on-server.sh"

try {
    ssh -i $KeyPath -o StrictHostKeyChecking=no "${RemoteUser}@${InstanceIP}" $DeployCommand
    Write-Host "배포 완료" -ForegroundColor Green
} catch {
    Write-Host "배포 실행 실패: $_" -ForegroundColor Red
    Write-Host "수동으로 SSH 접속하여 실행해주세요:" -ForegroundColor Yellow
    Write-Host "  ssh -i `"$KeyPath`" ${RemoteUser}@${InstanceIP}" -ForegroundColor Yellow
    Write-Host "  cd ~ && chmod +x deploy-on-server.sh && sudo cp ~/share-deploy.tar.gz /tmp/share-deploy.tar.gz && sudo ~/deploy-on-server.sh" -ForegroundColor Yellow
}

Write-Host "`n[6/6] 임시 파일 정리 중..." -ForegroundColor Yellow

# 9. 임시 파일 정리
Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path $ArchivePath -Force -ErrorAction SilentlyContinue

Write-Host "`n=== 배포 완료 ===" -ForegroundColor Green
Write-Host "서비스 확인:" -ForegroundColor Cyan
Write-Host "  Frontend: http://${InstanceIP}:8080" -ForegroundColor Cyan
Write-Host "  Backend API: http://${InstanceIP}:8000" -ForegroundColor Cyan

