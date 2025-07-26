@echo off
echo 🎬 Setting up Remotion Video Project for Permisos Digitales
echo ==========================================================

REM Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

echo ✅ Node.js version:
node --version

REM Check if npm is installed
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

echo ✅ npm version:
npm --version

REM Install dependencies
echo.
echo 📦 Installing dependencies...
npm install

REM Create public directory for assets
if not exist "public" mkdir public

echo.
echo ✅ Setup complete!
echo.
echo 🚀 Next steps:
echo 1. Run 'npm start' to open Remotion Studio
echo 2. Preview your video in the browser
echo 3. Run 'npm run render' to export the video
echo.
echo 📺 Available commands:
echo - npm start          : Open Remotion Studio
echo - npm run render     : Render video as MP4
echo - npm run render-gif : Render video as GIF
echo - npm run render-still : Export thumbnail
echo.
pause