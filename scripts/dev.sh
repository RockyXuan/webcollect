#!/bin/bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-${ROOT_DIR}}"
PORT="${PORT:-5000}"

cd "${COZE_WORKSPACE_PATH}"

echo "Starting HTTP service on port ${PORT} for dev..."
export PORT
exec corepack pnpm@9.0.0 exec tsx watch src/server.ts
