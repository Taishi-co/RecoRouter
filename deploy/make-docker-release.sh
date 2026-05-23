#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${OUT_DIR:-/tmp/recorouter-docker-release}"
OUT_TAR="${OUT_TAR:-/tmp/recorouter-docker-release.tar.gz}"

cd "$ROOT_DIR"

pnpm validate
pnpm build:web

rm -rf "$OUT_DIR" "$OUT_TAR"
mkdir -p "$OUT_DIR"

cp -R server-rust "$OUT_DIR/server-rust"
rm -rf "$OUT_DIR/server-rust/target"
cp -R dist-web "$OUT_DIR/dist-web"
cp -R deploy "$OUT_DIR/deploy"

tar -C "$OUT_DIR" -czf "$OUT_TAR" .

echo "Created $OUT_TAR"
echo "Build the Rust API image on the Linux server with deploy/install-docker-release.sh"
