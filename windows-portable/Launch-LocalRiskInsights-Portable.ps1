param(
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$bundleRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $bundleRoot ".portable-runtime"
$payloadRoot = Join-Path $bundleRoot "payload"
$pythonRoot = Join-Path $runtimeRoot "python"
$pythonExe = Join-Path $pythonRoot "python.exe"
$pipZipapp = Join-Path $payloadRoot "pip.pyz"
$pythonZip = Join-Path $payloadRoot "python-3.11.9-embed-amd64.zip"
$ffmpegZip = Join-Path $payloadRoot "ffmpeg-release-essentials.zip"
$sitePackages = Join-Path $pythonRoot "Lib\site-packages"
$ffmpegRoot = Join-Path $runtimeRoot "ffmpeg"
$ffmpegExe = Join-Path $ffmpegRoot "bin\ffmpeg.exe"
$requirementsFile = Join-Path $bundleRoot "requirements-windows.txt"
$depsMarker = Join-Path $runtimeRoot "deps.sha256"
$logsDir = Join-Path $runtimeRoot "logs"
$stdoutLog = Join-Path $logsDir "app.stdout.log"
$stderrLog = Join-Path $logsDir "app.stderr.log"
$pidFile = Join-Path $runtimeRoot "app.pid"
$envFile = Join-Path $bundleRoot ".env"
$healthUrl = "http://127.0.0.1:8000/api/health"

function Write-Section($message) {
    Write-Host ""
    Write-Host "== $message ==" -ForegroundColor Cyan
}

function Fail-And-Exit($message) {
    Write-Host ""
    Write-Host $message -ForegroundColor Red
    if (Test-Path $stderrLog) {
        Write-Host ""
        Write-Host "Recent error log:" -ForegroundColor Yellow
        Get-Content $stderrLog -Tail 40 | ForEach-Object { Write-Host $_ }
    }
    Write-Host ""
    Read-Host "Press Enter to close"
    exit 1
}

function Ensure-File($path, $message) {
    if (-not (Test-Path $path)) {
        Fail-And-Exit $message
    }
}

function Ensure-Directory($path) {
    New-Item -ItemType Directory -Force -Path $path | Out-Null
}

function Ensure-EnvFile {
    $example = Join-Path $bundleRoot ".env.example"
    if (-not (Test-Path $envFile)) {
        Copy-Item $example $envFile
    }

    $content = Get-Content $envFile -Raw
    if ($content -match "OPENROUTER_API_KEY\s*=\s*(.+)") {
        $value = $Matches[1].Trim()
        if ($value -and $value -ne '""') {
            return
        }
    }

    Write-Section "OpenRouter API key"
    $apiKey = Read-Host "Paste your OPENROUTER_API_KEY"
    if (-not $apiKey.Trim()) {
        Fail-And-Exit "An OpenRouter API key is required."
    }

    $lines = @()
    $replaced = $false
    foreach ($line in Get-Content $envFile) {
        if ($line -match "^\s*OPENROUTER_API_KEY\s*=") {
            $lines += "OPENROUTER_API_KEY=$apiKey"
            $replaced = $true
        }
        else {
            $lines += $line
        }
    }

    if (-not $replaced) {
        $lines += "OPENROUTER_API_KEY=$apiKey"
    }

    Set-Content -Path $envFile -Value $lines
}

function Get-RequirementsHash {
    return (Get-FileHash -Algorithm SHA256 -Path $requirementsFile).Hash
}

function Expand-PortableArchive($archivePath, $destinationPath) {
    $tempRoot = Join-Path $runtimeRoot "tmp-extract"
    if (Test-Path $tempRoot) {
        Remove-Item -Recurse -Force $tempRoot
    }
    Ensure-Directory $tempRoot
    Expand-Archive -Path $archivePath -DestinationPath $tempRoot -Force

    $children = Get-ChildItem -Path $tempRoot
    if ($children.Count -eq 1 -and $children[0].PSIsContainer) {
        Move-Item -Force -Path $children[0].FullName -Destination $destinationPath
    }
    else {
        Ensure-Directory $destinationPath
        Get-ChildItem -Path $tempRoot | ForEach-Object {
            Move-Item -Force -Path $_.FullName -Destination $destinationPath
        }
    }

    Remove-Item -Recurse -Force $tempRoot
}

function Enable-EmbeddedPythonSite {
    $pthFile = Join-Path $pythonRoot "python311._pth"
    Ensure-File $pthFile "The bundled Python runtime is incomplete."
    Ensure-Directory (Join-Path $pythonRoot "Lib")
    Ensure-Directory $sitePackages

    $entries = @(
        "python311.zip",
        ".",
        "Lib\site-packages",
        "import site"
    )
    Set-Content -Path $pthFile -Value $entries
}

function Ensure-PythonRuntime {
    Write-Section "Preparing portable Python"
    Ensure-File $pythonZip "Missing bundled Python payload."

    if (-not (Test-Path $pythonExe)) {
        Ensure-Directory $runtimeRoot
        Ensure-Directory $pythonRoot
        Expand-Archive -Path $pythonZip -DestinationPath $pythonRoot -Force
    }

    Enable-EmbeddedPythonSite
}

function Ensure-Ffmpeg {
    Write-Section "Preparing FFmpeg"
    Ensure-File $ffmpegZip "Missing bundled FFmpeg payload."

    if (-not (Test-Path $ffmpegExe)) {
        if (Test-Path $ffmpegRoot) {
            Remove-Item -Recurse -Force $ffmpegRoot
        }
        Expand-PortableArchive $ffmpegZip $ffmpegRoot
    }

    Ensure-File $ffmpegExe "FFmpeg extraction failed."
}

function Install-Dependencies {
    Write-Section "Preparing Python packages"
    Ensure-File $pipZipapp "Missing bundled pip payload."
    Ensure-File $requirementsFile "Missing bundled requirements file."
    Ensure-Directory $logsDir

    $currentHash = Get-RequirementsHash
    if ((Test-Path $depsMarker) -and ((Get-Content $depsMarker -Raw).Trim() -eq $currentHash)) {
        return
    }

    if (Test-Path $sitePackages) {
        Get-ChildItem -Force -Path $sitePackages | Remove-Item -Recurse -Force
    }
    else {
        Ensure-Directory $sitePackages
    }

    & $pythonExe $pipZipapp install `
        --no-index `
        --find-links $payloadRoot\wheelhouse `
        --only-binary=:all: `
        --target $sitePackages `
        -r $requirementsFile

    if ($LASTEXITCODE -ne 0) {
        Fail-And-Exit "Python dependency installation failed."
    }

    Set-Content -Path $depsMarker -Value $currentHash
}

function Test-AppHealthy {
    try {
        $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 2
        return $response.StatusCode -eq 200
    }
    catch {
        return $false
    }
}

function Get-RunningProcess {
    if (-not (Test-Path $pidFile)) {
        return $null
    }

    $pidValue = (Get-Content $pidFile -Raw).Trim()
    if (-not $pidValue) {
        return $null
    }

    try {
        return Get-Process -Id ([int]$pidValue) -ErrorAction Stop
    }
    catch {
        Remove-Item -Force $pidFile -ErrorAction SilentlyContinue
        return $null
    }
}

function Start-App {
    Write-Section "Starting LocalRiskInsights"
    Ensure-Directory $logsDir

    $existing = Get-RunningProcess
    if ($existing -and (Test-AppHealthy)) {
        Write-Host "LocalRiskInsights is already running." -ForegroundColor Green
        if (-not $NoBrowser) {
            Start-Process $healthUrl.Replace("/api/health", "")
        }
        return
    }

    $env:PYTHONPATH = $bundleRoot
    $env:PATH = "$($ffmpegRoot)\bin;$($pythonRoot);$env:PATH"
    $env:HF_HOME = Join-Path $runtimeRoot "hf-home"
    $env:XDG_CACHE_HOME = Join-Path $runtimeRoot "cache"
    $env:PYTHONUTF8 = "1"

    $process = Start-Process `
        -FilePath $pythonExe `
        -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000") `
        -WorkingDirectory $bundleRoot `
        -RedirectStandardOutput $stdoutLog `
        -RedirectStandardError $stderrLog `
        -PassThru

    Set-Content -Path $pidFile -Value $process.Id

    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Seconds 1
        if (Test-AppHealthy) {
            Write-Host "LocalRiskInsights is ready at http://127.0.0.1:8000" -ForegroundColor Green
            if (-not $NoBrowser) {
                Start-Process "http://127.0.0.1:8000" | Out-Null
            }
            return
        }
    }

    Fail-And-Exit "The app did not become healthy in time."
}

Ensure-File $pythonZip "The portable package is missing the embedded Python payload."
Ensure-File $ffmpegZip "The portable package is missing the FFmpeg payload."
Ensure-File $pipZipapp "The portable package is missing the pip payload."
Ensure-EnvFile
Ensure-PythonRuntime
Ensure-Ffmpeg
Install-Dependencies
Start-App

Write-Host ""
Read-Host "Press Enter to close"

