import Taro from '@tarojs/taro'
import { Network } from '@/network'

export type PaymentProvider = 'wechat' | 'alipay' | 'douyin'
export type PaymentBusinessType = 'order_fare' | 'order_commission' | 'mall_order'

interface StartPaymentOptions {
  orderId: string
  businessType?: PaymentBusinessType
  provider?: PaymentProvider
  payerId?: string
}

interface PrepayResponse {
  paymentId: string
  provider: PaymentProvider
  businessType: PaymentBusinessType
  orderId: string
  outTradeNo: string
  amountCents: number
  status: string
  clientPayload: unknown
}

export interface PaymentSyncResult {
  paymentId: string
  provider: PaymentProvider
  businessType: PaymentBusinessType
  orderId: string
  status: string
  orderStatus?: string | null
  paymentStatus?: string | null
  commissionPaymentStatus?: string | null
}

interface DouyinPayResult {
  code?: number
  errMsg?: string
}

interface DouyinPayOptions {
  orderInfo: Record<string, unknown>
  service: number
  success?: (res: DouyinPayResult) => void
  fail?: (res: DouyinPayResult) => void
}

interface DouyinRuntime {
  pay?: (options: DouyinPayOptions) => void
}

declare const tt: DouyinRuntime | undefined

export function detectPaymentProvider(): PaymentProvider {
  const env = Taro.getEnv()

  if (env === Taro.ENV_TYPE.ALIPAY) {
    return 'alipay'
  }
  if (env === Taro.ENV_TYPE.TT) {
    return 'douyin'
  }

  return 'wechat'
}

export async function startOrderPayment(
  options: StartPaymentOptions,
): Promise<PaymentSyncResult> {
  const provider = options.provider || detectPaymentProvider()
  const loginCode = provider === 'wechat' ? await getWechatLoginCode() : undefined
  const prepay = await createPrepay({
    orderId: options.orderId,
    businessType: options.businessType || 'order_fare',
    provider,
    payerId: options.payerId,
    loginCode,
  })

  await invokePlatformPayment(prepay.provider, prepay.clientPayload)

  return syncPayment(prepay.paymentId)
}

async function createPrepay(body: {
  orderId: string
  businessType: PaymentBusinessType
  provider: PaymentProvider
  payerId?: string
  loginCode?: string
}): Promise<PrepayResponse> {
  const response = await Network.request({
    url: '/api/payments/prepay',
    method: 'POST',
    header: {
      'content-type': 'application/json',
    },
    data: body,
  })

  return unwrapApiData<PrepayResponse>(response.statusCode, response.data)
}

async function syncPayment(paymentId: string): Promise<PaymentSyncResult> {
  const response = await Network.request({
    url: `/api/payments/${paymentId}/sync`,
    method: 'POST',
  })

  return unwrapApiData<PaymentSyncResult>(response.statusCode, response.data)
}

async function invokePlatformPayment(
  provider: PaymentProvider,
  clientPayload: unknown,
): Promise<void> {
  if (provider === 'wechat') {
    const payload = toWechatPaymentPayload(clientPayload)
    await Taro.requestPayment(payload)
    return
  }

  if (provider === 'alipay') {
    const payload = toAlipayPaymentPayload(clientPayload)
    const result = await Taro.tradePay(payload)
    const resultCode = String(result.response?.resultCode || '')
    if (!['9000', '8000', '6004'].includes(resultCode)) {
      throw new Error('支付宝支付未完成')
    }
    return
  }

  await invokeDouyinPayment(clientPayload)
}

async function getWechatLoginCode(): Promise<string> {
  const result = await Taro.login()
  const code = isRecord(result) ? readString(result, 'code') : undefined

  if (!code) {
    throw new Error('微信登录凭证获取失败')
  }

  return code
}

function toWechatPaymentPayload(
  clientPayload: unknown,
): Taro.requestPayment.Option {
  const payload = requireRecord(clientPayload, '微信支付参数异常')

  return {
    timeStamp: requireString(payload, 'timeStamp'),
    nonceStr: requireString(payload, 'nonceStr'),
    package: requireString(payload, 'package'),
    signType: 'RSA',
    paySign: requireString(payload, 'paySign'),
  }
}

function toAlipayPaymentPayload(clientPayload: unknown): Taro.tradePay.Option {
  const payload = requireRecord(clientPayload, '支付宝支付参数异常')
  const tradeNO = readString(payload, 'tradeNO')
  const orderStr = readString(payload, 'orderStr')

  if (!tradeNO && !orderStr) {
    throw new Error('支付宝支付参数缺少 tradeNO 或 orderStr')
  }

  return { tradeNO, orderStr }
}

function invokeDouyinPayment(clientPayload: unknown): Promise<void> {
  const payload = requireRecord(clientPayload, '抖音支付参数异常')
  const orderInfo = requireRecord(payload.orderInfo, '抖音支付参数缺少 orderInfo')
  const service = readNumber(payload, 'service') || 5

  if (typeof tt === 'undefined' || typeof tt.pay !== 'function') {
    return Promise.reject(new Error('当前环境不支持抖音支付'))
  }

  return new Promise((resolve, reject) => {
    tt.pay?.({
      orderInfo,
      service,
      success: res => {
        if (res.code === 0 || res.code === 9) {
          resolve()
        } else {
          reject(new Error('抖音支付未完成'))
        }
      },
      fail: res => {
        reject(new Error(res.errMsg || '抖音支付调起失败'))
      },
    })
  })
}

function unwrapApiData<T>(statusCode: number, rawData: unknown): T {
  const body = parseBody(rawData)
  const message = isRecord(body) ? readString(body, 'message') : undefined

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(message || '请求失败')
  }
  if (!isRecord(body)) {
    throw new Error('接口响应格式异常')
  }

  const code = readNumber(body, 'code')
  if (typeof code === 'number' && code !== 200) {
    throw new Error(message || '请求失败')
  }
  if (!('data' in body)) {
    throw new Error(message || '接口响应缺少数据')
  }

  return body.data as T
}

function parseBody(rawData: unknown): unknown {
  if (typeof rawData !== 'string') {
    return rawData
  }

  try {
    return JSON.parse(rawData)
  } catch {
    return rawData
  }
}

function requireRecord(value: unknown, message: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(message)
  }

  return value
}

function requireString(source: Record<string, unknown>, key: string): string {
  const value = readString(source, key)
  if (!value) {
    throw new Error(`支付参数缺少 ${key}`)
  }

  return value
}

function readString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key]
  return typeof value === 'string' && value.trim() ? value : undefined
}

function readNumber(source: Record<string, unknown>, key: string): number | undefined {
  const value = source[key]
  return typeof value === 'number' ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
