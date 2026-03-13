@echo off
chcp 65001 >nul
echo ========================================
echo   Start Frontend Only
echo ========================================
echo.

echo [Frontend] Starting frontend server...
start "SafeSleep-Frontend" cmd /k "cd admin && npm run dev"
timeout /t 2 /nobreak >nul

echo.
echo Frontend Admin: http://localhost:8080
echo.
pause
