const express = require('express');
const path = require('path');
const { execSync } = require('child_process');

const app = express();
const PORT = 3000;

console.log('Building Remotion project...');
try {
  execSync('npx remotion bundle', { stdio: 'inherit' });
  console.log('Build complete!');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}

// Serve static files
app.use(express.static(path.join(__dirname, 'build')));

// Serve the Remotion player
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Permisos Digitales - Promo Video</title>
      <style>
        body { margin: 0; padding: 0; background: #000; display: flex; align-items: center; justify-content: center; height: 100vh; }
        .container { text-align: center; }
        video { max-width: 100%; height: auto; }
        .controls { margin-top: 20px; }
        button { padding: 10px 20px; font-size: 16px; margin: 0 10px; cursor: pointer; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1 style="color: white;">Permisos Digitales - Promo Video</h1>
        <p style="color: white;">Click below to render and watch the video</p>
        <div class="controls">
          <button onclick="renderVideo()">Render Video</button>
        </div>
        <div id="status" style="color: white; margin-top: 20px;"></div>
      </div>
      <script>
        async function renderVideo() {
          document.getElementById('status').innerHTML = 'Rendering video... This may take a few minutes.';
          try {
            const response = await fetch('/render');
            const result = await response.json();
            if (result.success) {
              document.getElementById('status').innerHTML = '<video controls autoplay><source src="/video.mp4" type="video/mp4"></video>';
            } else {
              document.getElementById('status').innerHTML = 'Error: ' + result.error;
            }
          } catch (error) {
            document.getElementById('status').innerHTML = 'Error: ' + error.message;
          }
        }
      </script>
    </body>
    </html>
  `);
});

// Render endpoint
app.get('/render', async (req, res) => {
  try {
    console.log('Rendering video...');
    execSync('npx remotion render PromoVideo out/video.mp4 --overwrite', { stdio: 'inherit' });
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Serve the rendered video
app.use('/video.mp4', express.static(path.join(__dirname, 'out/video.mp4')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Server running at http://localhost:${PORT}`);
  console.log('Open this URL in your browser to view the video player');
});