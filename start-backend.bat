@echo off
chcp 65001 >nul
echo ========================================
echo   Start Backend Only
echo ========================================
echo.

echo [Backend] Starting backend server...
start "SafeSleep-Backend" cmd /k "cd server && npm start"
timeout /t 2 /nobreak >nul

echo.
echo Backend Server: http://localhost:3000
echo.
pause
