# Owner Wallet And WeChat Merchant Transfer Design

Date: 2026-05-31

## Goal

Add an owner-side wallet and withdrawal module for RecoRouter so carrier owners can see order income and withdraw eligible balance to WeChat Wallet.

The first automated payout channel is WeChat Pay Merchant Transfer in user-confirmation mode. The design keeps a manual fallback path: if the merchant transfer product is not fully configured, temporarily disabled, rejected by WeChat, or unavailable at runtime, wallet accounting still works and withdrawal requests can be handled manually by operations.

## Current System

The project lives in `/Users/sunhanchen/Documents/recocar/projects`.

Current payment flow:

- Demand-side fare payment uses the shared payment service through `/api/payments/prepay`.
- The frontend has a provider abstraction for `wechat`, `alipay`, and `douyin` in `src/services/payment.ts`.
- The backend WeChat Pay integration is in `server/src/modules/payments.rs`.
- Commission is currently separate from fare payout. If commission is zero, the order can complete without showing the commission payment page. If commission is positive, the owner pays platform commission separately and the order completes after admin confirmation.
- `server/src/modules/orders.rs` has `confirm_payment` and `confirm_commission` as completion points.
- `/api/orders/owner-revenue/:owner_id` currently calculates historical revenue from orders. It is not a real wallet and cannot support withdrawals, idempotent payout, or audit-grade accounting.

Dependency note:

- This work must be based on the branch that removes the local simulated payment sandbox, currently `codex/remove-simulated-sandbox-pay`, or on `main` after that PR is merged.
- New money movement must not be built on top of the previously introduced self-simulated sandbox payment mode.

## Product Behavior

Owner-side wallet page:

- Shows available balance, withdrawing amount, withdrawn amount, and lifetime income.
- Shows ledger history: order income, withdrawal debit, failed-withdrawal rollback, and manual adjustment if operations needs it later.
- Shows withdrawal history with status and failure reason.
- Provides a "withdraw to WeChat Wallet" action when automated transfer is enabled and the owner has a WeChat OpenID bound.
- Shows an operations/manual-withdrawal message when automated transfer is not enabled or cannot be used.

Withdrawal states:

- `pending_manual`: automatic WeChat transfer is disabled or unavailable, and operations must handle the payout.
- `waiting_user_confirm`: backend created a WeChat transfer bill and the owner must confirm in the official WeChat page.
- `transferring`: WeChat accepted the confirmation and is processing.
- `success`: WeChat transfer completed.
- `failed`: WeChat returned a terminal failure; funds are released back to available balance.
- `closed`: transfer expired, was canceled, or operations closed it; funds are released if they had been reserved.

The frontend must not treat `wx.requestMerchantTransfer` success as final payout success. WeChat documents that the callback only means the confirmation page was displayed and returned to the app; final status must come from backend sync, callback, or query.

## Income Recognition

The wallet credits owner income only after the order is truly payable:

- `orders.payment_status = 'paid'`
- The order is complete:
  - zero commission path: after owner confirms receipt and order becomes `completed` with `commission_payment_status = 'not_required'`
  - positive commission path: after admin confirms commission and order becomes `completed`

Current commission model:

- The owner pays platform commission separately.
- Wallet income credit is the full order fare under the current model.
- If the platform later switches to deduct commission from fare before payout, the ledger can add a separate `commission_deduction` entry without rewriting historical order income.

Idempotency:

- One completed order may create only one `fare_credit` ledger entry.
- Retrying order completion, callback delivery, sync jobs, or manual repair must not duplicate income.

## Data Model

Add database tables through a new immutable SQLx migration.

### `owner_wallet_accounts`

Stores the payout identity for an owner.

Fields:

- `id`
- `owner_id`
- `provider`: initially `wechat`
- `appid`
- `openid`
- `status`: `active`, `disabled`
- `created_at`
- `updated_at`

Rules:

- Unique active account per `(owner_id, provider, appid)`.
- The OpenID is obtained through WeChat miniapp login code and must match the appid used for merchant transfer.

### `owner_wallet_ledger_entries`

Stores audit-grade wallet movements.

Fields:

- `id`
- `owner_id`
- `order_id`
- `withdrawal_id`
- `entry_type`: `fare_credit`, `withdrawal_hold`, `withdrawal_success`, `withdrawal_release`, `manual_adjustment`
- `amount_cents`: signed integer
- `status`: `posted`, `voided`
- `description`
- `metadata`: JSONB
- `created_at`

Rules:

- Amounts are stored in cents, never floating point.
- Balance is derived from posted ledger entries.
- Unique `fare_credit` per `order_id`.
- Withdrawal reserve and release entries are idempotent per withdrawal.

