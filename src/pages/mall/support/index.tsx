import { useEffect, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Camera, ChevronLeft, Headphones } from 'lucide-react-taro'
import { Input } from '@/components/ui/input'
import {
  createSupportMessage,
  createSupportSession,
  getMallOrder,
  listSupportMessages,
  listSupportSessions,
  resolveMallImageUrl,
  type MallOrder,
  type SupportMessage,
  type SupportSession,
} from '@/services/mall'
import { MallBrandMark, MallPage, mallYuan } from '../mall-ui'
import { redirectToMallAuth } from '../auth-route'

interface StoredUser {
  id?: string
}

type MallSupportOrder = MallOrder & {
  supportPhone?: string | null
}

const QUICK_REPLIES = [
  {
    label: '配送进度',
    content: '想咨询这笔订单的配送进度，请帮我查看预计送达时间。',
  },
  {
    label: '申请售后',
    content: '这笔订单需要申请售后，请帮我确认可处理的方案。',
  },
  {
    label: '补充凭证',
    content: '我需要补充售后凭证，请帮我确认需要哪些照片或说明。',
  },
  {
    label: '改地址',
    content: '订单还没有配送的话，我想修改收货地址，请客服协助确认。',
  },
]
const INITIAL_SUPPORT_MESSAGE = '我的订单售后需要协助，请帮我查看进度。'

