import Taro from '@tarojs/taro'
import { Network } from '@/network'

export interface WalletSummary {
  availableBalanceCents: number
  withdrawingBalanceCents: number
  withdrawnBalanceCents: number
  lifetimeIncomeCents: number
}

export interface TransferAvailability {
  enabled: boolean
  ready: boolean
  mode: string
  reason?: string | null
  appid?: string | null
  mchId?: string | null
  minAmountCents: number
  maxAmountCents: number
}

export interface WechatAccountSummary {
  bound: boolean
  appid?: string | null
  status?: string | null
}

export interface WalletLedgerEntry {
  id: string
  entryType: string
  amountCents: number
  description?: string | null
  createdAt?: string | null
}

export interface OwnerWithdrawal {
  id: string
  provider: string
  amountCents: number
  status: string
  outBillNo: string
  transferBillNo?: string | null
  packageInfo?: string | null
  wechatState?: string | null
  failReason?: string | null
  manualNote?: string | null
  createdAt?: string | null
}

export interface OwnerWallet {
  ownerId: string
  summary: WalletSummary
  wechatAccount: WechatAccountSummary
  transferAvailability: TransferAvailability
  ledgerEntries: WalletLedgerEntry[]
  withdrawals: OwnerWithdrawal[]
}

export interface MerchantTransferPayload {
  mchId: string
  appId: string
  package: string
}

export interface WithdrawalActionResult {
  withdrawal: OwnerWithdrawal
  summary: WalletSummary
  transferPayload?: MerchantTransferPayload | null
}

interface MerchantTransferRuntime {
  canIUse?: (schema: string) => boolean
  requestMerchantTransfer?: (options: {
    mchId: string
    appId: string
    package: string
    success?: (res: { errMsg?: string; err_msg?: string }) => void
    fail?: (res: { errMsg?: string; err_msg?: string }) => void
    complete?: (res: { errMsg?: string; err_msg?: string }) => void
  }) => void
}

declare const wx: MerchantTransferRuntime | undefined

export async function getOwnerWallet(ownerId: string): Promise<OwnerWallet> {
  const response = await Network.request({
    url: `/api/owner-wallet/${ownerId}`,
    method: 'GET',
  })

  return unwrapApiData<OwnerWallet>(response.statusCode, response.data)
}

export async function bindOwnerWechat(ownerId: string): Promise<OwnerWallet> {
  const login = await Taro.login()
  const loginCode = typeof login.code === 'string' ? login.code : ''
  if (!loginCode) {
    throw new Error('微信登录凭证获取失败')
  }

  const response = await Network.request({
    url: '/api/owner-wallet/bind-wechat',
    method: 'POST',
    header: {
      'content-type': 'application/json',
    },
    data: {
      ownerId,
      loginCode,
    },
  })

  return unwrapApiData<OwnerWallet>(response.statusCode, response.data)
}

export async function createOwnerWithdrawal(
  ownerId: string,
  amountCents: number,
): Promise<WithdrawalActionResult> {
  const response = await Network.request({
    url: '/api/owner-wallet/withdrawals',
    method: 'POST',
    header: {
      'content-type': 'application/json',
    },
    data: {
      ownerId,
      amountCents,
    },
  })

  return unwrapApiData<WithdrawalActionResult>(response.statusCode, response.data)
}

export async function syncOwnerWithdrawal(
  withdrawalId: string,
): Promise<WithdrawalActionResult> {
  const response = await Network.request({
    url: `/api/owner-wallet/withdrawals/${withdrawalId}/sync`,
    method: 'POST',
  })

  return unwrapApiData<WithdrawalActionResult>(response.statusCode, response.data)
}

export function confirmWechatMerchantTransfer(
  payload: MerchantTransferPayload,
): Promise<void> {
  if (typeof wx === 'undefined' || typeof wx.requestMerchantTransfer !== 'function') {
    return Promise.reject(new Error('当前微信版本不支持确认收款'))
  }
  if (typeof wx.canIUse === 'function' && !wx.canIUse('requestMerchantTransfer')) {
    return Promise.reject(new Error('当前微信版本过低，请升级后再提现'))
  }

  return new Promise((resolve, reject) => {
    wx.requestMerchantTransfer?.({
      mchId: payload.mchId,
      appId: payload.appId,
      package: payload.package,
      success: () => resolve(),
      fail: res => reject(new Error(res.errMsg || res.err_msg || '微信确认收款页调起失败')),
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key]
  return typeof value === 'string' && value.trim() ? value : undefined
}

function readNumber(source: Record<string, unknown>, key: string): number | undefined {
  const value = source[key]
  return typeof value === 'number' ? value : undefined
}
