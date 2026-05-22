# RecoRouter production deploy

Target:

- Host: `62.234.29.88`
- Domain: `car.shcxyz.site`
- App root: `/opt/recorouter`
- API port: `34532`

## Prerequisites

1. Point DNS `A car.shcxyz.site` to `62.234.29.88`.
2. Ensure SSH access to the server.
3. Install nginx and systemd on the server.
4. Create `/etc/recorouter/recorouter.env` on the server:

```dotenv
DATABASE_URL=postgres://recorouter:change-me@127.0.0.1:5432/recorouter
SERVER_PORT=34532
PUBLIC_BASE_URL=https://car.shcxyz.site
LOCAL_UPLOAD_DIR=/opt/recorouter/uploads

# Optional Tencent COS. Leave unset to use local uploads.
# COS_SECRET_ID=
# COS_SECRET_KEY=
# COS_BUCKET=
# COS_REGION=
```

The Rust API runs embedded migrations on startup.

## Build a release package

From the repo root:

```bash
deploy/make-release.sh
```

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

After DNS resolves, enable HTTPS:

```bash
certbot --nginx -d car.shcxyz.site
```
