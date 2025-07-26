#!/bin/bash

echo "🎬 Setting up Remotion Video Project for Permisos Digitales"
echo "=========================================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm version: $(npm --version)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Create public directory for assets
mkdir -p public

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 Next steps:"
echo "1. Run 'npm start' to open Remotion Studio"
echo "2. Preview your video in the browser"
echo "3. Run 'npm run render' to export the video"
echo ""
echo "📺 Available commands:"
echo "- npm start          : Open Remotion Studio"
echo "- npm run render     : Render video as MP4"
echo "- npm run render-gif : Render video as GIF"
echo "- npm run render-still : Export thumbnail"
echo ""