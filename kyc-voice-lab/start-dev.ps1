# KYC Voice Lab - Local Development Startup Script
# Starts FastAPI backend on :8000 and Next.js frontend on :3000

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " Starting KYC Voice Lab (Local Prototype) " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. Check Python virtual environment
$backendDir = Join-Path $scriptDir "backend"
$venvPython = Join-Path $backendDir ".venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    Write-Host "Setting up Python virtual environment in $backendDir..." -ForegroundColor Yellow
    python -m venv (Join-Path $backendDir ".venv")
    & (Join-Path $backendDir ".venv\Scripts\pip.exe") install -r (Join-Path $backendDir "requirements.txt")
}

# 2. Check Node dependencies
$frontendDir = Join-Path $scriptDir "frontend"
$nodeModules = Join-Path $frontendDir "node_modules"

if (-not (Test-Path $nodeModules)) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    Push-Location $frontendDir
    npm install
    Pop-Location
}

# 3. Launch Backend in new window
Write-Host "Launching FastAPI backend on http://localhost:8000..." -ForegroundColor Green
$backendCmd = "Set-Location '$backendDir'; & .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $backendCmd

# 4. Launch Frontend in new window
Write-Host "Launching Next.js frontend on http://localhost:3000..." -ForegroundColor Green
$frontendCmd = "cd '$frontendDir'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd

Write-Host "`nAll services launched!" -ForegroundColor Cyan
Write-Host "Frontend:  http://localhost:3000" -ForegroundColor White
Write-Host "Backend:   http://localhost:8000" -ForegroundColor White
Write-Host "API Docs:  http://localhost:8000/docs" -ForegroundColor White
