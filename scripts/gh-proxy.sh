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

proxy_is_listening() {
  if [[ ! "${GITHUB_PROXY}" =~ ^http://([^:/]+):([0-9]+)$ ]]; then
    return 1
  fi

  local proxy_host="${BASH_REMATCH[1]}"
  local proxy_port="${BASH_REMATCH[2]}"

  command -v nc >/dev/null 2>&1 && nc -z "${proxy_host}" "${proxy_port}" >/dev/null 2>&1
}

if proxy_is_listening; then
  export HTTPS_PROXY="${HTTPS_PROXY:-${GITHUB_PROXY}}"
  export HTTP_PROXY="${HTTP_PROXY:-${GITHUB_PROXY}}"
  export NO_PROXY="${NO_PROXY:-localhost,127.0.0.1,::1}"
else
  unset HTTPS_PROXY HTTP_PROXY ALL_PROXY
fi

# Reuse the credential that already powers git push when gh's own keychain
# entry is stale. Keep it process-local and never print it.
if [[ -z "${GH_TOKEN:-}" && -z "${GITHUB_TOKEN:-}" ]]; then
  credential="$({
    printf 'protocol=https\n'
    printf 'host=github.com\n\n'
  } | GIT_TERMINAL_PROMPT=0 git credential fill 2>/dev/null || true)"
  token="$(printf '%s\n' "${credential}" | sed -n 's/^password=//p' | head -n 1)"
  if [[ -n "${token}" ]]; then
    export GH_TOKEN="${token}"
  fi
fi

exec "${GH_BIN}" "$@"
