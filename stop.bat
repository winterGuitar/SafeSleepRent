@echo off
echo ========================================
echo   Stop All Services (Graceful Shutdown)
echo ========================================
echo.

:: Request backend graceful shutdown
echo [Backend] Requesting graceful shutdown...
curl -s -X POST http://localhost:3000/api/shutdown -H "Content-Type: application/json" >nul 2>nul

:: Wait 5 seconds for backend to save data and close connections
echo [Backend] Waiting for graceful shutdown...
timeout /t 5 /nobreak >nul

:: Force kill backend if still running
echo [Backend] Checking backend status...
tasklist | findstr /i "node.exe" >nul 2>nul
if %errorlevel% == 0 (
    echo [Backend] Force stopping backend server...
    taskkill /fi "windowtitle eq SafeSleep-Backend*" /f >nul 2>nul
    timeout /t 1 /nobreak >nul
) else (
    echo [Backend] Backend already stopped
)

:: Stop frontend
echo [Frontend] Stopping frontend server...
taskkill /fi "windowtitle eq SafeSleep-Frontend*" /f >nul 2>nul

echo.
echo ========================================
echo   Done: All services stopped
echo ========================================
echo.
pause
