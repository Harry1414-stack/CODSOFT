@echo off
title VisionScript — Image Captioning AI
color 0A

echo.
echo  ==========================================
echo   VisionScript — AI Image Captioning
echo  ==========================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python is not installed or not in PATH.
    echo  Please install Python 3.10+ from https://python.org
    pause
    exit /b 1
)

:: Move to backend directory
cd /d "%~dp0backend"

:: Check if venv exists
if not exist "venv\" (
    echo  [SETUP] Creating virtual environment...
    python -m venv venv
    echo  [SETUP] Virtual environment created.
    echo.
)

:: Activate venv
call venv\Scripts\activate.bat

:: Install / upgrade dependencies
echo  [SETUP] Installing dependencies (this may take a while on first run)...
echo  [SETUP] Downloading: Flask, PyTorch, HuggingFace Transformers, BLIP model...
echo.
pip install -r requirements.txt --quiet

echo.
echo  [INFO]  Dependencies ready.
echo  [INFO]  Starting backend server on http://localhost:5000
echo  [INFO]  The BLIP model will download on first caption request (~1 GB).
echo.
echo  ==========================================
echo   Open frontend\index.html in your browser
echo  ==========================================
echo.

:: Start Flask
python app.py

pause
