@echo off
title FaceAI — Frontend
cd /d "%~dp0\frontend"

:: Install node_modules if missing
if not exist "node_modules" (
    echo Installing frontend dependencies...
    npm install
    if errorlevel 1 (
        echo ERROR: npm install failed. Make sure Node.js is installed.
        pause
        exit /b 1
    )
)

echo Starting FaceAI Frontend on http://localhost:3000 ...
echo.
npm run dev
pause
