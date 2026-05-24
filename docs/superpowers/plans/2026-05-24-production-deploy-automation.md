# Production Deploy Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a GitHub Actions deployment surface that deploys the Rust backend/H5 web app to the server and publishes WeChat miniapp builds from the server's stable IP.

**Architecture:** GitHub Actions packages source artifacts and transfers them to `62.234.29.88` over SSH. Server deployment uses the existing Docker-based `deploy/install-docker-release.sh`; miniapp publication extracts source on the server and runs Taro upload from `62.234.29.88` so WeChat CI sees a stable whitelisted IP.

**Tech Stack:** GitHub Actions, SSH/scp, Docker, pnpm/Taro, `@tarojs/plugin-mini-ci`, WeChat miniprogram CI.

---

### Task 1: Production Server Deployment Workflow

**Files:**
- Create: `.github/workflows/deploy-prod.yml`
- Use: `deploy/make-docker-release.sh`
- Use: `deploy/install-docker-release.sh`

- [x] Add a `push` to `main` and `workflow_dispatch` workflow.
- [x] Build `/tmp/recorouter-docker-release.tar.gz` with `deploy/make-docker-release.sh`.
- [x] Support SSH key or password auth from GitHub Secrets.
- [x] Upload the release tarball to `62.234.29.88`.
- [x] Run `deploy/install-docker-release.sh` on the server.
- [x] Verify `https://car.shcxyz.site/api/health` and the frontend URL.

### Task 2: Server-Side Miniapp Upload Flow

**Files:**
- Create: `deploy/make-miniapp-source-release.sh`
- Create: `deploy/upload-miniapp.sh`
- Modify: `config/index.ts`

- [x] Package miniapp source without `.env*`, `key/`, `dist*`, `node_modules`, `.git`, or build targets.
- [x] Extract source on the server under `/opt/recorouter-miniapp/releases/<release-id>`.
- [x] Build `.env.local` on the server with `PROJECT_DOMAIN=https://car.shcxyz.site`.
- [x] Copy the WeChat upload key from `/etc/recorouter/weapp/private.appid.key`.
- [x] Add `MINIAPP_UPLOAD_VERSION` and `MINIAPP_UPLOAD_DESC` support to Taro mini CI config.
- [x] Build `weapp`, verify the embedded domain, and run `taro upload --type weapp`.
- [x] Leave `tt` and `alipay` as explicit unsupported platform branches until their CI credentials are available.

### Task 3: Miniapp Publish Workflow

**Files:**
- Create: `.github/workflows/publish-miniapp.yml`

- [x] Add manual `workflow_dispatch` inputs for platform and project domain.
- [x] Add `push` to `main` trigger gated by `vars.WEAPP_UPLOAD_ON_MAIN == 'true'`.
- [x] Transfer the source package to the server.
- [x] Run `deploy/upload-miniapp.sh` on the server so the upload IP is `62.234.29.88`.

### Task 4: Server and GitHub Setup

**Files:**
- Server-only: `/etc/recorouter/weapp/private.appid.key`
- GitHub repository Secrets/Variables

- [x] Copy the local WeChat upload key to `/etc/recorouter/weapp/private.appid.key`.
- [x] Set `SERVER_HOST`, `SERVER_USER`, and `SERVER_PASSWORD` in GitHub Secrets.
- [x] Set `SERVER_PORT`, `PROJECT_DOMAIN`, `MINIAPP_PLATFORM`, `TARO_APP_WEAPP_APPID`, and `WEAPP_UPLOAD_ON_MAIN` in GitHub Variables.

### Task 5: Verification

**Files:**
- All changed workflow and deploy files

- [x] Run shell syntax checks for deploy scripts.
- [x] Build a miniapp source release tarball and inspect exclusions.
- [x] Build a WeChat miniapp locally with `MINIAPP_UPLOAD_VERSION` and `MINIAPP_UPLOAD_DESC`.
- [x] Validate workflow YAML parses.
- [x] Run `git diff --check`.
- [x] Commit and push to RecoRouter `main`.
