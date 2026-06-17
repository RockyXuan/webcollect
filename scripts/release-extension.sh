#!/bin/bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

REPO="${GITHUB_REPOSITORY:-RockyXuan/webcollect}"
TAG="${1:-}"

if [[ -z "${TAG}" ]]; then
  TAG="$(git tag --points-at HEAD | grep '^webcollect-' | sort | tail -n 1 || true)"
fi

if [[ -z "${TAG}" ]]; then
  TAG="webcollect-$(date +%F)-$(git rev-parse --short HEAD)"
fi

ZIP_PATH="${WEB_COLLECT_EXTENSION_ZIP:-/private/tmp/WebCollect-Chrome-Extension-${TAG}.zip}"

echo "Using release tag: ${TAG}"
echo "Using GitHub repo: ${REPO}"
echo "Using extension zip: ${ZIP_PATH}"

corepack pnpm build:ext

rm -f "${ZIP_PATH}"
(cd public/extension-dist && zip -qr "${ZIP_PATH}" .)

if ! git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then
  git tag "${TAG}"
fi

git push origin main
git push origin "${TAG}"

if scripts/gh-proxy.sh release view "${TAG}" --repo "${REPO}" >/dev/null 2>&1; then
  scripts/gh-proxy.sh release upload "${TAG}" "${ZIP_PATH}" --repo "${REPO}" --clobber
else
  scripts/gh-proxy.sh release create "${TAG}" "${ZIP_PATH}" \
    --repo "${REPO}" \
    --title "${TAG}" \
    --notes "WebCollect Chrome extension build for ${TAG}."
fi

scripts/gh-proxy.sh release view "${TAG}" --repo "${REPO}" --json tagName,url,assets
