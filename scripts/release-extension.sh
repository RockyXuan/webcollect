#!/bin/bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

REPO="${GITHUB_REPOSITORY:-RockyXuan/webcollect}"
TAG="${1:-}"
GITHUB_PROXY="${GITHUB_PROXY:-http://127.0.0.1:7897}"

github_proxy_is_listening() {
  if [[ ! "${GITHUB_PROXY}" =~ ^http://([^:/]+):([0-9]+)$ ]]; then
    return 1
  fi

  local proxy_host="${BASH_REMATCH[1]}"
  local proxy_port="${BASH_REMATCH[2]}"

  if ! command -v nc >/dev/null 2>&1; then
    return 1
  fi

  nc -z "${proxy_host}" "${proxy_port}" >/dev/null 2>&1
}

git_with_network() {
  if github_proxy_is_listening; then
    git -c "http.https://github.com.proxy=${GITHUB_PROXY}" "$@"
  else
    git "$@"
  fi
}

find_node() {
  if command -v node >/dev/null 2>&1; then
    command -v node
    return
  fi

  local candidate
  for candidate in \
    "/Users/rockyx/.nvm/versions/node/v20.20.2/bin/node" \
    "/opt/homebrew/bin/node"; do
    if [[ -x "${candidate}" ]]; then
      echo "${candidate}"
      return
    fi
  done

  echo "node was not found. Install Node.js before releasing." >&2
  exit 127
}

extension_zip_filename() {
  local tag="$1"
  if [[ "${tag}" =~ ^webcollect-([0-9]{4}-[0-9]{2}-[0-9]{2})-(.+)$ ]]; then
    echo "WebCollect-Chrome-Extension-${BASH_REMATCH[2]}-${BASH_REMATCH[1]}.zip"
    return
  fi

  if [[ "${tag}" =~ ^webcollect-([0-9]{4}-[0-9]{2}-[0-9]{2})$ ]]; then
    echo "WebCollect-Chrome-Extension-${BASH_REMATCH[1]}.zip"
    return
  fi

  echo "WebCollect-Chrome-Extension-${tag}.zip"
}

NODE_BIN="${NODE_BIN:-$(find_node)}"
export PATH="$(dirname "${NODE_BIN}"):${PATH}"

if [[ -z "${TAG}" ]]; then
  TAG="$(git tag --points-at HEAD | grep '^webcollect-' | sort | tail -n 1 || true)"
fi

if [[ -z "${TAG}" ]]; then
  TAG="webcollect-$(date +%F)-$(git rev-parse --short HEAD)"
fi

ZIP_NAME="$(extension_zip_filename "${TAG}")"
ZIP_PATH="${WEB_COLLECT_EXTENSION_ZIP:-/private/tmp/${ZIP_NAME}}"

echo "Using release tag: ${TAG}"
echo "Using GitHub repo: ${REPO}"
echo "Using extension zip: ${ZIP_PATH}"

if github_proxy_is_listening; then
  echo "Using GitHub proxy: ${GITHUB_PROXY}"
else
  echo "GitHub proxy ${GITHUB_PROXY} is not listening; falling back to direct GitHub access."
fi

"${NODE_BIN}" ./extension/build.mjs

rm -f "${ZIP_PATH}"
(cd extension/dist && zip -qr "${ZIP_PATH}" .)

if ! git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then
  git tag "${TAG}"
fi

git_with_network push origin main
git_with_network push origin "${TAG}"

if scripts/gh-proxy.sh release view "${TAG}" --repo "${REPO}" >/dev/null 2>&1; then
  scripts/gh-proxy.sh release upload "${TAG}" "${ZIP_PATH}" --repo "${REPO}" --clobber
else
  scripts/gh-proxy.sh release create "${TAG}" "${ZIP_PATH}" \
    --repo "${REPO}" \
    --title "${TAG}" \
    --notes "WebCollect Chrome extension build for ${TAG}."
fi

scripts/gh-proxy.sh release view "${TAG}" --repo "${REPO}" --json tagName,url,assets
