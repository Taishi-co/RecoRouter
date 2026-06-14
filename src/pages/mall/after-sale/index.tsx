import { useEffect, useMemo, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Camera, ChevronLeft, Headphones, PackageCheck, RefreshCw, RotateCcw } from 'lucide-react-taro'
import { Textarea } from '@/components/ui/textarea'
import { createMallAfterSale, getMallOrder, type MallAfterSale, type MallOrder } from '@/services/mall'
import { MallPage, MallPrimaryButton, mallYuan } from '../mall-ui'
import { redirectToMallAuth } from '../auth-route'

interface StoredUser {
  id?: string
}

type AfterSaleType = 'return_refund' | 'exchange' | 'refund_only'

const afterSaleTypes: Array<{
  key: AfterSaleType
  title: string
  description: string
}> = [
  { key: 'return_refund', title: '退货退款', description: '商品需要退回，客服确认后退款' },
  { key: 'exchange', title: '换货', description: '破损、错发等需要重新配送' },
  { key: 'refund_only', title: '仅退款', description: '少件、坏果、差价等无需退回' },
]

const reasonOptions = ['商品破损/坏果', '少件/漏发', '错发商品', '重量或价格有误', '其他问题']

export default function MallAfterSalePage() {
  const [order, setOrder] = useState<MallOrder | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [afterSaleType, setAfterSaleType] = useState<AfterSaleType>('refund_only')
  const [reason, setReason] = useState(reasonOptions[0])
  const [description, setDescription] = useState('')
  const [selectedOrderItemIds, setSelectedOrderItemIds] = useState<string[]>([])
  const [evidenceImages, setEvidenceImages] = useState<string[]>([])
  const userId = (Taro.getStorageSync('userInfo') as StoredUser | undefined)?.id || ''
  const orderId = String(Taro.getCurrentInstance().router?.params?.orderId || '')

  useEffect(() => {
    loadOrder()
  }, [])

  const loadOrder = async () => {
    if (!userId) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      redirectToMallAuth(`/pages/mall/after-sale/index?orderId=${orderId}`)
      return
    }
    if (!orderId) {
      Taro.showToast({ title: '缺少订单信息', icon: 'none' })
      return
    }
    setLoading(true)
    try {
      const nextOrder = await getMallOrder(orderId)
      setOrder(nextOrder)
      setSelectedOrderItemIds(nextOrder.items.map((item) => item.id))
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '订单加载失败',
        icon: 'none',
      })
    } finally {
      setLoading(false)
    }
  }

  const selectedItems = useMemo(
    () => order?.items.filter((item) => selectedOrderItemIds.includes(item.id)) || [],
    [order, selectedOrderItemIds],
  )
  const requestedAmountCents = useMemo(
    () => selectedItems.reduce((sum, item) => sum + (item.lineTotalCents || item.unitPriceCents * item.quantity || 0), 0),
    [selectedItems],
  )
  const latestAfterSale = order?.afterSales?.[0]

  const toggleItem = (itemId: string) => {
    setSelectedOrderItemIds((current) => {
      if (current.includes(itemId)) {
        return current.length > 1 ? current.filter((id) => id !== itemId) : current
      }
      return [...current, itemId]
    })
  }

  const addEvidence = async () => {
    try {
      const result = await Taro.chooseImage({ count: Math.max(1, 6 - evidenceImages.length) })
      setEvidenceImages((current) => [...current, ...result.tempFilePaths].slice(0, 6))
    } catch {
      Taro.showToast({ title: '未选择照片', icon: 'none' })
    }
  }

  const submit = async () => {
    if (!order || submitting) return
    if (!selectedItems.length) {
      Taro.showToast({ title: '请选择售后商品', icon: 'none' })
      return
    }
    if (!description.trim()) {
      Taro.showToast({ title: '请填写问题说明', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      const afterSale = await createMallAfterSale(order.id, {
        userId,
        afterSaleType,
        reason,
        description: description.trim(),
        selectedItems: selectedItems.map((item) => ({
          orderItemId: item.id,
          productId: item.productId,
          variantId: item.variantId,
          variantName: item.variantName,
          productName: item.productName,
          sku: item.sku,
          unitPriceCents: item.unitPriceCents,
          quantity: item.quantity,
          lineTotalCents: item.lineTotalCents,
          pricingMode: item.pricingMode,
        })),
        requestedAmountCents,
        amountCents: requestedAmountCents,
        evidenceImages,
      })
      Taro.showToast({ title: '售后已提交', icon: 'success' })
      const sessionQuery = afterSale.supportSessionId ? `&sessionId=${afterSale.supportSessionId}` : ''
      Taro.navigateTo({ url: `/pages/mall/support/index?orderId=${order.id}&afterSaleId=${afterSale.id}&topic=after-sale${sessionQuery}` })
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '提交失败',
        icon: 'none',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <MallPage active="mine">
      <View className="mall-back-row">
        <ChevronLeft size={24} color="#1F2D1F" onClick={() => Taro.navigateBack()} />
        <View>
          <Text className="mall-breadcrumb">我的 / 售后服务</Text>
          <Text className="mall-page-title">申请售后</Text>
        </View>
      </View>

      {!order ? (
        <View className="mall-empty">
          <Text className="mall-empty-title">{loading ? '订单加载中...' : '暂无订单信息'}</Text>
          <Text className="mall-empty-copy">请从订单详情进入售后服务。</Text>
        </View>
      ) : null}

      {order ? (
        <>
          <View className="mall-card">
            <View className="mall-list-row" style={{ marginTop: 0 }}>
              <Text className="mall-list-title">订单 {order.orderNo}</Text>
              <Text className="mall-status-pill">{statusLabel(latestAfterSale?.status || order.afterSaleStatus || '可申请')}</Text>
            </View>
            <Text className="mall-product-subtitle">{order.addressText || '送货地址待确认'}</Text>
            <Text className="mall-product-name">实付 {mallYuan(order.payableCents)}</Text>
          </View>

          <View className="mall-card">
            <Text className="mall-list-title">售后类型</Text>
            <View className="mall-after-sale-type-grid">
              {afterSaleTypes.map((item) => {
                const Icon = item.key === 'return_refund' ? RotateCcw : item.key === 'exchange' ? RefreshCw : PackageCheck
                return (
                  <View
                    key={item.key}
                    className={afterSaleType === item.key ? 'mall-after-sale-type mall-after-sale-type-active' : 'mall-after-sale-type'}
                    onClick={() => setAfterSaleType(item.key)}
                  >
                    <Icon size={18} color={afterSaleType === item.key ? '#63BF54' : '#64725F'} />
                    <Text className="mall-link-title">{item.title}</Text>
                    <Text className="mall-link-subtitle">{item.description}</Text>
                  </View>
                )
              })}
            </View>
          </View>

          <View className="mall-card">
            <View className="mall-list-row" style={{ marginTop: 0 }}>
              <Text className="mall-list-title">选择商品</Text>
              <Text className="mall-section-action">预计 {mallYuan(requestedAmountCents)}</Text>
            </View>
            {order.items.map((item) => {
              const active = selectedOrderItemIds.includes(item.id)
              return (
                <View key={item.id} className={active ? 'mall-after-sale-item mall-after-sale-item-active' : 'mall-after-sale-item'} onClick={() => toggleItem(item.id)}>
                  <View className="mall-after-sale-check">
                    <Text>{active ? '✓' : ''}</Text>
                  </View>
                  <View className="mall-link-copy">
                    <Text className="mall-link-title">{item.productName}{item.variantName ? ` · ${item.variantName}` : ''}</Text>
                    <Text className="mall-link-subtitle">数量 {item.quantity} · 单价 {mallYuan(item.unitPriceCents)}</Text>
                  </View>
                  <Text className="mall-summary-value">{mallYuan(item.lineTotalCents)}</Text>
                </View>
              )
            })}
          </View>

          <View className="mall-card">
            <Text className="mall-list-title">售后原因</Text>
            <View className="mall-reason-grid">
              {reasonOptions.map((item) => (
                <View
                  key={item}
                  className={reason === item ? 'mall-reason mall-reason-active' : 'mall-reason'}
                  onClick={() => setReason(item)}
                >
                  <Text>{item}</Text>
                </View>
              ))}
            </View>
            <Textarea
              className="mall-textarea"
              value={description}
              onInput={(event) => setDescription(String(event.detail.value || ''))}
              placeholder="请说明问题、期望处理方式，客服会在会话里继续沟通"
            />
          </View>

          <View className="mall-total-bar">
            <View>
              <Text className="mall-total-label">凭证照片 {evidenceImages.length} 张</Text>
              <Text className="mall-total-value" style={{ fontSize: 13 }}>最多 6 张，建议拍清商品和外包装</Text>
            </View>
            <View className="mall-total-button" style={{ background: '#63BF54' }} onClick={addEvidence}>
              <Camera size={16} color="#FFFFFF" />
              <Text style={{ marginLeft: 4 }}>上传</Text>
            </View>
          </View>

          {latestAfterSale ? <AfterSaleProgress afterSale={latestAfterSale} /> : null}

          <View style={{ marginTop: 18 }}>
            <MallPrimaryButton onClick={submit}>
              <Text>{submitting ? '提交中...' : '提交售后申请'}</Text>
            </MallPrimaryButton>
          </View>
          <View style={{ marginTop: 10 }}>
            <MallPrimaryButton subtle onClick={() => Taro.navigateTo({ url: `/pages/mall/support/index?orderId=${order.id}${latestAfterSale?.supportSessionId ? `&sessionId=${latestAfterSale.supportSessionId}` : ''}` })}>
              <Headphones size={18} color="#2F7E43" />
              <Text style={{ marginLeft: 6 }}>联系客服</Text>
            </MallPrimaryButton>
          </View>
        </>
      ) : null}
    </MallPage>
  )
}

function AfterSaleProgress({ afterSale }: { afterSale: MallAfterSale }) {
  const timeline = afterSale.timeline?.length
    ? afterSale.timeline
    : [{ status: afterSale.status, title: statusLabel(afterSale.status), description: afterSale.resolution || afterSale.description || '' }]

  return (
    <View className="mall-card">
      <View className="mall-list-row" style={{ marginTop: 0 }}>
        <Text className="mall-list-title">售后进度</Text>
        <Text className="mall-status-pill">{afterSaleTypeLabel(afterSale.afterSaleType)}</Text>
      </View>
      {timeline.map((event, index) => (
        <View key={`${event.status || index}-${index}`} className="mall-after-sale-step">
          <View className="mall-after-sale-dot" />
          <View className="mall-link-copy">
            <Text className="mall-link-title">{event.title || statusLabel(event.status || afterSale.status)}</Text>
            {event.description ? <Text className="mall-link-subtitle">{event.description}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  )
}

function afterSaleTypeLabel(value?: string | null) {
  if (value === 'return_refund') return '退货退款'
  if (value === 'exchange') return '换货'
  if (value === 'refund_only') return '仅退款'
  return '售后'
}

function statusLabel(value?: string | null) {
  const map: Record<string, string> = {
    submitted: '已提交',
    negotiating: '协商中',
    approved: '已通过',
    return_pending: '待退货',
    returning: '退货中',
    exchange_processing: '换货中',
    replacement_sent: '补发中',
    refunding: '退款中',
    refunded: '已退款',
    resolved: '已完成',
    rejected: '已驳回',
    closed: '已关闭',
  }
  return value ? map[value] || value : '可申请'
}
