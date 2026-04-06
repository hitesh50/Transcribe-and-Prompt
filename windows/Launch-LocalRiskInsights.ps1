param(
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

function Write-Section($message) {
    Write-Host ""
    Write-Host "== $message ==" -ForegroundColor Cyan
}

function Fail-And-Exit($message) {
    Write-Host ""
    Write-Host $message -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to close"
    exit 1
}

function Ensure-Command($name, $installHint) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        Fail-And-Exit "$installHint"
    }
}

function Ensure-Docker-Running {
    Write-Section "Checking Docker Desktop"
    for ($i = 0; $i -lt 12; $i++) {
        docker info *> $null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Docker Desktop is ready." -ForegroundColor Green
            return
        }

        if ($i -eq 0) {
            Write-Host "Docker Desktop is not ready yet." -ForegroundColor Yellow
            Write-Host "If it is installed but closed, start Docker Desktop now."
        }

        Start-Sleep -Seconds 5
    }

    Fail-And-Exit "Docker Desktop did not become ready in time. Start it fully, then run Launch-LocalRiskInsights again."
}

function Ensure-EnvFile {
    $envPath = Join-Path $repoRoot ".env"
    $examplePath = Join-Path $repoRoot ".env.example"

    if (-not (Test-Path $envPath)) {
        Copy-Item $examplePath $envPath
        Write-Host "Created .env from .env.example" -ForegroundColor Green
    }

    $content = Get-Content $envPath -Raw
    if ($content -match "OPENROUTER_API_KEY\s*=\s*(.+)") {
        $value = $Matches[1].Trim()
        if ($value -and $value -ne '""') {
            return
        }
    }

    Write-Section "OpenRouter API key"
    $apiKey = Read-Host "Paste your OPENROUTER_API_KEY"
    if (-not $apiKey.Trim()) {
        Fail-And-Exit "An OpenRouter API key is required before launch."
    }

    $updated = @()
    $replaced = $false
    foreach ($line in Get-Content $envPath) {
        if ($line -match "^\s*OPENROUTER_API_KEY\s*=") {
            $updated += "OPENROUTER_API_KEY=$apiKey"
            $replaced = $true
        }
        else {
            $updated += $line
        }
    }

    if (-not $replaced) {
        $updated += "OPENROUTER_API_KEY=$apiKey"
    }

    Set-Content -Path $envPath -Value $updated
}

function Start-App {
    Write-Section "Starting LocalRiskInsights"
    Push-Location $repoRoot
    try {
        docker compose up --build
    }
    finally {
        Pop-Location
    }
}

Ensure-Command "docker" "Docker Desktop is required. Install it first from https://www.docker.com/products/docker-desktop/ and then re-run this launcher."
Ensure-Docker-Running
Ensure-EnvFile

if (-not $NoBrowser) {
    Start-Process "http://localhost:8000" | Out-Null
}

Start-App

