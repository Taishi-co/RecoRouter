#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-car.shcxyz.site}"
APP_ROOT="${APP_ROOT:-/opt/recorouter}"
SERVICE_NAME="${SERVICE_NAME:-recorouter-api}"
API_PORT="${API_PORT:-34533}"
RELEASE_TAR="${1:-/tmp/recorouter-release.tar.gz}"
RELEASE_ID="${RELEASE_ID:-$(date +%Y%m%d%H%M%S)}"
ENV_DIR="/etc/recorouter"
ENV_FILE="$ENV_DIR/recorouter.env"

if [[ "$(id -u)" != "0" ]]; then
  echo "install-release.sh must run as root" >&2
  exit 1
fi

if [[ ! -f "$RELEASE_TAR" ]]; then
  echo "Release tar not found: $RELEASE_TAR" >&2
  exit 1
fi

mkdir -p "$APP_ROOT/releases" "$APP_ROOT/uploads" "$ENV_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  cat >"$ENV_FILE" <<EOF
DATABASE_URL=postgres://postgres:change-me@127.0.0.1:5432/recocar
SERVER_PORT=$API_PORT
PUBLIC_BASE_URL=https://$DOMAIN
LOCAL_UPLOAD_DIR=$APP_ROOT/uploads

# Optional Tencent COS. Leave unset to use local uploads.
# COS_SECRET_ID=
# COS_SECRET_KEY=
# COS_BUCKET=
# COS_REGION=
EOF
  chmod 600 "$ENV_FILE"
  echo "Created $ENV_FILE. Fill DATABASE_URL and rerun this script." >&2
  exit 2
fi

if ! getent group recorouter >/dev/null 2>&1; then
  groupadd --system recorouter
fi

NOLOGIN_SHELL="/usr/sbin/nologin"
if [[ ! -x "$NOLOGIN_SHELL" ]]; then
  NOLOGIN_SHELL="/sbin/nologin"
fi

if ! id -u recorouter >/dev/null 2>&1; then
  useradd --system --gid recorouter --home "$APP_ROOT" --shell "$NOLOGIN_SHELL" recorouter
fi

RELEASE_DIR="$APP_ROOT/releases/$RELEASE_ID"
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
tar -xzf "$RELEASE_TAR" -C "$RELEASE_DIR"
chmod +x "$RELEASE_DIR/recorouter-api"
if [[ -d "$RELEASE_DIR/dist-web" ]]; then
  chmod -R a+rX "$RELEASE_DIR/dist-web"
fi
if [[ -d "$RELEASE_DIR/mall-products" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
  "$RELEASE_DIR/recorouter-api" sync-mall-assets "$RELEASE_DIR/mall-products"
fi
ln -sfn "$RELEASE_DIR" "$APP_ROOT/current"
chown -R recorouter:recorouter "$APP_ROOT"

install -m 0644 "$RELEASE_DIR/deploy/recorouter-api.service" "/etc/systemd/system/$SERVICE_NAME.service"

if [[ -d /etc/nginx/conf.d ]]; then
  install -m 0644 "$RELEASE_DIR/deploy/nginx-car.shcxyz.site.conf" /etc/nginx/conf.d/recorouter.conf
elif [[ -d /etc/nginx/sites-available ]]; then
  install -m 0644 "$RELEASE_DIR/deploy/nginx-car.shcxyz.site.conf" /etc/nginx/sites-available/recorouter
  ln -sfn /etc/nginx/sites-available/recorouter /etc/nginx/sites-enabled/recorouter
else
  echo "Cannot find nginx conf.d or sites-available directory" >&2
  exit 1
fi

nginx -t
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"
systemctl reload nginx

curl -fsS "http://127.0.0.1:$API_PORT/api/health" >/dev/null
echo "RecoRouter deployed at https://$DOMAIN"
