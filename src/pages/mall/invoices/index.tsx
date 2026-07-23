import { useEffect, useMemo, useState } from 'react'
import { Picker, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ChevronLeft, FileCheck, Mail, ReceiptText } from 'lucide-react-taro'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import { listMallOrders, type MallOrder } from '@/services/mall'
import {
  cancelMallInvoice,
  createMallInvoice,
  listMallInvoices,
  type MallInvoiceRequest,
} from '@/services/mall-compliance'
import { MallPage, MallPrimaryButton, mallYuan } from '../mall-ui'

type TitleType = 'individual' | 'enterprise'

export default function MallInvoicePage() {
  const user = (Taro.getStorageSync('userInfo') || {}) as { id?: string; name?: string }
  const [orders, setOrders] = useState<MallOrder[]>([])
  const [invoices, setInvoices] = useState<MallInvoiceRequest[]>([])
  const [selectedOrderIndex, setSelectedOrderIndex] = useState(0)
  const [titleType, setTitleType] = useState<TitleType>('individual')
  const [title, setTitle] = useState(user.name || '个人')
  const [taxNumber, setTaxNumber] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    if (!user.id) return
    try {
      const [nextOrders, nextInvoices] = await Promise.all([
        listMallOrders(user.id),
        listMallInvoices(),
      ])
      const invoicedOrderIds = new Set(nextInvoices
        .filter((invoice) => !['rejected', 'cancelled'].includes(invoice.status))
        .map((invoice) => invoice.orderId))
      setOrders(nextOrders.filter((order) => order.paymentStatus === 'paid' && !invoicedOrderIds.has(order.id)))
      setInvoices(nextInvoices)
      setSelectedOrderIndex(0)
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : '发票信息加载失败', icon: 'none' })
    }
  }

  useEffect(() => {
    load()
  }, [user.id])

  const orderOptions = useMemo(() => orders.map((order) => (
    `${order.orderNo} · ${mallYuan(Number(order.payableCents || 0))}`
  )), [orders])
  const selectedOrder = orders[selectedOrderIndex]

  const submit = async () => {
    if (!selectedOrder) {
      Taro.showToast({ title: '暂无可开票的已支付订单', icon: 'none' })
      return
    }
    if (!title.trim()) {
      Taro.showToast({ title: '请填写发票抬头', icon: 'none' })
      return
    }
    if (titleType === 'enterprise' && !taxNumber.trim()) {
      Taro.showToast({ title: '企业发票需填写税号', icon: 'none' })
      return
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      Taro.showToast({ title: '请输入正确的接收邮箱', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await createMallInvoice({
        orderId: selectedOrder.id,
        invoiceType: 'electronic_normal',
        titleType,
        title: title.trim(),
        taxNumber: titleType === 'enterprise' ? taxNumber.trim() : undefined,
        email: email.trim(),
      })
      Taro.showToast({ title: '开票申请已提交', icon: 'success' })
      await load()
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : '申请失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const cancel = async (invoice: MallInvoiceRequest) => {
    const result = await Taro.showModal({ title: '撤销开票申请', content: `确定撤销 ${invoice.invoiceNo} 吗？` })
    if (!result.confirm) return
    try {
      await cancelMallInvoice(invoice.id)
      await load()
      Taro.showToast({ title: '申请已撤销', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : '撤销失败', icon: 'none' })
    }
  }

  const openInvoice = async (invoice: MallInvoiceRequest) => {
    if (!invoice.invoiceUrl) return
    try {
      const download = await Network.downloadFile({ url: invoice.invoiceUrl })
      await Taro.openDocument({ filePath: download.tempFilePath, showMenu: true })
    } catch {
      Taro.setClipboardData({ data: invoice.invoiceUrl })
      Taro.showToast({ title: '发票链接已复制', icon: 'none' })
    }
  }

  if (!user.id) {
    return (
      <MallPage active="mine" noTab>
        <View className="mall-empty">
          <ReceiptText size={34} color="#2F7E43" />
          <Text className="mall-empty-title">登录后申请电子发票</Text>
          <MallPrimaryButton onClick={() => Taro.redirectTo({ url: '/pages/mall/auth/index?returnUrl=%2Fpages%2Fmall%2Finvoices%2Findex' })}>
            <Text>去登录</Text>
          </MallPrimaryButton>
        </View>
      </MallPage>
    )
  }

  return (
    <MallPage active="mine" noTab>
      <View className="mall-back-row">
        <ChevronLeft size={24} color="#1F2D1F" onClick={() => Taro.navigateBack()} />
        <Text className="mall-section-action">返回</Text>
      </View>
      <Text className="mall-page-title">电子发票</Text>
      <Text className="mall-page-subtitle">选择已支付订单提交开票资料，可在本页查看处理进度和下载电子发票。</Text>

      <View className="mall-card mall-invoice-form">
        <Text className="mall-list-title">新建开票申请</Text>
        <Text className="mall-form-label">开票订单</Text>
        <Picker
          mode="selector"
          range={orderOptions.length ? orderOptions : ['暂无可开票订单']}
          value={selectedOrderIndex}
          disabled={!orderOptions.length}
          onChange={(event) => setSelectedOrderIndex(Number(event.detail.value || 0))}
        >
          <View className="mall-form-input mall-picker-value">
            <Text>{orderOptions[selectedOrderIndex] || '暂无可开票订单'}</Text>
          </View>
        </Picker>
        <Text className="mall-form-label">抬头类型</Text>
        <View className="mall-segmented-control">
          <View className={titleType === 'individual' ? 'active' : ''} onClick={() => setTitleType('individual')}><Text>个人</Text></View>
          <View className={titleType === 'enterprise' ? 'active' : ''} onClick={() => setTitleType('enterprise')}><Text>企业</Text></View>
        </View>
        <Text className="mall-form-label">发票抬头</Text>
        <Input className="mall-form-input" value={title} placeholder="填写个人姓名或企业全称" onInput={(event) => setTitle(String(event.detail.value || ''))} />
        {titleType === 'enterprise' ? (
          <>
            <Text className="mall-form-label">纳税人识别号</Text>
            <Input className="mall-form-input" value={taxNumber} placeholder="填写企业税号" onInput={(event) => setTaxNumber(String(event.detail.value || '').toUpperCase())} />
          </>
        ) : null}
        <Text className="mall-form-label">接收邮箱</Text>
        <View className="mall-input-with-icon">
          <Mail size={17} color="#667166" />
          <Input className="mall-form-input" value={email} placeholder="用于接收电子发票" onInput={(event) => setEmail(String(event.detail.value || ''))} />
        </View>
        <MallPrimaryButton onClick={submit}><Text>{submitting ? '提交中' : '提交开票申请'}</Text></MallPrimaryButton>
      </View>

      <Text className="mall-section-title">开票记录</Text>
      {invoices.length ? invoices.map((invoice) => (
        <View className="mall-card mall-invoice-record" key={invoice.id}>
          <View className="mall-list-row" style={{ marginTop: 0 }}>
            <View className="mall-compliance-title-row">
              <FileCheck size={18} color="#2F7E43" />
              <Text className="mall-list-title">{invoice.invoiceNo}</Text>
            </View>
            <Text className={`mall-invoice-status mall-invoice-status-${invoice.status}`}>{invoiceStatusLabel(invoice.status)}</Text>
          </View>
          <Text className="mall-compliance-body">{invoice.title} · {mallYuan(invoice.amountCents)}</Text>
          <Text className="mall-compliance-meta">接收邮箱 {invoice.email}</Text>
          {invoice.rejectionReason ? <Text className="mall-compliance-warning">未通过原因：{invoice.rejectionReason}</Text> : null}
          {invoice.status === 'issued' ? <Text className="mall-section-action" onClick={() => openInvoice(invoice)}>下载电子发票</Text> : null}
          {invoice.status === 'submitted' ? <Text className="mall-section-action" onClick={() => cancel(invoice)}>撤销申请</Text> : null}
        </View>
      )) : <View className="mall-empty"><Text className="mall-empty-copy">还没有开票记录</Text></View>}
    </MallPage>
  )
}

function invoiceStatusLabel(status: string) {
  return ({
    submitted: '待处理',
    processing: '开票中',
    issued: '已开具',
    rejected: '未通过',
    cancelled: '已撤销',
  } as Record<string, string>)[status] || status
}
