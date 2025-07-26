@echo off
echo.
echo ===================================
echo  Permisos Digitales - Video Render
echo ===================================
echo.

:: Change to the frontend directory
cd /d "C:\Users\micha\Desktop\Permisos_digitales\frontend"

echo Choose an option:
echo 1. Open Remotion Studio (Preview)
echo 2. Render Simple Video (5 seconds, faster)
echo 3. Render Full Video (15 seconds, all animations)
echo 4. Exit
echo.

set /p choice="Enter your choice (1-4): "

if %choice%==1 (
    echo Opening Remotion Studio...
    npx remotion studio src/video/index.tsx
) else if %choice%==2 (
    echo Rendering simple promo video...
    npx remotion render src/video/index.tsx SimplePromo simple-promo.mp4
    echo.
    echo Video saved as: simple-promo.mp4
) else if %choice%==3 (
    echo Rendering full promo video (this may take a few minutes)...
    npx remotion render src/video/index.tsx PromoVideo promo-video.mp4
    echo.
    echo Video saved as: promo-video.mp4
) else if %choice%==4 (
    echo Exiting...
    exit /b
) else (
    echo Invalid choice. Please run the script again.
)

echo.
pause