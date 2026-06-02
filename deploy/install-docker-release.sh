#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-car.shcxyz.site}"
APP_ROOT="${APP_ROOT:-/opt/recorouter}"
API_PORT="${API_PORT:-34533}"
CANDIDATE_API_PORT="${CANDIDATE_API_PORT:-34534}"
CONTAINER_NAME="${CONTAINER_NAME:-recorouter-api}"
DOCKER_NETWORK="${DOCKER_NETWORK:-server_default}"
UPLOAD_VOLUME="${UPLOAD_VOLUME:-server_recocar-uploads}"
RELEASE_TAR="${1:-/tmp/recorouter-docker-release.tar.gz}"
RELEASE_ID="${RELEASE_ID:-$(date +%Y%m%d%H%M%S)}"
ENV_DIR="/etc/recorouter"
ENV_FILE="$ENV_DIR/recorouter.env"

if [[ "$(id -u)" != "0" ]]; then
  echo "install-docker-release.sh must run as root" >&2
  exit 1
fi

if [[ ! -f "$RELEASE_TAR" ]]; then
  echo "Release tar not found: $RELEASE_TAR" >&2
  exit 1
fi

mkdir -p "$APP_ROOT/releases" "$ENV_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  cat >"$ENV_FILE" <<EOF
DATABASE_URL=postgres://postgres:change-me@recocar-postgres:5432/recocar
SERVER_PORT=$API_PORT
PUBLIC_BASE_URL=https://$DOMAIN
LOCAL_UPLOAD_DIR=/app/uploads

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

RELEASE_DIR="$APP_ROOT/releases/$RELEASE_ID"
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
tar -xzf "$RELEASE_TAR" -C "$RELEASE_DIR"
if [[ -d "$RELEASE_DIR/dist-web" ]]; then
  chmod -R a+rX "$RELEASE_DIR/dist-web"
fi

docker network inspect "$DOCKER_NETWORK" >/dev/null
IMAGE_REF="recorouter-api:$RELEASE_ID"
if [[ -f "$RELEASE_DIR/recorouter-api-image.tar" ]]; then
  docker load -i "$RELEASE_DIR/recorouter-api-image.tar"
  docker tag "recorouter-api:release" "$IMAGE_REF"
elif [[ -f "$RELEASE_DIR/recorouter-api" ]]; then
  chmod +x "$RELEASE_DIR/recorouter-api"
  cat >"$RELEASE_DIR/Dockerfile.runtime" <<'EOF'
FROM debian:bookworm-slim

WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY recorouter-api /usr/local/bin/recorouter-api
COPY migrations ./migrations

ENV SERVER_PORT=34533
ENV LOCAL_UPLOAD_DIR=/app/uploads
EXPOSE 34533

CMD ["recorouter-api"]
EOF
  docker build -t "$IMAGE_REF" -f "$RELEASE_DIR/Dockerfile.runtime" "$RELEASE_DIR"
else
  docker build -t "$IMAGE_REF" "$RELEASE_DIR/server"
fi

if [[ -d "$RELEASE_DIR/mall-products" ]]; then
  docker run --rm \
    --network "$DOCKER_NETWORK" \
    --env-file "$ENV_FILE" \
    -v "$UPLOAD_VOLUME:/app/uploads" \
    -v "$RELEASE_DIR/mall-products:/assets/mall-products:ro" \
    "$IMAGE_REF" \
    recorouter-api sync-mall-assets /assets/mall-products
fi

CANDIDATE_NAME="${CONTAINER_NAME}-candidate-$RELEASE_ID"
docker rm -f "$CANDIDATE_NAME" >/dev/null 2>&1 || true
docker run -d \
  --name "$CANDIDATE_NAME" \
  --restart no \
  --network "$DOCKER_NETWORK" \
  --env-file "$ENV_FILE" \
  -p "127.0.0.1:$CANDIDATE_API_PORT:$API_PORT" \
  -v "$UPLOAD_VOLUME:/app/uploads" \
  -v "$ENV_DIR:$ENV_DIR:ro" \
  "$IMAGE_REF"

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$CANDIDATE_API_PORT/api/health" >/dev/null; then
    CANDIDATE_HEALTHY=1
    break
  fi
  sleep 1
done

if [[ "${CANDIDATE_HEALTHY:-0}" != "1" ]]; then
  docker logs --tail 100 "$CANDIDATE_NAME" >&2 || true
  docker rm -f "$CANDIDATE_NAME" >/dev/null 2>&1 || true
  echo "Candidate API failed health check; keeping existing $CONTAINER_NAME container." >&2
  exit 1
fi

docker rm -f "$CANDIDATE_NAME" >/dev/null 2>&1 || true
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --network "$DOCKER_NETWORK" \
  --env-file "$ENV_FILE" \
  -p "127.0.0.1:$API_PORT:$API_PORT" \
  -v "$UPLOAD_VOLUME:/app/uploads" \
  -v "$ENV_DIR:$ENV_DIR:ro" \
  "$IMAGE_REF"
docker tag "$IMAGE_REF" "recorouter-api:latest"
ln -sfn "$RELEASE_DIR" "$APP_ROOT/current"

if [[ -d /www/server/panel/vhost/nginx ]]; then
  install -m 0644 "$RELEASE_DIR/deploy/nginx-car.shcxyz.site.conf" /www/server/panel/vhost/nginx/car.shcxyz.site.conf
elif [[ -d /etc/nginx/conf.d ]]; then
  install -m 0644 "$RELEASE_DIR/deploy/nginx-car.shcxyz.site.conf" /etc/nginx/conf.d/recorouter.conf
elif [[ -d /etc/nginx/sites-available ]]; then
  install -m 0644 "$RELEASE_DIR/deploy/nginx-car.shcxyz.site.conf" /etc/nginx/sites-available/recorouter
  ln -sfn /etc/nginx/sites-available/recorouter /etc/nginx/sites-enabled/recorouter
else
  echo "Cannot find nginx vhost, conf.d, or sites-available directory" >&2
  exit 1
fi

nginx -t
nginx -s reload

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$API_PORT/api/health" >/dev/null; then
    echo "RecoRouter API is healthy on 127.0.0.1:$API_PORT"
    echo "RecoRouter backend is configured for https://$DOMAIN"
    exit 0
  fi
  sleep 1
done

docker logs --tail 100 "$CONTAINER_NAME" >&2 || true
exit 1
