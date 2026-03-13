@echo off
chcp 65001 >nul
echo ========================================
echo   Install Dependencies
echo ========================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [Error] Node.js not found
    pause
    exit /b 1
)

:: Install backend
echo [Backend] Installing dependencies...
cd server
call npm install
cd ..
echo [Done] Backend dependencies installed
echo.

:: Install frontend
echo [Frontend] Installing dependencies...
cd admin
call npm install
cd ..
echo [Done] Frontend dependencies installed
echo.

echo ========================================
echo   Installation Complete!
echo ========================================
echo.
pause
