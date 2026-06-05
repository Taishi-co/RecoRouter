#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${OUT_DIR:-/tmp/recorouter-docker-release}"
OUT_TAR="${OUT_TAR:-/tmp/recorouter-docker-release.tar.gz}"
IMAGE_TAG="${IMAGE_TAG:-recorouter-api:release}"
WEB_OUTPUT_ROOT="${WEB_OUTPUT_ROOT:-dist-web}"
VEHICLE_WEB_OUTPUT_ROOT="${VEHICLE_WEB_OUTPUT_ROOT:-dist-web-vehicle}"
MALL_WEB_OUTPUT_ROOT="${MALL_WEB_OUTPUT_ROOT:-dist-web-mall}"

cd "$ROOT_DIR"

pnpm validate

if [[ "${BUILD_WEB:-1}" == "1" ]]; then
  PROJECT_DOMAIN="${PROJECT_DOMAIN:-https://car.shcxyz.site}" pnpm build:web
  PROJECT_DOMAIN="${PROJECT_DOMAIN:-https://car.shcxyz.site}" pnpm build:web:vehicle
  PROJECT_DOMAIN="${PROJECT_DOMAIN:-https://car.shcxyz.site}" pnpm build:web:mall
fi

rm -rf "$OUT_DIR" "$OUT_TAR"
mkdir -p "$OUT_DIR"

cp -R deploy "$OUT_DIR/deploy"
mkdir -p "$OUT_DIR/mall-products"
cp -R src/assets/mall-products/. "$OUT_DIR/mall-products/"
if [[ "${BUILD_WEB:-1}" == "1" ]]; then
  test -d "$WEB_OUTPUT_ROOT"
  test -d "$VEHICLE_WEB_OUTPUT_ROOT"
  test -d "$MALL_WEB_OUTPUT_ROOT"
  cp -R "$WEB_OUTPUT_ROOT" "$OUT_DIR/dist-web"
  cp -R "$VEHICLE_WEB_OUTPUT_ROOT" "$OUT_DIR/dist-web-vehicle"
  cp -R "$MALL_WEB_OUTPUT_ROOT" "$OUT_DIR/dist-web-mall"
fi

if [[ "${BUILD_DOCKER_IMAGE:-0}" == "1" ]]; then
  docker build -t "$IMAGE_TAG" server
  docker save "$IMAGE_TAG" -o "$OUT_DIR/recorouter-api-image.tar"
elif [[ "${BUILD_RUST_BINARY:-0}" == "1" ]]; then
  cargo build --manifest-path server/Cargo.toml --release --locked --bins
  cp server/target/release/recorouter-api "$OUT_DIR/recorouter-api"
  cp server/target/release/vehicle-api "$OUT_DIR/vehicle-api"
  cp server/target/release/mall-api "$OUT_DIR/mall-api"
  cp server/target/release/platform-api "$OUT_DIR/platform-api"
  cp server/target/release/recorouter-migrator "$OUT_DIR/recorouter-migrator"
  cp -R server/migrations "$OUT_DIR/migrations"
else
  cp -R server "$OUT_DIR/server"
  rm -rf "$OUT_DIR/server/target"
fi

tar -C "$OUT_DIR" -czf "$OUT_TAR" .

echo "Created $OUT_TAR"
if [[ "${BUILD_DOCKER_IMAGE:-0}" == "1" ]]; then
  echo "Created Docker image artifact $IMAGE_TAG"
elif [[ "${BUILD_RUST_BINARY:-0}" == "1" ]]; then
  echo "Created Rust binary Docker release artifact"
else
  echo "Build the Rust API image on the Linux server with deploy/install-docker-release.sh"
fi
