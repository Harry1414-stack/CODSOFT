@echo off
title Tic-Tac-Toe AI Launcher
color 0A
echo.
echo  ==========================================
echo   TIC-TAC-TOE AI - Starting Servers...
echo  ==========================================
echo.

echo  [1/2] Starting Python AI Backend (port 5000)...
start "Python Flask Backend" cmd /k "cd /d "%~dp0" && python backend/app.py"

timeout /t 2 /nobreak >nul

echo  [2/2] Starting React Frontend (port 5173)...
start "React Frontend (Vite)" cmd /k "cd /d "%~dp0frontend" && npm.cmd run dev"

timeout /t 3 /nobreak >nul

echo.
echo  ==========================================
echo   Both servers are starting up!
echo   Open your browser to: http://localhost:5173
echo  ==========================================
echo.

start "" "http://localhost:5173"

echo  Press any key to close this launcher...
pause >nul
