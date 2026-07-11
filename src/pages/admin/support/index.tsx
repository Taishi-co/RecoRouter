import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { BookOpen, ChartNoAxesCombined, ClipboardList, Headphones, MessageCircle } from 'lucide-react-taro'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  adminSupportMetrics,
  createAdminSupportKnowledge,
  createAdminSupportMessage,
  createAdminSupportTicket,
  listAdminSupportKnowledge,
  listAdminSupportMessages,
  listAdminSupportSessions,
  listAdminSupportTickets,
  updateAdminSupportTicket,
  type SupportKnowledge,
  type SupportMessage,
  type SupportSession,
  type SupportTicket,
} from '@/services/mall'

type PanelKey = 'sessions' | 'tickets' | 'knowledge' | 'metrics'

interface StoredUser {
  id?: string
  role?: string
}

export default function AdminSupportWorkbench() {
  const [panel, setPanel] = useState<PanelKey>('sessions')
  const [sessions, setSessions] = useState<SupportSession[]>([])
  const [selectedSession, setSelectedSession] = useState<SupportSession | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [knowledge, setKnowledge] = useState<SupportKnowledge[]>([])
  const [metrics, setMetrics] = useState<Record<string, number>>({})
  const [reply, setReply] = useState('您好，客服已接入，请补充订单号或配送异常截图。')
  const [articleTitle, setArticleTitle] = useState('无人车开舱码失效处理')
  const [articleContent, setArticleContent] = useState('核验订单状态后重新发送短信开舱码，并同步配送追踪事件。')

  const currentUser = (Taro.getStorageSync('userInfo') as StoredUser | undefined) || {}

  useEffect(() => {
    if (currentUser.role !== 'admin') {
      Taro.showToast({ title: '无权限访问', icon: 'none' })
      Taro.redirectTo({ url: '/pages/index/index' })
      return
    }
    loadAll()
  }, [])

  const loadAll = async () => {
    try {
      const [nextSessions, nextTickets, nextKnowledge, nextMetrics] = await Promise.all([
        listAdminSupportSessions(),
        listAdminSupportTickets(),
        listAdminSupportKnowledge(),
        adminSupportMetrics(),
      ])
      setSessions(nextSessions)
      setTickets(nextTickets)
      setKnowledge(nextKnowledge)
      setMetrics(nextMetrics)
      const nextSelected = selectedSession
        ? nextSessions.find((item) => item.id === selectedSession.id) || nextSessions[0]
        : nextSessions[0]
      if (nextSelected) {
        setSelectedSession(nextSelected)
        setMessages(await listAdminSupportMessages(nextSelected.id))
      } else {
        setSelectedSession(null)
        setMessages([])
      }
    } catch (error) {
      showError(error, '加载失败')
    }
  }

  const openSession = async (session: SupportSession) => {
    try {
      setSelectedSession(session)
      setMessages(await listAdminSupportMessages(session.id))
    } catch (error) {
      showError(error, '消息加载失败')
    }
  }

  const sendReply = async () => {
    if (!selectedSession) return
    try {
      await createAdminSupportMessage(selectedSession.id, {
        senderId: currentUser.id || 'admin',
        senderRole: 'agent',
        content: reply,
      })
      Taro.showToast({ title: '已回复', icon: 'success' })
      await openSession(selectedSession)
    } catch (error) {
      showError(error, '回复失败')
    }
  }

  const createTicketFromSession = async () => {
    if (!selectedSession) return
    try {
      await createAdminSupportTicket({
        userId: selectedSession.userId,
        sessionId: selectedSession.id,
        category: 'delivery_tracking',
        priority: 'high',
        title: '配送追踪异常需人工介入',
        description: selectedSession.lastMessage || selectedSession.topic,
      })
      Taro.showToast({ title: '工单已生成', icon: 'success' })
      await loadAll()
    } catch (error) {
      showError(error, '生成失败')
    }
  }

  const resolveTicket = async (ticket: SupportTicket) => {
    try {
      await updateAdminSupportTicket(ticket.id, {
        status: 'resolved',
        assignedAgentId: currentUser.id || 'admin',
        resolution: '已完成用户沟通，配送或退款处理已同步。',
      })
      Taro.showToast({ title: '工单已处理', icon: 'success' })
      await loadAll()
    } catch (error) {
      showError(error, '处理失败')
    }
  }

  const publishKnowledge = async () => {
    try {
      await createAdminSupportKnowledge({
        title: articleTitle,
        category: 'after_sales',
        content: articleContent,
        status: 'published',
      })
      Taro.showToast({ title: '知识库已发布', icon: 'success' })
      await loadAll()
    } catch (error) {
      showError(error, '发布失败')
    }
  }

  return (
    <AppPageShell
      title="客服工作台"
      subtitle="在线客服 / 售后工单 / 配送追踪 / 知识库"
      icon={Headphones}
      bottom={<BottomNav type="admin" active="support" />}
      contentClassName="space-y-4"
    >
      <View className="grid grid-cols-2 gap-2">
        <Metric label="在线会话" value={metricValue(metrics.openSessions)} />
        <Metric label="待处理工单" value={metricValue(metrics.openTickets)} tone="warn" />
        <Metric label="售后处理中" value={metricValue(metrics.afterSales)} tone="warn" />
        <Metric label="知识库" value={metricValue(metrics.knowledgeArticles)} />
      </View>

      <View className="flex flex-row gap-2 overflow-x-auto">
        {[
          ['sessions', '会话队列'],
          ['tickets', '工单处理'],
          ['knowledge', '知识库'],
          ['metrics', '绩效'],
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

      {panel === 'sessions' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                <View className="flex items-center gap-2">
                  <MessageCircle size={18} color="#0062FF" />
                  <Text className="text-base font-black text-gray-900">Web 客服会话队列</Text>
                </View>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sessions.map((session) => (
                <AdminRow
                  key={session.id}
                  title={`${session.topic} · ${session.userId}`}
                  subtitle={`${channelText(session.channel)} · ${session.lastMessage || '等待用户消息'}`}
                  active={selectedSession?.id === session.id}
                >
                  <Badge className={session.status === 'open' ? 'bg-emerald-500' : 'bg-gray-500'}>
                    <Text className="text-xs text-white">{session.status}</Text>
                  </Badge>
                  <Button size="sm" variant="outline" onClick={() => openSession(session)}>
                    <Text className="text-xs font-black text-primary">进入</Text>
                  </Button>
                </AdminRow>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                <Text className="text-base font-black text-gray-900">在线客服回复</Text>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {messages.length === 0 ? (
                <Text className="block text-sm font-bold text-gray-500">请选择会话查看消息</Text>
              ) : (
                messages.map((message) => (
                  <View key={message.id} className={message.senderRole === 'agent' ? 'rounded-xl bg-blue-50 p-3' : 'rounded-xl bg-gray-50 p-3'}>
                    <Text className="block text-xs font-black text-gray-500">{message.senderRole === 'agent' ? '客服' : '用户'}</Text>
                    <Text className="mt-1 block text-sm font-bold text-gray-900">{message.content}</Text>
                  </View>
                ))
              )}
              <Textarea value={reply} placeholder="输入客服回复" onInput={(event) => setReply(String(event.detail.value || ''))} />
              <View className="flex gap-2">
                <Button className="flex-1 rounded-full" onClick={sendReply}>
                  <Text className="text-sm font-black text-white">发送回复</Text>
                </Button>
                <Button className="flex-1 rounded-full" variant="outline" onClick={createTicketFromSession}>
                  <Text className="text-sm font-black text-primary">转工单</Text>
                </Button>
              </View>
            </CardContent>
          </Card>
        </>
      )}

      {panel === 'tickets' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <View className="flex items-center gap-2">
                <ClipboardList size={18} color="#0062FF" />
                <Text className="text-base font-black text-gray-900">售后工单处理</Text>
              </View>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tickets.map((ticket) => (
              <AdminRow key={ticket.id} title={`${ticket.title} · ${priorityText(ticket.priority)}`} subtitle={`${ticket.category} · ${ticket.description || '暂无描述'}`}>
                <Badge className={ticket.status === 'resolved' ? 'bg-emerald-500' : 'bg-orange-500'}>
                  <Text className="text-xs text-white">{statusText(ticket.status)}</Text>
                </Badge>
                <Button size="sm" onClick={() => resolveTicket(ticket)}>
                  <Text className="text-xs font-black text-white">处理</Text>
                </Button>
              </AdminRow>
            ))}
          </CardContent>
        </Card>
      )}

      {panel === 'knowledge' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <View className="flex items-center gap-2">
                <BookOpen size={18} color="#0062FF" />
                <Text className="text-base font-black text-gray-900">知识库发布</Text>
              </View>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={articleTitle} placeholder="知识库标题" onInput={(event) => setArticleTitle(String(event.detail.value || ''))} />
            <Textarea value={articleContent} placeholder="处理步骤" onInput={(event) => setArticleContent(String(event.detail.value || ''))} />
            <Button className="w-full rounded-full" onClick={publishKnowledge}>
              <Text className="text-sm font-black text-white">发布知识库</Text>
            </Button>
            {knowledge.map((article) => (
              <AdminRow key={article.id} title={article.title} subtitle={`${article.category} · 引用 ${article.useCount} 次`}>
                <Badge className={article.status === 'published' ? 'bg-emerald-500' : 'bg-gray-500'}>
                  <Text className="text-xs text-white">{article.status}</Text>
                </Badge>
              </AdminRow>
            ))}
          </CardContent>
        </Card>
      )}

      {panel === 'metrics' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <View className="flex items-center gap-2">
                <ChartNoAxesCombined size={18} color="#0062FF" />
                <Text className="text-base font-black text-gray-900">客服绩效</Text>
              </View>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <AdminRow title="响应队列" subtitle={`${metricValue(metrics.openSessions)} 个打开会话，优先处理配送追踪与售后`} />
            <AdminRow title="工单 SLA" subtitle={`${metricValue(metrics.openTickets)} 个待处理工单，退款审核承诺 10 分钟内`} />
            <AdminRow title="知识库覆盖" subtitle={`${metricValue(metrics.knowledgeArticles)} 篇可用文章，可复用到小程序客服中心`} />
          </CardContent>
        </Card>
      )}
    </AppPageShell>
  )
}

