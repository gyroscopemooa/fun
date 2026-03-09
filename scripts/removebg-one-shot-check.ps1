param(
  [string]$ApiBase = "http://127.0.0.1:8787"
)

$ErrorActionPreference = "Stop"

Write-Host "[1/4] Checking API health..." -ForegroundColor Cyan
$health = Invoke-RestMethod -Uri "$ApiBase/health" -TimeoutSec 5
if (-not $health.ok) {
  throw "API health check failed."
}

Write-Host "[2/4] Checking provider configuration..." -ForegroundColor Cyan
$config = Invoke-RestMethod -Uri "$ApiBase/config" -TimeoutSec 5
Write-Host ("configured provider : " + $config.configuredImageProvider)
Write-Host ("resolved provider   : " + $config.imageProvider)
Write-Host ("remove.bg key ready : " + $config.readiness.removeBgReady)

if ($config.configuredImageProvider -ne "remove_bg") {
  throw "IMAGE_PROVIDER is not set to remove_bg."
}
if (-not $config.readiness.removeBgReady) {
  throw "REMOVE_BG_API_KEY is missing."
}

Write-Host "[3/4] Final reminder before real call..." -ForegroundColor Yellow
Write-Host "This run will consume remove.bg credits."
Write-Host "Run the final generation test manually once from ai-id-photo page."

Write-Host "[4/4] Ready" -ForegroundColor Green
Write-Host "Open /ai-id-photo, upload 1 image, click generate once."
