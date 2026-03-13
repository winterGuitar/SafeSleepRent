@echo off
chcp 65001 >nul
echo ========================================
echo   Stop All Services
echo ========================================
echo.

:: Stop backend server
echo [Backend] Stopping backend server...
taskkill /fi "windowtitle eq SafeSleep-Backend*" /f >nul 2>nul

:: Stop frontend server
echo [Frontend] Stopping frontend server...
taskkill /fi "windowtitle eq SafeSleep-Frontend*" /f >nul 2>nul

echo.
echo [Done] All services stopped
echo.
pause
