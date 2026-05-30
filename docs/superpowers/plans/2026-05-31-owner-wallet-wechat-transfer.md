# Owner Wallet WeChat Transfer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an owner wallet with ledgered order income, manual fallback withdrawals, and WeChat Merchant Transfer user-confirmation payouts.

**Architecture:** Add immutable wallet tables, a focused Rust `owner_wallet` backend module, and a small owner wallet miniapp page. Keep payment collection and owner payouts as separate domains while sharing WeChat Pay API v3 signing helpers. Wallet balance is derived from posted ledger entries, not cached totals.

**Tech Stack:** Rust 2021, axum, SQLx/PostgreSQL migrations, reqwest, WeChat Pay API v3 RSA signing, Taro 4, React 18, TypeScript, Tailwind utility classes, lucide-react-taro.

---

## File Structure

- Create `server/migrations/0008_owner_wallet.sql`
  - Adds owner wallet account, ledger, and withdrawal tables.
- Create `server/src/wechat_pay.rs`
  - Shared WeChat Pay merchant config, API v3 signing, headers, private-key loading, miniapp code-to-openid exchange, and notification decrypt helpers.
- Modify `server/src/lib.rs`
  - Exports the shared WeChat helper module.
- Modify `server/src/modules/payments.rs`
  - Reuses shared WeChat helpers while preserving existing payment behavior.
- Create `server/src/modules/owner_wallet.rs`
  - Owns wallet crediting, balance calculation, owner APIs, admin manual withdrawal APIs, WeChat transfer bill creation, transfer status sync, and transfer notification handling.
- Modify `server/src/modules/mod.rs`
  - Exports the owner wallet module.
- Modify `server/src/app.rs`
  - Registers owner wallet routes.
- Modify `server/src/modules/orders.rs`
  - Calls wallet crediting after zero-commission completion and commission-confirmed completion.
- Create `server/tests/owner_wallet_endpoints.rs`
  - DB-backed endpoint and idempotency tests.
- Create `src/services/owner-wallet.ts`
  - Frontend API wrapper and `wx.requestMerchantTransfer` bridge.
- Create `src/pages/owner/wallet/index.tsx`
  - Owner wallet page.
- Create `src/pages/owner/wallet/index.config.ts`
  - Page title config.
- Modify `src/pages/owner/profile/index.tsx`
  - Adds a wallet entry.
- Modify `src/components/layout/bottom-nav.tsx`
  - Points owner revenue tab to the wallet page.
- Modify `src/app.config.ts`
  - Registers the wallet page.
- Create `docs/payments/wechat-merchant-transfer-setup.md`
  - Lists the WeChat merchant platform setup needed before production auto-transfer.

---

### Task 1: Database Migration

**Files:**
- Create: `server/migrations/0008_owner_wallet.sql`
- Test: `pnpm check:sqlx-migration-immutability`

- [ ] **Step 1: Write the migration**

Create `server/migrations/0008_owner_wallet.sql` with these tables and indexes:

```sql
CREATE TABLE IF NOT EXISTS owner_wallet_accounts (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_id text NOT NULL,
  provider text NOT NULL DEFAULT 'wechat',
  appid text NOT NULL,
  openid text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS owner_wallet_accounts_owner_provider_appid_uidx
  ON owner_wallet_accounts (owner_id, provider, appid)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS owner_wallet_accounts_owner_idx
  ON owner_wallet_accounts (owner_id);

CREATE TABLE IF NOT EXISTS owner_wallet_ledger_entries (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_id text NOT NULL,
  order_id text,
  withdrawal_id text,
  entry_type text NOT NULL,
  amount_cents bigint NOT NULL,
  status text NOT NULL DEFAULT 'posted',
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS owner_wallet_ledger_fare_credit_order_uidx
  ON owner_wallet_ledger_entries (order_id)
  WHERE entry_type = 'fare_credit' AND order_id IS NOT NULL AND status = 'posted';

CREATE UNIQUE INDEX IF NOT EXISTS owner_wallet_ledger_withdrawal_type_uidx
  ON owner_wallet_ledger_entries (withdrawal_id, entry_type)
  WHERE withdrawal_id IS NOT NULL
    AND entry_type IN ('withdrawal_hold', 'withdrawal_release');

CREATE INDEX IF NOT EXISTS owner_wallet_ledger_owner_created_idx
  ON owner_wallet_ledger_entries (owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS owner_withdrawals (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_id text NOT NULL,
  provider text NOT NULL,
  amount_cents bigint NOT NULL,
  status text NOT NULL,
  out_bill_no text NOT NULL UNIQUE,
  transfer_bill_no text,
  package_info text,
  wechat_state text,
  fail_reason text,
  manual_note text,
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS owner_withdrawals_owner_created_idx
  ON owner_withdrawals (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS owner_withdrawals_status_idx
  ON owner_withdrawals (status);
```

