# Spring Boot 빌드 및 배포 스크립트

param(
    [string]$InstanceIP = "54.253.167.33",
    [string]$KeyPath = "C:\coding\share-backend-key.pem",
    [string]$RemoteUser = "ubuntu"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Spring Boot 빌드 및 배포 ===" -ForegroundColor Green

$SpringBootDir = "C:\coding\tradenote-backend"
$JarFile = "share-0.0.1-SNAPSHOT.jar"

# 1. Spring Boot 디렉토리로 이동
Set-Location $SpringBootDir

Write-Host "`n[1/4] Spring Boot JAR 빌드 중..." -ForegroundColor Yellow

# 2. Gradle로 빌드
if (Test-Path ".\gradlew.bat") {
    Write-Host "Gradle Wrapper 사용하여 빌드..."
    .\gradlew.bat bootJar
} elseif (Test-Path "gradlew") {
    Write-Host "Gradle Wrapper 사용하여 빌드..."
    bash gradlew bootJar
} else {
    Write-Host "경고: gradlew를 찾을 수 없습니다. 이미 빌드된 JAR 파일을 확인합니다." -ForegroundColor Yellow
}

# 3. JAR 파일 확인
$JarPath = Join-Path "build\libs" $JarFile

if (-not (Test-Path $JarPath)) {
    Write-Host "오류: JAR 파일을 찾을 수 없습니다: $JarPath" -ForegroundColor Red
    Write-Host "먼저 빌드를 완료하세요: cd $SpringBootDir && .\gradlew.bat bootJar" -ForegroundColor Yellow
    exit 1
}

Write-Host "JAR 파일 찾음: $JarPath" -ForegroundColor Green

# 4. application.yml 확인
Write-Host "`n[2/4] 설정 파일 확인 중..." -ForegroundColor Yellow
$AppYml = "src\main\resources\application.yml"
if (Test-Path $AppYml) {
    Write-Host "application.yml 찾음" -ForegroundColor Green
} else {
    Write-Host "경고: application.yml을 찾을 수 없습니다." -ForegroundColor Yellow
}

# 5. EC2로 전송
Write-Host "`n[3/4] EC2로 파일 전송 중..." -ForegroundColor Yellow

# JAR 파일 전송
Write-Host "  JAR 파일 전송 중..."
scp -i $KeyPath -o StrictHostKeyChecking=no $JarPath "${RemoteUser}@${InstanceIP}:~/$JarFile"

# application.yml 전송
if (Test-Path $AppYml) {
    Write-Host "  application.yml 전송 중..."
    scp -i $KeyPath -o StrictHostKeyChecking=no $AppYml "${RemoteUser}@${InstanceIP}:~/application.yml"
}

# 배포 스크립트 확인
$DeployScript = Join-Path "C:\coding\share" "deploy-springboot.sh"
if (Test-Path $DeployScript) {
    Write-Host "  배포 스크립트는 이미 전송되어 있습니다." -ForegroundColor Gray
} else {
    Write-Host "  배포 스크립트 전송 중..."
    scp -i $KeyPath -o StrictHostKeyChecking=no $DeployScript "${RemoteUser}@${InstanceIP}:~/deploy-springboot.sh"
}

Write-Host "`n[4/4] 전송 완료!" -ForegroundColor Green

Write-Host "`n다음 명령을 SSH 터미널에서 실행하세요:" -ForegroundColor Cyan
Write-Host "  cd ~" -ForegroundColor White
Write-Host "  chmod +x deploy-springboot.sh" -ForegroundColor White
Write-Host "  sudo ./deploy-springboot.sh" -ForegroundColor White

