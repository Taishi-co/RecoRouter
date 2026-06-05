#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-car.shcxyz.site}"
APP_ROOT="${APP_ROOT:-/opt/recorouter}"
VEHICLE_API_PORT="${VEHICLE_API_PORT:-34533}"
MALL_API_PORT="${MALL_API_PORT:-34534}"
PLATFORM_API_PORT="${PLATFORM_API_PORT:-34535}"
CANDIDATE_VEHICLE_API_PORT="${CANDIDATE_VEHICLE_API_PORT:-34633}"
CANDIDATE_MALL_API_PORT="${CANDIDATE_MALL_API_PORT:-34634}"
CANDIDATE_PLATFORM_API_PORT="${CANDIDATE_PLATFORM_API_PORT:-34635}"
CONTAINER_PREFIX="${CONTAINER_PREFIX:-recorouter}"
LEGACY_CONTAINER_NAME="${LEGACY_CONTAINER_NAME:-recorouter-api}"
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
SERVER_PORT=$VEHICLE_API_PORT
VEHICLE_API_PORT=$VEHICLE_API_PORT
MALL_API_PORT=$MALL_API_PORT
PLATFORM_API_PORT=$PLATFORM_API_PORT
RUN_MIGRATIONS=0
PUBLIC_BASE_URL=https://$DOMAIN
LOCAL_UPLOAD_DIR=/app/uploads

# Optional split databases. Leave unset to use DATABASE_URL during phased rollout.
# VEHICLE_DATABASE_URL=
# MALL_DATABASE_URL=
# PLATFORM_DATABASE_URL=

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
  chmod +x "$RELEASE_DIR/recorouter-api" \
    "$RELEASE_DIR/vehicle-api" \
    "$RELEASE_DIR/mall-api" \
    "$RELEASE_DIR/platform-api" \
    "$RELEASE_DIR/recorouter-migrator"
  cat >"$RELEASE_DIR/Dockerfile.runtime" <<'EOF'
FROM debian:bookworm-slim

WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY recorouter-api /usr/local/bin/recorouter-api
COPY vehicle-api /usr/local/bin/vehicle-api
COPY mall-api /usr/local/bin/mall-api
COPY platform-api /usr/local/bin/platform-api
COPY recorouter-migrator /usr/local/bin/recorouter-migrator
COPY migrations ./migrations

ENV SERVER_PORT=34533
ENV VEHICLE_API_PORT=34533
ENV MALL_API_PORT=34534
ENV PLATFORM_API_PORT=34535
ENV LOCAL_UPLOAD_DIR=/app/uploads
EXPOSE 34533 34534 34535

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

run_migrator() {
  local service="$1"
  docker run --rm \
    --network "$DOCKER_NETWORK" \
    --env-file "$ENV_FILE" \
    -e "MIGRATION_SERVICE=$service" \
    -e RUN_MIGRATIONS=1 \
    -v "$UPLOAD_VOLUME:/app/uploads" \
    -v "$ENV_DIR:$ENV_DIR:ro" \
    "$IMAGE_REF" \
    recorouter-migrator
}

start_candidate() {
  local service="$1"
  local binary="$2"
  local container_name="$3"
  local service_port="$4"
  local candidate_port="$5"
  local port_env_name="$6"

  docker rm -f "$container_name" >/dev/null 2>&1 || true
  docker run -d \
    --name "$container_name" \
    --restart no \
    --network "$DOCKER_NETWORK" \
    --env-file "$ENV_FILE" \
    -e RUN_MIGRATIONS=0 \
    -e "$port_env_name=$service_port" \
    -p "127.0.0.1:$candidate_port:$service_port" \
    -v "$UPLOAD_VOLUME:/app/uploads" \
    -v "$ENV_DIR:$ENV_DIR:ro" \
    "$IMAGE_REF" \
    "$binary"

  for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:$candidate_port/api/health" >/dev/null; then
      return 0
    fi
    sleep 1
  done

  docker logs --tail 100 "$container_name" >&2 || true
  echo "$service candidate failed health check on 127.0.0.1:$candidate_port" >&2
  return 1
}

start_production() {
  local binary="$1"
  local container_name="$2"
  local service_port="$3"
  local port_env_name="$4"

  docker rm -f "$container_name" >/dev/null 2>&1 || true
  docker run -d \
    --name "$container_name" \
    --restart unless-stopped \
    --network "$DOCKER_NETWORK" \
    --env-file "$ENV_FILE" \
    -e RUN_MIGRATIONS=0 \
    -e "$port_env_name=$service_port" \
    -p "127.0.0.1:$service_port:$service_port" \
    -v "$UPLOAD_VOLUME:/app/uploads" \
    -v "$ENV_DIR:$ENV_DIR:ro" \
    "$IMAGE_REF" \
    "$binary"
}

cleanup_candidates() {
  docker rm -f \
    "$CONTAINER_PREFIX-vehicle-api-candidate-$RELEASE_ID" \
    "$CONTAINER_PREFIX-mall-api-candidate-$RELEASE_ID" \
    "$CONTAINER_PREFIX-platform-api-candidate-$RELEASE_ID" \
    >/dev/null 2>&1 || true
}

trap cleanup_candidates EXIT

run_migrator legacy
run_migrator vehicle
run_migrator mall
run_migrator platform

start_candidate \
  vehicle-api \
  vehicle-api \
  "$CONTAINER_PREFIX-vehicle-api-candidate-$RELEASE_ID" \
  "$VEHICLE_API_PORT" \
  "$CANDIDATE_VEHICLE_API_PORT" \
  VEHICLE_API_PORT
start_candidate \
  mall-api \
  mall-api \
  "$CONTAINER_PREFIX-mall-api-candidate-$RELEASE_ID" \
  "$MALL_API_PORT" \
  "$CANDIDATE_MALL_API_PORT" \
  MALL_API_PORT
start_candidate \
  platform-api \
  platform-api \
  "$CONTAINER_PREFIX-platform-api-candidate-$RELEASE_ID" \
  "$PLATFORM_API_PORT" \
  "$CANDIDATE_PLATFORM_API_PORT" \
  PLATFORM_API_PORT

cleanup_candidates
docker rm -f "$LEGACY_CONTAINER_NAME" >/dev/null 2>&1 || true
start_production vehicle-api "$CONTAINER_PREFIX-vehicle-api" "$VEHICLE_API_PORT" VEHICLE_API_PORT
start_production mall-api "$CONTAINER_PREFIX-mall-api" "$MALL_API_PORT" MALL_API_PORT
start_production platform-api "$CONTAINER_PREFIX-platform-api" "$PLATFORM_API_PORT" PLATFORM_API_PORT

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

for spec in \
  "vehicle-api:$VEHICLE_API_PORT" \
  "mall-api:$MALL_API_PORT" \
  "platform-api:$PLATFORM_API_PORT"; do
  service="${spec%%:*}"
  port="${spec##*:}"
  for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:$port/api/health" >/dev/null; then
      echo "$service is healthy on 127.0.0.1:$port"
      healthy=1
      break
    fi
    sleep 1
  done
  if [[ "${healthy:-0}" != "1" ]]; then
    docker logs --tail 100 "$CONTAINER_PREFIX-$service" >&2 || true
    exit 1
  fi
  unset healthy
done

echo "RecoRouter split APIs are healthy for https://$DOMAIN"
