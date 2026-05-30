# WeChat Merchant Transfer Setup

Date: 2026-05-31

This document lists the WeChat Pay platform setup required for RecoRouter owner wallet withdrawals.

## 1. Product Permission

Open WeChat Pay merchant platform:

`商户平台 > 产品中心 > 运营工具 > 商家转账`

Confirm the merchant has opened Merchant Transfer. The merchant ID used by this project is:

```text
1746295681
```

Official reference:

- https://pay.wechatpay.cn/doc/v3/merchant/4013740645

## 2. Transfer Initiation Mode

Open:

`商户平台 > 产品中心 > 运营工具 > 商家转账到零钱 > 前往功能`

Enable `API发起转账`.

Keep `页面发起转账` available if operations wants a manual merchant-platform fallback, but miniapp automatic withdrawal requires API initiation.

Official reference:

- https://pay.wechatpay.cn/doc/v3/merchant/4012064803

## 3. Transfer Scene

In the Merchant Transfer product settings, create or select the scene used for order fare withdrawals.

Record the scene ID into backend env:

```text
WECHAT_TRANSFER_SCENE_ID=
```

The current backend sends these scene report fields by default:

```text
WECHAT_TRANSFER_RECV_PERCEPTION=劳务报酬
WECHAT_TRANSFER_SCENE_INFO_TYPE_1=岗位类型
WECHAT_TRANSFER_SCENE_INFO_CONTENT_1=货运司机
WECHAT_TRANSFER_SCENE_INFO_TYPE_2=报酬说明
WECHAT_TRANSFER_SCENE_INFO_CONTENT_2=订单运费提现
```

If the WeChat platform shows different required `信息类型` names for the selected scene, update the env values to exactly match WeChat's scene requirements.

## 4. API Security IP

Configure the server's outbound public IP in WeChat Pay Merchant Transfer interface security IP settings.

For the current production server, confirm the outbound IP from the server before filling it in. It is usually the server public IP, but NAT or cloud egress can differ.

## 5. Transfer Verifier And Limit

Configure the transfer verifier and no-password threshold in WeChat merchant platform.

RecoRouter defaults to:

```text
WECHAT_TRANSFER_MIN_AMOUNT_CENTS=100
WECHAT_TRANSFER_MAX_AMOUNT_CENTS=199999
```

The default maximum is below 2000 yuan because WeChat requires receiver real-name verification for transfers of 2000 yuan or more. Raise this only after adding the WeChat Pay public-key encryption config for real-name fields.

## 6. Callback URL

Use HTTPS and no query parameters:

```text
WECHAT_TRANSFER_NOTIFY_URL=https://car.shcxyz.site/api/owner-wallet/wechat-transfer/notify
```

If this env is omitted, the backend derives the same URL from:

```text
PUBLIC_BASE_URL=https://car.shcxyz.site
```

Official transfer callback reference:

- https://pay.wechatpay.cn/doc/v3/merchant/4012712115

## 7. AppID Binding

Confirm the miniapp AppID is bound to merchant ID `1746295681`.

The backend uses the same AppID for:

- miniapp payment
- owner WeChat OpenID binding
- merchant transfer user confirmation

Required env:

```text
WECHAT_PAY_APPID=
WECHAT_MINIAPP_SECRET=
WECHAT_PAY_MCH_ID=1746295681
WECHAT_PAY_MCH_SERIAL_NO=
WECHAT_PAY_PRIVATE_KEY_PATH=
WECHAT_PAY_API_V3_KEY=
WECHAT_PAY_NOTIFY_URL=https://car.shcxyz.site/api/payments/wechat/notify
```

`WECHAT_PAY_PRIVATE_KEY` may be used instead of `WECHAT_PAY_PRIVATE_KEY_PATH`, but production should prefer a mounted private key file with strict permissions.

## 8. Enable Automatic Transfer

Start with:

```text
WECHAT_TRANSFER_ENABLED=false
```

After the platform settings above are verified, change to:

```text
WECHAT_TRANSFER_ENABLED=true
```

Then restart the backend container so env changes are loaded.

## 9. Fallback Behavior

If automatic transfer is disabled or configuration is incomplete, the owner can still create a withdrawal request. The backend marks it as:

```text
pending_manual
```

Operations can then handle the payout manually and mark it complete or failed through the admin withdrawal endpoints.

The system does not simulate successful WeChat transfer.

## 10. Production Smoke Test

Use a low amount first:

1. Complete an order and let the owner wallet receive order fare income.
2. Owner opens `运力端 > 钱包`.
3. Owner binds WeChat.
4. Owner submits a small withdrawal.
5. Miniapp should call the official `wx.requestMerchantTransfer` confirmation page.
6. Backend should receive callback or sync by merchant bill number.
7. The withdrawal should end at `success`.

Official API references:

- Create transfer bill: https://pay.wechatpay.cn/doc/v3/merchant/4012716434
- Query by merchant bill number: https://pay.wechatpay.cn/doc/v3/merchant/4012716437
- Miniapp user confirmation: https://pay.wechatpay.cn/doc/v3/merchant/4012716430