- [ ] **Step 2: Run migration guard**

Run: `pnpm check:sqlx-migration-immutability`

Expected: PASS with no immutable migration changes reported.

- [ ] **Step 3: Commit**

```bash
git add server/migrations/0008_owner_wallet.sql
git commit -m "feat: add owner wallet schema"
```

### Task 2: Shared WeChat Pay Helpers

**Files:**
- Create: `server/src/wechat_pay.rs`
- Modify: `server/src/lib.rs`
- Modify: `server/src/modules/payments.rs`
- Test: `cargo test --manifest-path server/Cargo.toml payments::tests wechat_pay::tests`

- [ ] **Step 1: Move shared helper tests first**

Add tests in `server/src/wechat_pay.rs` covering:

```rust
#[test]
fn api_v3_json_requests_include_required_headers() {
    let request = with_wechat_json_headers(
        reqwest::Client::new().post("https://api.mch.weixin.qq.com/test"),
        "WECHATPAY2-SHA256-RSA2048 test",
    )
    .build()
    .unwrap();
    let headers = request.headers();

    assert_eq!(headers.get("accept").unwrap().to_str().unwrap(), "application/json");
    assert_eq!(headers.get("content-type").unwrap().to_str().unwrap(), "application/json");
    assert!(headers.get("user-agent").unwrap().to_str().unwrap().contains("RecoRouter"));
}

#[test]
fn encrypted_notifications_reject_unknown_algorithms() {
    let resource = WechatNotifyResource {
        algorithm: "PLAINTEXT".to_string(),
        ciphertext: "ignored".to_string(),
        associated_data: None,
        nonce: "ignored".to_string(),
    };

    let result = decrypt_wechat_notification::<serde_json::Value>(&resource);
    assert!(result.is_err());
}
```

- [ ] **Step 2: Verify tests fail before implementation**

Run: `cargo test --manifest-path server/Cargo.toml wechat_pay::tests`

Expected: FAIL because `wechat_pay` does not exist.

- [ ] **Step 3: Implement shared helper module**

Implement:

- `WechatPayMerchantConfig::from_env()`
- `exchange_miniapp_login_code`
- `wechat_authorization`
- `with_wechat_headers`
- `with_wechat_json_headers`
- `sign_message`
- `load_wechat_private_key`
- `decrypt_wechat_notification`
- `random_token`, `unix_timestamp`, `unix_timestamp_millis`, `truncate_chars`

- [ ] **Step 4: Refactor payments module to use shared helpers**

Update `payments.rs` so existing WeChat payment behavior is unchanged and duplicated helper code is removed.

- [ ] **Step 5: Verify payment tests pass**

