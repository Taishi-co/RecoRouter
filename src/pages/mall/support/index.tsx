import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Camera, ChevronLeft, Headphones } from 'lucide-react-taro'
import { Input } from '@/components/ui/input'
import {
  createSupportMessage,
  createSupportSession,
  listSupportMessages,
  listSupportSessions,
  type SupportMessage,
  type SupportSession,
} from '@/services/mall'
import { MallPage } from '../mall-ui'

interface StoredUser {
  id?: string
}

export default function MallSupportCenter() {
  const [, setSessions] = useState<SupportSession[]>([])
  const [selectedSession, setSelectedSession] = useState<SupportSession | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [draft, setDraft] = useState('我的订单售后需要协助，请帮我查看进度。')
  const userId = (Taro.getStorageSync('userInfo') as StoredUser | undefined)?.id || ''
  const orderId = Taro.getCurrentInstance().router?.params?.orderId
  const topic = Taro.getCurrentInstance().router?.params?.topic === 'after-sale'
    ? '环果包赔 · 草莓拼团'
    : '商城订单售后咨询'

  useEffect(() => {
    if (!userId) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      Taro.redirectTo({ url: '/pages/index/index' })
    }
  }, [])

  useDidShow(() => {
    loadSessions()
  })

  const loadSessions = async () => {
    if (!userId) return
    try {
      const nextSessions = await listSupportSessions(userId)
      setSessions(nextSessions)
      const session = nextSessions[0]
      if (session) {
        setSelectedSession(session)
        setMessages(await listSupportMessages(session.id))
      }
    } catch {
      setSessions([])
      setSelectedSession(null)
      setMessages(fallbackMessages())
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
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: `local-${Date.now()}`,
          sessionId: selectedSession?.id || 'local-session',
          senderId: userId,
          senderRole: 'user',
          content: draft.trim(),
        },
      ])
      setDraft('')
    }
  }

  return (
    <MallPage active="mine">
      <View className="mall-back-row">
        <ChevronLeft size={24} color="#1F2D1F" onClick={() => Taro.navigateBack()} />
        <Text className="mall-top-brand">叁友甄选</Text>
      </View>
      <Text className="mall-breadcrumb">我的 / 客服聊天</Text>
      <Text className="mall-page-title">客服聊天</Text>
      <Text className="mall-page-subtitle">围绕订单售后问题与客服小叁沟通，照片、退款进度和处理结论都保存在我的订单。</Text>

      <View className="mall-support-summary">
        <View className="mall-list-row" style={{ marginTop: 0 }}>
          <View>
            <Text className="mall-breadcrumb">我的订单支持</Text>
            <Text className="mall-list-title">{topic}</Text>
          </View>
          <Text className="mall-status-pill">处理中</Text>
        </View>
        <View className="mall-support-facts">
          <Fact label="订单号" value={orderId ? String(orderId).slice(0, 10) : 'SY240618'} />
          <Fact label="售后单" value="AFTER-028" />
          <Fact label="预计回复" value="12分钟" />
        </View>
      </View>

      <View className="mall-chat-list">
        {(messages.length > 0 ? messages : fallbackMessages()).map((message) => (
          <View key={message.id} className={message.senderRole === 'user' ? 'mall-chat-bubble mall-chat-bubble-user' : 'mall-chat-bubble'}>
            <Text className="mall-chat-text">{message.content}</Text>
            <Text className="mall-chat-time">{message.senderRole === 'user' ? '09:43' : '09:42'}</Text>
          </View>
        ))}
      </View>

      <View className="mall-support-actions">
        <View className="mall-small-button" onClick={() => Taro.showToast({ title: '请选择照片', icon: 'none' })}>
          <Camera size={15} color="#1F2D1F" />
          <Text>上传照片</Text>
        </View>
        <View className="mall-small-button" onClick={() => Taro.navigateTo({ url: `/pages/mall/after-sale/index?orderId=${orderId || ''}` })}>
          <Text>查看进度</Text>
        </View>
        <View className="mall-small-button" onClick={() => Taro.showToast({ title: '团长中心待补齐', icon: 'none' })}>
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

function fallbackMessages(): SupportMessage[] {
  return [
    {
      id: 'm1',
      sessionId: 'local',
      senderRole: 'agent',
      content: '客服小叁：已进入我的订单售后客服，请补充坏果照片，我们会优先处理。',
    },
    {
      id: 'm2',
      sessionId: 'local',
      senderRole: 'user',
      content: '我：草莓有两盒压坏了，已拍照。',
    },
    {
      id: 'm3',
      sessionId: 'local',
      senderRole: 'agent',
      content: '客服小叁：照片收到，已为你发起坏果包赔，退款会回到原支付账户。',
    },
  ]
}
