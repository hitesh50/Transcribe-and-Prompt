$ErrorActionPreference = "Stop"
$bundleRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $bundleRoot ".portable-runtime"
$pidFile = Join-Path $runtimeRoot "app.pid"

if (-not (Test-Path $pidFile)) {
    Write-Host "No running app PID file was found." -ForegroundColor Yellow
    Read-Host "Press Enter to close"
    exit 0
}

$pidValue = (Get-Content $pidFile -Raw).Trim()
if (-not $pidValue) {
    Remove-Item -Force $pidFile -ErrorAction SilentlyContinue
    Write-Host "No running app PID was recorded." -ForegroundColor Yellow
    Read-Host "Press Enter to close"
    exit 0
}

try {
    Stop-Process -Id ([int]$pidValue) -Force -ErrorAction Stop
    Remove-Item -Force $pidFile -ErrorAction SilentlyContinue
    Write-Host "LocalRiskInsights has stopped." -ForegroundColor Green
}
catch {
    Remove-Item -Force $pidFile -ErrorAction SilentlyContinue
    Write-Host "The saved process was no longer running." -ForegroundColor Yellow
}

Read-Host "Press Enter to close"

