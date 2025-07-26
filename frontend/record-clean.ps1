# Auto-record script
Write-Host "Opening demo in fullscreen..." -ForegroundColor Green

# Open in Chrome/Edge fullscreen
Start-Process "msedge.exe" -ArgumentList "--kiosk", "file:///C:/Users/micha/Desktop/Permisos_digitales/frontend/user-journey-video-clean.html"

Write-Host "`nPress F11 to exit fullscreen when done" -ForegroundColor Yellow
Write-Host "Use Win+Alt+R to start/stop recording" -ForegroundColor Cyan