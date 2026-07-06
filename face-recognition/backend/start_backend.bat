@echo off
title FaceAI — Backend Server
cd /d "%~dp0"
echo Starting FaceAI Backend on http://localhost:8000 ...
echo Press Ctrl+C to stop.
echo.
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
