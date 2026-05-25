#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_TAR="${OUT_TAR:-/tmp/recorouter-miniapp-source.tar.gz}"

cd "$ROOT_DIR"

rm -f "$OUT_TAR"

tar \
  --exclude='./.git' \
  --exclude='./.github' \
  --exclude='./.env' \
  --exclude='./.env.*' \
  --exclude='./node_modules' \
  --exclude='./node-compile-cache' \
  --exclude='./.pnpm-store' \
  --exclude='./dist' \
  --exclude='./dist-*' \
  --exclude='./server/target' \
  --exclude='./key' \
  --exclude='./project.private.config.json' \
  --exclude='./*.key' \
  --exclude='./*.pem' \
  --exclude='./*.p12' \
  --exclude='./*.pfx' \
  --exclude='./*.crt' \
  --exclude='./*.cer' \
  -czf "$OUT_TAR" .

echo "Created $OUT_TAR"
