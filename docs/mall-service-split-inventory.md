# Mall Service Split Inventory

盘点基准：当前工作树位于 `codex/mall-web-ops-deploy` 分支。当前代码仍是单体 Rust API + 单个 Taro 应用，本文按目标架构重新归类能力，用于安排后续开发计划。

## Target Boundary

目标不是简单把商城换一个小程序入口，而是拆成三个后端边界：

| 服务 | 责任 |
| --- | --- |
| `vehicle-api` / `recorouter-api` | B 端无人车业务：企业、车主、需求方、车辆、运单、佣金、租赁、奶站 |
| `mall-api` | C 端商城业务：商城用户、商品、购物车、订单、售后、客服、商城后台 |
| `platform-api` | 公共交易和基础能力：支付、退款、转账/分账、支付通知、支付流水、COS 上传凭证、审计 |

公共代码不要全部做成运行时服务。日志、配置、错误响应、微信签名、COS SDK 封装等可以先放 `shared` 库；支付、退款、转账、幂等、审计这类跨业务且需要统一流水的能力放 `platform-api`。

## Shared Infrastructure

Redis、PostgreSQL、COS 可以共用实例，但不能共用业务命名空间。

| 基础设施 | 建议 |
| --- | --- |
| PostgreSQL | 同实例可行；优先三个 database，其次三个 schema：`vehicle`、`mall`、`platform` |
| Redis | 同实例可行；必须使用 key 前缀：`vehicle:*`、`mall:*`、`platform:*` |
| COS | 同 bucket 可行；必须使用 key 前缀：`vehicle/*`、`mall/*`、`platform/*` |

权限要求：

- `vehicle-api` 只能访问无人车库表。
- `mall-api` 只能访问商城库表。
- `platform-api` 只能访问支付、退款、转账、审计流水库表。
- `platform-api` 不直接修改 `mall_orders` 或无人车 `orders`，支付成功后通过事件或回调通知业务服务。

## 1. Existing Capability, No Migration Needed

这些能力保留在 `vehicle-api`。后续如果拆目录或 Cargo workspace，只需要随无人车服务一起保留，不进入商城或公共服务。

| 能力 | 当前位置 | 目标归属 | 备注 |
| --- | --- | --- | --- |
| B 端注册、登录、图形验证码、用户信息 | `server/src/modules/auth.rs` | `vehicle-api` | 商城需要独立 `mall_auth`，不要复用 B 端 `users.role` |
| B 端角色切换 | `server/src/modules/user_roles.rs` | `vehicle-api` | 只服务企业/车主/需求方 |
| 账号设置 | `server/src/modules/account_settings.rs` | `vehicle-api` | B 端账号能力 |
| 企业端 | `server/src/modules/enterprise*.rs` | `vehicle-api` | 企业、调度、车队、企业需求 |
| 车主/车辆 | `server/src/modules/vehicles.rs`、`enterprise_vehicles.rs` | `vehicle-api` | 无人车资产与状态 |
| 奶站/站点 | `server/src/modules/station.rs` | `vehicle-api` | B 端履约网络 |
| 需求方需求 | `server/src/modules/demands.rs` | `vehicle-api` | B 端运输需求 |
| 运单与取消 | `server/src/modules/orders.rs`、`cancellations.rs` | `vehicle-api` | 支付成功处理需改为接收 `platform-api` 事件 |
| 运价计算 | `server/src/modules/fare.rs` | `vehicle-api` | B 端专属 |
| 车辆租赁 | `server/src/modules/vehicle_rentals.rs`、`rental_reminders.rs` | `vehicle-api` | B 端专属 |
| B 端地址簿/常用线路/模板/定时发布 | `address_books.rs`、`favorite_routes.rs`、`demand_templates.rs`、`demand_schedules.rs` | `vehicle-api` | 商城需要独立地址表 |
| B 端通知 | `server/src/modules/notifications.rs` | `vehicle-api` | 商城通知另建或后续统一消息服务 |
| 非商城运营后台 | `src/pages/admin/users`、`vehicles`、`orders`、`commission`、`stats`、`settings` | B 端后台 | 移除商城入口即可 |

## 2. Existing Capability, Move To Public Service

这些能力已经有代码，但现在混在单体后端中。拆服务时应迁到 `platform-api` 或 `shared`。

