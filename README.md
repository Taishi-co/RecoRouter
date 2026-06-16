# RecoRouter

RecoRouter 是面向无人车运力调度、社区团购商城和运营管理的前后端一体化仓库。当前代码已经按业务边界拆成三类前端 profile 和三类后端 API 服务，并保留一个 legacy 聚合服务用于本地开发和兼容部署。

## 当前用途

| 业务域 | 面向用户 | 主要能力 |
| --- | --- | --- |
| 无人车 / 运力 | 企业端、车主端、需求方端 | 企业调度、车队和奶站管理、需求发布、订单履约、车辆租赁、行程编排、取消处理、车主钱包 |
| 商城 / 叁友甄选 | C 端商城用户、团长、商城运营 | 商品目录、购物车、结算、订单支付、配送时段、自提点、优惠券、积分、售后、客服、商城运营后台 |
| 运营管理 | 平台管理员、客服、财务/运营 | 用户审核、车辆审核、运力订单、佣金审核、商城商品/订单/营销/客服/财务、运营数据看板 |
| 公共服务 | 各业务后端 | 平台配置、支付预下单和回调、退款/转账/分账记录、COS 上传记录、审计日志、事件投递 |

## 架构总览

```mermaid
flowchart LR
  subgraph Frontend["前端"]
    VehicleMini["Taro vehicle profile\n锐途运力小程序 / H5"]
    MallMini["Taro mall profile\n叁友甄选小程序 / H5"]
    AdminMini["Taro admin profile\n运营端小程序页面"]
    WebAdmin["Vite Web Admin\nsrc/web-admin/main.tsx"]
  end

  subgraph Edge["生产入口"]
    Nginx["Nginx\ncar.shcxyz.site"]
  end

  subgraph Backend["Rust / Axum API"]
    VehicleAPI["vehicle-api\n无人车 / 运力"]
    MallAPI["mall-api\n商城 / 客服"]
    PlatformAPI["platform-api\n公共服务"]
    LegacyAPI["recorouter-api\nlegacy 聚合服务"]
    Migrator["recorouter-migrator\nSQLx migrations"]
  end

  subgraph Data["数据与外部服务"]
    Postgres["PostgreSQL"]
    Storage["Local uploads / Tencent COS"]
    WeChatPay["WeChat Pay"]
  end

  VehicleMini --> Nginx
  MallMini --> Nginx
  AdminMini --> Nginx
  WebAdmin --> Nginx
  Nginx --> VehicleAPI
  Nginx --> MallAPI
  Nginx --> PlatformAPI
  VehicleAPI --> Postgres
  MallAPI --> Postgres
  PlatformAPI --> Postgres
  Migrator --> Postgres
  VehicleAPI --> Storage
  MallAPI --> Storage
  PlatformAPI --> Storage
  PlatformAPI --> WeChatPay
```

生产环境按路径把 `/api/` 拆到三个 API：

| 入口路径 | 目标服务 | 说明 |
| --- | --- | --- |
| `/api/mall/*`、`/api/admin/mall/*`、`/api/support/*` | `mall-api` | 商城 C 端、商城后台、客服 |
| `/api/platform/*`、`/api/payments/*` | `platform-api` | 平台配置、支付、退款、转账、分账、审计和事件投递 |
| 其他 `/api/*` | `vehicle-api` | 用户、角色、企业、车队、需求、订单、车辆、行程、通知、车主钱包 |
| 本地兼容 | `recorouter-api` | legacy 聚合服务，合并 vehicle、mall、platform 全部路由 |

## 前端

前端基于 Taro 4、React 18、TypeScript、Tailwind CSS 4 和 weapp-tailwindcss。网络请求必须通过 `src/network.ts` 的 `Network.request`、`Network.uploadFile`、`Network.downloadFile`，由它统一拼接 `PROJECT_DOMAIN` 并附加登录 token。

### 应用 profile

`src/app.config.ts` 通过 `RECO_APP_PROFILE` 控制打包页面集：

| Profile | 标题 | 页面范围 | 常用命令 |
| --- | --- | --- | --- |
| `vehicle` | 锐途运力 | 企业端、车主端、需求方端、租赁、通知、角色切换 | `pnpm dev:weapp:vehicle`、`pnpm build:weapp:vehicle`、`pnpm build:web:vehicle` |
| `mall` | 叁友甄选 | 商城首页、分类、商品、购物车、确认订单、地址、支付成功、订单、售后、客服、我的、优惠券、积分、社区 | `pnpm dev:weapp:mall`、`pnpm build:weapp:mall`、`pnpm build:web:mall` |
| `admin` | Reco Console | 运营控制台、用户、车辆、商城、客服、订单、佣金、统计、设置 | `pnpm dev:weapp:admin`、`pnpm build:weapp:admin`、`pnpm build:web:admin` |
| `all` | 无人车共享运营平台 | 全部 Taro 页面，用于兼容和全量调试 | `pnpm dev:weapp`、`pnpm build:weapp` |

