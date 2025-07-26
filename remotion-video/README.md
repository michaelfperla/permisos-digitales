# Permisos Digitales - Promo Video with Remotion

This is a complete Remotion implementation of the 60-second promotional video for Permisos Digitales.

## 🎬 Video Structure

The video consists of 5 scenes:

1. **The Problem** (0-8s): Government office frustration
2. **Discovery** (8-13s): Finding the solution online
3. **Demo** (13-33s): 3-step process demonstration
4. **Success** (33-43s): Payment confirmation and permit generation
5. **Call to Action** (43-60s): Brand message and conversion

## 🚀 Quick Start

### Installation

```bash
cd remotion-video
npm install
```

### Development

Start the Remotion Studio to preview and edit:

```bash
npm start
```

This will open the Remotion Studio at `http://localhost:3000` where you can:
- Preview all scenes
- Adjust timing
- Test animations
- Export frames

### Rendering

#### Full Video (MP4)
```bash
npm run render
# or with custom settings
npx remotion render PromoVideo out/promo.mp4 --codec=h264 --crf=18
```

#### GIF Version
```bash
npm run render-gif
```

#### Thumbnail/Still Frame
```bash
npm run render-still
# or specific frame
npx remotion still PromoVideo out/frame.png --frame=900
```

## 📁 Project Structure

```
remotion-video/
├── src/
│   ├── index.tsx           # Entry point
│   ├── Root.tsx            # Composition registry
│   ├── compositions/       # Video scenes
│   │   ├── PromoVideo.tsx  # Main composition
│   │   ├── Scene1Problem.tsx
│   │   ├── Scene2Discovery.tsx
│   │   ├── Scene3Demo.tsx
│   │   ├── Scene4Success.tsx
│   │   └── Scene5CTA.tsx
│   └── config/
│       └── theme.ts        # Colors and styling
├── package.json
├── remotion.config.ts      # Remotion configuration
└── tsconfig.json
```

## 🎨 Customization

### Changing Duration

Edit scene durations in `src/Root.tsx`:

```typescript
const SCENE_DURATIONS = {
  scene1: 8 * FPS,    // 8 seconds
  scene2: 5 * FPS,    // 5 seconds
  scene3: 20 * FPS,   // 20 seconds
  scene4: 10 * FPS,   // 10 seconds
  scene5: 17 * FPS,   // 17 seconds
};
```

### Changing Colors

Edit the theme in `src/config/theme.ts`:

```typescript
export const theme = {
  colors: {
    primary: '#B5384D',     // Main brand color
    secondary: '#FFD700',   // Accent color
    // ...
  }
};
```

### Adding Music

1. Add your audio file to `public/` directory
2. Import in `PromoVideo.tsx`:

```typescript
import { Audio, staticFile } from 'remotion';

// In component:
<Audio src={staticFile('background-music.mp3')} volume={0.3} />
```

## 🎯 Render Settings

### High Quality (for production)
```bash
npx remotion render PromoVideo out/promo-hq.mp4 \
  --codec=h264 \
  --crf=16 \
  --pixel-format=yuv420p \
  --preset=slow
```

### Web Optimized
```bash
npx remotion render PromoVideo out/promo-web.mp4 \
  --codec=h264 \
  --crf=23 \
  --scale=1280:720
```

### Social Media Formats

#### Instagram Square (1:1)
```bash
npx remotion render PromoVideo out/promo-instagram.mp4 \
  --codec=h264 \
  --scale=1080:1080
```

#### TikTok/Reels (9:16)
```bash
npx remotion render PromoVideo out/promo-vertical.mp4 \
  --codec=h264 \
  --scale=1080:1920
```

## 🛠 Troubleshooting

### "Cannot find module" errors
```bash
rm -rf node_modules package-lock.json
npm install
```

### Rendering issues on Windows
Use software rendering:
```bash
npx remotion render PromoVideo out/video.mp4 --gl=angle
```

### Memory issues
Reduce concurrency:
```bash
npx remotion render PromoVideo out/video.mp4 --concurrency=1
```

## 📝 Advanced Features

### Adding Subtitles
Create a subtitle track in `Scene1Problem.tsx`:

```typescript
<Sequence from={fps * 2} durationInFrames={fps * 2}>
  <div style={{
    position: 'absolute',
    bottom: 100,
    width: '100%',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    color: 'white',
    padding: 20,
  }}>
    4 hours wasted every month
  </div>
</Sequence>
```

### Lottie Animations
```bash
npm install @remotion/lottie
```

Then import Lottie animations for more complex effects.

### 3D Effects
```bash
npm install @remotion/three
```

Add Three.js 3D animations to any scene.

## 🚀 Production Checklist

- [ ] Test all scenes in Remotion Studio
- [ ] Verify timing matches script (60 seconds total)
- [ ] Check text is readable on mobile
- [ ] Export at multiple resolutions
- [ ] Add captions for accessibility
- [ ] Compress for web delivery
- [ ] Create thumbnail from best frame

## 📄 License

This video is property of Permisos Digitales. All rights reserved.