### `owner_withdrawals`

Stores owner withdrawal requests and WeChat transfer state.

Fields:

- `id`
- `owner_id`
- `provider`: `wechat` or `manual`
- `amount_cents`
- `status`
- `out_bill_no`
- `transfer_bill_no`
- `package_info`
- `wechat_state`
- `fail_reason`
- `manual_note`
- `created_at`
- `updated_at`
- `completed_at`

Rules:

- `out_bill_no` is globally unique.
- Creating a withdrawal first reserves available balance with a negative `withdrawal_hold` ledger entry.
- On success, the hold remains as the balance debit and the withdrawal is marked `success`.
- On failed or closed terminal state, add `withdrawal_release` to restore the reserved amount.

## Backend API

Add a new backend module, likely `server/src/modules/owner_wallet.rs`, and register its router in the Rust app.

Owner APIs:

- `GET /api/owner-wallet/:owner_id`
  - returns summary, account binding status, provider availability, ledger list, and recent withdrawals.
- `POST /api/owner-wallet/bind-wechat`
  - accepts `owner_id` and WeChat `login_code`; stores owner OpenID for the configured appid.
- `POST /api/owner-wallet/withdrawals`
  - accepts `owner_id`, `amount_cents`, and provider preference.
  - if `WECHAT_TRANSFER_ENABLED=true` and config is complete, creates a WeChat transfer bill.
  - otherwise creates `pending_manual`.
- `POST /api/owner-wallet/withdrawals/:id/sync`
  - queries WeChat or re-reads local manual status and returns the latest withdrawal state.
- `POST /api/owner-wallet/wechat-transfer/notify`
  - receives WeChat merchant transfer callback and updates local state idempotently.

Admin or operations APIs:

- `GET /api/admin/owner-withdrawals`
  - filters by status, owner, and time range.
- `POST /api/admin/owner-withdrawals/:id/manual-complete`
  - marks a `pending_manual` withdrawal as paid after operations handles the payout.
- `POST /api/admin/owner-withdrawals/:id/manual-fail`
  - marks a `pending_manual` withdrawal as failed and releases held balance.

Authorization:

- Owner APIs must verify the caller owns the `owner_id` or is an admin.
- Admin APIs require admin role.
- The current codebase still uses explicit `owner_id`/`user_id` request parameters in many places, so the first implementation can match that pattern while keeping all checks centralized in the wallet module.

## WeChat Merchant Transfer Integration

Use the upgraded WeChat Merchant Transfer user-confirmation flow:

- Backend calls `POST /v3/fund-app/mch-transfer/transfer-bills`.
- Backend expects `WAIT_USER_CONFIRM` and `package_info` for the normal owner-confirmation path.
- Miniapp calls `wx.requestMerchantTransfer` with:
  - `mchId`
  - `appId`
  - `package`
- Backend verifies final status through WeChat callback or query API.

Implementation boundary:

- Extract shared WeChat Pay API v3 signing, nonce, timestamp, private key loading, and HTTP header generation from the current payment module into a reusable service.
- Keep payment collection and merchant transfer as separate domain services even if they share signing helpers.
- Do not add a local simulated transfer success path.

Required environment:

```text
WECHAT_TRANSFER_ENABLED=true
WECHAT_TRANSFER_SCENE_ID=1009
WECHAT_TRANSFER_NOTIFY_URL=
WECHAT_TRANSFER_RECV_PERCEPTION=货款
WECHAT_TRANSFER_SCENE_INFO_TYPE_1=采购商品名称
WECHAT_TRANSFER_SCENE_INFO_CONTENT_1=货运服务
WECHAT_TRANSFER_MIN_AMOUNT_CENTS=1
WECHAT_TRANSFER_MAX_AMOUNT_CENTS=200000
```

The current merchant platform may only show `采购货款 ID:1009` and may not allow adding custom scenes. That is acceptable for this release. For scene `1009`, the backend sends one scene report info by default: `采购商品名称=货运服务`. The older `劳务报酬 / 岗位类型 / 报酬说明` report fields must not be used with scene `1009`.

The existing WeChat Pay variables remain shared:

```text
WECHAT_PAY_APPID=
WECHAT_MINIAPP_SECRET=
WECHAT_PAY_MCH_ID=1746295681
WECHAT_PAY_MCH_SERIAL_NO=
WECHAT_PAY_PRIVATE_KEY_PATH=
WECHAT_PAY_PRIVATE_KEY=
WECHAT_PAY_API_V3_KEY=
```

If WeChat requires receiver real-name verification or encrypted user name for the selected scene, add:

```text
WECHAT_PAY_PUBLIC_KEY_ID=
WECHAT_PAY_PUBLIC_KEY_PATH=
```

The first implementation should not require real-name input unless the selected WeChat transfer scene or amount threshold requires it.

Official references:

- WeChat Merchant Transfer product: https://pay.wechatpay.cn/doc/v3/merchant/4012711988
- Permission application: https://pay.wechatpay.cn/doc/v3/merchant/4013740645
- Transfer bill API: https://pay.wechatpay.cn/doc/v3/merchant/4012716434
- JSAPI/miniapp user confirmation: https://pay.wechatpay.cn/doc/v3/merchant/4012716430

## Manual Fallback

Keep the fallback even though the merchant has opened the product.

Fallback triggers:

- `WECHAT_TRANSFER_ENABLED` is false.
- Required transfer config is missing.
- WeChat returns a permission/configuration error.
- WeChat transfer API is temporarily unavailable and the request cannot be safely retried.
- Operations explicitly disables automatic payout.

Fallback behavior:

- The wallet still reserves balance by creating a withdrawal.
- The withdrawal status becomes `pending_manual`.
- The owner sees that the withdrawal is being handled manually.
- Admin/operations can mark the withdrawal as paid or failed.
- Failed manual withdrawals release the held balance.

This fallback must not silently pretend that WeChat transfer succeeded.

## Frontend Design

Add an owner wallet page and navigation entry in the owner side "我的" area or owner order-related area.

Page sections:

- Balance summary: available, withdrawing, withdrawn.
- WeChat account status: bound, unbound, disabled, or auto-withdraw unavailable.
- Withdraw form: amount input, current minimum/maximum, submit button.
- Withdrawal result:
  - if `waiting_user_confirm`, call `wx.requestMerchantTransfer`
  - after return, call withdrawal sync and display the backend state
  - if `pending_manual`, show manual processing state
- Ledger and withdrawal history.

Miniapp capability handling:

- Check `wx.canIUse('requestMerchantTransfer')`.
- If unsupported, do not create fake success. Show a clear "微信版本过低，无法拉起官方确认收款页" message and keep the withdrawal syncable.

TypeScript support:

- Add a small declaration for `wx.requestMerchantTransfer` because Taro types may not include it.
- Keep existing payment provider abstraction for collecting payments; withdrawals are a separate payout module.

## Error Handling

Money movement rules:

- Never create duplicate transfer bills for the same withdrawal unless the previous bill is known terminal failed or closed.
- Never replace `out_bill_no` immediately after an uncertain WeChat API error.
- On uncertain WeChat response, query by merchant bill number before deciding whether to retry.
- Frontend callback success is not final success.
- Only callback/query terminal success can mark a withdrawal `success`.
- Terminal failure or close must add a release ledger entry exactly once.

User-facing errors:

- Insufficient balance: tell the owner the available amount.
- Unbound WeChat account: prompt the owner to bind through miniapp login.
- Transfer not enabled/configured: create or show manual withdrawal handling, depending on the action.
- WeChat unsupported version: ask the owner to update WeChat and allow later retry/sync.

## Testing And Verification

Backend tests:

- Completed zero-commission order creates one fare credit.
- Completed positive-commission order creates one fare credit after commission confirmation.
- Repeating completion or sync does not duplicate fare credit.
- Withdrawal creation reserves balance and rejects insufficient balance.
- Manual fallback creates `pending_manual`.
- Manual success keeps the hold and marks withdrawal success.
- Manual failure releases held balance.
- WeChat `WAIT_USER_CONFIRM` response stores `package_info`.
- WeChat terminal failure releases held balance exactly once.

Frontend validation:

- Wallet page renders all balance states.
- Withdraw action handles `waiting_user_confirm`, `pending_manual`, failure, and unsupported WeChat API.
- `pnpm validate`
- `pnpm build:weapp`

Backend validation:

- Targeted wallet/payment cargo tests.
- Existing payment tests remain passing.

## Rollout

1. Merge or base on the no-simulated-sandbox payment branch.
2. Deploy database migration and backend with `WECHAT_TRANSFER_ENABLED=false`.
3. Verify wallet ledger credits and manual fallback in production-like data.
4. Configure WeChat transfer env values and restart backend.
5. Run a small real transfer with a low amount.
6. Keep operations manual-complete/manual-fail tools available for support.

## Non-Goals

- No Alipay or Douyin payout implementation in this phase. Their interfaces can be reserved after the wallet domain is stable.
- No local fake or simulated successful payout.
- No automatic tax withholding calculation.
- No commission-from-fare deduction in the first release.
- No full admin finance dashboard beyond the minimum manual withdrawal handling endpoints required for fallback.
