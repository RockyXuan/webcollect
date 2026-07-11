#!/bin/bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-${ROOT_DIR}}"

cd "${COZE_WORKSPACE_PATH}"

echo "Building the Next.js project..."
corepack pnpm@9.0.0 exec next build

echo "Bundling server with tsup..."
corepack pnpm@9.0.0 exec tsup src/server.ts --format cjs --platform node --target node20 --outDir dist --no-splitting --no-minify

echo "Build completed successfully!"