export default function MallSupportCenter() {
  const [, setSessions] = useState<SupportSession[]>([])
  const [selectedSession, setSelectedSession] = useState<SupportSession | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [order, setOrder] = useState<MallSupportOrder | null>(null)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const userId = (Taro.getStorageSync('userInfo') as StoredUser | undefined)?.id || ''
  const orderId = Taro.getCurrentInstance().router?.params?.orderId
  const sessionId = Taro.getCurrentInstance().router?.params?.sessionId
  const afterSaleId = Taro.getCurrentInstance().router?.params?.afterSaleId
  const topic = Taro.getCurrentInstance().router?.params?.topic === 'after-sale'
    ? '订单售后协商'
    : '商城订单售后咨询'

  useEffect(() => {
    if (!userId) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      redirectToMallAuth('/pages/mall/support/index')
    }
  }, [])

  useDidShow(() => {
    loadSessions()
  })

  useEffect(() => {
    if (!selectedSession?.id) return undefined
    const timer = setInterval(() => {
      loadMessages(selectedSession, true)
    }, 1000)
    return () => clearInterval(timer)
  }, [selectedSession?.id])

  const loadSessions = async () => {
    if (!userId) return
    try {
      const [nextSessions, nextOrder] = await Promise.all([
        listSupportSessions(userId),
        orderId ? getMallOrder(String(orderId)) : Promise.resolve(null),
      ])
      setOrder(nextOrder)
      setSessions(nextSessions)
      const session = sessionId
        ? nextSessions.find((item) => item.id === String(sessionId)) || nextSessions[0]
        : nextSessions[0]
      if (session) {
        setSelectedSession(session)
        await loadMessages(session)
      }
      setError('')
    } catch (loadError) {
      setSessions([])
      setSelectedSession(null)
      setMessages([])
      setError(loadError instanceof Error ? loadError.message : '客服数据加载失败')
    }
  }

  const loadMessages = async (session: SupportSession, silent = false) => {
    try {
      const nextMessages = await listSupportMessages(session.id)
      setMessages(nextMessages)
      if (!silent) setError('')
    } catch (messageError) {
      if (!silent) {
        setMessages([])
        setError(messageError instanceof Error ? messageError.message : '客服消息加载失败')
      }
    }
  }

  const ensureSession = async (autoSendInitialMessage = false) => {
    if (selectedSession) return selectedSession
    const session = await createSupportSession({
      userId,
      channel: 'mini_program',
      topic,
    })
    setSelectedSession(session)
    setSessions((current) => [session, ...current])
    if (autoSendInitialMessage) {
      const initialMessage = await createSupportMessage(session.id, {
        senderId: userId,
        senderRole: 'user',
        content: INITIAL_SUPPORT_MESSAGE,
        metadata: {
          orderId: orderId ? String(orderId) : undefined,
          afterSaleId: afterSaleId ? String(afterSaleId) : undefined,
          autoSendInitialMessage: true,
        },
      })
      setMessages([initialMessage])
    }
    return session
  }

  const sendMessageContent = async (content: string) => {
    const nextContent = content.trim()
    if (!nextContent) return
    try {
      const session = await ensureSession(topic === '订单售后协商')
      const message = await createSupportMessage(session.id, {
        senderId: userId,
        senderRole: 'user',
        content: nextContent,
        metadata: {
          orderId: orderId ? String(orderId) : undefined,
          afterSaleId: afterSaleId ? String(afterSaleId) : undefined,
        },
      })
      setMessages((current) => [...current, message])
      setDraft('')
    } catch (sendError) {
      Taro.showToast({
        title: sendError instanceof Error ? sendError.message : '发送失败',
        icon: 'none',
      })
    }
  }

  const sendMessage = async () => {
    await sendMessageContent(draft)
  }

  const handleQuickReply = async (content: string) => {
    await sendMessageContent(content)
  }

  const contactDelivery = async () => {
    const phone = order?.supportPhone?.trim()
    if (phone) {
      Taro.makePhoneCall({ phoneNumber: phone })
      return
    }
    Taro.showToast({ title: '暂无配送客服电话，已转在线客服', icon: 'none' })
    await sendMessageContent('订单暂无配送客服电话，请帮我跟进配送问题。')
  }

  const uploadEvidence = async () => {
    try {
      const result = await Taro.chooseImage({ count: 3 })
      if (!result.tempFilePaths.length) return
      const session = await ensureSession(topic === '订单售后协商')
      const message = await createSupportMessage(session.id, {
        senderId: userId,
        senderRole: 'user',
        content: `补充售后凭证 ${result.tempFilePaths.length} 张`,
        metadata: {
          orderId: orderId ? String(orderId) : undefined,
          afterSaleId: afterSaleId ? String(afterSaleId) : undefined,
          localImages: result.tempFilePaths,
        },
      })
      setMessages((current) => [...current, message])
      Taro.showToast({ title: '凭证已发送', icon: 'success' })
    } catch {
      Taro.showToast({ title: '未选择照片', icon: 'none' })
    }
  }

  const selectedAfterSale = order?.afterSales?.find((item) => item.id === String(afterSaleId || '')) || order?.afterSales?.[0]
  const selectedItems = selectedAfterSale?.selectedItems || []

  return (
    <MallPage active="mine">
      <View className="mall-back-row">
        <ChevronLeft size={24} color="#1F2D1F" onClick={() => Taro.navigateBack()} />
        <View>
          <View className="mall-back-brand">
            <MallBrandMark compact />
            <Text className="mall-top-brand">叁友甄选客服</Text>
          </View>
          <Text className="mall-breadcrumb">订单问题优先处理 · 在线客服</Text>
        </View>
      </View>

      <View className="mall-support-order-card mall-support-summary">
        <View className="mall-list-row" style={{ marginTop: 0 }}>
          <View>
            <Text className="mall-breadcrumb">当前咨询订单</Text>
            <Text className="mall-list-title">{order?.orderNo || (orderId ? String(orderId).slice(0, 10) : topic)}</Text>
          </View>
          <Text className="mall-status-pill">{selectedSession?.status || '待创建'}</Text>
        </View>
        <View className="mall-support-facts">
          <Fact label="订单号" value={order?.orderNo || (orderId ? String(orderId).slice(0, 10) : '未关联')} />
          <Fact label="实付" value={order ? mallYuan(order.payableCents) : '待确认'} />
          <Fact label={order?.afterSaleStatus ? '售后状态' : '订单状态'} value={orderStatusText(order)} />
          <Fact label="商品数量" value={order ? `${orderItemCount(order)} 件` : '待确认'} />
        </View>
        {order?.items.length ? (
          <View className="mall-support-items">
            {order.items.map((item) => {
              const imageUrl = resolveMallImageUrl(item.imageUrl)
              return (
                <View key={item.id} className="mall-support-item">
                  {imageUrl ? (
                    <Image className="mall-support-item-image" src={imageUrl} mode="aspectFill" />
                  ) : (
                    <View className="mall-support-item-image mall-support-item-empty" />
                  )}
                  <View className="mall-link-copy">
                    <Text className="mall-link-title">{item.productName}</Text>
                    <Text className="mall-link-subtitle">{item.variantName || '默认规格'} · x{item.quantity}</Text>
                  </View>
                  <Text className="mall-summary-value">{mallYuan(item.lineTotalCents || item.unitPriceCents * item.quantity || 0)}</Text>
                </View>
              )
            })}
          </View>
        ) : null}
        {selectedItems.length ? (
          <View className="mall-support-selected-items">
            <Text className="mall-breadcrumb">本次售后商品</Text>
            {selectedItems.map((item) => (
              <View key={item.orderItemId || item.id || item.productName} className="mall-support-item">
                <View className="mall-link-copy">
                  <Text className="mall-link-title">{item.productName || '售后商品'}</Text>
                  <Text className="mall-link-subtitle">{item.variantName || '默认规格'} · x{item.quantity || 1}</Text>
                </View>
                <Text className="mall-summary-value">{mallYuan(item.lineTotalCents || Number(item.unitPriceCents || 0) * Number(item.quantity || 1))}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {error ? <Text className="mall-empty-copy">{error}</Text> : null}

      <View className="mall-support-quick-replies">
        {QUICK_REPLIES.map((reply) => (
          <View key={reply.label} className="mall-small-button" onClick={() => handleQuickReply(reply.content)}>
            <Text>{reply.label}</Text>
          </View>
        ))}
      </View>

      <View className="mall-chat-list">
        {messages.map((message) => (
          <View key={message.id} className={message.senderRole === 'user' ? 'mall-chat-bubble mall-chat-bubble-user' : 'mall-chat-bubble'}>
            <Text className="mall-chat-text">{message.content}</Text>
            <Text className="mall-chat-time">{message.createdAt || ''}</Text>
          </View>
        ))}
        {!messages.length ? (
          <View className="mall-empty">
            <Text className="mall-empty-title">暂无客服消息</Text>
            <Text className="mall-empty-copy">点击快捷问题或输入消息后，将创建真实客服会话。</Text>
          </View>
        ) : null}
      </View>

      <View className="mall-support-actions">
        <View className="mall-small-button" onClick={uploadEvidence}>
          <Camera size={15} color="#1F2D1F" />
          <Text>上传照片</Text>
        </View>
        <View className="mall-small-button" onClick={() => Taro.navigateTo({ url: `/pages/mall/after-sale/index?orderId=${orderId || ''}` })}>
          <Text>查看进度</Text>
        </View>
        <View className="mall-small-button" onClick={contactDelivery}>
          <Headphones size={15} color="#1F2D1F" />
          <Text>联系配送客服</Text>
        </View>
      </View>

      <View className="mall-support-keyboard mall-chat-input-row">
        <Input
          className="mall-chat-input"
          value={draft}
          onInput={(event) => setDraft(String(event.detail.value || ''))}
          placeholder="输入问题或售后说明"
        />
        <View className="mall-chat-send" onClick={sendMessage}>
          <Text>发送</Text>
        </View>
      </View>
    </MallPage>
  )
}

function orderItemCount(order: MallOrder) {
  return order.items.reduce((sum, item) => sum + Math.max(Number(item.quantity || 0), 0), 0) || order.items.length || 1
}

function orderStatusText(order?: MallOrder | null) {
  if (!order) return '待确认'
  if (order.afterSaleStatus) return afterSaleStatusText(order.afterSaleStatus)
  if (order.refundStatus) return afterSaleStatusText(order.refundStatus)
  if (order.status === 'cancelled' || order.paymentStatus === 'cancelled') return '订单已取消'
  if (order.paymentStatus !== 'paid' || order.status === 'pending_payment') return '等待支付'
  if (order.status.includes('complete') || order.status.includes('finish')) return '商品已送达'
  if (order.status.includes('deliver') || order.status.includes('dispatch')) return '配送中'
  return '备货中'
}

function afterSaleStatusText(value?: string | null) {
  const labels: Record<string, string> = {
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
  return value ? labels[value] || value : '暂无售后'
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View className="mall-support-fact">
      <Text className="mall-summary-label">{label}</Text>
      <Text className="mall-summary-value">{value}</Text>
    </View>
  )
}
