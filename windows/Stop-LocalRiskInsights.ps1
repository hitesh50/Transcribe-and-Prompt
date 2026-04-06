$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "Stopping LocalRiskInsights..." -ForegroundColor Cyan
Push-Location $repoRoot
try {
    docker compose down
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "LocalRiskInsights has stopped." -ForegroundColor Green
Read-Host "Press Enter to close"

