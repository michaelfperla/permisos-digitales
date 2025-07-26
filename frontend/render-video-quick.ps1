# PowerShell script for Permisos Digitales video rendering

Write-Host "`n====================================" -ForegroundColor Cyan
Write-Host " Permisos Digitales - Video Render" -ForegroundColor Cyan
Write-Host "====================================`n" -ForegroundColor Cyan

# Change to the frontend directory
Set-Location "C:\Users\micha\Desktop\Permisos_digitales\frontend"

Write-Host "Options:" -ForegroundColor Yellow
Write-Host "1. Open Remotion Studio (Preview)"
Write-Host "2. Render Simple Video (5 seconds, faster)"
Write-Host "3. Render Full Video (15 seconds, all animations)"
Write-Host "4. Exit`n"

$choice = Read-Host "Enter your choice (1-4)"

switch ($choice) {
    1 {
        Write-Host "`nOpening Remotion Studio..." -ForegroundColor Green
        npx remotion studio src/video/index.tsx
    }
    2 {
        Write-Host "`nRendering simple promo video..." -ForegroundColor Green
        npx remotion render src/video/index.tsx SimplePromo simple-promo.mp4
        Write-Host "`nVideo saved as: simple-promo.mp4" -ForegroundColor Green
    }
    3 {
        Write-Host "`nRendering full promo video (this may take a few minutes)..." -ForegroundColor Green
        npx remotion render src/video/index.tsx PromoVideo promo-video.mp4
        Write-Host "`nVideo saved as: promo-video.mp4" -ForegroundColor Green
    }
    4 {
        Write-Host "Exiting..." -ForegroundColor Yellow
        exit
    }
    default {
        Write-Host "Invalid choice. Please run the script again." -ForegroundColor Red
    }
}

Write-Host "`nPress any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")