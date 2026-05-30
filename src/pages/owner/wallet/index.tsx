import { useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { CircleAlert, Clock, CreditCard, RefreshCw, Wallet } from 'lucide-react-taro'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  bindOwnerWechat,
  confirmWechatMerchantTransfer,
  createOwnerWithdrawal,
  getOwnerWallet,
  OwnerWallet,
  syncOwnerWithdrawal,
} from '@/services/owner-wallet'

export default function OwnerWalletPage() {
  const [wallet, setWallet] = useState<OwnerWallet | null>(null)
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [binding, setBinding] = useState(false)
  const [syncingWithdrawalId, setSyncingWithdrawalId] = useState('')

  useDidShow(() => {
    loadWallet()
  })

  const readOwnerId = () => {
    const userInfo = Taro.getStorageSync('userInfo')
    if (!userInfo || userInfo.role !== 'owner') {
      Taro.showToast({ title: '请使用运力账号登录', icon: 'none' })
      setTimeout(() => Taro.redirectTo({ url: '/pages/index/index' }), 800)
      return ''
    }
    return userInfo.id || ''
  }

  const loadWallet = async () => {
    const ownerId = readOwnerId()
    if (!ownerId) return

    setLoading(true)
    try {
      setWallet(await getOwnerWallet(ownerId))
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '加载失败',
        icon: 'none',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleBindWechat = async () => {
    const ownerId = readOwnerId()
    if (!ownerId) return

    setBinding(true)
    try {
      setWallet(await bindOwnerWechat(ownerId))
      Taro.showToast({ title: '绑定成功', icon: 'success' })
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '绑定失败',
        icon: 'none',
      })
    } finally {
      setBinding(false)
    }
  }

  const handleWithdraw = async () => {
    const ownerId = readOwnerId()
    if (!ownerId || submitting) return

    const amountCents = Math.round(Number(amount) * 100)
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      Taro.showToast({ title: '请输入提现金额', icon: 'none' })
      return
    }

    setSubmitting(true)
    try {
      const result = await createOwnerWithdrawal(ownerId, amountCents)
      if (result.transferPayload) {
        await confirmWechatMerchantTransfer(result.transferPayload)
        await syncOwnerWithdrawal(result.withdrawal.id)
      }

      setAmount('')
      await loadWallet()
      Taro.showToast({
        title: withdrawalToastTitle(result.withdrawal.status),
        icon: 'success',
      })
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '提现失败',
        icon: 'none',
      })
      await loadWallet()
    } finally {
      setSubmitting(false)
    }
  }

  const handleSyncWithdrawal = async (withdrawalId: string) => {
    if (syncingWithdrawalId) return

    setSyncingWithdrawalId(withdrawalId)
    try {
      let result = await syncOwnerWithdrawal(withdrawalId)
      if (result.transferPayload) {
        await confirmWechatMerchantTransfer(result.transferPayload)
        result = await syncOwnerWithdrawal(withdrawalId)
      }

      await loadWallet()
      Taro.showToast({
        title: withdrawalToastTitle(result.withdrawal.status),
        icon: 'success',
      })
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '同步失败',
        icon: 'none',
      })
      await loadWallet()
    } finally {
      setSyncingWithdrawalId('')
    }
  }

  const summary = wallet?.summary
  const availability = wallet?.transferAvailability

  return (
    <AppPageShell
      title="运力钱包"
      subtitle="RecoRouter 运力端"
      icon={Wallet}
      contentClassName="space-y-4"
      bottom={<BottomNav type="owner" active="revenue" />}
      right={(
        <Button size="icon" variant="outline" onClick={loadWallet} disabled={loading}>
          <RefreshCw size={18} color="#2563eb" />
        </Button>
      )}
    >
      <Card className="bg-white rounded-lg shadow-sm">
        <CardContent className="p-4">
          <View className="flex items-start justify-between gap-3">
            <View className="min-w-0 flex-1">
              <Text className="block text-sm font-semibold text-gray-500">可提现余额</Text>
              <Text className="block text-3xl font-black text-gray-900 mt-2">
                {formatMoney(summary?.availableBalanceCents || 0)}
              </Text>
            </View>
            <Badge className="bg-blue-50 text-blue-700 px-3 py-1">
              <Text className="text-xs">{availability?.ready ? '微信自动提现' : '人工处理可用'}</Text>
            </Badge>
          </View>
          <View className="grid grid-cols-3 gap-3 mt-4">
            <Metric label="提现中" value={formatMoney(summary?.withdrawingBalanceCents || 0)} />
            <Metric label="已提现" value={formatMoney(summary?.withdrawnBalanceCents || 0)} />
            <Metric label="累计收入" value={formatMoney(summary?.lifetimeIncomeCents || 0)} />
          </View>
        </CardContent>
      </Card>

      <Card className="bg-white rounded-lg shadow-sm">
        <CardHeader>
          <View className="flex items-center justify-between gap-3">
            <View className="flex items-center gap-2">
              <CreditCard size={19} color="#2563eb" />
              <CardTitle className="text-base font-semibold">提现到微信零钱</CardTitle>
            </View>
            <Button size="sm" variant="outline" onClick={handleBindWechat} disabled={binding}>
              <Text className="text-xs">{wallet?.wechatAccount.bound ? '重新绑定' : '绑定微信'}</Text>
            </Button>
          </View>
        </CardHeader>
        <CardContent>
          {availability?.reason && (
            <View className="mb-3 rounded-lg bg-amber-50 px-3 py-2">
              <View className="flex items-start gap-2">
                <CircleAlert size={16} color="#d97706" />
                <Text className="block flex-1 text-xs leading-5 text-amber-700">
                  {availability.reason}
                </Text>
              </View>
            </View>
          )}
          <View className="flex items-center gap-2">
            <Input
              type="digit"
              value={amount}
              placeholder="输入提现金额"
              onInput={event => setAmount(String(event.detail.value || ''))}
            />
            <Button onClick={handleWithdraw} disabled={submitting || loading}>
              <Text className="text-sm">{submitting ? '提交中' : '提现'}</Text>
            </Button>
          </View>
          <Text className="block text-xs text-gray-500 mt-2">
            单笔范围 {formatMoney(availability?.minAmountCents || 1)} - {formatMoney(availability?.maxAmountCents || 199999)}
          </Text>
        </CardContent>
      </Card>

      <Card className="bg-white rounded-lg shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">提现记录</CardTitle>
        </CardHeader>
        <CardContent>
          {wallet?.withdrawals.length ? (
            <View className="space-y-3">
              {wallet.withdrawals.map(item => (
                <View key={item.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
                  <View className="flex items-center justify-between gap-3">
                    <View className="min-w-0 flex-1">
                      <Text className="block text-sm font-semibold text-gray-900">
                        {formatMoney(item.amountCents)}
                      </Text>
                      <Text className="block text-xs text-gray-500 mt-1">
                        {item.provider === 'wechat' ? '微信提现' : '人工提现'} · {formatTime(item.createdAt)}
                      </Text>
                      {item.failReason && (
                        <Text className="block text-xs text-red-500 mt-1">{item.failReason}</Text>
                      )}
                    </View>
                    <Badge className={statusBadgeClass(item.status)}>
                      <Text className="text-xs">{statusText(item.status)}</Text>
                    </Badge>
                  </View>
                  {canSyncWithdrawal(item) && (
                    <View className="flex justify-end mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSyncWithdrawal(item.id)}
                        disabled={syncingWithdrawalId === item.id}
                      >
                        <Text className="text-xs">
                          {syncingWithdrawalId === item.id ? '处理中' : syncButtonText(item)}
                        </Text>
                      </Button>
                    </View>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <EmptyState icon="clock" text="暂无提现记录" />
          )}
        </CardContent>
      </Card>

      <Card className="bg-white rounded-lg shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">钱包明细</CardTitle>
        </CardHeader>
        <CardContent>
          {wallet?.ledgerEntries.length ? (
            <View className="space-y-3">
              {wallet.ledgerEntries.map(item => (
                <View key={item.id} className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                  <View className="min-w-0 flex-1">
                    <Text className="block text-sm font-medium text-gray-900">
                      {ledgerText(item.entryType)}
                    </Text>
                    <Text className="block text-xs text-gray-500 mt-1">
                      {item.description || '钱包变动'} · {formatTime(item.createdAt)}
                    </Text>
                  </View>
                  <Text className={`block text-sm font-bold ${item.amountCents >= 0 ? 'text-green-600' : 'text-gray-900'}`}>
                    {item.amountCents >= 0 ? '+' : ''}{formatMoney(item.amountCents)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <EmptyState icon="wallet" text="订单完成后自动入账" />
          )}
        </CardContent>
      </Card>
    </AppPageShell>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View className="rounded-lg bg-gray-50 px-2 py-3 text-center">
      <Text className="block text-sm font-bold text-gray-900">{value}</Text>
      <Text className="block text-xs text-gray-500 mt-1">{label}</Text>
    </View>
  )
}

function EmptyState({ icon, text }: { icon: 'clock' | 'wallet'; text: string }) {
  const Icon = icon === 'clock' ? Clock : Wallet
  return (
    <View className="flex flex-col items-center py-6">
      <Icon size={28} color="#9ca3af" />
      <Text className="block text-sm text-gray-500 mt-2">{text}</Text>
    </View>
  )
}

function formatMoney(cents: number) {
  return `¥${(cents / 100).toFixed(2)}`
}

function formatTime(value?: string | null) {
  if (!value) return '刚刚'
  return value.replace('T', ' ').slice(0, 16)
}

function statusText(status: string) {
  switch (status) {
    case 'pending_manual':
      return '人工处理中'
    case 'pending_retry':
      return '待重试'
    case 'waiting_user_confirm':
      return '待确认'
    case 'transferring':
      return '处理中'
    case 'success':
      return '已到账'
    case 'failed':
      return '失败'
    case 'closed':
      return '已关闭'
    default:
      return status || '未知'
  }
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'success':
      return 'bg-green-50 text-green-700 px-2 py-1'
    case 'failed':
    case 'closed':
      return 'bg-red-50 text-red-700 px-2 py-1'
    case 'pending_manual':
    case 'pending_retry':
      return 'bg-amber-50 text-amber-700 px-2 py-1'
    default:
      return 'bg-blue-50 text-blue-700 px-2 py-1'
  }
}

function withdrawalToastTitle(status: string) {
  switch (status) {
    case 'pending_manual':
      return '已进入人工处理'
    case 'pending_retry':
      return '待充值后原单重试'
    case 'waiting_user_confirm':
      return '请确认收款'
    case 'success':
      return '提现已到账'
    default:
      return '提现已提交'
  }
}

function canSyncWithdrawal(item: { provider: string; status: string; failReason?: string | null }) {
  if (item.provider !== 'wechat') return false
  return ['pending_retry', 'waiting_user_confirm', 'transferring'].includes(item.status)
    || (item.status === 'pending_manual' && isRetryableWechatFailReason(item.failReason))
}

function syncButtonText(item: { status: string; failReason?: string | null }) {
  if (item.status === 'pending_retry' || isRetryableWechatFailReason(item.failReason)) {
    return '原单重试'
  }
  return '同步状态'
}

function isRetryableWechatFailReason(reason?: string | null) {
  return !!reason && [
    'NOT_ENOUGH',
    'SYSTEM_ERROR',
    'FREQUENCY_LIMIT',
    'FREQUENCY_LIMITED',
    'FREQUENCY_LIMIT_EXCEED',
    'RATELIMIT_EXCEEDED',
  ].some(code => reason.includes(code))
}

function ledgerText(entryType: string) {
  switch (entryType) {
    case 'fare_credit':
      return '订单运费收入'
    case 'withdrawal_hold':
      return '提现冻结'
    case 'withdrawal_release':
      return '提现退回'
    case 'manual_adjustment':
      return '人工调整'
    default:
      return '钱包变动'
  }
}
