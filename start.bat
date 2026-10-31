@echo off
echo ========================================================
echo   Starting RailReplan Localhost Environment
echo ========================================================
echo.

echo [1/2] Launching FastAPI Backend on http://localhost:8000 ...
start "RailReplan Backend Server" cmd /k "python -m uvicorn railreplan.api.server:app --app-dir backend --port 8000 --reload"

echo [2/2] Launching Vite Frontend on http://localhost:5173 ...
cd frontend2\frontend2
start "RailReplan Frontend Dashboard" cmd /k "npm run dev"

echo.
echo ========================================================
echo   Services are starting up!
echo   - Backend API: http://localhost:8000/docs
echo   - Frontend UI: http://localhost:5173
echo ========================================================
timeout /t 3 >nul
start http://localhost:5173
