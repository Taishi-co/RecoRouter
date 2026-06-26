import { useEffect, useMemo, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Camera, ChevronLeft, Headphones, PackageCheck, RefreshCw, RotateCcw, X } from 'lucide-react-taro'
import { Textarea } from '@/components/ui/textarea'
import { createMallAfterSale, getMallOrder, resolveMallImageUrl, type MallAfterSale, type MallOrder } from '@/services/mall'
import { MallPage, MallPrimaryButton, mallYuan } from '../mall-ui'
import { redirectToMallAuth } from '../auth-route'

interface StoredUser {
  id?: string
}

type AfterSaleType = 'return_refund' | 'exchange' | 'refund_only'
type MallOrderItem = MallOrder['items'][number]

const afterSaleTypes: Array<{
  key: AfterSaleType
  title: string
  description: string
  scene: string
}> = [
  {
    key: 'return_refund',
    title: '退货退款',
    description: '已收到商品，需要寄回后退款',
    scene: '适用于破损、错发、品质问题等需要退回商品的情况',
  },
  {
    key: 'exchange',
    title: '换货',
    description: '保留订单，为您重新安排商品',
    scene: '适用于错发、破损但仍希望重新配送同款商品的情况',
  },
  {
    key: 'refund_only',
    title: '仅退款',
    description: '无需寄回商品，审核后原路退回',
    scene: '适用于少件、坏果、差价、称重调整等无需退货的情况',
  },
]

