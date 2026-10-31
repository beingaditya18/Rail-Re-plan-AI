# PowerShell One-Click Launcher for RailReplan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Starting RailReplan Localhost Environment" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/2] Launching FastAPI Backend on http://localhost:8000 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "python -m uvicorn railreplan.api.server:app --app-dir backend --port 8000 --reload"

Write-Host "[2/2] Launching Vite Frontend on http://localhost:5173 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location 'frontend2/frontend2'; npm run dev"

Start-Sleep -Seconds 3
Write-Host ""
Write-Host "Opening http://localhost:5173 in default browser..." -ForegroundColor Green
Start-Process "http://localhost:5173"
