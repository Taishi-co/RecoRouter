# RecoRouter production deploy

Target:

- Host: `62.234.29.88`
- Domain: `car.shcxyz.site`
- App root: `/opt/recorouter`
- API port: `34533`
- Runtime: Docker container on the existing `server_default` network

## Prerequisites

1. Point DNS `A car.shcxyz.site` to `62.234.29.88`.
2. Ensure SSH access to the server.
3. Install nginx and Docker on the server.
4. Create `/etc/recorouter/recorouter.env` on the server:

```dotenv
DATABASE_URL=postgres://postgres:change-me@recocar-postgres:5432/recocar
SERVER_PORT=34533
PUBLIC_BASE_URL=https://car.shcxyz.site
LOCAL_UPLOAD_DIR=/app/uploads

# Optional Tencent COS. Leave unset to use local uploads.
# COS_SECRET_ID=
# COS_SECRET_KEY=
# COS_BUCKET=
# COS_REGION=
```

The Rust API runs embedded migrations on startup.

## Build a Docker release package

From the repo root:

```bash
deploy/make-docker-release.sh
```

This creates `/tmp/recorouter-docker-release.tar.gz` containing:

- `server-rust/`
- `dist-web/`
- `deploy/`

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
- `dist-web/`
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
certbot certonly --webroot -w /opt/recorouter/current/dist-web -d car.shcxyz.site
```
