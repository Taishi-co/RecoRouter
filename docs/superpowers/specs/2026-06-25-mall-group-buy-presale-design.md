# 叁友甄选集采预售设计

## 背景

叁友甄选需要新增“集采预售”能力。运营发起类似团购预售的活动，用户先按认购数量支付定金；活动达到运营配置的采购门槛后，系统按最终累计数量命中的阶梯价格计算尾款；用户支付尾款后等待到货。未成团时，定金原路退回。

第一版集采不作为普通优惠券或普通营销活动的一个规则项实现，而是作为独立业务流程实现。原因是集采包含活动成团、定金、尾款、退款、信用分、运营强制动作和后续普通商城订单生成，状态复杂度高于满减、满折、一口价等即时营销。

## 已确认业务口径

1. 第一版一个集采活动只绑定一个商品和一个售卖规格。
2. 集采单位继承商品售卖规格单位，运营不能在活动中另改单位。
3. 活动最终价格按累计数量命中的最高阶梯统一结算，所有有效认购用户同价。
4. 定金规则由运营按活动配置，支持按认购金额比例、按单位固定金额、按单固定金额。
5. 用户信用分复用现有 `users.credit_score`，新用户默认 100 分。
6. 活动可配置最低信用分，低于门槛的用户不能报名。
7. 用户已付定金但尾款逾期未支付，系统自动取消该用户认购、扣信用分、释放认购数量。
8. 活动已经成团后，部分用户尾款逾期不应自动取消已付尾款用户的资格。是否继续采购由运营确认。
9. 未成团或运营取消时，定金和尾款按原支付路径退款。
10. 用户付清尾款后，再生成普通商城订单进入配送、售后和订单详情流程。

## 业务状态

### 集采活动状态

- `draft`：草稿，仅管理端可见。
- `published`：已发布，等待开始。
- `enrolling`：报名中，用户可支付定金。
- `formed_pending_balance`：已成团待尾款，系统锁定最终档位价格。
- `balance_closing`：尾款截止处理中，系统处理逾期认购。
- `ops_review`：待运营确认，通常发生在尾款逾期释放数量后低于采购门槛。
- `procuring`：待采购或待到货。
- `completed`：活动完成。
- `offline`：运营强制下线。
- `failed_refunding`：未成团退款中。
- `failed_refunded`：未成团已退款。
- `cancelled_refunding`：运营取消退款中。
- `cancelled`：已取消。

### 用户认购单状态

- `pending_deposit`：待付定金。
- `deposit_paid`：已付定金，等待成团。
- `pending_balance`：待付尾款。
- `balance_paid`：已付尾款。
- `order_created`：已生成普通商城订单。
- `deposit_refunding`：定金退款中。
- `deposit_refunded`：定金已退。
- `balance_overdue_cancelled`：尾款逾期取消。
- `activity_cancel_refunding`：活动取消退款中。
- `refunded`：已退款。

## 数据模型

### `mall_group_buy_activities`

活动主表。

核心字段：

- `id`
- `name`
- `product_id`
- `variant_id`
- `unit_name`
- `status`
- `starts_at`
- `ends_at`
- `balance_due_at`
- `min_group_quantity`
- `max_quantity_per_user`，为空表示不限量。
- `min_credit_score`
- `overdue_credit_penalty`
- `deposit_type`：`percent`、`unit_fixed`、`order_fixed`。
- `deposit_value`
- `tiers`：阶梯价格数组，例如 `[{ "quantity": 100, "priceCents": 300 }, { "quantity": 200, "priceCents": 200 }]`。
- `formed_quantity`
- `final_tier_quantity`
- `final_unit_price_cents`
- `ops_review_reason`
- `created_by`
- `created_at`
- `updated_at`

### `mall_group_buy_subscriptions`

用户认购单。

核心字段：

- `id`
- `activity_id`
- `user_id`
- `quantity`
- `unit_name`
- `status`
- `estimated_unit_price_cents`
- `final_unit_price_cents`
- `estimated_total_cents`
- `deposit_cents`
- `balance_cents`
- `deposit_payment_id`
- `balance_payment_id`
- `deposit_paid_at`
- `balance_paid_at`
- `mall_order_id`
- `cancel_reason`
- `credit_penalty_points`
- `created_at`
- `updated_at`

同一用户在同一活动下第一版只保留一张有效认购单。用户想追加数量时，优先更新认购数量并重算定金差额；如果已进入尾款阶段，则不允许追加。

### `mall_group_buy_events`

活动和认购流水。

记录发布、强制下线、强制成团、尾款逾期处理、运营确认继续采购、取消退款、用户支付定金、用户支付尾款等关键事件。

### `mall_credit_ledger`

商城信用分流水。

核心字段：

- `id`
- `user_id`
- `source_type`：第一版使用 `mall_group_buy`。
- `source_id`
- `delta`
- `score_before`
- `score_after`
- `reason`
- `created_by`
- `created_at`

信用分实际值仍落在 `users.credit_score`。

## 后端接口

### 用户端接口