const reasonOptions = ['商品破损/坏果', '少件/漏发', '错发商品', '重量或价格有误', '其他问题']
const processSteps = [
  { title: '提交申请', description: '请确认商品、金额和问题说明后提交。' },
  { title: '客服审核', description: '客服会结合订单、凭证和配送记录核实。' },
  { title: '寄回或补发', description: '需要退货或换货时，会在会话中告知处理方式。' },
  { title: '退款完成', description: '通过后按支付方式原路退回，到账时间以支付渠道为准。' },
]

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
      const existingAfterSale = nextOrder.afterSales?.[0]
      const existingItemIds = existingAfterSale?.selectedItems
        ?.map((item) => item.orderItemId || item.id || '')
        .filter(Boolean) || []
      if (existingAfterSale) {
        setAfterSaleType((existingAfterSale.afterSaleType as AfterSaleType) || 'refund_only')
        setReason(existingAfterSale.reason || reasonOptions[0])
        setDescription(existingAfterSale.description || '')
        setEvidenceImages(existingAfterSale.evidenceImages || [])
      }
      setOrder(nextOrder)
      setSelectedOrderItemIds(existingItemIds.length ? existingItemIds : nextOrder.items.map((item) => item.id))
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
    () => selectedItems.reduce((sum, item) => sum + orderItemAmountCents(item), 0),
    [selectedItems],
  )
  const totalItemQuantity = useMemo(
    () => order?.items.reduce((sum, item) => sum + Math.max(Number(item.quantity || 0), 0), 0) || 0,
    [order],
  )
  const latestAfterSale = order?.afterSales?.[0]
  const isAfterSaleLocked = Boolean(latestAfterSale)

  const toggleItem = (itemId: string) => {
    if (isAfterSaleLocked) return
    setSelectedOrderItemIds((current) => {
      if (current.includes(itemId)) {
        return current.length > 1 ? current.filter((id) => id !== itemId) : current
      }
      return [...current, itemId]
    })
  }

  const addEvidence = async () => {
    if (isAfterSaleLocked) return
    try {
      const result = await Taro.chooseImage({ count: Math.max(1, 6 - evidenceImages.length) })
      setEvidenceImages((current) => [...current, ...result.tempFilePaths].slice(0, 6))
    } catch {
      Taro.showToast({ title: '未选择照片', icon: 'none' })
    }
  }

  const previewEvidenceImage = (imageUrl: string) => {
    const images = (evidenceImages.length ? evidenceImages : latestAfterSale?.evidenceImages || []).map(resolveMallImageUrl)
    Taro.previewImage({
      urls: images,
      current: resolveMallImageUrl(imageUrl),
    })
  }

  const removeEvidenceImage = (imageUrl: string) => {
    if (isAfterSaleLocked) return
    setEvidenceImages((current) => current.filter((item) => item !== imageUrl))
  }

  const submit = async () => {
    if (!order || submitting) return
    if (isAfterSaleLocked) {
      Taro.showToast({ title: '售后提交后不可修改', icon: 'none' })
      return
    }
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
          <Text className="mall-breadcrumb">我的 / 订单售后</Text>
          <Text className="mall-page-title">售后服务</Text>
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
              <Text className="mall-list-title">订单摘要</Text>
              <Text className="mall-status-pill">{statusLabel(latestAfterSale?.status || order.afterSaleStatus || '可申请')}</Text>
            </View>
            <Text className="mall-product-name">订单号 {order.orderNo}</Text>
            <Text className="mall-product-subtitle">共 {totalItemQuantity || order.items.length} 件商品 · 实付 {mallYuan(order.payableCents)}</Text>
            <Text className="mall-product-subtitle">收货信息：{order.addressText || '送货地址待确认'}</Text>
          </View>

          <View className="mall-card">
            <Text className="mall-list-title">选择售后服务</Text>
            {isAfterSaleLocked ? (
              <Text className="mall-product-subtitle">提交后不可修改。如需补充说明或更换处理方案，请联系客服协商。</Text>
            ) : null}
            <View className="mall-after-sale-method-list">
              {afterSaleTypes.map((item) => {
                const Icon = item.key === 'return_refund' ? RotateCcw : item.key === 'exchange' ? RefreshCw : PackageCheck
                const active = afterSaleType === item.key
                return (
                  <View
                    key={item.key}
                    className={active ? 'mall-after-sale-type mall-after-sale-type-active' : 'mall-after-sale-type'}
                    onClick={() => {
                      if (!isAfterSaleLocked) setAfterSaleType(item.key)
                    }}
                  >
                    <Icon size={18} color={active ? '#63BF54' : '#64725F'} />
                    <View className="mall-link-copy">
                      <Text className="mall-link-title">{item.title}</Text>
                      <Text className="mall-link-subtitle">{item.description}</Text>
                      <Text className="mall-product-subtitle">{item.scene}</Text>
                    </View>
                  <Text className="mall-status-pill">{active ? '已选择' : '选择'}</Text>
                  </View>
                )
              })}
            </View>
          </View>

          <View className="mall-card">
            <View className="mall-list-row" style={{ marginTop: 0 }}>
              <Text className="mall-list-title">选择售后商品</Text>
              <Text className="mall-section-action">已选 {selectedItems.length} 件</Text>
            </View>
            {order.items.map((item) => {
              const active = selectedOrderItemIds.includes(item.id)
              const imageUrl = resolveMallImageUrl(item.imageUrl)
              return (
                <View key={item.id} className={active ? 'mall-after-sale-item mall-after-sale-item-active' : 'mall-after-sale-item'} onClick={() => toggleItem(item.id)}>
                  <View className="mall-after-sale-check">
                    <Text>{active ? '✓' : ''}</Text>
                  </View>
                  {imageUrl ? (
                    <Image className="mall-orders-thumb" mode="aspectFill" src={imageUrl} />
                  ) : (
                    <View className="mall-orders-thumb mall-orders-thumb-empty" />
                  )}
                  <View className="mall-link-copy">
                    <Text className="mall-link-title">{item.productName}</Text>
                    <Text className="mall-link-subtitle">{orderItemSpecText(item)}</Text>
                    <Text className="mall-link-subtitle">数量 x{item.quantity} · 单价 {mallYuan(item.unitPriceCents)}</Text>
                  </View>
                  <View>
                    <Text className="mall-summary-value">{mallYuan(orderItemAmountCents(item))}</Text>
                    <Text className="mall-link-subtitle">{active ? '本次处理' : '不处理'}</Text>
                  </View>
                </View>
              )
            })}
          </View>

          <View className="mall-card">
            <View className="mall-list-row" style={{ marginTop: 0 }}>
              <Text className="mall-list-title">退款金额</Text>
              <Text className="mall-summary-value">{mallYuan(requestedAmountCents)}</Text>
            </View>
            <View className="mall-list-row">
              <Text className="mall-link-subtitle">预计处理金额</Text>
              <Text className="mall-section-action">{mallYuan(requestedAmountCents)}</Text>
            </View>
            <Text className="mall-product-subtitle">最终金额以客服审核、商品寄回状态和订单计价结果为准。</Text>
          </View>

          <View className="mall-card">
            <Text className="mall-list-title">问题描述</Text>
            <Text className="mall-product-subtitle">请选择最符合的售后原因，并补充问题细节。</Text>
            <View className="mall-reason-grid">
              {reasonOptions.map((item) => (
                <View
                  key={item}
                  className={reason === item ? 'mall-reason mall-reason-active' : 'mall-reason'}
                  onClick={() => {
                    if (!isAfterSaleLocked) setReason(item)
                  }}
                >
                  <Text>{item}</Text>
                </View>
              ))}
            </View>
            <Textarea
              className="mall-textarea"
              value={description}
              disabled={isAfterSaleLocked}
              onInput={(event) => {
                if (!isAfterSaleLocked) setDescription(String(event.detail.value || ''))
              }}
              placeholder="请填写商品问题、发现时间、期望处理方式等信息"
            />
          </View>

          <View className="mall-card">
            <View className="mall-list-row" style={{ marginTop: 0 }}>
              <Text className="mall-list-title">凭证上传</Text>
              <Text className="mall-section-action">{(isAfterSaleLocked ? latestAfterSale?.evidenceImages?.length || 0 : evidenceImages.length)}/6</Text>
            </View>
            <Text className="mall-product-subtitle">{isAfterSaleLocked ? '已提交的凭证只可查看，不可直接修改。' : '可上传商品、外包装、配送单等照片，便于客服核实。'}</Text>
            {(isAfterSaleLocked ? latestAfterSale?.evidenceImages?.length : evidenceImages.length) ? (
              <View className="mall-orders-images">
                {(isAfterSaleLocked ? latestAfterSale?.evidenceImages || [] : evidenceImages).map((imageUrl, index) => (
                  <View key={`${imageUrl}-${index}`} className="mall-evidence-thumb">
                    <Image
                      className="mall-orders-thumb"
                      mode="aspectFill"
                      src={resolveMallImageUrl(imageUrl)}
                      onClick={() => previewEvidenceImage(imageUrl)}
                    />
                    {!isAfterSaleLocked ? (
                      <View className="mall-evidence-delete" onClick={() => removeEvidenceImage(imageUrl)}>
                        <X size={12} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
            {!isAfterSaleLocked ? (
              <View className="mall-total-bar">
                <View>
                  <Text className="mall-total-label">售后凭证</Text>
                  <Text className="mall-total-value" style={{ fontSize: 13 }}>最多 6 张，建议拍清商品和外包装</Text>
                </View>
                <View className="mall-total-button" style={{ background: '#63BF54' }} onClick={addEvidence}>
                  <Camera size={16} color="#FFFFFF" />
                  <Text style={{ marginLeft: 4 }}>上传照片</Text>
                </View>
              </View>
            ) : null}
          </View>

          <View className="mall-card">
            <Text className="mall-list-title">处理流程</Text>
            <View className="mall-after-sale-flow">
              {processSteps.map((step, index) => (
                <View key={step.title} className="mall-after-sale-step">
                  <View className="mall-after-sale-dot" />
                  <View className="mall-link-copy">
                    <Text className="mall-link-title">{index + 1}. {step.title}</Text>
                    <Text className="mall-link-subtitle">{step.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {latestAfterSale ? (
            <AfterSaleProgress afterSale={latestAfterSale} />
          ) : (
            <View className="mall-card">
              <Text className="mall-list-title">已有售后进度</Text>
              <Text className="mall-product-subtitle">当前订单暂无进行中的售后申请。</Text>
            </View>
          )}

          {!isAfterSaleLocked ? (
            <View style={{ marginTop: 18 }}>
              <MallPrimaryButton onClick={submit}>
                <Text>{submitting ? '提交中...' : '提交售后申请'}</Text>
              </MallPrimaryButton>
            </View>
          ) : (
            <View className="mall-after-sale-readonly">
              <Text>提交后不可修改</Text>
              <Text>如需补充凭证、沟通退款或换货方案，请联系客服处理。</Text>
            </View>
          )}
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

function orderItemAmountCents(item: MallOrderItem) {
  return item.lineTotalCents || item.unitPriceCents * item.quantity || 0
}

function orderItemSpecText(item: MallOrderItem) {
  const details = [
    item.variantName ? `规格：${item.variantName}` : '',
    item.sku ? `货号：${item.sku}` : '',
    item.weightUnitLabel ? `单位：${item.weightUnitLabel}` : '',
  ].filter(Boolean)
  return details.join(' · ') || '默认规格'
}

function AfterSaleProgress({ afterSale }: { afterSale: MallAfterSale }) {
  const timeline = afterSale.timeline?.length
    ? afterSale.timeline
    : [{ status: afterSale.status, title: statusLabel(afterSale.status), description: afterSale.resolution || afterSale.description || '' }]

  return (
    <View className="mall-card">
      <View className="mall-list-row" style={{ marginTop: 0 }}>
        <Text className="mall-list-title">已有售后进度</Text>
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