### Web 管理平台

独立 Web 管理平台由 `web-admin/vite.config.ts` 打包，入口是 `web-admin/main.tsx`，实际业务实现复用 `src/web-admin/main.tsx`。它面向运营和客服，覆盖：

- 平台总览、用户和车辆审核。
- 运力订单、佣金审核、企业和需求数据。
- 商城商品、分类、订单、配送、自提点、团长、营销、优惠券、首页配置、权限和设置。
- 客服会话、工单、知识库和售后联动。

构建产物默认输出到 `dist-web`，生产根路径 `/` 直接服务该 Web 管理平台。

### 前端目录

```text
src/
  app.config.ts              # profile 页面集和应用标题
  app.tsx                    # Taro 应用入口
  network.ts                 # 统一请求封装
  components/ui/             # Taro 版 shadcn 风格通用组件
  components/layout/         # 页面壳、底部导航、固定操作栏
  pages/enterprise/          # 企业端
  pages/owner/               # 车主端
  pages/merchant/            # 需求方端
  pages/mall/                # 商城 C 端
  pages/admin/               # Taro 运营端页面
  services/                  # 商城、支付、车主钱包等前端服务封装
  web-admin/                 # Web 管理平台 React 入口和样式
web-admin/
  index.html
  main.tsx                   # import ../src/web-admin/main
  vite.config.ts
```

## 后端

后端基于 Rust 2021、Axum、SQLx、PostgreSQL、Serde 和 Tokio。服务入口在 `server/src/runtime.rs`，路由组装在 `server/src/app.rs`。

### API 服务

| Binary | 默认端口 | 环境变量 | 路由范围 |
| --- | --- | --- | --- |
| `recorouter-api` | `SERVER_PORT`，默认 `34532` | `DATABASE_URL` | legacy 聚合服务，合并全部业务路由 |
| `vehicle-api` | `VEHICLE_API_PORT`，未设置时回退 `SERVER_PORT` 或默认端口 | `VEHICLE_DATABASE_URL`，未设置时回退 `DATABASE_URL` | 无人车、企业、车主、需求方、订单、行程、钱包、通知、管理员审核 |
| `mall-api` | `MALL_API_PORT`，未设置时回退 `SERVER_PORT` 或默认端口 | `MALL_DATABASE_URL`，未设置时回退 `DATABASE_URL` | 商城用户、商品、购物车、结算、订单、售后、客服、商城后台 |
| `platform-api` | `PLATFORM_API_PORT`，未设置时回退 `SERVER_PORT` 或默认端口 | `PLATFORM_DATABASE_URL`，未设置时回退 `DATABASE_URL` | 平台配置、支付、退款、转账、分账、审计、事件投递、COS 上传记录 |
| `recorouter-migrator` | 不监听端口 | `MIGRATION_SERVICE` + 对应数据库变量 | 单独执行 SQLx migrations，供 split API 部署先迁移后启动 |

本地开发默认使用 `recorouter-api`，生产部署使用 `vehicle-api`、`mall-api`、`platform-api` 三个 split API。split 阶段可以共用一个 `DATABASE_URL`；独立数据库准备好后再配置 `VEHICLE_DATABASE_URL`、`MALL_DATABASE_URL`、`PLATFORM_DATABASE_URL`。

### 后端模块

```text
server/
  src/app.rs                 # legacy / vehicle / mall / platform 路由边界
  src/runtime.rs             # 配置、数据库、迁移、Storage、监听端口
  src/config.rs              # 服务类型、端口、数据库和 COS 环境变量
  src/db/mod.rs              # PostgreSQL 连接池与 SQLx migrations
  src/storage/               # LocalStorage / TencentCosStorage 抽象
  src/wechat_pay.rs          # 微信支付签名、请求与回调相关能力
  src/modules/
    auth.rs                  # 登录、注册、验证码、微信登录、mall auth
    enterprise*.rs           # 企业、奶站、企业车辆、企业需求
    demands*.rs              # 需求、模板、定时发布
    vehicles.rs              # 车辆审核、位置、租赁设置
    orders.rs                # 运力订单、佣金、支付确认
    trips.rs                 # 行程、站点、自动分配、调度统计
    owner_wallet.rs          # 车主钱包、微信提现、后台处理
    mall.rs                  # 商城 C 端、商城后台、客服和售后
    platform.rs              # 公共服务数据面
    payments.rs              # 支付预下单、同步、微信回调
  migrations/                # SQLx migration，从基础业务表到商城/平台/行程/售后扩展
```

### 公共服务边界

当前公共服务集中在 `platform-api` 和共享库中：

