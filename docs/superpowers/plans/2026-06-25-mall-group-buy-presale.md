# Mall Group Buy Presale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first version of 叁友甄选集采预售: one activity binds one product variant, users pay deposit first, final tier price is unified by formed quantity, users pay balance after forming, overdue balance cancels that user's subscription and deducts credit score, and paid subscriptions become normal mall orders.

**Architecture:** Add a dedicated mall group-buy presale model instead of folding it into generic campaigns. Backend owns activity/subscription state, credit ledger, payment callbacks, and ordinary mall order generation. The mall miniapp and web admin consume explicit group-buy APIs and do not duplicate state machine logic.

**Tech Stack:** Rust/Axum/sqlx/PostgreSQL backend, Taro React miniapp, standalone React web admin, Node static check scripts, existing `payments` table and WeChat payment flow.

---

## File Structure

- Create `server/migrations/0042_mall_group_buy_presale.sql`: group-buy tables, indexes, JSON helpers, and seed activity.
- Modify `server/src/modules/mall.rs`: public and admin routes, data structs, validators, state transitions, credit ledger helpers, order generation helper.
- Modify `server/src/modules/payments.rs`: add `mall_group_buy_deposit` and `mall_group_buy_balance` payment business types.
- Modify `src/services/payment.ts`: extend `PaymentBusinessType` union.
- Modify `src/services/mall.ts`: add group-buy types and API client functions.
- Modify `src/app.config.ts`: register mall group-buy pages.
- Create `src/pages/mall/group-buy/index.config.ts`, `src/pages/mall/group-buy/index.tsx`: group-buy list.
- Create `src/pages/mall/group-buy/detail.config.ts`, `src/pages/mall/group-buy/detail.tsx`: group-buy detail and subscription flow.
- Create `src/pages/mall/group-buy/my.config.ts`, `src/pages/mall/group-buy/my.tsx`: user's group-buy subscriptions.
- Modify `src/pages/mall/index/index.tsx`: add a visible group-buy entrance.
- Modify `src/pages/mall/profile/index.tsx`: add "我的集采" entry.
- Modify `src/pages/mall/mall-theme.css`: group-buy miniapp styles.
- Modify `src/web-admin/main.tsx`: load group-buy data, add menu item, activity CRUD, actions, subscription detail modal.
- Modify `src/web-admin/styles.css`: group-buy admin styles.
- Create `scripts/check-mall-group-buy-presale.mjs`: static guard for routes, business types, pages, and admin wiring.
- Modify `package.json`: add `check:mall-group-buy-presale` and include it in `validate`.

## Current Worktree Rule

The current checkout has unrelated uncommitted mall/payment/frontend changes. Before implementing, create an isolated worktree or make sure the execution agent explicitly scopes every `git add` to group-buy files only. Do not stage the existing dirty files unless the user asks to include them.

Recommended execution preflight:

```bash
git status --short --branch
git fetch recorouter main
git worktree add /tmp/recorouter-group-buy-presale -b codex/mall-group-buy-presale recorouter/main
cd /tmp/recorouter-group-buy-presale
```

Expected: clean new worktree on `codex/mall-group-buy-presale`.

---

### Task 1: Database Schema And Static Guard

**Files:**
- Create: `server/migrations/0042_mall_group_buy_presale.sql`
- Create: `scripts/check-mall-group-buy-presale.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing static guard**

Create `scripts/check-mall-group-buy-presale.mjs` with these checks:

```js
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const assert = (condition, message) => {
  if (!condition) {
    console.error(`FAIL ${message}`)
    process.exitCode = 1
  } else {
    console.log(`PASS ${message}`)
  }
}

const migration = read('server/migrations/0042_mall_group_buy_presale.sql')
const mall = read('server/src/modules/mall.rs')
const payments = read('server/src/modules/payments.rs')
const mallService = read('src/services/mall.ts')
const paymentService = read('src/services/payment.ts')
const appConfig = read('src/app.config.ts')
const admin = read('src/web-admin/main.tsx')
const packageJson = JSON.parse(read('package.json'))

for (const table of [
  'mall_group_buy_activities',
  'mall_group_buy_subscriptions',
  'mall_group_buy_events',
  'mall_credit_ledger',
]) {
  assert(migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), `${table} table exists`)
}

for (const businessType of ['mall_group_buy_deposit', 'mall_group_buy_balance']) {
  assert(migration.includes(businessType), `${businessType} migration reference exists`)
  assert(payments.includes(businessType), `${businessType} backend payment type exists`)
  assert(paymentService.includes(businessType), `${businessType} frontend payment type exists`)
}

for (const route of [
  '/api/mall/group-buys',
  '/api/mall/group-buy-subscriptions/:id/pay-deposit',
  '/api/mall/group-buy-subscriptions/:id/pay-balance',
  '/api/admin/mall/group-buys',
  '/api/admin/mall/group-buys/:id/confirm-procurement',
]) {
  assert(mall.includes(route), `${route} route is wired`)
}

for (const page of [
  'pages/mall/group-buy/index',
  'pages/mall/group-buy/detail',
  'pages/mall/group-buy/my',
]) {
  assert(appConfig.includes(page), `${page} is registered`)
}

for (const apiName of [
  'listMallGroupBuys',
  'getMallGroupBuy',
  'subscribeMallGroupBuy',
  'payMallGroupBuyDeposit',
  'payMallGroupBuyBalance',
  'listMyMallGroupBuySubscriptions',
]) {
  assert(mallService.includes(`function ${apiName}`) || mallService.includes(`const ${apiName}`), `${apiName} service exists`)
}

assert(admin.includes('mall.groupBuyPresale'), 'web admin group-buy page key exists')
assert(packageJson.scripts['check:mall-group-buy-presale'] === 'node scripts/check-mall-group-buy-presale.mjs', 'package script exists')
assert(packageJson.scripts.validate.includes('check:mall-group-buy-presale'), 'validate includes group-buy check')

