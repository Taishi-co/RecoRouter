import { useEffect, useRef, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { Camera, ChevronLeft, Headphones } from 'lucide-react-taro'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  createSupportMessage,
  createSupportSession,
  getMallOrder,
  listSupportMessages,
  listSupportSessions,
  rateSupportSession,
  resolveMallImageUrl,
  uploadSupportEvidence,
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
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [rating, setRating] = useState(5)
  const [ratingTags, setRatingTags] = useState<string[]>([])
  const [ratingComment, setRatingComment] = useState('')
  const [ratingSaving, setRatingSaving] = useState(false)
  const pageVisibleRef = useRef(false)
  const sessionVersionRef = useRef('')
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
    pageVisibleRef.current = true
    loadSessions()
  })

  useDidHide(() => {
    pageVisibleRef.current = false
  })

  useEffect(() => {
    if (!selectedSession?.id) return undefined
    const timer = setInterval(() => {
      if (pageVisibleRef.current) pollSessionUpdates(selectedSession)
    }, 4000)
    return () => clearInterval(timer)
  }, [selectedSession?.id])

  const rememberSessionVersion = (nextSessions: SupportSession[]) => {
    nextSessions.forEach((session) => {
      const updatedAt = session.updatedAt || ''
      if (updatedAt > sessionVersionRef.current) sessionVersionRef.current = updatedAt
    })
  }

  const loadSessions = async () => {
    if (!userId) return
    try {
      const [nextSessions, nextOrder] = await Promise.all([
        listSupportSessions(userId),
        orderId ? getMallOrder(String(orderId)) : Promise.resolve(null),
      ])
      rememberSessionVersion(nextSessions)
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

  const loadMessages = async (session: SupportSession) => {
    try {
      const nextMessages = await listSupportMessages(session.id, userId)
      setMessages(nextMessages)
      setError('')
    } catch (messageError) {
      setMessages([])
      setError(messageError instanceof Error ? messageError.message : '客服消息加载失败')
    }
  }

  const pollSessionUpdates = async (session: SupportSession) => {
    try {
      const changedSessions = await listSupportSessions(userId, {
        updatedAfter: sessionVersionRef.current || undefined,
      })
      if (!changedSessions.length) return
      rememberSessionVersion(changedSessions)
      const changedIds = new Set(changedSessions.map((item) => item.id))
      setSessions((current) => [
        ...changedSessions,
        ...current.filter((item) => !changedIds.has(item.id)),
      ].sort((left, right) => (right.updatedAt || '').localeCompare(left.updatedAt || '')))
      const refreshedSession = changedSessions.find((item) => item.id === session.id)
      if (refreshedSession) {
        setSelectedSession(refreshedSession)
        await loadMessages(refreshedSession)
      }
    } catch {
      // 静默轮询失败时保留当前聊天内容，下一轮自动重试。
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
    if (!nextContent || sending) return
    setSending(true)
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
    } finally {
      setSending(false)
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
    if (uploading) return
    try {
      const result = await Taro.chooseImage({ count: 3, sizeType: ['compressed'], sourceType: ['album', 'camera'] })
      if (!result.tempFilePaths.length) return
      const session = await ensureSession(topic === '订单售后协商')
      setUploading(true)
      Taro.showLoading({ title: '正在上传凭证' })
      const uploads = await Promise.all(
        result.tempFilePaths.map((filePath) => uploadSupportEvidence(session.id, userId, filePath)),
      )
      const message = await createSupportMessage(session.id, {
        senderId: userId,
        senderRole: 'user',
        content: `已补充售后凭证 ${uploads.length} 张，请查收。`,
        metadata: {
          orderId: orderId ? String(orderId) : undefined,
          afterSaleId: afterSaleId ? String(afterSaleId) : undefined,
          evidenceImages: uploads.map((upload) => upload.url),
          evidenceFileKeys: uploads.map((upload) => upload.fileKey),
        },
      })
      setMessages((current) => [...current, message])
      Taro.showToast({ title: '凭证已发送', icon: 'success' })
    } catch (uploadError) {
      Taro.showToast({
        title: uploadError instanceof Error ? uploadError.message : '凭证上传失败',
        icon: 'none',
      })
    } finally {
      setUploading(false)
      Taro.hideLoading()
    }
  }

  const openAfterSaleProgress = () => {
    if (orderId) {
      Taro.navigateTo({ url: `/pages/mall/after-sale/index?orderId=${encodeURIComponent(String(orderId))}` })
      return
    }
    Taro.showToast({ title: '请先选择需要售后的订单', icon: 'none' })
    Taro.navigateTo({ url: '/pages/mall/orders/index?tab=after_sale' })
  }

  const submitRating = async () => {
    if (!selectedSession?.id || ratingSaving) return
    setRatingSaving(true)
    try {
      const satisfaction = await rateSupportSession(selectedSession.id, {
        userId,
        rating,
        tags: ratingTags,
        comment: ratingComment.trim() || undefined,
      })
      setSelectedSession((current) => current ? { ...current, satisfaction } : current)
      setSessions((current) => current.map((session) => (
        session.id === selectedSession.id ? { ...session, satisfaction } : session
      )))
      Taro.showToast({ title: '感谢您的评价', icon: 'success' })
    } catch (ratingError) {
      Taro.showToast({
        title: ratingError instanceof Error ? ratingError.message : '评价提交失败',
        icon: 'none',
      })
    } finally {
      setRatingSaving(false)
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
          <View key={reply.label} className="mall-small-button" onClick={() => !sending && handleQuickReply(reply.content)}>
            <Text>{reply.label}</Text>
          </View>
        ))}
      </View>

      <View className="mall-chat-list">
        {messages.map((message) => {
          const evidenceImages = Array.isArray(message.metadata?.evidenceImages)
            ? message.metadata.evidenceImages.filter((value): value is string => typeof value === 'string')
            : []
          return (
            <View key={message.id} className={message.senderRole === 'user' ? 'mall-chat-bubble mall-chat-bubble-user' : 'mall-chat-bubble'}>
              <Text className="mall-chat-text">{message.content}</Text>
              {evidenceImages.length ? (
                <View className="mall-chat-evidence-grid">
                  {evidenceImages.map((imageUrl) => (
                    <Image
                      key={imageUrl}
                      className="mall-chat-evidence-image"
                      src={imageUrl}
                      mode="aspectFill"
                      onClick={() => Taro.previewImage({ current: imageUrl, urls: evidenceImages })}
                    />
                  ))}
                </View>
              ) : null}
              <Text className="mall-chat-time">{message.createdAt || ''}</Text>
            </View>
          )
        })}
        {!messages.length ? (
          <View className="mall-empty">
            <Text className="mall-empty-title">暂无客服消息</Text>
            <Text className="mall-empty-copy">点击快捷问题或输入消息后，将创建真实客服会话。</Text>
          </View>
        ) : null}
      </View>

      {selectedSession && ['resolved', 'closed'].includes(selectedSession.status) ? (
        <View className="mall-support-rating-card">
          {selectedSession.satisfaction ? (
            <View className="mall-support-rating-complete">
              <Text className="mall-list-title">感谢评价</Text>
              <Text className="mall-support-rating-stars">{'★'.repeat(selectedSession.satisfaction.rating)}{'☆'.repeat(5 - selectedSession.satisfaction.rating)}</Text>
              <Text className="mall-empty-copy">您的反馈会进入客服质检，帮助我们持续改善服务。</Text>
            </View>
          ) : (
            <>
              <Text className="mall-list-title">这次客服解决问题了吗？</Text>
              <Text className="mall-empty-copy">请按真实体验评价，结果会直接计入客服服务质量。</Text>
              <View className="mall-support-rating-stars mall-support-rating-stars-selectable">
                {[1, 2, 3, 4, 5].map((value) => (
                  <Text key={value} onClick={() => setRating(value)}>{value <= rating ? '★' : '☆'}</Text>
                ))}
              </View>
              <View className="mall-support-rating-tags">
                {['响应及时', '解决问题', '态度友好', '仍需跟进'].map((tag) => {
                  const selected = ratingTags.includes(tag)
                  return (
                    <View
                      className={`mall-small-button ${selected ? 'mall-support-rating-tag-active' : ''}`}
                      key={tag}
                      onClick={() => setRatingTags((current) => selected ? current.filter((item) => item !== tag) : [...current, tag])}
                    >
                      <Text>{tag}</Text>
                    </View>
                  )
                })}
              </View>
              <Input
                className="mall-support-rating-input"
                value={ratingComment}
                onInput={(event) => setRatingComment(String(event.detail.value || ''))}
                placeholder="补充评价（选填）"
              />
              <Button className="mall-support-rating-submit" disabled={ratingSaving} onClick={submitRating}>
                <Text>{ratingSaving ? '提交中…' : '提交评价'}</Text>
              </Button>
            </>
          )}
        </View>
      ) : null}

      <View className="mall-support-actions">
        <View className="mall-small-button" onClick={uploadEvidence}>
          <Camera size={15} color="#1F2D1F" />
          <Text>{uploading ? '上传中…' : '上传照片'}</Text>
        </View>
        <View className="mall-small-button" onClick={openAfterSaleProgress}>
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
        <Button className="mall-chat-send" disabled={sending || !draft.trim()} onClick={sendMessage}>
          <Text>{sending ? '发送中…' : '发送'}</Text>
        </Button>
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