- `platform-api` 负责可运营的数据面：平台设置、应用配置、支付单、退款单、转账单、分账计划、审计日志、事件投递和 COS 上传记录。
- `payments.rs` 提供业务支付入口：创建预支付、同步支付状态、处理微信支付回调。
- `storage/` 把文件能力抽象为 Local uploads 或 Tencent COS；`/api/uploads` 负责本地上传文件的静态访问。
- `auth.rs`、`response.rs`、`pagination.rs`、`error.rs` 等是共享代码，不单独作为服务边界。

## 数据层

- 数据库使用 PostgreSQL，Rust 侧通过 SQLx 连接池访问。
- 迁移位于 `server/migrations/`，从 `0001_init.sql` 起覆盖用户、需求、车辆、订单、平台配置、钱包、支付、商城、平台公共服务、行程、售后和优惠券等表。
- 仓库包含 `check:sqlx-migration-immutability`，已应用的 migration 不应随意改写；需要 schema 变化时新增 migration。
- 当前代码不依赖物理外键作为跨业务边界，`check:no-physical-fks` 用于防止重新引入不符合拆分方向的物理约束。

## 本地开发

### 环境要求

- Node.js >= 18
- pnpm >= 9
- Rust stable
- PostgreSQL

安装依赖：

```bash
pnpm install
```

最小 `.env.local` 示例：

```dotenv
DATABASE_URL=postgres://postgres:postgres@localhost:5432/recocar
SERVER_PORT=34532
PUBLIC_BASE_URL=http://localhost:34532
LOCAL_UPLOAD_DIR=uploads
PROJECT_DOMAIN=
```

如果需要腾讯 COS：

```dotenv
COS_SECRET_ID=
COS_SECRET_KEY=
COS_BUCKET=
COS_REGION=
```

### 启动

```bash
pnpm dev
```

`pnpm dev` 会同时启动 Web 管理平台和 legacy 后端：

- Web 管理平台：`http://localhost:5173` 或 Vite 输出的实际端口
- legacy API：`http://localhost:34532`

单独启动：

```bash
pnpm dev:web
pnpm dev:server
pnpm dev:vehicle-api
pnpm dev:mall-api
pnpm dev:platform-api
pnpm dev:weapp:vehicle
pnpm dev:weapp:mall
pnpm dev:weapp:admin
```

### 迁移

```bash
pnpm migrate:server
pnpm migrate:vehicle-api
pnpm migrate:mall-api
pnpm migrate:platform-api
```

split API 部署时推荐先运行 `recorouter-migrator`，再以 `RUN_MIGRATIONS=0` 启动三个 API，避免多个服务并发迁移。

## 构建与验证

常用构建：

```bash
pnpm build:web
pnpm build:web:vehicle
pnpm build:web:mall
pnpm build:weapp:vehicle
pnpm build:weapp:mall
pnpm build:apis
cargo build --manifest-path server/Cargo.toml --release --locked --bins
```

常用验证：

```bash
pnpm lint:build
pnpm tsc
pnpm test:service-routers
pnpm validate:split
pnpm validate
```

`pnpm validate` 是仓库级前端/脚本检查入口，会跑 lint、TypeScript、migration immutability、网络请求规范、商城体验、Web 管理平台权限和运营工作台等脚本。

## 生产部署

生产部署说明在 `deploy/README.md`。当前目标：

| 项 | 值 |
| --- | --- |
| Host | `62.234.29.88` |
| Domain | `car.shcxyz.site` |
| App root | `/opt/recorouter` |
| Web admin | `/opt/recorouter/current/dist-web` |
| Split API ports | `vehicle-api=34533`、`mall-api=34534`、`platform-api=34535` |
| H5 demo ports | vehicle `18081`、mall `18082` |

自动部署 workflow：

- `.github/workflows/deploy-prod.yml`：main 分支相关路径变更后构建 Web 管理平台、vehicle H5、mall H5 和 Rust API，打包并安装到生产服务器，最后验证 `/api/health`。
- `.github/workflows/publish-miniapp.yml`：手动发布小程序，或在 `WEAPP_UPLOAD_ON_MAIN=true` 时随 main 发布；上传动作在服务器执行，确保微信看到固定上传 IP。

本地构建 Docker release 包：

```bash
deploy/make-docker-release.sh
```

## 开发约束

- 包管理器必须使用 pnpm。
- 前端通用 UI 优先使用 `src/components/ui/*`，不要在页面中临时手搓按钮、表单、弹窗、卡片、表格、Tabs 等通用组件。
- 业务请求必须走 `Network` 封装，避免绕过域名拼接、鉴权 header 和 GET 参数清洗。
- 除微信小程序 TabBar 强制本地 PNG 外，图片/视频等静态资源应通过对象存储管理。
- 样式默认优先 Tailwind；CSS 只用于动画、复杂选择器、第三方覆盖或框架兼容。
- 提交信息遵守 commitlint，例如 `docs: update architecture readme`。
