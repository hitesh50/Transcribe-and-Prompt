@echo off
setlocal
set SCRIPT_DIR=%~dp0
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%Stop-LocalRiskInsights.ps1"
set EXIT_CODE=%ERRORLEVEL%
exit /b %EXIT_CODE%

