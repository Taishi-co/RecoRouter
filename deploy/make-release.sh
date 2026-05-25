#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${OUT_DIR:-/tmp/recorouter-release}"
OUT_TAR="${OUT_TAR:-/tmp/recorouter-release.tar.gz}"
TARGET_UNAME="$(uname -s)"

cd "$ROOT_DIR"

if [[ "$TARGET_UNAME" != "Linux" && "${ALLOW_NON_LINUX_RELEASE:-}" != "1" ]]; then
  echo "This package contains a native Rust binary for $TARGET_UNAME." >&2
  echo "Run this script on Linux/CI for server deployment, or set ALLOW_NON_LINUX_RELEASE=1 for a local smoke test only." >&2
  exit 1
fi

pnpm validate
cargo build --manifest-path server/Cargo.toml --release --locked

rm -rf "$OUT_DIR" "$OUT_TAR"
mkdir -p "$OUT_DIR"

cp server/target/release/recorouter-api "$OUT_DIR/recorouter-api"
cp -R server/migrations "$OUT_DIR/migrations"
cp -R deploy "$OUT_DIR/deploy"

tar -C "$OUT_DIR" -czf "$OUT_TAR" .

echo "Created $OUT_TAR"