const Metric = ({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) => (
  <Card className={tone === 'warn' ? 'bg-orange-50' : 'bg-blue-50'}>
    <CardContent className="p-4">
      <Text className="block text-xs font-bold text-gray-500">{label}</Text>
      <Text className={tone === 'warn' ? 'mt-1 block text-2xl font-black text-orange-500' : 'mt-1 block text-2xl font-black text-blue-600'}>
        {value}
      </Text>
    </CardContent>
  </Card>
)

const AdminRow = ({
  title,
  subtitle,
  children,
  active,
}: {
  title: string
  subtitle: string
  children?: ReactNode
  active?: boolean
}) => (
  <View className={active ? 'rounded-xl border border-blue-300 bg-blue-50 p-3' : 'rounded-xl border border-gray-200 bg-white p-3'}>
    <View className="flex items-start justify-between gap-3">
      <View className="min-w-0 flex-1">
        <Text className="block text-sm font-black text-gray-900">{title}</Text>
        <Text className="mt-1 block text-xs font-bold text-gray-500">{subtitle}</Text>
      </View>
      {children && <View className="flex shrink-0 items-center gap-2">{children}</View>}
    </View>
  </View>
)

function metricValue(value?: number) {
  return `${value || 0}`
}

function channelText(channel: string) {
  const map: Record<string, string> = {
    mini_program: '小程序客服',
    web_queue: 'Web 队列',
    mall_after_sales: '商城售后',
  }
  return map[channel] || channel
}

function statusText(status: string) {
  const map: Record<string, string> = {
    open: '待处理',
    processing: '处理中',
    resolved: '已处理',
    closed: '已关闭',
  }
  return map[status] || status
}

function priorityText(priority: string) {
  const map: Record<string, string> = {
    high: '高优先级',
    normal: '普通',
    low: '低优先级',
  }
  return map[priority] || priority
}

function showError(error: unknown, fallback: string) {
  Taro.showToast({
    title: error instanceof Error ? error.message : fallback,
    icon: 'none',
  })
}
