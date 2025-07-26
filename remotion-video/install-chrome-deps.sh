#!/bin/bash

echo "Installing Chrome dependencies for WSL..."

# List of dependencies needed for Chrome/Chromium on WSL
DEPS=(
    libnss3
    libatk1.0-0
    libatk-bridge2.0-0
    libcups2
    libdrm2
    libxkbcommon0
    libxcomposite1
    libxdamage1
    libxrandr2
    libgbm1
    libgtk-3-0
    libasound2
    libxshmfence1
    libglu1-mesa
    libx11-xcb1
    libxcb-dri3-0
)

echo "These packages need to be installed:"
echo "${DEPS[@]}"
echo ""
echo "Run this command:"
echo "sudo apt-get update && sudo apt-get install -y ${DEPS[@]}"