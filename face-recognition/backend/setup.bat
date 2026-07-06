@echo off
title Face Recognition — Backend Setup
echo ============================================================
echo   FaceAI — Installing Python Dependencies
echo   (No C++ required — uses DeepFace + TensorFlow)
echo ============================================================
echo.

cd /d "%~dp0"

echo Installing all dependencies...
pip install -r requirements.txt

if errorlevel 1 (
    echo.
    echo ERROR: Some packages failed to install.
    echo Make sure you have Python 3.8+ and internet access.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   Setup complete!  Run start_backend.bat to launch.
echo ============================================================
pause
