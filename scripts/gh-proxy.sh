#!/bin/bash
set -Eeuo pipefail

GITHUB_PROXY="${GITHUB_PROXY:-http://127.0.0.1:7897}"
GH_BIN="${GH_BIN:-}"

if [[ -z "${GH_BIN}" ]]; then
  if [[ -x "/opt/homebrew/bin/gh" ]]; then
    GH_BIN="/opt/homebrew/bin/gh"
  else
    GH_BIN="$(command -v gh)"
  fi
fi

export HTTPS_PROXY="${HTTPS_PROXY:-${GITHUB_PROXY}}"
export HTTP_PROXY="${HTTP_PROXY:-${GITHUB_PROXY}}"
export NO_PROXY="${NO_PROXY:-localhost,127.0.0.1,::1}"

exec "${GH_BIN}" "$@"