| 能力 | 当前位置 | 目标归属 | 改造点 |
| --- | --- | --- | --- |
| 微信支付签名、通知解密、私钥加载 | `server/src/wechat_pay.rs` | `shared` 或 `platform-api` | 支持多 AppID 配置 |
| `code2session` 换 openid | `server/src/wechat_pay.rs` | `platform-api` 或各业务 auth | 如果由平台统一做，需要区分 `vehicle`/`mall` appid |
| 支付单、预支付、查单、支付通知 | `server/src/modules/payments.rs` | `platform-api` | 不能再直接查 `orders` / `mall_orders` |
| 支付表 | `server/migrations/0007_payments.sql` | `platform` DB/schema | 增加业务回调、幂等键、应用来源 |
| 微信商家转账底层能力 | `server/src/modules/owner_wallet.rs` | `platform-api` | 钱包账本仍可留 B 端，微信转账调用与通知进平台 |
| COS/local storage 抽象 | `server/src/storage/*` | `shared`，可加 `platform-api` 上传凭证 | 第一阶段可共享库，后续再服务化上传凭证 |
| 通用响应、错误、配置、健康检查 | `server/src/response.rs`、`error.rs`、`config.rs`、`health.rs` | `shared` | 不需要独立服务 |
| 运行日志基础 | `tracing_subscriber` in `main.rs` | `shared` + 部署采集 | 暂不做独立日志服务 |

当前 `payments.rs` 的问题：它包含公共支付逻辑，同时通过 `fetch_payable_order` 和 `mark_payment_success` 直接读写无人车订单表、商城订单表。拆分后应变为：

1. 业务服务向 `platform-api` 创建支付请求。
2. `platform-api` 创建平台支付单并调用微信。
3. 微信通知进入 `platform-api`。
4. `platform-api` 用事件或回调通知 `mall-api` / `vehicle-api`。
5. 业务服务自己修改业务订单状态。

## 3. Existing Capability, Needs Migration Or Refactor

这些能力已经存在，但目标归属是 `mall-api` 或独立商城小程序，不能原样继续放在无人车单体里。

| 能力 | 当前位置 | 目标归属 | 改造点 |
| --- | --- | --- | --- |
| 商城分类/商品/购物车/订单/售后/客服/活动/设置 | `server/src/modules/mall.rs` | `mall-api` | 拆模块，去掉对 B 端 `users`、`address_books` 的依赖 |
| 商城表结构 | `server/migrations/0009_mall_operations_support.sql`、`0010_seed_mall_image_products.sql` | `mall` DB/schema | 迁移到商城库，旧 migration 不回改 |
| 商城小程序页面 | `src/pages/mall/*` | 独立商城小程序 | 单独 `app.config`、appid、tabbar、构建和上传 |
| 商城前端 service | `src/services/mall.ts` | 商城小程序 | base URL 指向 `mall-api` |
| 支付前端 service | `src/services/payment.ts` | 共享前端 SDK 或商城/无人车各自 service | 改为调用 `platform-api` |
| 商城运营页 | `src/pages/admin/mall` | 商城后台 | 后台请求指向 `mall-api` |
| 客服工作台 | `src/pages/admin/support`、`src/pages/mall/support` | `mall-api` + 商城后台/小程序 | 当前客服属于商城，不进 B 端 |
| 商城订单派单 | `admin_dispatch_order` in `mall.rs` | `mall-api` | 第一阶段保留手动派单；如果后续接无人车履约，再用接口对接 B 端 |
| 商城退款状态 | `admin_refund_order` in `mall.rs` | `mall-api` + `platform-api` | 当前只改状态，需接真实微信退款 |
| 商城支付成功处理 | `settle_mall_order_payment_success` in `mall.rs` | `mall-api` | 改为接收 `platform-api` 支付成功事件 |

## 4. Missing Capability, Add To Mall

这些能力当前不足或没有，应该进入 `mall-api` / 商城小程序。

| 能力 | 归属 | 优先级 | 说明 |
| --- | --- | --- | --- |
| 商城用户体系 | `mall-api` | P0 | `mall_users`，微信登录，手机号绑定，session |
| 商城地址 | `mall-api` | P0 | `mall_addresses`，不要复用 B 端地址簿 |
| 独立商城小程序构建 | 商城小程序 | P0 | 独立 appid、页面列表、tabbar、上传脚本 |
| 库存并发安全 | `mall-api` | P0 | 原子扣减，避免并发超卖 |
| 未支付超时关单 | `mall-api` | P0 | 定时任务或延迟队列，释放库存 |
| 取消/退款库存回滚 | `mall-api` | P0 | 支付前取消、支付后退款分别处理 |
| 真实退款业务流 | `mall-api` | P0 | 申请、审核、调用 `platform-api`、回写状态 |
| 优惠/活动后端校验 | `mall-api` | P1 | 当前 `coupon_cents` 可由前端传入，风险较高 |
| 商品图片上传入口 | `mall-api` + `platform-api`/COS | P1 | 后台上传商品图，保存 `mall/products/*` |
| 商城后台账号和权限 | `mall-api` | P1 | 商品、订单、退款、客服权限 |
| 商城订单审计 | `mall-api` | P1 | 订单状态变更、退款审核、客服处理 |
| 商城通知 | `mall-api` | P2 | 订单状态、退款状态、客服提醒 |