- `GET /api/mall/group-buys`：集采活动列表。
- `GET /api/mall/group-buys/:id`：集采活动详情。
- `POST /api/mall/group-buys/:id/subscribe`：创建或更新认购，返回定金支付信息。
- `POST /api/mall/group-buy-subscriptions/:id/pay-deposit`：发起定金支付。
- `POST /api/mall/group-buy-subscriptions/:id/pay-balance`：发起尾款支付。
- `GET /api/mall/me/group-buy-subscriptions`：我的集采。

### 管理端接口

- `GET /api/admin/mall/group-buys`：活动列表。
- `POST /api/admin/mall/group-buys`：创建活动。
- `PUT /api/admin/mall/group-buys/:id`：编辑活动。
- `POST /api/admin/mall/group-buys/:id/publish`：发布活动。
- `POST /api/admin/mall/group-buys/:id/offline`：强制下线。
- `POST /api/admin/mall/group-buys/:id/force-form`：强制成团。
- `POST /api/admin/mall/group-buys/:id/extend`：延期。
- `POST /api/admin/mall/group-buys/:id/cancel`：取消并退款。
- `POST /api/admin/mall/group-buys/:id/confirm-procurement`：确认继续采购。
- `GET /api/admin/mall/group-buys/:id/subscriptions`：认购用户列表。

### 支付业务类型

支付服务新增业务类型：

- `mall_group_buy_deposit`
- `mall_group_buy_balance`

支付回调或同步成功后，后端根据业务类型更新认购单状态。尾款支付成功后，若活动处于可采购状态，则生成普通商城订单。

## 前端设计

### 小程序端

新增页面：

- 集采列表页：展示活动状态、阶梯价、当前已团数量、倒计时。
- 集采详情页：展示商品、规格单位、阶梯价、当前进度、定金规则、尾款规则、信用分门槛、每人上限。
- 我的集采页：展示待付定金、待成团、待付尾款、待到货、退款中和已退款。

首页营销区增加集采入口。活动卡片要突出当前最低可达价格、已团数量和成团进度，不要做成普通商品卡片。

用户报名时：

1. 校验登录状态。
2. 校验用户信用分。
3. 校验活动状态和报名时间。
4. 校验每人上限。
5. 创建认购单并进入定金支付。

### Web 管理端

在“商城业务 / 营销中心”增加“集采预售”。

页面包含：

- 活动列表：活动名称、商品规格、当前数量、成团门槛、最终档位、已付定金人数、尾款完成率、状态、活动时间。
- 创建和编辑弹窗：选择商品规格、配置阶梯价格、定金规则、每人上限、最低信用分、尾款期限、逾期扣分。
- 活动详情弹窗：认购用户、认购数量、定金状态、尾款状态、信用分扣减、退款状态。
- 活动操作：发布、强制下线、强制成团、延期、取消并退款、确认继续采购。

## 定时任务和自动处理

需要增加后台任务或复用现有任务框架：

1. 活动开始时，将 `published` 活动推进到 `enrolling`。
2. 活动结束时，检查是否成团。
3. 未成团活动进入退款流程。
4. 成团活动计算最终阶梯价格，并将有效认购单推进到 `pending_balance`。
5. 尾款截止后，取消逾期认购，扣信用分，记录信用流水。
6. 如果实际已付尾款数量低于采购门槛，活动进入 `ops_review`。
7. 运营确认继续采购后，为已付尾款用户生成普通商城订单。

第一版如果没有独立 worker，可以在服务启动任务或管理端操作入口触发补偿处理，但接口必须保持幂等。

## 错误处理

- 信用分不足：返回明确错误，提示当前信用分和活动最低要求。
- 活动已结束或已下线：不允许报名和支付定金。
- 超过每人上限：返回最大可认购数量。
- 支付成功但状态已变化：接口幂等处理，不重复创建认购单或普通订单。
- 退款失败：活动或认购单保留 `refunding` 状态，管理端展示失败原因，允许重试。
- 尾款逾期扣分：同一认购单只能扣一次，通过信用流水和认购单状态防重。

## 测试计划

### 后端

- 创建活动、编辑活动、发布活动。
- 阶梯价格选择：100 斤档、200 斤档、未达门槛。
- 定金计算：比例、按单位固定、按单固定。
- 信用分门槛拦截。
- 每人认购上限拦截。
- 定金支付成功后状态更新。
- 成团后统一最终价格。
- 尾款支付成功后生成普通商城订单。
- 尾款逾期取消、扣信用分、释放数量。
- 未成团退款流程。
- 运营取消退款流程。
- 幂等：重复支付回调、重复强制成团、重复确认采购。

### 小程序

- 集采列表和详情展示真实接口数据。
- 低信用分用户不能报名。
- 用户报名后能完成定金支付。
- 成团后能看到尾款待支付入口。
- 付清尾款后能进入普通商城订单。
- 未成团或取消活动时展示退款状态。

### Web 管理端

- 活动 CRUD。
- 阶梯价格动态增删。
- 定金规则切换后字段正确展示。
- 强制下线、强制成团、延期、取消、确认采购均有成功或失败提示。
- 认购列表、尾款完成率和风险状态展示正确。

## 第一版不做

- 一个活动绑定多个商品规格。
- 商品组集采。
- 多批次早鸟价。
- 团长专属集采。
- 自动采购单对接供应商。
- 信用分申诉流程。

这些能力保留为后续扩展，不进入第一版实现范围。
