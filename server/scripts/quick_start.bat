@echo off
REM Quick start script for Windows systems

echo 🔭 Telescope Control System - Quick Start
echo ========================================

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python 3 is required but not installed.
    pause
    exit /b 1
)

REM Create virtual environment if it doesn't exist
if not exist "venv" (
    echo 📦 Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
echo 🔌 Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo 📥 Installing dependencies...
pip install -r requirements.txt

REM Create .env file if it doesn't exist
if not exist ".env" (
    echo ⚙️ Creating environment configuration...
    copy .env.example .env
    echo ✅ Created .env file from template
    echo 📝 You may need to update ALPACA_BASE in .env for your simulator
)

echo.
echo 🚀 Setup complete! Next steps:
echo 1. Make sure SimScope (or other ASCOM Alpaca simulator) is running
echo 2. Run: docker compose up --build
echo 3. Test: python scripts/test_telescope_api.py
echo.
echo 🔍 To find your simulator port: python scripts/find_alpaca_port.py
pause
