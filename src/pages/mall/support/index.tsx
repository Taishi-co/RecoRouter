import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { BookOpen, Headphones, MessageCircle, Truck } from 'lucide-react-taro'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  createSupportMessage,
  createSupportSession,
  createSupportTicket,
  listSupportKnowledge,
  listSupportMessages,
  listSupportSessions,
  listSupportTickets,
  type SupportKnowledge,
  type SupportMessage,
  type SupportSession,
  type SupportTicket,
} from '@/services/mall'

type PanelKey = 'chat' | 'tickets' | 'tracking' | 'knowledge'

interface StoredUser {
  id?: string
}

export default function MallSupportCenter() {
  const [panel, setPanel] = useState<PanelKey>('chat')
  const [sessions, setSessions] = useState<SupportSession[]>([])
  const [selectedSession, setSelectedSession] = useState<SupportSession | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [knowledge, setKnowledge] = useState<SupportKnowledge[]>([])
  const [topic, setTopic] = useState('商城订单售后咨询')
  const [messageDraft, setMessageDraft] = useState('我的订单配送状态异常，请客服协助查看。')
  const [ticketTitle, setTicketTitle] = useState('申请售后处理')
  const [ticketDescription, setTicketDescription] = useState('商品破损或配送延迟，需要客服介入处理。')

  const userId = (Taro.getStorageSync('userInfo') as StoredUser | undefined)?.id || ''
  const orderId = Taro.getCurrentInstance().router?.params?.orderId

  useEffect(() => {
    guardLogin()
  }, [])

  useDidShow(() => {
    loadAll()
  })

  const guardLogin = () => {
    if (!userId) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      Taro.redirectTo({ url: '/pages/index/index' })
    }
  }

  const loadAll = async () => {
    if (!userId) return
    try {
      const [nextSessions, nextTickets, nextKnowledge] = await Promise.all([
        listSupportSessions(userId),
        listSupportTickets(userId),
        listSupportKnowledge(),
      ])
      setSessions(nextSessions)
      setTickets(nextTickets)
      setKnowledge(nextKnowledge)
      const nextSelected = selectedSession
        ? nextSessions.find((item) => item.id === selectedSession.id) || nextSessions[0]
        : nextSessions[0]
      if (nextSelected) {
        setSelectedSession(nextSelected)
        setMessages(await listSupportMessages(nextSelected.id))
      } else {
        setSelectedSession(null)
        setMessages([])
      }
    } catch (error) {
      showError(error, '客服数据加载失败')
    }
  }

  const startChat = async () => {
    if (!userId) return
    try {
      const session = await createSupportSession({
        userId,
        channel: 'mini_program',
        topic,
      })
      await createSupportMessage(session.id, {
        senderId: userId,
        senderRole: 'user',
        content: messageDraft,
      })
      Taro.showToast({ title: '客服已接入', icon: 'success' })
      await loadAll()
      setPanel('chat')
    } catch (error) {
      showError(error, '发起失败')
    }
  }

  const selectSession = async (session: SupportSession) => {
    try {
      setSelectedSession(session)
      setMessages(await listSupportMessages(session.id))
    } catch (error) {
      showError(error, '消息加载失败')
    }
  }

  const sendMessage = async () => {
    if (!selectedSession) {
      await startChat()
      return
    }
    try {
      await createSupportMessage(selectedSession.id, {
        senderId: userId,
        senderRole: 'user',
        content: messageDraft,
      })
      Taro.showToast({ title: '已发送', icon: 'success' })
      await selectSession(selectedSession)
    } catch (error) {
      showError(error, '发送失败')
    }
  }

  const submitTicket = async (category: 'after_sales' | 'delivery_tracking') => {
    if (!userId) return
    try {
      await createSupportTicket({
        userId,
        sessionId: selectedSession?.id,
        orderId,
        category,
        priority: category === 'delivery_tracking' ? 'high' : 'normal',
        title: category === 'delivery_tracking' ? '配送追踪客服介入' : ticketTitle,
        description: category === 'delivery_tracking' ? '无人车配送轨迹或开舱码异常，需要人工客服协助。' : ticketDescription,
      })
      Taro.showToast({ title: '工单已提交', icon: 'success' })
      await loadAll()
      setPanel('tickets')
    } catch (error) {
      showError(error, '提交失败')
    }
  }

  return (
    <AppPageShell
      title="客服中心"
      subtitle="在线客服 / 售后工单 / 配送追踪客服"
      icon={Headphones}
      bottom={<BottomNav type="merchant" active="mall" />}
      contentClassName="space-y-4"
    >
      <View className="grid grid-cols-2 gap-2">
        <QuickAction icon={<MessageCircle size={18} color="#0062FF" />} label="在线客服" value={`${sessions.length} 个会话`} onClick={() => setPanel('chat')} />
        <QuickAction icon={<Headphones size={18} color="#F97316" />} label="售后工单" value={`${tickets.length} 个工单`} onClick={() => setPanel('tickets')} />
        <QuickAction icon={<Truck size={18} color="#10B981" />} label="配送追踪" value={orderId ? '订单已带入' : '人工介入'} onClick={() => setPanel('tracking')} />
        <QuickAction icon={<BookOpen size={18} color="#64748B" />} label="知识库" value={`${knowledge.length} 篇`} onClick={() => setPanel('knowledge')} />
      </View>

      <View className="flex flex-row gap-2 overflow-x-auto">
        {[
          ['chat', '在线客服'],
          ['tickets', '售后工单'],
          ['tracking', '配送追踪'],
          ['knowledge', '知识库'],
        ].map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={panel === key ? 'default' : 'outline'}
            className="shrink-0 rounded-full"
            onClick={() => setPanel(key as PanelKey)}
          >
            <Text className="text-xs font-black">{label}</Text>
          </Button>
        ))}
      </View>

      {panel === 'chat' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                <Text className="text-base font-black text-gray-900">发起在线客服</Text>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input value={topic} placeholder="咨询主题" onInput={(event) => setTopic(String(event.detail.value || ''))} />
              <Textarea value={messageDraft} placeholder="输入问题" onInput={(event) => setMessageDraft(String(event.detail.value || ''))} />
              <View className="flex gap-2">
                <Button className="flex-1 rounded-full" onClick={startChat}>
                  <Text className="text-sm font-black text-white">新建会话</Text>
                </Button>
                <Button className="flex-1 rounded-full" variant="outline" onClick={sendMessage}>
                  <Text className="text-sm font-black text-primary">发送消息</Text>
                </Button>
              </View>
            </CardContent>
          </Card>

          {sessions.map((session) => (
            <Card key={session.id} className={selectedSession?.id === session.id ? 'bg-blue-50' : undefined} onClick={() => selectSession(session)}>
              <CardContent className="p-4">
                <View className="flex items-center justify-between">
                  <View className="min-w-0 flex-1">
                    <Text className="block text-sm font-black text-gray-900">{session.topic}</Text>
                    <Text className="mt-1 block text-xs font-bold text-gray-500">{session.lastMessage || '等待客服回复'}</Text>
                  </View>
                  <Badge className={session.status === 'open' ? 'bg-emerald-500' : 'bg-gray-500'}>
                    <Text className="text-xs text-white">{session.status}</Text>
                  </Badge>
                </View>
              </CardContent>
            </Card>
          ))}

          {selectedSession && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  <Text className="text-base font-black text-gray-900">会话记录</Text>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {messages.map((message) => (
                  <View key={message.id} className={message.senderRole === 'user' ? 'rounded-xl bg-blue-50 p-3' : 'rounded-xl bg-gray-50 p-3'}>
                    <Text className="block text-xs font-black text-gray-500">{message.senderRole === 'user' ? '我' : '客服'}</Text>
                    <Text className="mt-1 block text-sm font-bold text-gray-900">{message.content}</Text>
                  </View>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {panel === 'tickets' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <Text className="text-base font-black text-gray-900">售后工单</Text>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={ticketTitle} placeholder="工单标题" onInput={(event) => setTicketTitle(String(event.detail.value || ''))} />
            <Textarea value={ticketDescription} placeholder="问题描述" onInput={(event) => setTicketDescription(String(event.detail.value || ''))} />
            <Button className="w-full rounded-full" onClick={() => submitTicket('after_sales')}>
              <Text className="text-sm font-black text-white">提交售后工单</Text>
            </Button>
            {tickets.map((ticket) => (
              <View key={ticket.id} className="rounded-xl border border-gray-200 bg-white p-3">
                <View className="flex items-center justify-between">
                  <Text className="block text-sm font-black text-gray-900">{ticket.title}</Text>
                  <Text className="block text-xs font-black text-orange-500">{statusText(ticket.status)}</Text>
                </View>
                <Text className="mt-1 block text-xs font-bold text-gray-500">{ticket.description}</Text>
              </View>
            ))}
          </CardContent>
        </Card>
      )}

      {panel === 'tracking' && (
        <Card className="bg-gray-950">
          <CardContent className="p-4">
            <View className="flex items-center gap-3">
              <Truck size={24} color="#10B981" />
              <View className="min-w-0 flex-1">
                <Text className="block text-lg font-black text-white">配送追踪客服</Text>
                <Text className="mt-1 block text-xs font-bold text-emerald-100">
                  {orderId ? `已关联订单 ${orderId}` : '可提交轨迹、开舱码或冷链异常'}
                </Text>
              </View>
            </View>
            <Button className="mt-4 w-full rounded-full bg-emerald-500" onClick={() => submitTicket('delivery_tracking')}>
              <Text className="text-sm font-black text-white">请求人工介入</Text>
            </Button>
          </CardContent>
        </Card>
      )}

      {panel === 'knowledge' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <Text className="text-base font-black text-gray-900">自助知识库</Text>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {knowledge.map((article) => (
              <View key={article.id} className="rounded-xl bg-gray-50 p-3">
                <Text className="block text-sm font-black text-gray-900">{article.title}</Text>
                <Text className="mt-1 block text-xs font-bold text-gray-500">{article.content}</Text>
              </View>
            ))}
          </CardContent>
        </Card>
      )}
    </AppPageShell>
  )
}

const QuickAction = ({
  icon,
  label,
  value,
  onClick,
}: {
  icon: JSX.Element
  label: string
  value: string
  onClick: () => void
}) => (
  <Card onClick={onClick}>
    <CardContent className="p-4">
      <View className="flex items-center justify-between">
        {icon}
        <Text className="text-xs font-black text-gray-500">{value}</Text>
      </View>
      <Text className="mt-3 block text-sm font-black text-gray-900">{label}</Text>
    </CardContent>
  </Card>
)

function statusText(status: string) {
  const map: Record<string, string> = {
    open: '待处理',
    processing: '处理中',
    resolved: '已处理',
    closed: '已关闭',
  }
  return map[status] || status
}

function showError(error: unknown, fallback: string) {
  Taro.showToast({
    title: error instanceof Error ? error.message : fallback,
    icon: 'none',
  })
}
