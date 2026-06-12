import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Camera, ChevronLeft, Headphones } from 'lucide-react-taro'
import { Input } from '@/components/ui/input'
import {
  createSupportMessage,
  createSupportSession,
  getMallOrder,
  listSupportMessages,
  listSupportSessions,
  type MallOrder,
  type SupportMessage,
  type SupportSession,
} from '@/services/mall'
import { MallBrandMark, MallPage } from '../mall-ui'
import { redirectToMallAuth } from '../auth-route'

interface StoredUser {
  id?: string
}

export default function MallSupportCenter() {
  const [, setSessions] = useState<SupportSession[]>([])
  const [selectedSession, setSelectedSession] = useState<SupportSession | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [order, setOrder] = useState<MallOrder | null>(null)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('我的订单售后需要协助，请帮我查看进度。')
  const userId = (Taro.getStorageSync('userInfo') as StoredUser | undefined)?.id || ''
  const orderId = Taro.getCurrentInstance().router?.params?.orderId
  const topic = Taro.getCurrentInstance().router?.params?.topic === 'after-sale'
    ? '环果包赔 · 草莓拼团'
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

  const loadSessions = async () => {
    if (!userId) return
    try {
      const [nextSessions, nextOrder] = await Promise.all([
        listSupportSessions(userId),
        orderId ? getMallOrder(String(orderId)) : Promise.resolve(null),
      ])
      setOrder(nextOrder)
      setSessions(nextSessions)
      const session = nextSessions[0]
      if (session) {
        setSelectedSession(session)
        setMessages(await listSupportMessages(session.id))
      }
      setError('')
    } catch (loadError) {
      setSessions([])
      setSelectedSession(null)
      setMessages([])
      setError(loadError instanceof Error ? loadError.message : '客服数据加载失败')
    }
  }

  const ensureSession = async () => {
    if (selectedSession) return selectedSession
    const session = await createSupportSession({
      userId,
      channel: 'mini_program',
      topic,
    })
    setSelectedSession(session)
    setSessions((current) => [session, ...current])
    return session
  }

  const sendMessage = async () => {
    if (!draft.trim()) return
    try {
      const session = await ensureSession()
      const message = await createSupportMessage(session.id, {
        senderId: userId,
        senderRole: 'user',
        content: draft.trim(),
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

  const contactLeader = () => {
    const phone = order?.groupLeaderPhone || order?.recipientPhone
    if (phone) {
      Taro.makePhoneCall({ phoneNumber: phone })
      return
    }
    Taro.showToast({ title: '订单暂无团长联系方式', icon: 'none' })
  }

  return (
    <MallPage active="mine">
      <View className="mall-back-row">
        <ChevronLeft size={24} color="#1F2D1F" onClick={() => Taro.navigateBack()} />
        <View className="mall-back-brand">
          <MallBrandMark compact />
          <Text className="mall-top-brand">叁友甄选</Text>
        </View>
      </View>
      <Text className="mall-breadcrumb">我的 / 客服聊天</Text>
      <Text className="mall-page-title">客服聊天</Text>
      <Text className="mall-page-subtitle">围绕订单售后问题与客服小叁沟通，照片、退款进度和处理结论都保存在我的订单。</Text>

      <View className="mall-support-summary">
        <View className="mall-list-row" style={{ marginTop: 0 }}>
          <View>
            <Text className="mall-breadcrumb">我的订单支持</Text>
            <Text className="mall-list-title">{order?.orderNo || topic}</Text>
          </View>
          <Text className="mall-status-pill">{selectedSession?.status || '待创建'}</Text>
        </View>
        <View className="mall-support-facts">
          <Fact label="订单号" value={order?.orderNo || (orderId ? String(orderId).slice(0, 10) : '未关联')} />
          <Fact label="售后状态" value={order?.afterSaleStatus || '暂无售后'} />
          <Fact label="团长" value={order?.groupLeaderName || order?.recipientName || '待确认'} />
        </View>
      </View>
      {error ? <Text className="mall-empty-copy">{error}</Text> : null}

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
            <Text className="mall-empty-copy">发送第一条消息后将创建真实客服会话。</Text>
          </View>
        ) : null}
      </View>

      <View className="mall-support-actions">
        <View className="mall-small-button" onClick={() => Taro.showToast({ title: '请选择照片', icon: 'none' })}>
          <Camera size={15} color="#1F2D1F" />
          <Text>上传照片</Text>
        </View>
        <View className="mall-small-button" onClick={() => Taro.navigateTo({ url: `/pages/mall/after-sale/index?orderId=${orderId || ''}` })}>
          <Text>查看进度</Text>
        </View>
        <View className="mall-small-button" onClick={contactLeader}>
          <Headphones size={15} color="#1F2D1F" />
          <Text>联系团长</Text>
        </View>
      </View>

      <View className="mall-chat-input-row">
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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View className="mall-support-fact">
      <Text className="mall-summary-label">{label}</Text>
      <Text className="mall-summary-value">{value}</Text>
    </View>
  )
}