## 5. Missing Capability, Add To Public Service

这些是 `platform-api` 的核心增量。

| 能力 | 归属 | 优先级 | 说明 |
| --- | --- | --- | --- |
| 服务间鉴权 | `platform-api` | P0 | `mall-api` / `vehicle-api` 调平台不能裸调 |
| 通用支付请求模型 | `platform-api` | P0 | `business_type`、`business_id`、`app_id`、`callback_url`、幂等键 |
| 多 AppID 支付配置 | `platform-api` | P0 | 同一商户号，不同小程序 appid |
| 支付事件投递与重试 | `platform-api` | P0 | 通知业务服务，失败可重试 |
| 微信退款 API | `platform-api` | P0 | 申请退款、查退款、退款通知 |
| 支付通知幂等 | `platform-api` | P0 | 重复微信通知不能重复落账 |
| 平台支付流水 | `platform-api` | P0 | 支付、退款、转账统一流水 |
| COS 上传凭证或上传代理 | `platform-api` | P1 | 统一 key namespace 和权限 |
| 审计日志 | `platform-api` | P1 | 记录支付、退款、转账、关键配置修改 |
| 下载账单/对账 | `platform-api` | P2 | 可第二期做，但表结构最好预留 |
| 分账 | `platform-api` | P2 | 如果商城首发不依赖，第二期做 |

## 6. Missing Capability, Add To Vehicle

拆出 `platform-api` 后，无人车侧需要补这些适配能力。

| 能力 | 归属 | 优先级 | 说明 |
| --- | --- | --- | --- |
| 运费支付成功事件处理 | `vehicle-api` | P0 | 替代当前 `payments.rs` 直接调用 `orders::settle_order_fare_payment_success` |
| 佣金支付成功事件处理 | `vehicle-api` | P0 | 替代当前公共支付模块直接改 `orders` |
| 转账/提现事件处理 | `vehicle-api` | P0 | 平台转账状态变化后回写 B 端钱包/提现状态 |
| 支付兼容层 | `vehicle-api` | P0 | 前端老接口迁移到 `platform-api` 或增加代理 |
| B 端后台导航清理 | B 端前端 | P1 | 移除商城入口和客服入口 |
| 独立部署配置 | `vehicle-api` | P1 | 独立端口、DB/schema、健康检查、回滚 |
| 真实无人车平台对接 | `vehicle-api` | P2 | 车辆绑定、轨迹、调度、状态同步，和商城无关 |

## 7. Other Notes

- 第一阶段建议同 repo 拆服务，不建议一开始拆成多个 repo。
- 旧 SQLx migration 不要改，新增迁移完成拆库/拆 schema。
- `platform-api` 不要包含商品、车辆、订单状态机等业务逻辑。
- `mall-api` 不直接访问无人车库表。
- `vehicle-api` 不直接访问商城库表。
- Redis 只放缓存、锁、幂等、短期状态；支付、退款、转账的最终状态必须在 PostgreSQL。
- COS 可以共 bucket，但前缀必须隔离：`mall/products/*`、`mall/refunds/*`、`vehicle/photos/*`、`platform/payment-qrs/*`。
- 如果 15 天上线，公共服务第一期只做支付、退款、转账底层、COS 凭证、审计基础；分账和完整对账放第二期。

## Suggested Work Allocation

| 角色 | 主要任务 |
| --- | --- |
| A | 商城小程序 + `mall-api` 业务主链路：用户、商品、购物车、订单、售后 |
| B | `vehicle-api` 清理和兼容：移除商城耦合、接入平台支付事件、保证 B 端稳定 |
| C | `platform-api` + 交付：支付/退款/转账/COS/服务间鉴权/部署/联调 |

## First Milestone

第一期上线目标：

- C 端商城独立小程序。
- `mall-api` 独立运行，使用独立商城 DB/schema。
- `platform-api` 统一支付、退款、转账底层和微信通知。
- `vehicle-api` 保持 B 端无人车业务稳定。
- Redis、PostgreSQL、COS 共用实例但逻辑隔离。

第一期不做：

- 完整分账系统。
- 完整财务对账中心。
- 自动无人车配送调度接入商城。
- B/C 用户体系打通。
- 全新独立客服 IM。
