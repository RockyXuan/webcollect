#!/bin/bash
set -e

echo "Building WebCollect Chrome Extension..."

# Step 1: Vite build
cd "$(dirname "$0")/.."
npx vite build --config extension/vite.config.ts

# Step 2: Copy extension files into dist
cp extension/manifest.json extension/dist/
cp extension/background.js extension/dist/
cp -r extension/public extension/dist/

# Step 3: Fix paths in HTML (absolute → relative for chrome-extension://)
# The Vite build outputs paths like /assets/xxx which work with chrome-extension:// URLs
# No fix needed since Chrome extension pages resolve / to extension root

echo ""
echo "Build complete! Output in extension/dist/"
echo "To install: chrome://extensions → Developer mode → Load unpacked → select extension/dist/"
