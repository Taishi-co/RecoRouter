# RecoRouter production deploy

Target:

- Host: `62.234.29.88`
- Domain: `car.shcxyz.site`
- App root: `/opt/recorouter`
- API port: `34533`
- Split API ports: `vehicle-api=34533`, `mall-api=34534`, `platform-api=34535`
- Web root: `/opt/recorouter/current/dist-web` (admin management platform)
- Demo web ports: `vehicle H5=18081`, `mall H5=18082`
- Runtime: Docker container on the existing `server_default` network

## Prerequisites

1. Point DNS `A car.shcxyz.site` to `62.234.29.88`.
2. Ensure SSH access to the server.
3. Install nginx and Docker on the server.
4. Create `/etc/recorouter/recorouter.env` on the server:

```dotenv
DATABASE_URL=postgres://postgres:change-me@recocar-postgres:5432/recocar
SERVER_PORT=34533
VEHICLE_API_PORT=34533
MALL_API_PORT=34534
PLATFORM_API_PORT=34535
RUN_MIGRATIONS=0
PUBLIC_BASE_URL=https://car.shcxyz.site
LOCAL_UPLOAD_DIR=/app/uploads

# Optional Tencent COS. Leave unset to use local uploads.
# COS_SECRET_ID=
# COS_SECRET_KEY=
# COS_BUCKET=
# COS_REGION=
```

The Rust API runs embedded migrations on startup.
For the split API deployment, `deploy/install-docker-release.sh` runs
`recorouter-migrator` first and starts `vehicle-api`, `mall-api`, and
`platform-api` with embedded migrations disabled. During phased rollout, the
three services can still share `DATABASE_URL`; when separate databases are
ready, set `VEHICLE_DATABASE_URL`, `MALL_DATABASE_URL`, and
`PLATFORM_DATABASE_URL` in `/etc/recorouter/recorouter.env`.

Nginx routes API traffic by path:

- `/api/mall/`, `/api/admin/mall/`, `/api/support/` -> `mall-api`
- `/api/platform/`, `/api/payments/` -> `platform-api`
- other `/api/` paths -> `vehicle-api`

Nginx also serves H5 demo builds for browser presentation:

- `http://car.shcxyz.site:18081/` -> vehicle app H5 (`dist-web-vehicle`)
- `http://car.shcxyz.site:18082/` -> mall app H5 (`dist-web-mall`)

## GitHub Actions auto deploy

The repository has two production workflows:

- `.github/workflows/deploy-prod.yml`
  - Trigger: frontend/backend/deploy changes on `main`, or manual `workflow_dispatch`.
  - Builds `/tmp/recorouter-docker-release.tar.gz`.
  - Builds the Web admin app plus Taro H5 vehicle and mall demo apps with `PROJECT_DOMAIN=https://car.shcxyz.site`.
  - Builds the Rust API binary on the GitHub Linux runner.
  - Packages `dist-web`, `dist-web-vehicle`, `dist-web-mall`, Rust migrations, all API binaries, and deploy scripts.
  - Runs `deploy/install-docker-release.sh`; the server builds only the lightweight runtime Docker image, runs the migrator, health-checks three candidate containers, then restarts production split API containers.
  - Installs nginx so `/` serves the Web admin platform, `:18081` serves the vehicle H5 demo, `:18082` serves the mall H5 demo, and `/api/` is routed to the correct split API by path.
  - Verifies `https://car.shcxyz.site/api/health`.
- `.github/workflows/publish-miniapp.yml`
  - Trigger: manual `workflow_dispatch`, or push to `main` when repository variable `WEAPP_UPLOAD_ON_MAIN=true`.
  - Packages source without local env/key/build artifacts.
  - Runs `deploy/upload-miniapp.sh` on `62.234.29.88`, so WeChat sees the fixed upload IP `62.234.29.88`.
  - Currently supports `weapp`; `tt` and `alipay` are explicit extension points.

Required GitHub Secrets:

```text
SERVER_HOST=62.234.29.88
SERVER_USER=root
SERVER_PASSWORD=<server password>
# or use SERVER_SSH_KEY instead of SERVER_PASSWORD
```

Required GitHub Variables:

```text
SERVER_PORT=22
PROJECT_DOMAIN=https://car.shcxyz.site
MINIAPP_PLATFORM=weapp
TARO_APP_WEAPP_APPID=wx1d00ff916a4a8ed0
WEAPP_UPLOAD_ON_MAIN=false
```

Set `WEAPP_UPLOAD_ON_MAIN=true` only after the WeChat upload IP allowlist includes
`62.234.29.88`.

Server-only WeChat upload key path:

```text
/etc/recorouter/weapp/private.appid.key
```

Do not commit the WeChat upload key, `.env.local`, or `project.private.config.json`.

## Build a Docker release package

From the repo root:

```bash
deploy/make-docker-release.sh
```

This creates `/tmp/recorouter-docker-release.tar.gz` containing:

- `deploy/`
- `dist-web/` when `BUILD_WEB` is not `0`
- `dist-web-vehicle/` and `dist-web-mall/` when `BUILD_WEB` is not `0`

By default the package contains `server/` and lets the server build the
Docker image. In GitHub Actions, `BUILD_RUST_BINARY=1` builds the Rust binary on
the Linux runner and packages `recorouter-api` plus migrations; the server then
builds only the small runtime image and restarts the container. `BUILD_DOCKER_IMAGE=1`
is also supported when a full Docker image artifact is wanted. Set
`BUILD_WEB=0` only for backend-only emergency releases; normal production
releases should include all three web outputs.

Upload and install:

```bash
scp /tmp/recorouter-docker-release.tar.gz root@62.234.29.88:/tmp/recorouter-docker-release.tar.gz
ssh root@62.234.29.88 'mkdir -p /tmp/recorouter-install && tar -xzf /tmp/recorouter-docker-release.tar.gz -C /tmp/recorouter-install && bash /tmp/recorouter-install/deploy/install-docker-release.sh /tmp/recorouter-docker-release.tar.gz'
```

## Build a release package

Run this on Linux or a Linux CI runner, because the release contains a native
Rust binary for the target server:

```bash
deploy/make-release.sh
```

On macOS, use `ALLOW_NON_LINUX_RELEASE=1 deploy/make-release.sh` only for a
local smoke test. Do not upload that tarball to the Linux server.

This creates `/tmp/recorouter-release.tar.gz` containing:

- `recorouter-api`
- `vehicle-api`
- `mall-api`
- `platform-api`
- `recorouter-migrator`
- `migrations/`
- `dist-web/` when `BUILD_WEB` is not `0`
- `deploy/`

## Install on the server

Upload the release tarball, then run the installer as root:

```bash
scp /tmp/recorouter-release.tar.gz root@62.234.29.88:/tmp/recorouter-release.tar.gz
ssh root@62.234.29.88 'bash /opt/recorouter/current/deploy/install-release.sh /tmp/recorouter-release.tar.gz'
```

For first install, when `/opt/recorouter/current` does not exist yet:

```bash
ssh root@62.234.29.88 'mkdir -p /tmp/recorouter-install && tar -xzf /tmp/recorouter-release.tar.gz -C /tmp/recorouter-install && bash /tmp/recorouter-install/deploy/install-release.sh /tmp/recorouter-release.tar.gz'
```

If the certificate is missing, issue it with:

```bash
certbot certonly --webroot -w /var/www/html -d car.shcxyz.site
```
