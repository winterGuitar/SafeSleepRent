@echo off
chcp 65001 >nul
echo ========================================
echo   Open Admin System
echo ========================================
echo.

:: Check if frontend is running
curl -s http://localhost:8080 >nul 2>nul
if %errorlevel% equ 0 (
    echo [Info] Opening admin system...
    start http://localhost:8080
) else (
    echo [Warning] Frontend not running
    echo.
    set /p choice=Start frontend now? (y/n):
    if /i "%choice%"=="y" (
        start "SafeSleep-Frontend" cmd /k "cd admin && npm run dev"
        timeout /t 3 /nobreak >nul
        start http://localhost:8080
    )
)

echo.
pause
