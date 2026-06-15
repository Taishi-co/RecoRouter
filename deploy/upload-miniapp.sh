#!/usr/bin/env bash
set -euo pipefail

PLATFORM="${MINIAPP_PLATFORM:-weapp}"
DOMAIN="${PROJECT_DOMAIN:-https://car.shcxyz.site}"
APP_PROFILE="${RECO_APP_PROFILE:-${TARO_APP_PROFILE:-all}}"
OUTPUT_ROOT="${OUTPUT_ROOT:-}"
APP_ROOT="${APP_ROOT:-/opt/recorouter-miniapp}"
RELEASE_TAR="${1:-/tmp/recorouter-miniapp-source.tar.gz}"
RELEASE_ID="${RELEASE_ID:-$(date +%Y%m%d%H%M%S)}"

if [[ "$(id -u)" != "0" ]]; then
  echo "upload-miniapp.sh must run as root" >&2
  exit 1
fi

if [[ ! -f "$RELEASE_TAR" ]]; then
  echo "Miniapp source tar not found: $RELEASE_TAR" >&2
  exit 1
fi

mkdir -p "$APP_ROOT/releases"
RELEASE_DIR="$APP_ROOT/releases/$RELEASE_ID"
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
tar -xzf "$RELEASE_TAR" -C "$RELEASE_DIR"
ln -sfn "$RELEASE_DIR" "$APP_ROOT/current"

cd "$RELEASE_DIR"

if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable
  corepack prepare pnpm@9.0.0 --activate
fi

case "$PLATFORM" in
  weapp)
    : "${TARO_APP_WEAPP_APPID:?TARO_APP_WEAPP_APPID is required for weapp upload}"
    if [[ -z "${WEAPP_PRIVATE_KEY_PATH:-}" ]]; then
      APPID_KEY_PATH="/etc/recorouter/weapp/private.${TARO_APP_WEAPP_APPID}.key"
      if [[ -f "$APPID_KEY_PATH" ]]; then
        WEAPP_PRIVATE_KEY_PATH="$APPID_KEY_PATH"
      else
        WEAPP_PRIVATE_KEY_PATH="/etc/recorouter/weapp/private.appid.key"
      fi
    fi
    if [[ ! -f "$WEAPP_PRIVATE_KEY_PATH" ]]; then
      echo "WeChat upload key not found: $WEAPP_PRIVATE_KEY_PATH" >&2
      exit 1
    fi

    mkdir -p key
    install -m 0600 "$WEAPP_PRIVATE_KEY_PATH" key/private.appid.key
    cat >.env.local <<EOF
PROJECT_DOMAIN=$DOMAIN
TARO_APP_WEAPP_APPID=$TARO_APP_WEAPP_APPID
TARO_APP_WEAPP_MALL_APPID=${TARO_APP_WEAPP_MALL_APPID:-$TARO_APP_WEAPP_APPID}
RECO_APP_PROFILE=$APP_PROFILE
EOF

    pnpm install --frozen-lockfile

    DEFAULT_VERSION="$(
      node - <<'NODE'
const pkg = require('./package.json')
console.log(String(pkg.version || '1.0.0'))
NODE
    )"
    export MINIAPP_UPLOAD_VERSION="${MINIAPP_UPLOAD_VERSION:-$DEFAULT_VERSION}"
    export MINIAPP_UPLOAD_DESC="${MINIAPP_UPLOAD_DESC:-RecoRouter weapp ${MINIAPP_UPLOAD_VERSION}}"
    DIST_DIR="$OUTPUT_ROOT"
    if [[ -z "$DIST_DIR" ]]; then
      case "$APP_PROFILE" in
        vehicle) DIST_DIR="dist-weapp-vehicle" ;;
        mall) DIST_DIR="dist-weapp-mall" ;;
        admin) DIST_DIR="dist-weapp-admin" ;;
        *) DIST_DIR="dist" ;;
      esac
    fi

    RECO_APP_PROFILE="$APP_PROFILE" pnpm exec taro build --type weapp

    if command -v rg >/dev/null 2>&1; then
      rg -q "$DOMAIN" "$DIST_DIR"
      ! rg -q 'car\.recolink\.cn' "$DIST_DIR"
    else
      grep -R "$DOMAIN" "$DIST_DIR" >/dev/null
      ! grep -R 'car\.recolink\.cn' "$DIST_DIR" >/dev/null
    fi

    RECO_APP_PROFILE="$APP_PROFILE" pnpm exec taro upload --type weapp
    ;;
  tt)
    echo "tt upload is not configured yet. Add TARO_APP_TT_EMAIL/TARO_APP_TT_PASSWORD and extend this script when Douyin is ready." >&2
    exit 2
    ;;
  alipay)
    echo "alipay upload is not configured yet. Add Alipay miniapp CI credentials and extend this script when Alipay is ready." >&2
    exit 2
    ;;
  *)
    echo "Unsupported MINIAPP_PLATFORM: $PLATFORM" >&2
    exit 2
    ;;
esac
