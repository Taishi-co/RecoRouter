#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${OUT_DIR:-/tmp/recorouter-docker-release}"
OUT_TAR="${OUT_TAR:-/tmp/recorouter-docker-release.tar.gz}"
IMAGE_TAG="${IMAGE_TAG:-recorouter-api:release}"

cd "$ROOT_DIR"

pnpm validate
pnpm build:web

rm -rf "$OUT_DIR" "$OUT_TAR"
mkdir -p "$OUT_DIR"

cp -R dist-web "$OUT_DIR/dist-web"
cp -R deploy "$OUT_DIR/deploy"

if [[ "${BUILD_DOCKER_IMAGE:-0}" == "1" ]]; then
  docker build -t "$IMAGE_TAG" server-rust
  docker save "$IMAGE_TAG" -o "$OUT_DIR/recorouter-api-image.tar"
else
  cp -R server-rust "$OUT_DIR/server-rust"
  rm -rf "$OUT_DIR/server-rust/target"
fi

tar -C "$OUT_DIR" -czf "$OUT_TAR" .

echo "Created $OUT_TAR"
if [[ "${BUILD_DOCKER_IMAGE:-0}" == "1" ]]; then
  echo "Created Docker image artifact $IMAGE_TAG"
else
  echo "Build the Rust API image on the Linux server with deploy/install-docker-release.sh"
fi
