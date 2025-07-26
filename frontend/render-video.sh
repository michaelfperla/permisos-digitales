#!/bin/bash

echo "🎬 Rendering Permisos Digitales Promo Video..."
echo ""
echo "This will create a 15-second promotional video showcasing:"
echo "- Animated logo and branding"
echo "- Key features and benefits"
echo "- 3-step process animation"
echo "- Pricing information"
echo "- Call-to-action"
echo ""

# Try to render with lower quality first for faster results
echo "Attempting fast render (lower quality for preview)..."
npx remotion render src/video/index.tsx PromoVideo promo-video-preview.mp4 \
  --jpeg-quality 80 \
  --scale 0.5 \
  --codec h264 \
  --crf 28 \
  --log=error

if [ $? -eq 0 ]; then
    echo "✅ Preview video created: promo-video-preview.mp4"
    echo ""
    echo "For full quality render, run:"
    echo "npx remotion render src/video/index.tsx PromoVideo promo-video-hd.mp4"
else
    echo "❌ Video rendering failed. Try opening the preview HTML file instead."
fi