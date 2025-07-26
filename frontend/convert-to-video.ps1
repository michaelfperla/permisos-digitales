# PowerShell script to convert HTML demo to video using ffmpeg

Write-Host "Converting HTML Demo to Video" -ForegroundColor Cyan

# First, take screenshots using Puppeteer
$convertScript = @'
const puppeteer = require('puppeteer');
const fs = require('fs');

async function captureDemo() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Load the HTML file
    await page.goto(`file://${__dirname}/user-journey-video.html`);
    
    // Capture each scene
    const scenes = 5;
    for (let i = 0; i < scenes; i++) {
        await page.screenshot({ path: `scene-${i}.png` });
        await page.click('.control-btn:nth-child(3)'); // Next button
        await page.waitForTimeout(1000);
    }
    
    await browser.close();
    console.log('Screenshots captured!');
}

captureDemo();
'@

# Save the script
$convertScript | Out-File -FilePath "capture-demo.js" -Encoding UTF8

Write-Host @"

To convert to video:

1. Install required tools:
   npm install puppeteer
   
2. Capture screenshots:
   node capture-demo.js
   
3. Create video with ffmpeg:
   ffmpeg -framerate 1/3 -pattern_type glob -i 'scene-*.png' -c:v libx264 -r 30 -pix_fmt yuv420p demo-video.mp4

Or use Windows Photos app:
- Import the screenshots
- Create a video with music
- Export as MP4

"@ -ForegroundColor Green