Run: `cargo test --manifest-path server/Cargo.toml payments::tests wechat_pay::tests`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/wechat_pay.rs server/src/lib.rs server/src/modules/payments.rs
git commit -m "refactor: share wechat pay api helpers"
```

### Task 3: Wallet Domain And Endpoints

**Files:**
- Create: `server/src/modules/owner_wallet.rs`
- Modify: `server/src/modules/mod.rs`
- Modify: `server/src/app.rs`
- Test: `server/tests/owner_wallet_endpoints.rs`

- [ ] **Step 1: Write failing DB-backed wallet tests**

Create tests for:

- `completed_order_credits_wallet_once`
- `manual_fallback_withdrawal_reserves_balance`
- `manual_failure_releases_held_balance`
- `wallet_rejects_withdrawal_above_available_balance`

The tests should insert an owner, merchant, demand, vehicle, and completed paid order; call the new endpoints; and assert API response balances in cents.

- [ ] **Step 2: Verify tests fail before implementation**

Run: `TEST_DATABASE_URL="$TEST_DATABASE_URL" cargo test --manifest-path server/Cargo.toml --test owner_wallet_endpoints`

Expected: FAIL with 404 routes or missing module.

- [ ] **Step 3: Implement pure wallet helpers**

Implement:

- `money_to_cents`
- `available_balance_cents`
- `posted_balance_summary`
- `new_out_bill_no`
- `map_wechat_state_to_withdrawal_status`
- `is_terminal_failure_state`

- [ ] **Step 4: Implement wallet crediting**

Implement `pub async fn credit_completed_order_income(pool: &PgPool, order_id: &str) -> ApiResult<()>`.

Rules:

- Query order by `order_id`.
- Require paid fare and completed status.
- Require owner id.
- Convert fare to cents.
- Insert one `fare_credit` ledger row with `ON CONFLICT DO NOTHING`.

- [ ] **Step 5: Implement owner wallet routes**

Add:

- `GET /api/owner-wallet/:owner_id`
- `POST /api/owner-wallet/bind-wechat`
- `POST /api/owner-wallet/withdrawals`
- `POST /api/owner-wallet/withdrawals/:id/sync`
- `POST /api/owner-wallet/wechat-transfer/notify`

- [ ] **Step 6: Implement admin manual routes**

Add:

- `GET /api/admin/owner-withdrawals`
- `POST /api/admin/owner-withdrawals/:id/manual-complete`
- `POST /api/admin/owner-withdrawals/:id/manual-fail`

- [ ] **Step 7: Implement WeChat transfer calls**

Add real API calls only when `WECHAT_TRANSFER_ENABLED=true` and all required config is present:

- Create bill: `POST /v3/fund-app/mch-transfer/transfer-bills`
- Query by merchant bill: `GET /v3/fund-app/mch-transfer/transfer-bills/out-bill-no/{out_bill_no}`

If automatic transfer is disabled, missing config, or permission/config error occurs before a safe transfer bill exists, create `pending_manual` rather than fake success.

- [ ] **Step 8: Verify tests pass**

Run: `TEST_DATABASE_URL="$TEST_DATABASE_URL" cargo test --manifest-path server/Cargo.toml --test owner_wallet_endpoints`

Expected: PASS, or skip with the existing test message when `TEST_DATABASE_URL` is not set.

- [ ] **Step 9: Commit**

```bash
git add server/src/modules/owner_wallet.rs server/src/modules/mod.rs server/src/app.rs server/tests/owner_wallet_endpoints.rs
git commit -m "feat: add owner wallet withdrawal api"
```

### Task 4: Order Completion Wallet Credit

**Files:**
- Modify: `server/src/modules/orders.rs`
- Test: `server/tests/owner_wallet_endpoints.rs`

- [ ] **Step 1: Add failing integration assertion**

Extend `completed_order_credits_wallet_once` so it completes the order through the same order endpoint path used by the app and then verifies a wallet fare credit appears exactly once.

- [ ] **Step 2: Verify failure**

Run: `TEST_DATABASE_URL="$TEST_DATABASE_URL" cargo test --manifest-path server/Cargo.toml --test owner_wallet_endpoints completed_order_credits_wallet_once`

Expected: FAIL because order completion does not credit wallet yet.

- [ ] **Step 3: Wire order completion to wallet crediting**

In `finalize_completed_order`, after credit score and demand/vehicle updates, call:

```rust
crate::modules::owner_wallet::credit_completed_order_income(pool, &order.id).await?;
```

- [ ] **Step 4: Verify pass**

Run: `TEST_DATABASE_URL="$TEST_DATABASE_URL" cargo test --manifest-path server/Cargo.toml --test owner_wallet_endpoints completed_order_credits_wallet_once`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/modules/orders.rs server/tests/owner_wallet_endpoints.rs
git commit -m "feat: credit owner wallet on order completion"
```

### Task 5: Frontend Wallet Service And Page

