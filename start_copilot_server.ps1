# DS Bodycam AI Copilot Server Launcher
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " DS Bodycam AI Copilot - Python Server" -ForegroundColor Green
Write-Host " Running on http://127.0.0.1:8765" -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Cyan
python server.py
