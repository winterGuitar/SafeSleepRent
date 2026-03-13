@echo off
chcp 65001 >nul
echo ========================================
echo   Start All Services
echo ========================================
echo.

:: Start backend server
echo [Backend] Starting backend server...
start "SafeSleep-Backend" cmd /k "cd server && npm start"
timeout /t 3 /nobreak >nul

:: Start frontend server
echo [Frontend] Starting frontend server...
start "SafeSleep-Frontend" cmd /k "cd admin && npm run dev"
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo   Startup Complete!
echo ========================================
echo.
echo Backend Server: http://localhost:3000
echo Frontend Admin: http://localhost:8080
echo.
echo Press any key to close this window (services will continue running)
echo.
pause