**Files:**
- Create: `src/services/owner-wallet.ts`
- Create: `src/pages/owner/wallet/index.tsx`
- Create: `src/pages/owner/wallet/index.config.ts`
- Modify: `src/pages/owner/profile/index.tsx`
- Modify: `src/components/layout/bottom-nav.tsx`
- Modify: `src/app.config.ts`

- [ ] **Step 1: Write source-level regression check**

Create `scripts/check-owner-wallet-page.mjs` that asserts:

- `src/app.config.ts` includes `pages/owner/wallet/index`.
- `src/services/owner-wallet.ts` calls `/api/owner-wallet/withdrawals`.
- `src/services/owner-wallet.ts` uses `requestMerchantTransfer`.
- `src/pages/owner/profile/index.tsx` links to `/pages/owner/wallet/index`.
- `src/components/layout/bottom-nav.tsx` owner revenue item points to `/pages/owner/wallet/index`.

- [ ] **Step 2: Verify failure**

Run: `node scripts/check-owner-wallet-page.mjs`

Expected: FAIL because wallet page/service are not implemented.

- [ ] **Step 3: Implement frontend service**

Implement API functions:

- `getOwnerWallet(ownerId)`
- `bindOwnerWechat(ownerId)`
- `createOwnerWithdrawal(ownerId, amountCents)`
- `syncOwnerWithdrawal(withdrawalId)`
- `confirmWechatMerchantTransfer(payload)`

- [ ] **Step 4: Implement wallet page**

The page should:

- Read `userInfo` from storage.
- Load wallet summary.
- Bind WeChat with `Taro.login`.
- Submit withdrawal amount in yuan and convert to cents.
- If backend returns `waiting_user_confirm`, call `wx.requestMerchantTransfer`, then sync.
- If backend returns `pending_manual`, show manual processing status.
- Display ledger and withdrawal lists.

- [ ] **Step 5: Wire navigation**

Register page and add entry from owner profile and owner bottom nav.

- [ ] **Step 6: Verify frontend checks**

Run:

```bash
node scripts/check-owner-wallet-page.mjs
pnpm tsc
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/services/owner-wallet.ts src/pages/owner/wallet/index.tsx src/pages/owner/wallet/index.config.ts src/pages/owner/profile/index.tsx src/components/layout/bottom-nav.tsx src/app.config.ts scripts/check-owner-wallet-page.mjs
git commit -m "feat: add owner wallet miniapp page"
```

### Task 6: WeChat Platform Setup Documentation

**Files:**
- Create: `docs/payments/wechat-merchant-transfer-setup.md`

- [ ] **Step 1: Write setup document**

Document:

- Merchant platform path for applying/opening Merchant Transfer.
- Enable API initiated transfer.
- Configure transfer scene and record `WECHAT_TRANSFER_SCENE_ID`.
- Configure transfer verification person and no-password threshold as required by WeChat.
- Configure interface security IP to the server outbound public IP.
- Ensure WeChat merchant account has enough balance for transfer.
- Configure callback URL as `https://car.shcxyz.site/api/owner-wallet/wechat-transfer/notify`.
- Confirm miniapp AppID is bound to merchant ID `1746295681`.
- Configure env variables and restart backend.

- [ ] **Step 2: Commit**

```bash
git add docs/payments/wechat-merchant-transfer-setup.md
git commit -m "docs: add wechat transfer setup guide"
```

### Task 7: Full Verification

**Files:**
- All touched files.

- [ ] **Step 1: Rust tests**

Run:

```bash
cargo test --manifest-path server/Cargo.toml payments::tests wechat_pay::tests owner_wallet::tests
cargo test --manifest-path server/Cargo.toml --test owner_wallet_endpoints
```

Expected: PASS, or DB-backed tests skip only when `TEST_DATABASE_URL` is unset.

- [ ] **Step 2: Frontend and repo validation**

Run:

```bash
node scripts/check-owner-wallet-page.mjs
pnpm validate
pnpm build:weapp
```

Expected: PASS.

- [ ] **Step 3: Final status**

Run:

```bash
git status --short --branch
```

Expected: branch `codex/owner-wallet-wechat-transfer` with a clean worktree.
