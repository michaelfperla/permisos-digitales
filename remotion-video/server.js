const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Serve static files
app.use(express.static(__dirname));

// Main route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'player.html'));
});

// Render video endpoint
app.get('/render-video', (req, res) => {
    console.log('Starting video render...');
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync('out')) {
        fs.mkdirSync('out');
    }
    
    exec('npx remotion render PromoVideo out/promo.mp4 --overwrite', (error, stdout, stderr) => {
        if (error) {
            console.error('Render error:', error);
            res.json({ success: false, error: error.message });
            return;
        }
        
        console.log('Render complete!');
        res.json({ 
            success: true, 
            videoPath: '/out/promo.mp4'
        });
    });
});

// Serve rendered videos
app.use('/out', express.static(path.join(__dirname, 'out')));

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════════════════╗
║                                                    ║
║  🎬 Remotion Video Server Running!                 ║
║                                                    ║
║  Open in your browser:                             ║
║  http://localhost:${PORT}                              ║
║                                                    ║
║  Features:                                         ║
║  - Canvas preview of all 5 scenes                  ║
║  - Play/Pause/Restart controls                     ║
║  - Render to MP4 button                           ║
║                                                    ║
╚════════════════════════════════════════════════════╝
    `);
});