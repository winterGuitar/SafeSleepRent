@echo off
chcp 65001 >nul
color 0a

:menu
cls
echo.
echo ========================================
echo        SafeSleep Menu
echo ========================================
echo.
echo   [1] Start All Services
echo   [2] Start Backend Only
echo   [3] Start Frontend Only
echo   [4] Install Dependencies
echo   [5] Stop All Services
echo.
echo   [0] Exit
echo.
echo ========================================
echo.
set /p choice=Select option (0-5):

if "%choice%"=="1" call start.bat
if "%choice%"=="2" call start-backend.bat
if "%choice%"=="3" call start-frontend.bat
if "%choice%"=="4" call install.bat
if "%choice%"=="5" call stop.bat
if "%choice%"=="0" exit

goto menu
