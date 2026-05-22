#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${OUT_DIR:-/tmp/recorouter-release}"
OUT_TAR="${OUT_TAR:-/tmp/recorouter-release.tar.gz}"

cd "$ROOT_DIR"

pnpm validate
pnpm build:web
(cd server-rust && cargo build --release)

rm -rf "$OUT_DIR" "$OUT_TAR"
mkdir -p "$OUT_DIR"

cp server-rust/target/release/recorouter-api "$OUT_DIR/recorouter-api"
cp -R dist-web "$OUT_DIR/dist-web"
cp -R deploy "$OUT_DIR/deploy"

tar -C "$OUT_DIR" -czf "$OUT_TAR" .

echo "Created $OUT_TAR"
