# 后端三服务拆分第二阶段说明

日期：2026-06-05

## 本阶段目标

本阶段先完成“可独立启动、可独立路由验证、平台公共记录模型可用”的后端骨架：

- `vehicle-api`：无人车业务路由，不暴露商城和平台治理路由。
- `mall-api`：商城业务与商城后台路由，不暴露无人车和平台治理路由。
- `platform-api`：平台设置、支付、平台流水、退款、转账、分账计划、事件投递、COS 记录、审计路由，不暴露业务订单路由。
- legacy `recorouter-api`：保留原聚合入口，降低上线切换风险。

这还不是最终物理隔离完成态。当前 crate 仍是一个 Rust workspace package，三个服务先以不同 binary 和 router 运行。后续还要继续拆迁移目录、部署单元、平台事件投递和真实微信退款/转账/分账执行。

## 启动入口

```bash
pnpm dev:server        # legacy recorouter-api
pnpm dev:vehicle-api   # vehicle-api
pnpm dev:mall-api      # mall-api
pnpm dev:platform-api  # platform-api
```

构建：

```bash
pnpm build:apis
cargo build --manifest-path server/Cargo.toml --bins
```

迁移：

```bash
pnpm migrate:server        # legacy / compatibility database
pnpm migrate:vehicle-api   # vehicle database
pnpm migrate:mall-api      # mall database
pnpm migrate:platform-api  # platform database
```

## 环境变量

本地兼容模式可以继续只配 `DATABASE_URL` 和 `SERVER_PORT`。三服务模式建议显式配置：

```dotenv
VEHICLE_DATABASE_URL=postgres://postgres:change-me@postgres:5432/recocar_vehicle
MALL_DATABASE_URL=postgres://postgres:change-me@postgres:5432/recocar_mall
PLATFORM_DATABASE_URL=postgres://postgres:change-me@postgres:5432/recocar_platform

VEHICLE_API_PORT=34532
MALL_API_PORT=34533
PLATFORM_API_PORT=34534

INTERNAL_SERVICE_SECRET=change-me
```

迁移运行策略：

```dotenv
# legacy recorouter-api 默认会跑 embedded migrations。
# vehicle-api / mall-api / platform-api 默认不跑 migrations，避免三进程并发启动时抢同一套 SQLx migration lock。
RUN_MIGRATIONS=
VEHICLE_RUN_MIGRATIONS=
MALL_RUN_MIGRATIONS=
PLATFORM_RUN_MIGRATIONS=
MIGRATION_SERVICE=legacy
```

生产三服务部署建议：

1. 先用 `recorouter-migrator` 或 `pnpm migrate:*` 对目标 database/schema 执行迁移。
2. 迁移成功后启动对应 API 进程。
3. 只有本地临时调试时，才建议对单个服务显式设置 `*_RUN_MIGRATIONS=1`。

PostgreSQL、Redis、COS 可以共用基础设施，但必须按命名空间隔离：

- PostgreSQL：优先三个 database；退一步三个 schema。
- Redis：`vehicle:*`、`mall:*`、`platform:*`。
- COS：`vehicle/*`、`mall/*`、`platform/*`。

## 平台公共模型

新增迁移：

- `platform_app_configs`
- `platform_payment_orders`
- `platform_refund_orders`
- `platform_transfer_orders`
- `platform_receivers`
- `platform_split_plans`
- `platform_split_items`
- `platform_event_deliveries`
- `platform_cos_uploads`
- `platform_audit_logs`
- `platform_idempotency_keys`

第一批接口：

- `GET/POST /api/platform/app-configs`
- `GET/POST /api/platform/payment-orders`
- `GET/POST /api/platform/refund-orders`
- `GET/POST /api/platform/transfer-orders`
- `GET/POST /api/platform/split-plans`
- `GET /api/platform/split-plans/:id`
- `GET/POST /api/platform/event-deliveries`
- `GET/POST /api/platform/cos-uploads`
- `GET /api/platform/audit-logs`

分账规则边界：

- `vehicle-api` 计算无人车佣金/分账规则。
- `mall-api` 计算商城供应商/团长/平台服务费规则。
- `platform-api` 只接收标准分账计划，做金额、接收方、幂等和审计校验，后续再执行真实微信分账。

## 验证

```bash
pnpm validate:split
pnpm validate
cargo check --manifest-path server/Cargo.toml
cargo test --manifest-path server/Cargo.toml --test service_routers
```

已知待办：

- 三服务当前仍共用 `server/migrations`，已加独立 migrator 和 `RUN_MIGRATIONS` 控制，但后续仍应拆三套迁移目录或 schema migrator。
- `payments.rs` 仍会直接推进业务订单状态，后续要改成 platform 记录成功后投递事件，由 `vehicle-api` / `mall-api` 消费。
- `owner_wallet.rs` 仍包含微信商家转账执行逻辑，后续要把底层执行迁到 `platform-api`，业务钱包账本留在 `vehicle-api`。
- Docker、systemd、GitHub Actions 仍是单服务部署模型，不能直接视为生产三服务上线完成。
