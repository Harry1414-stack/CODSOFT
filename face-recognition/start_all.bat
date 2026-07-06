@echo off
title FaceAI — Full Stack Launcher
echo ============================================================
echo   FaceAI — Face Detection ^& Recognition
echo   Starting backend + frontend simultaneously
echo ============================================================
echo.

set "PROJECT_DIR=%~dp0"

:: Start backend in a new window
cd /d "%PROJECT_DIR%backend"
start "FaceAI Backend" cmd /k "python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

:: Give backend 3 seconds to boot
ping 127.0.0.1 -n 4 > nul

:: Start frontend in a new window
cd /d "%PROJECT_DIR%frontend"
start "FaceAI Frontend" cmd /k "npm run dev"

echo.
echo Both services are starting in separate windows.
echo.
echo   Backend  →  http://localhost:8000
echo   Frontend →  http://localhost:3000
echo.
echo Open http://localhost:3000 in your browser.
pause