if (process.exitCode) process.exit(process.exitCode)
```

- [ ] **Step 2: Run the guard and verify it fails**

Run:

```bash
node scripts/check-mall-group-buy-presale.mjs
```

Expected: FAIL lines for missing migration, routes, payment types, pages, services, admin key, and package script.

- [ ] **Step 3: Add the migration**

Create `server/migrations/0042_mall_group_buy_presale.sql`:

```sql
CREATE TABLE IF NOT EXISTS mall_group_buy_activities (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  product_id text NOT NULL,
  variant_id text,
  unit_name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  balance_due_at timestamptz,
  min_group_quantity integer NOT NULL CHECK (min_group_quantity > 0),
  max_quantity_per_user integer CHECK (max_quantity_per_user IS NULL OR max_quantity_per_user > 0),
  min_credit_score integer NOT NULL DEFAULT 80 CHECK (min_credit_score >= 0),
  overdue_credit_penalty integer NOT NULL DEFAULT 10 CHECK (overdue_credit_penalty >= 0),
  deposit_type text NOT NULL DEFAULT 'percent',
  deposit_value integer NOT NULL DEFAULT 20 CHECK (deposit_value >= 0),
  tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  formed_quantity integer NOT NULL DEFAULT 0,
  final_tier_quantity integer,
  final_unit_price_cents bigint,
  ops_review_reason text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mall_group_buy_activities_status_time_idx
  ON mall_group_buy_activities (status, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS mall_group_buy_activities_product_idx
  ON mall_group_buy_activities (product_id, variant_id);

CREATE TABLE IF NOT EXISTS mall_group_buy_subscriptions (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  activity_id text NOT NULL,
  user_id text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending_deposit',
  estimated_unit_price_cents bigint NOT NULL DEFAULT 0,
  final_unit_price_cents bigint,
  estimated_total_cents bigint NOT NULL DEFAULT 0,
  deposit_cents bigint NOT NULL DEFAULT 0,
  balance_cents bigint NOT NULL DEFAULT 0,
  deposit_payment_id text,
  balance_payment_id text,
  deposit_paid_at timestamptz,
  balance_paid_at timestamptz,
  mall_order_id text,
  cancel_reason text,
  credit_penalty_points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mall_group_buy_subscriptions_active_user_uidx
  ON mall_group_buy_subscriptions (activity_id, user_id)
  WHERE status NOT IN ('deposit_refunded', 'balance_overdue_cancelled', 'activity_cancel_refunding', 'refunded');
CREATE INDEX IF NOT EXISTS mall_group_buy_subscriptions_activity_status_idx
  ON mall_group_buy_subscriptions (activity_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS mall_group_buy_subscriptions_user_idx
  ON mall_group_buy_subscriptions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS mall_group_buy_events (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  activity_id text,
  subscription_id text,
  event_type text NOT NULL,
  title text NOT NULL,
  description text,
  actor_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mall_group_buy_events_activity_idx
  ON mall_group_buy_events (activity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mall_group_buy_events_subscription_idx
  ON mall_group_buy_events (subscription_id, created_at DESC);

CREATE TABLE IF NOT EXISTS mall_credit_ledger (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL,
  source_type text NOT NULL,
  source_id text NOT NULL,
  delta integer NOT NULL,
  score_before integer NOT NULL,
  score_after integer NOT NULL,
  reason text NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mall_credit_ledger_source_uidx
  ON mall_credit_ledger (source_type, source_id, reason);
CREATE INDEX IF NOT EXISTS mall_credit_ledger_user_idx
  ON mall_credit_ledger (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION mall_group_buy_activity_json(activity mall_group_buy_activities)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', activity.id,
    'name', activity.name,
    'productId', activity.product_id,
    'variantId', activity.variant_id,
    'unitName', activity.unit_name,
    'status', activity.status,
    'startsAt', activity.starts_at,
    'endsAt', activity.ends_at,
    'balanceDueAt', activity.balance_due_at,
    'minGroupQuantity', activity.min_group_quantity,
    'maxQuantityPerUser', activity.max_quantity_per_user,
    'minCreditScore', activity.min_credit_score,
    'overdueCreditPenalty', activity.overdue_credit_penalty,
    'depositType', activity.deposit_type,
    'depositValue', activity.deposit_value,
    'tiers', activity.tiers,
    'formedQuantity', activity.formed_quantity,
    'finalTierQuantity', activity.final_tier_quantity,
    'finalUnitPriceCents', activity.final_unit_price_cents,
    'opsReviewReason', activity.ops_review_reason,
    'createdBy', activity.created_by,
    'createdAt', activity.created_at,
    'updatedAt', activity.updated_at
  );
$$;

CREATE OR REPLACE FUNCTION mall_group_buy_subscription_json(subscription mall_group_buy_subscriptions)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', subscription.id,
    'activityId', subscription.activity_id,
    'userId', subscription.user_id,
    'quantity', subscription.quantity,
    'unitName', subscription.unit_name,
    'status', subscription.status,
    'estimatedUnitPriceCents', subscription.estimated_unit_price_cents,
    'finalUnitPriceCents', subscription.final_unit_price_cents,
    'estimatedTotalCents', subscription.estimated_total_cents,
    'depositCents', subscription.deposit_cents,
    'balanceCents', subscription.balance_cents,
    'depositPaymentId', subscription.deposit_payment_id,
    'balancePaymentId', subscription.balance_payment_id,
    'depositPaidAt', subscription.deposit_paid_at,
    'balancePaidAt', subscription.balance_paid_at,
    'mallOrderId', subscription.mall_order_id,
    'cancelReason', subscription.cancel_reason,
    'creditPenaltyPoints', subscription.credit_penalty_points,
    'createdAt', subscription.created_at,
    'updatedAt', subscription.updated_at
  );
$$;
```

- [ ] **Step 4: Wire package script**

Add this script entry to `package.json`:

```json
"check:mall-group-buy-presale": "node scripts/check-mall-group-buy-presale.mjs"
```

Also add `\"pnpm check:mall-group-buy-presale\"` to the `validate` script's concurrently command list.

- [ ] **Step 5: Run schema guard until only code/UI checks fail**

Run:

```bash
node scripts/check-mall-group-buy-presale.mjs
```

Expected: table checks and package script checks pass; route, service, payment, page, and admin checks still fail.

- [ ] **Step 6: Commit**

```bash
git add server/migrations/0042_mall_group_buy_presale.sql scripts/check-mall-group-buy-presale.mjs package.json
git commit -m "Add mall group buy schema"
```

---

### Task 2: Backend Group-Buy State Machine And APIs

**Files:**
- Modify: `server/src/modules/mall.rs`
- Test: `server/src/modules/mall.rs` test module

- [ ] **Step 1: Add failing unit tests for pricing and deposit calculation**

Extend the `#[cfg(test)]` section in `server/src/modules/mall.rs` with tests:

```rust
#[test]
fn group_buy_final_tier_uses_highest_matched_quantity() {
    let tiers = vec![
        GroupBuyTier { quantity: 100, price_cents: 300 },
        GroupBuyTier { quantity: 200, price_cents: 200 },
    ];
    let tier = select_group_buy_tier(&tiers, 230).expect("tier");
    assert_eq!(tier.quantity, 200);
    assert_eq!(tier.price_cents, 200);
}

#[test]
fn group_buy_deposit_supports_percent_unit_and_order_modes() {
    assert_eq!(calculate_group_buy_deposit_cents("percent", 20, 30, 300), 1_800);
    assert_eq!(calculate_group_buy_deposit_cents("unit_fixed", 50, 30, 300), 1_500);
    assert_eq!(calculate_group_buy_deposit_cents("order_fixed", 1_000, 30, 300), 1_000);
}
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
cargo test --manifest-path server/Cargo.toml group_buy_
```

Expected: FAIL because `GroupBuyTier`, `select_group_buy_tier`, and `calculate_group_buy_deposit_cents` do not exist.

- [ ] **Step 3: Add domain structs and helpers**

Add near other mall request/row structs:

```rust
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct GroupBuyTier {
    quantity: i32,
    #[serde(rename = "priceCents")]
    price_cents: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GroupBuyActivityRequest {
    name: String,
    product_id: String,
    variant_id: Option<String>,
    starts_at: DateTime<Utc>,
    ends_at: DateTime<Utc>,
    balance_due_at: Option<DateTime<Utc>>,
    min_group_quantity: i32,
    max_quantity_per_user: Option<i32>,
    min_credit_score: Option<i32>,
    overdue_credit_penalty: Option<i32>,
    deposit_type: Option<String>,
    deposit_value: Option<i32>,
    tiers: Vec<GroupBuyTier>,
    created_by: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GroupBuySubscribeRequest {
    user_id: String,
    quantity: i32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GroupBuyUserQuery {
    user_id: String,
}

fn select_group_buy_tier(tiers: &[GroupBuyTier], quantity: i32) -> Option<GroupBuyTier> {
    tiers
        .iter()
        .filter(|tier| tier.quantity <= quantity)
        .max_by_key(|tier| tier.quantity)
        .cloned()
}

fn calculate_group_buy_deposit_cents(
    deposit_type: &str,
    deposit_value: i32,
    quantity: i32,
    estimated_unit_price_cents: i64,
) -> i64 {
    let total = i64::from(quantity.max(0)) * estimated_unit_price_cents.max(0);
    match deposit_type {
        "unit_fixed" => i64::from(quantity.max(0)) * i64::from(deposit_value.max(0)),
        "order_fixed" => i64::from(deposit_value.max(0)).min(total),
        _ => (total * i64::from(deposit_value.clamp(0, 100)) / 100).min(total),
    }
}
```

If `DateTime` and `Utc` are not imported in `mall.rs`, extend imports:

```rust
use chrono::{DateTime, Utc};
```

- [ ] **Step 4: Add route wiring**

In `router()` add:

```rust
.route("/api/mall/group-buys", get(list_group_buys::<S>))
.route("/api/mall/group-buys/:id", get(get_group_buy::<S>))
.route("/api/mall/group-buys/:id/subscribe", post(subscribe_group_buy::<S>))
.route("/api/mall/group-buy-subscriptions/:id/pay-deposit", post(pay_group_buy_deposit::<S>))
.route("/api/mall/group-buy-subscriptions/:id/pay-balance", post(pay_group_buy_balance::<S>))
.route("/api/mall/me/group-buy-subscriptions", get(list_my_group_buy_subscriptions::<S>))
```

In `admin_router()` add:

```rust
.route("/api/admin/mall/group-buys", get(admin_list_group_buys::<S>).post(admin_create_group_buy::<S>))
.route("/api/admin/mall/group-buys/:id", put(admin_update_group_buy::<S>))
.route("/api/admin/mall/group-buys/:id/publish", post(admin_publish_group_buy::<S>))
.route("/api/admin/mall/group-buys/:id/offline", post(admin_offline_group_buy::<S>))
.route("/api/admin/mall/group-buys/:id/force-form", post(admin_force_form_group_buy::<S>))
.route("/api/admin/mall/group-buys/:id/extend", post(admin_extend_group_buy::<S>))
.route("/api/admin/mall/group-buys/:id/cancel", post(admin_cancel_group_buy::<S>))
.route("/api/admin/mall/group-buys/:id/confirm-procurement", post(admin_confirm_group_buy_procurement::<S>))
.route("/api/admin/mall/group-buys/:id/subscriptions", get(admin_list_group_buy_subscriptions::<S>))
```

- [ ] **Step 5: Implement public read APIs**

Implement list/detail by joining product data and returning `mall_group_buy_activity_json(activity)` plus a `product` object:

```rust
async fn list_group_buys<S>(
    State(state): State<AppState<S>>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    advance_group_buy_activities(&state.db).await?;
    let rows = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT mall_group_buy_activity_json(activity) || jsonb_build_object(
          'product', product_json(product),
          'currentQuantity', COALESCE((
            SELECT sum(quantity)::integer
            FROM mall_group_buy_subscriptions subscription
            WHERE subscription.activity_id = activity.id
              AND subscription.status IN ('deposit_paid', 'pending_balance', 'balance_paid', 'order_created')
          ), 0)
        )
        FROM mall_group_buy_activities activity
        JOIN mall_products product ON product.id = activity.product_id
        WHERE activity.status IN ('published', 'enrolling', 'formed_pending_balance', 'procuring')
        ORDER BY activity.starts_at ASC, activity.created_at DESC
        "#,
    )
    .fetch_all(&state.db)
    .await?;
    Ok(ok("查询成功", rows))
}
```

Implement `get_group_buy` similarly with `WHERE activity.id = $1`.

- [ ] **Step 6: Implement subscription creation**

Implement `subscribe_group_buy` to:

1. Check activity status is `published` or `enrolling`.
2. Check current time is inside activity window.
3. Fetch `users.credit_score`; block below `min_credit_score`.
4. Check `max_quantity_per_user`.
5. Use selected tier if current quantity plus requested quantity reaches a tier; otherwise use the lowest configured tier for estimated display.
6. Upsert a single active subscription per user and activity.

Core insert:

```rust
INSERT INTO mall_group_buy_subscriptions (
  activity_id, user_id, quantity, unit_name, status,
  estimated_unit_price_cents, estimated_total_cents, deposit_cents, balance_cents
)
VALUES ($1, $2, $3, $4, 'pending_deposit', $5, $6, $7, GREATEST($6 - $7, 0))
ON CONFLICT ON CONSTRAINT mall_group_buy_subscriptions_active_user_uidx
DO UPDATE SET
  quantity = EXCLUDED.quantity,
  estimated_unit_price_cents = EXCLUDED.estimated_unit_price_cents,
  estimated_total_cents = EXCLUDED.estimated_total_cents,
  deposit_cents = EXCLUDED.deposit_cents,
  balance_cents = EXCLUDED.balance_cents,
  updated_at = now()
RETURNING mall_group_buy_subscription_json(mall_group_buy_subscriptions)
```

If PostgreSQL does not allow `ON CONFLICT ON CONSTRAINT` for the partial unique index, replace it with an advisory lock and explicit select/update/insert in one transaction.

- [ ] **Step 7: Implement admin CRUD and actions**

Implement:

- `admin_list_group_buys`: returns all activities with counts.
- `admin_create_group_buy`: validates product/variant, derives `unit_name`, validates sorted tiers, inserts draft.
- `admin_update_group_buy`: only editable in `draft`, `published`, `enrolling`.
- `admin_publish_group_buy`: changes `draft` to `published`.
- `admin_offline_group_buy`: changes active activity to `offline`.
- `admin_force_form_group_buy`: calls `form_group_buy_activity`.
- `admin_extend_group_buy`: updates `ends_at` or `balance_due_at` from request.
- `admin_cancel_group_buy`: marks `cancelled_refunding` and creates refund events.
- `admin_confirm_group_buy_procurement`: creates normal mall orders for `balance_paid` subscriptions, then marks `procuring`.
- `admin_list_group_buy_subscriptions`: returns subscriptions with user phone/name.

For every action, insert `mall_group_buy_events`.

- [ ] **Step 8: Implement lifecycle helpers**

Add:

```rust
pub async fn settle_group_buy_deposit_payment_success(pool: &PgPool, subscription_id: &str) -> ApiResult<()> { /* update pending_deposit -> deposit_paid */ }
pub async fn settle_group_buy_balance_payment_success(pool: &PgPool, subscription_id: &str) -> ApiResult<()> { /* update pending_balance -> balance_paid */ }
pub async fn advance_group_buy_activities(pool: &PgPool) -> ApiResult<()> { /* published -> enrolling, ended -> formed/refund, overdue -> review/procuring */ }
```

`advance_group_buy_activities` must be idempotent. Use status predicates in every update.

- [ ] **Step 9: Add credit deduction helper**

Add a transaction helper:

```rust
async fn deduct_group_buy_credit_tx(
    tx: &mut sqlx::Transaction<'_, Postgres>,
    user_id: &str,
    subscription_id: &str,
    penalty: i32,
) -> ApiResult<()> {
    if penalty <= 0 {
        return Ok(());
    }
    let score_before: i32 = sqlx::query_scalar("SELECT COALESCE(credit_score, 100) FROM users WHERE id = $1 FOR UPDATE")
        .bind(user_id)
        .fetch_one(&mut **tx)
        .await?;
    let score_after = (score_before - penalty).max(0);
    sqlx::query("UPDATE users SET credit_score = $2, updated_at = now() WHERE id = $1")
        .bind(user_id)
        .bind(score_after)
        .execute(&mut **tx)
        .await?;
    sqlx::query(
        r#"
        INSERT INTO mall_credit_ledger (user_id, source_type, source_id, delta, score_before, score_after, reason)
        VALUES ($1, 'mall_group_buy', $2, $3, $4, $5, 'balance_overdue')
        ON CONFLICT (source_type, source_id, reason) DO NOTHING
        "#,
    )
    .bind(user_id)
    .bind(subscription_id)
    .bind(-penalty)
    .bind(score_before)
    .bind(score_after)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
```

- [ ] **Step 10: Run backend tests**

Run:

```bash
cargo test --manifest-path server/Cargo.toml group_buy_
cargo test --manifest-path server/Cargo.toml --test service_routers
```

Expected: PASS.

- [ ] **Step 11: Run static guard**

Run:

```bash
node scripts/check-mall-group-buy-presale.mjs
```

Expected: backend route checks pass; payment/frontend/admin checks may still fail.

- [ ] **Step 12: Commit**

```bash
git add server/src/modules/mall.rs
git commit -m "Add mall group buy backend"
```

---

### Task 3: Payment Integration

**Files:**
- Modify: `server/src/modules/payments.rs`
- Modify: `src/services/payment.ts`
- Test: `server/src/modules/payments.rs` test module

- [ ] **Step 1: Add failing payment parser tests**

In `server/src/modules/payments.rs` tests, add:

```rust
#[test]
fn parses_group_buy_payment_business_types() {
    assert_eq!(
        "mall_group_buy_deposit".parse::<PaymentBusinessType>().unwrap().as_str(),
        "mall_group_buy_deposit"
    );
    assert_eq!(
        "mall_group_buy_balance".parse::<PaymentBusinessType>().unwrap().as_str(),
        "mall_group_buy_balance"
    );
}
```

- [ ] **Step 2: Run parser test and verify failure**

Run:

```bash
cargo test --manifest-path server/Cargo.toml parses_group_buy_payment_business_types
```

Expected: FAIL because the enum variants are missing.

- [ ] **Step 3: Extend backend payment business type**

Modify enum:

```rust
enum PaymentBusinessType {
    OrderFare,
    OrderCommission,
    MallOrder,
    MallGroupBuyDeposit,
    MallGroupBuyBalance,
}
```

Extend `as_str()` and `FromStr`:

```rust
Self::MallGroupBuyDeposit => "mall_group_buy_deposit",
Self::MallGroupBuyBalance => "mall_group_buy_balance",
```

```rust
"mall_group_buy_deposit" | "group_buy_deposit" => Ok(Self::MallGroupBuyDeposit),
"mall_group_buy_balance" | "group_buy_balance" => Ok(Self::MallGroupBuyBalance),
```

- [ ] **Step 4: Fetch group-buy payable rows**

In `fetch_payable_order`, add two branches:

```rust
PaymentBusinessType::MallGroupBuyDeposit => sqlx::query_as::<_, PayableOrderRow>(
    r#"
    SELECT
      subscription.id,
      subscription.status,
      CASE WHEN subscription.deposit_paid_at IS NULL THEN 'pending' ELSE 'paid' END AS payment_status,
      NULL::text AS commission_payment_status,
      NULL::float8 AS fare_price,
      NULL::float8 AS commission_amount,
      subscription.deposit_cents AS payable_cents,
      activity.name AS cargo_name
    FROM mall_group_buy_subscriptions subscription
    JOIN mall_group_buy_activities activity ON activity.id = subscription.activity_id
    WHERE subscription.id = $1
    "#,
)
.bind(order_id)
.fetch_optional(pool)
.await?
.ok_or_else(|| ApiError::NotFound("集采认购单不存在".to_string())),
PaymentBusinessType::MallGroupBuyBalance => sqlx::query_as::<_, PayableOrderRow>(
    r#"
    SELECT
      subscription.id,
      subscription.status,
      CASE WHEN subscription.balance_paid_at IS NULL THEN 'pending' ELSE 'paid' END AS payment_status,
      NULL::text AS commission_payment_status,
      NULL::float8 AS fare_price,
      NULL::float8 AS commission_amount,
      subscription.balance_cents AS payable_cents,
      activity.name AS cargo_name
    FROM mall_group_buy_subscriptions subscription
    JOIN mall_group_buy_activities activity ON activity.id = subscription.activity_id
    WHERE subscription.id = $1
    "#,
)
.bind(order_id)
.fetch_optional(pool)
.await?
.ok_or_else(|| ApiError::NotFound("集采认购单不存在".to_string())),
```

- [ ] **Step 5: Validate group-buy payable states**

In `validate_payable_order`:

```rust
PaymentBusinessType::MallGroupBuyDeposit => {
    if order.status.as_deref() != Some("pending_deposit") {
        return Err(ApiError::BadRequest("当前认购单不可支付定金".to_string()));
    }
    if order.payment_status.as_deref() == Some("paid") {
        return Err(ApiError::BadRequest("定金已支付".to_string()));
    }
}
PaymentBusinessType::MallGroupBuyBalance => {
    if order.status.as_deref() != Some("pending_balance") {
        return Err(ApiError::BadRequest("当前认购单不可支付尾款".to_string()));
    }
    if order.payment_status.as_deref() == Some("paid") {
        return Err(ApiError::BadRequest("尾款已支付".to_string()));
    }
}
```

In `payable_amount_cents`, use the existing `payable_cents` path for both group-buy variants.

- [ ] **Step 6: Settle group-buy payment success**

In `mark_payment_success`:

```rust
PaymentBusinessType::MallGroupBuyDeposit => {
    crate::modules::mall::settle_group_buy_deposit_payment_success(pool, &payment.business_id).await?;
}
PaymentBusinessType::MallGroupBuyBalance => {
    crate::modules::mall::settle_group_buy_balance_payment_success(pool, &payment.business_id).await?;
}
```

- [ ] **Step 7: Use mall WeChat config and description**

In `WechatPayConfig::from_env_for_business` selection, route group-buy types to `ApiService::Mall`.

In `build_wechat_prepay_payload`, add descriptions:

```rust
PaymentBusinessType::MallGroupBuyDeposit => format!("叁友甄选集采定金-{}", order.cargo_name.as_deref().unwrap_or("集采")),
PaymentBusinessType::MallGroupBuyBalance => format!("叁友甄选集采尾款-{}", order.cargo_name.as_deref().unwrap_or("集采")),
```

- [ ] **Step 8: Extend frontend payment type**

In `src/services/payment.ts`:

```ts
export type PaymentBusinessType =
  | 'order_fare'
  | 'order_commission'
  | 'mall_order'
  | 'mall_group_buy_deposit'
  | 'mall_group_buy_balance'
```

- [ ] **Step 9: Run tests and guard**

Run:

```bash
cargo test --manifest-path server/Cargo.toml parses_group_buy_payment_business_types
pnpm tsc
node scripts/check-mall-group-buy-presale.mjs
```

Expected: payment checks pass; miniapp/admin checks may still fail.

- [ ] **Step 10: Commit**

```bash
git add server/src/modules/payments.rs src/services/payment.ts
git commit -m "Support group buy deposit and balance payments"
```

---

### Task 4: Mall Miniapp Group-Buy Experience

**Files:**
- Modify: `src/services/mall.ts`
- Modify: `src/app.config.ts`
- Create: `src/pages/mall/group-buy/index.config.ts`
- Create: `src/pages/mall/group-buy/index.tsx`
- Create: `src/pages/mall/group-buy/detail.config.ts`
- Create: `src/pages/mall/group-buy/detail.tsx`
- Create: `src/pages/mall/group-buy/my.config.ts`
- Create: `src/pages/mall/group-buy/my.tsx`
- Modify: `src/pages/mall/index/index.tsx`
- Modify: `src/pages/mall/profile/index.tsx`
- Modify: `src/pages/mall/mall-theme.css`

- [ ] **Step 1: Add service types and functions**

In `src/services/mall.ts`, add:

```ts
export interface MallGroupBuyTier {
  quantity: number
  priceCents: number
}

export interface MallGroupBuyActivity {
  id: string
  name: string
  productId: string
  variantId?: string | null
  unitName: string
  status: string
  startsAt: string
  endsAt: string
  balanceDueAt?: string | null
  minGroupQuantity: number
  maxQuantityPerUser?: number | null
  minCreditScore: number
  overdueCreditPenalty: number
  depositType: 'percent' | 'unit_fixed' | 'order_fixed' | string
  depositValue: number
  tiers: MallGroupBuyTier[]
  formedQuantity?: number
  currentQuantity?: number
  finalTierQuantity?: number | null
  finalUnitPriceCents?: number | null
  product?: MallProduct
}

export interface MallGroupBuySubscription {
  id: string
  activityId: string
  userId: string
  quantity: number
  unitName: string
  status: string
  estimatedUnitPriceCents: number
  finalUnitPriceCents?: number | null
  estimatedTotalCents: number
  depositCents: number
  balanceCents: number
  mallOrderId?: string | null
  creditPenaltyPoints?: number
  activity?: MallGroupBuyActivity
}

export async function listMallGroupBuys(): Promise<MallGroupBuyActivity[]> {
  return apiGet('/api/mall/group-buys')
}

export async function getMallGroupBuy(id: string): Promise<MallGroupBuyActivity> {
  return apiGet(`/api/mall/group-buys/${id}`)
}

export async function subscribeMallGroupBuy(
  id: string,
  data: { userId: string; quantity: number },
): Promise<MallGroupBuySubscription> {
  return apiPost(`/api/mall/group-buys/${id}/subscribe`, data)
}

export async function payMallGroupBuyDeposit(id: string, userId: string): Promise<MallGroupBuySubscription> {
  return apiPost(`/api/mall/group-buy-subscriptions/${id}/pay-deposit`, { userId })
}

export async function payMallGroupBuyBalance(id: string, userId: string): Promise<MallGroupBuySubscription> {
  return apiPost(`/api/mall/group-buy-subscriptions/${id}/pay-balance`, { userId })
}

export async function listMyMallGroupBuySubscriptions(userId: string): Promise<MallGroupBuySubscription[]> {
  return apiGet('/api/mall/me/group-buy-subscriptions', { userId })
}
```

- [ ] **Step 2: Register pages**

In `src/app.config.ts`, add these under `mallPages` and `miniAppPages`:

```ts
'pages/mall/group-buy/index',
'pages/mall/group-buy/detail',
'pages/mall/group-buy/my',
```

- [ ] **Step 3: Create list page config**

`src/pages/mall/group-buy/index.config.ts`:

```ts
export default definePageConfig({
  navigationBarTitleText: '集采预售',
})
```

- [ ] **Step 4: Create list page**

`src/pages/mall/group-buy/index.tsx`:

```tsx
import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { listMallGroupBuys, type MallGroupBuyActivity } from '@/services/mall'
import '../mall-theme.css'

export default function MallGroupBuyListPage() {
  const [items, setItems] = useState<MallGroupBuyActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listMallGroupBuys()
      .then(setItems)
      .catch(error => Taro.showToast({ title: error instanceof Error ? error.message : '集采加载失败', icon: 'none' }))
      .finally(() => setLoading(false))
  }, [])

  return (
    <View className="mall-page mall-group-buy-page">
      <View className="mall-page-header">
        <Text className="mall-page-title">集采预售</Text>
        <Text className="mall-page-subtitle">先付定金，成团后按最终阶梯价付尾款</Text>
      </View>
      {loading ? <Text className="mall-muted">加载中</Text> : null}
      {items.map(activity => (
        <View
          className="mall-group-buy-card"
          key={activity.id}
          onClick={() => Taro.navigateTo({ url: `/pages/mall/group-buy/detail?id=${activity.id}` })}
        >
          <Text className="mall-group-buy-name">{activity.name}</Text>
          <Text className="mall-group-buy-progress">
            已团 {activity.currentQuantity || activity.formedQuantity || 0}/{activity.minGroupQuantity} {activity.unitName}
          </Text>
          <Text className="mall-group-buy-price">
            最低 ¥{formatCents(lowestTierPrice(activity))}/{activity.unitName}
          </Text>
        </View>
      ))}
      {!loading && items.length === 0 ? <Text className="mall-muted">暂无集采活动</Text> : null}
    </View>
  )
}

function lowestTierPrice(activity: MallGroupBuyActivity) {
  return Math.min(...(activity.tiers || []).map(tier => tier.priceCents).filter(Boolean), activity.finalUnitPriceCents || Number.MAX_SAFE_INTEGER)
}

function formatCents(value: number) {
  if (!Number.isFinite(value) || value === Number.MAX_SAFE_INTEGER) return '--'
  return (value / 100).toFixed(1).replace(/\.0$/, '')
}
```

- [ ] **Step 5: Create detail page**

`src/pages/mall/group-buy/detail.config.ts`:

```ts
export default definePageConfig({
  navigationBarTitleText: '集采详情',
})
```

`src/pages/mall/group-buy/detail.tsx` must:

- Load `id` from router params.
- Display activity, product image, tiers, current progress, deposit rule, credit threshold, and user quantity stepper.
- On submit, call `subscribeMallGroupBuy`, then call `startOrderPayment({ orderId: subscription.id, businessType: 'mall_group_buy_deposit' })`.
- After payment, navigate to `/pages/mall/group-buy/my`.

Use this payment handler:

```tsx
const payDeposit = async () => {
  const user = Taro.getStorageSync('userInfo') || {}
  if (!user.id) {
    Taro.navigateTo({ url: `/pages/mall/auth/index?mode=login&returnUrl=${encodeURIComponent(`/pages/mall/group-buy/detail?id=${activity?.id}`)}` })
    return
  }
  if (!activity) return
  try {
    setSubmitting(true)
    const subscription = await subscribeMallGroupBuy(activity.id, { userId: user.id, quantity })
    await startOrderPayment({ orderId: subscription.id, businessType: 'mall_group_buy_deposit', payerId: user.id })
    Taro.showToast({ title: '定金支付成功', icon: 'success' })
    Taro.navigateTo({ url: '/pages/mall/group-buy/my' })
  } catch (error) {
    Taro.showToast({ title: error instanceof Error ? error.message : '支付失败', icon: 'none' })
  } finally {
    setSubmitting(false)
  }
}
```

- [ ] **Step 6: Create my subscriptions page**

`src/pages/mall/group-buy/my.config.ts`:

```ts
export default definePageConfig({
  navigationBarTitleText: '我的集采',
})
```

`src/pages/mall/group-buy/my.tsx` must:

- Read `userInfo.id`.
- Call `listMyMallGroupBuySubscriptions`.
- Render status, quantity, deposit, balance, and mall order entry.
- For `pending_balance`, call `startOrderPayment({ orderId: subscription.id, businessType: 'mall_group_buy_balance', payerId: user.id })`.
- For `order_created`, navigate to `/pages/mall/order-detail/index?id=${subscription.mallOrderId}`.

- [ ] **Step 7: Add entry points**

In `src/pages/mall/index/index.tsx`, add a visible "集采预售" entrance in the marketing area:

```tsx
<View className="mall-group-buy-entry" onClick={() => Taro.navigateTo({ url: '/pages/mall/group-buy/index' })}>
  <Text className="mall-group-buy-entry-title">集采预售</Text>
  <Text className="mall-group-buy-entry-copy">先付定金，成团更便宜</Text>
</View>
```

In `src/pages/mall/profile/index.tsx`, add "我的集采":

```tsx
<ProfileLink
  icon="users"
  title="我的集采"
  subtitle="查看定金、尾款和到货进度"
  onClick={() => Taro.navigateTo({ url: '/pages/mall/group-buy/my' })}
/>
```

Adjust the icon prop to match the existing `ProfileLink` signature.

- [ ] **Step 8: Add styles**

In `src/pages/mall/mall-theme.css`, add classes:

```css
.mall-group-buy-page {
  background: #fbfaf6;
  min-height: 100vh;
}

.mall-group-buy-card,
.mall-group-buy-entry {
  background: #fff;
  border: 1px solid #d9ead6;
  border-radius: 16px;
  padding: 18px;
  margin: 14px 0;
}

.mall-group-buy-name,
.mall-group-buy-entry-title {
  display: block;
  color: #173522;
  font-size: 22px;
  font-weight: 800;
}

.mall-group-buy-progress,
.mall-group-buy-entry-copy,
.mall-group-buy-price {
  display: block;
  color: #657262;
  margin-top: 8px;
}

.mall-group-buy-price {
  color: #ff7a1a;
  font-size: 24px;
  font-weight: 900;
}
```

- [ ] **Step 9: Run frontend checks**

Run:

```bash
pnpm tsc
node scripts/check-mall-group-buy-presale.mjs
pnpm build:weapp:mall
```

Expected: TypeScript and miniapp build pass; admin check may still fail.

- [ ] **Step 10: Commit**

```bash
git add src/services/mall.ts src/app.config.ts src/pages/mall/group-buy src/pages/mall/index/index.tsx src/pages/mall/profile/index.tsx src/pages/mall/mall-theme.css
git commit -m "Add mall group buy miniapp flow"
```

---

### Task 5: Web Admin Group-Buy Operations

**Files:**
- Modify: `src/web-admin/main.tsx`
- Modify: `src/web-admin/styles.css`

- [ ] **Step 1: Add data loading**

In the dashboard data loading area near existing mall loads, add:

```ts
loadWithFallback('集采预售', [], errors, () => apiGet<JsonRecord[]>('/api/admin/mall/group-buys')),
```

Add the resulting data field to the app data shape as `mallGroupBuys`.

- [ ] **Step 2: Add page menu key**

Add a mall marketing page definition:

```ts
designPage('mall.groupBuyPresale', '集采预售', '营销中心', '集采预售活动、定金、尾款和采购确认', 'shopping-bag')
```

If page helper copy appears visually, keep only the title in UI and avoid rendering the description text.

- [ ] **Step 3: Add form state**

Add state:

```ts
const [groupBuyForm, setGroupBuyForm] = useState<GroupBuyForm>(() => emptyGroupBuyForm())
const [groupBuyModalOpen, setGroupBuyModalOpen] = useState(false)
const [groupBuySubscriptions, setGroupBuySubscriptions] = useState<JsonRecord[]>([])
const [groupBuyDetailOpen, setGroupBuyDetailOpen] = useState(false)
```

Add form type:

```ts
interface GroupBuyForm {
  id?: string
  name: string
  productId: string
  variantId: string
  startsAt: string
  endsAt: string
  balanceDueAt: string
  minGroupQuantity: string
  maxQuantityPerUser: string
  minCreditScore: string
  overdueCreditPenalty: string
  depositType: string
  depositValue: string
  tiers: Array<{ quantity: string; priceCents: string }>
}
```

- [ ] **Step 4: Implement CRUD handlers**

Add handlers:

```ts
const saveGroupBuy = async () => {
  const payload = {
    name: groupBuyForm.name,
    productId: groupBuyForm.productId,
    variantId: groupBuyForm.variantId || undefined,
    startsAt: groupBuyForm.startsAt,
    endsAt: groupBuyForm.endsAt,
    balanceDueAt: groupBuyForm.balanceDueAt || undefined,
    minGroupQuantity: Number(groupBuyForm.minGroupQuantity),
    maxQuantityPerUser: groupBuyForm.maxQuantityPerUser ? Number(groupBuyForm.maxQuantityPerUser) : undefined,
    minCreditScore: Number(groupBuyForm.minCreditScore || 80),
    overdueCreditPenalty: Number(groupBuyForm.overdueCreditPenalty || 10),
    depositType: groupBuyForm.depositType,
    depositValue: Number(groupBuyForm.depositValue),
    tiers: groupBuyForm.tiers.map(tier => ({ quantity: Number(tier.quantity), priceCents: yuanToCents(tier.priceCents) })),
  }
  const saved = groupBuyForm.id
    ? await apiPut<JsonRecord>(`/api/admin/mall/group-buys/${groupBuyForm.id}`, payload)
    : await apiPost<JsonRecord>('/api/admin/mall/group-buys', payload)
  setData(current => ({ ...current, mallGroupBuys: upsertRecordList(current.mallGroupBuys, saved) }))
  showMessage('success', '集采活动已保存')
  setGroupBuyModalOpen(false)
}
```

Add action helper:

```ts
const runGroupBuyAction = async (id: string, action: string, successText: string, payload: JsonRecord = {}) => {
  const updated = await apiPost<JsonRecord>(`/api/admin/mall/group-buys/${id}/${action}`, payload)
  setData(current => ({ ...current, mallGroupBuys: upsertRecordList(current.mallGroupBuys, updated) }))
  showMessage('success', successText)
}
```

- [ ] **Step 5: Render section**

Create `MallGroupBuyPresaleSection` in `src/web-admin/main.tsx`:

```tsx
function MallGroupBuyPresaleSection({
  activities,
  products,
  onCreate,
  onEdit,
  onAction,
  onDetail,
}: {
  activities: JsonRecord[]
  products: JsonRecord[]
  onCreate: () => void
  onEdit: (activity: JsonRecord) => void
  onAction: (id: string, action: string, successText: string) => void
  onDetail: (activity: JsonRecord) => void
}) {
  return (
    <section className="admin-section">
      <div className="section-toolbar">
        <h2>集采预售</h2>
        <button className="primary-button" onClick={onCreate}>新建集采活动</button>
      </div>
      <div className="admin-table">
        <table>
          <thead>
            <tr>
              <th>活动</th>
              <th>商品</th>
              <th>进度</th>
              <th>尾款</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {activities.map(activity => (
              <tr key={stringValue(activity, 'id')}>
                <td>{stringValue(activity, 'name')}</td>
                <td>{productName(products, stringValue(activity, 'productId'))}</td>
                <td>{numberValue(activity, 'currentQuantity', numberValue(activity, 'formedQuantity', 0))}/{numberValue(activity, 'minGroupQuantity', 0)} {stringValue(activity, 'unitName')}</td>
                <td>{formatDate(stringValue(activity, 'balanceDueAt'))}</td>
                <td>{groupBuyStatusLabel(stringValue(activity, 'status'))}</td>
                <td>
                  <button onClick={() => onDetail(activity)}>详情</button>
                  <button onClick={() => onEdit(activity)}>编辑</button>
                  <button onClick={() => onAction(stringValue(activity, 'id'), 'publish', '集采活动已发布')}>发布</button>
                  <button onClick={() => onAction(stringValue(activity, 'id'), 'force-form', '集采活动已强制成团')}>强制成团</button>
                  <button onClick={() => onAction(stringValue(activity, 'id'), 'confirm-procurement', '已确认继续采购')}>确认采购</button>
                  <button onClick={() => onAction(stringValue(activity, 'id'), 'offline', '集采活动已下线')}>下线</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
```

Use the existing web-admin modal classes for the create/edit and detail dialogs: `modal-backdrop`, `modal-panel`, `modal-title-row`, `modal-actions`, `ghost-button`, and `primary-button`.

- [ ] **Step 6: Add create/edit modal**

Modal fields:

- 活动名称 required.
- 商品 required.
- 售卖规格 required if product has variants.
- 活动开始时间 required.
- 活动结束时间 required.
- 尾款截止时间 required.
- 成团门槛 required.
- 每人上限 optional.
- 最低信用分 required.
- 尾款逾期扣分 required.
- 定金方式 select: 按比例、按单位固定、按单固定.
- 定金数值 required.
- 阶梯价 rows: quantity + price.

Every save failure must call:

```ts
showMessage('error', error instanceof Error ? error.message : '集采活动保存失败')
```

- [ ] **Step 7: Add detail modal**

On detail click:

```ts
const rows = await apiGet<JsonRecord[]>(`/api/admin/mall/group-buys/${id}/subscriptions`)
setGroupBuySubscriptions(rows)
setGroupBuyDetailOpen(true)
```

Render user name/phone, quantity, deposit status, balance status, credit penalty, refund status, and mall order id.

- [ ] **Step 8: Add styles**

In `src/web-admin/styles.css`:

```css
.group-buy-tier-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 12px;
  align-items: center;
}

.group-buy-progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.group-buy-status {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 4px 10px;
  background: #edf7ed;
  color: #1f6b3a;
  font-weight: 700;
}
```

- [ ] **Step 9: Run admin checks**

Run:

```bash
pnpm tsc
pnpm build:web
node scripts/check-mall-group-buy-presale.mjs
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/web-admin/main.tsx src/web-admin/styles.css
git commit -m "Add web admin group buy operations"
```

---

### Task 6: Final Verification, PR, And Deployment Prep

**Files:**
- Modify only if checks require small fixes in files touched by Tasks 1-5.

- [ ] **Step 1: Run focused validation**

Run:

```bash
pnpm tsc
cargo test --manifest-path server/Cargo.toml group_buy_
cargo test --manifest-path server/Cargo.toml parses_group_buy_payment_business_types
cargo test --manifest-path server/Cargo.toml --test service_routers
node scripts/check-mall-group-buy-presale.mjs
pnpm build:web
pnpm build:weapp:mall
```

Expected: all commands pass.

- [ ] **Step 2: Run split validation**

Run:

```bash
pnpm validate:split
```

Expected: PASS.

- [ ] **Step 3: Run full validation if time allows**

Run:

```bash
pnpm validate
```

Expected: PASS. If it fails on an unrelated pre-existing check, record the failing check and prove focused group-buy checks pass.

- [ ] **Step 4: Inspect git scope**

Run:

```bash
git status --short
git diff --stat recorouter/main...HEAD
```

Expected: only group-buy schema, backend, payment, miniapp, web admin, styles, scripts, and package changes are present.

- [ ] **Step 5: Push and open PR**

Run:

```bash
git push -u recorouter codex/mall-group-buy-presale
gh pr create --repo Taishi-co/RecoRouter --base main --head codex/mall-group-buy-presale --draft --title "Add mall group buy presale" --body-file /tmp/group-buy-presale-pr.md
```

PR body must include:

```markdown
## Summary
- add mall group-buy presale schema, lifecycle, credit ledger, and admin/user APIs
- support deposit and balance payment business types
- add miniapp group-buy list/detail/my pages and web-admin operations

## Validation
- pnpm tsc
- cargo test --manifest-path server/Cargo.toml group_buy_
- cargo test --manifest-path server/Cargo.toml parses_group_buy_payment_business_types
- cargo test --manifest-path server/Cargo.toml --test service_routers
- node scripts/check-mall-group-buy-presale.mjs
- pnpm build:web
- pnpm build:weapp:mall
```

- [ ] **Step 6: Deployment prep**

After PR review or user approval, deploy backend migrations and services before publishing the miniapp because the miniapp pages depend on new APIs.

Deployment order:

```bash
pnpm build:rust-server
pnpm build:web
pnpm build:weapp:mall
```

Then use the existing deployment scripts for server/web/miniapp. Verify:

```bash
curl -fsS https://car.shcxyz.site/api/health
curl -fsS https://car.shcxyz.site/api/mall/group-buys
```

Expected: health returns success and group-buy list returns an API envelope.

---

## Self-Review

Spec coverage:

- Single activity to one product variant: Task 1 schema and Task 2 admin creation enforce product/variant.
- Unit inherits sellable spec: Task 2 admin creation derives `unit_name`.
- Unified final tier price: Task 2 pricing helper and lifecycle.
- Configurable deposit rules: Task 1 schema, Task 2 helper, Task 5 admin form.
- Credit score reuse and ledger: Task 1 `mall_credit_ledger`, Task 2 credit helper.
- Low credit score blocks signup: Task 2 subscribe validation.
- Balance overdue cancellation and penalty: Task 2 lifecycle helper.
- Procurement confirmation after formed risk: Task 2 `confirm-procurement`, Task 5 action.
- Refund states: Task 1 statuses, Task 2 cancel/refund state hooks.
- Normal mall order after balance: Task 2 procurement confirmation and Task 4 my page order link.
- Miniapp pages: Task 4.
- Web admin page: Task 5.
- Payment business types: Task 3.
- Validation: Task 6.

Placeholder scan: no unresolved implementation placeholders are intentionally left in this plan. Where snippets use surrounding existing app helpers, the task names the exact existing file and required behavior.

Type consistency:

- Backend business types use `mall_group_buy_deposit` and `mall_group_buy_balance`.
- Frontend payment type union uses the same string values.
- Service function names match the static guard: `listMallGroupBuys`, `getMallGroupBuy`, `subscribeMallGroupBuy`, `payMallGroupBuyDeposit`, `payMallGroupBuyBalance`, `listMyMallGroupBuySubscriptions`.
