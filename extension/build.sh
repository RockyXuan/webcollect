#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Building WebCollect Chrome Extension..."

node "$PROJECT_ROOT/scripts/check-auth-contracts.mjs"

# Build with Vite
npx vite build --config "$SCRIPT_DIR/vite.config.ts"

# Copy extension files into dist
cp "$SCRIPT_DIR/manifest.json" "$SCRIPT_DIR/dist/"
cp "$SCRIPT_DIR/background.js" "$SCRIPT_DIR/dist/"

# Copy icons to dist/icons/ (manifest references icons/icon16.png etc.)
mkdir -p "$SCRIPT_DIR/dist/icons"
cp "$SCRIPT_DIR/public/icons/"*.png "$SCRIPT_DIR/dist/icons/"

# Copy packaged Zoom wallpaper assets so new tabs can open without remote image downloads.
mkdir -p "$SCRIPT_DIR/dist/assets/wallpapers"
cp "$PROJECT_ROOT/public/assets/wallpapers/"* "$SCRIPT_DIR/dist/assets/wallpapers/"

echo "Extension built successfully! Output: $SCRIPT_DIR/dist/"
echo "Load this folder in chrome://extensions to install."
