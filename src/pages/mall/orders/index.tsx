import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Headphones, ReceiptText, Truck } from 'lucide-react-taro'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  createMallAfterSale,
  getMallOrder,
  getMallTracking,
  listMallOrders,
  type MallOrder,
  type MallOrderEvent,
  yuan,
} from '@/services/mall'
import { startOrderPayment } from '@/services/payment'

interface StoredUser {
  id?: string
}

export default function MallOrdersPage() {
  const [orders, setOrders] = useState<MallOrder[]>([])
  const [selectedOrder, setSelectedOrder] = useState<MallOrder | null>(null)
  const [events, setEvents] = useState<MallOrderEvent[]>([])
  const [afterSaleReason, setAfterSaleReason] = useState('鲜奶包装破损，需要极速退款')
  const [paying, setPaying] = useState(false)
  const userId = (Taro.getStorageSync('userInfo') as StoredUser | undefined)?.id || ''

  useEffect(() => {
    loadInitial()
  }, [])

  useDidShow(() => {
    loadInitial()
  })

  const loadInitial = async () => {
    if (!userId) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      Taro.redirectTo({ url: '/pages/index/index' })
      return
    }
    const orderId = Taro.getCurrentInstance().router?.params?.orderId
    try {
      const data = await listMallOrders(userId)
      setOrders(data)
      if (orderId) {
        const detail = await getMallOrder(orderId)
        setSelectedOrder(detail)
        const tracking = await getMallTracking(orderId)
        setEvents(tracking.events)
      } else if (data[0]) {
        setSelectedOrder(data[0])
        setEvents(data[0].events || [])
      }
    } catch (error) {
      showError(error, '订单加载失败')
    }
  }

  const selectOrder = async (order: MallOrder) => {
    try {
      const detail = await getMallOrder(order.id)
      const tracking = await getMallTracking(order.id)
      setSelectedOrder(detail)
      setEvents(tracking.events)
    } catch (error) {
      showError(error, '详情加载失败')
    }
  }

  const payOrder = async () => {
    if (!selectedOrder) return
    setPaying(true)
    try {
      await startOrderPayment({
        orderId: selectedOrder.id,
        businessType: 'mall_order',
      })
      Taro.showToast({ title: '支付成功', icon: 'success' })
      await selectOrder(selectedOrder)
    } catch (error) {
      showError(error, '支付失败')
    } finally {
      setPaying(false)
    }
  }

  const submitAfterSale = async () => {
    if (!selectedOrder) return
    try {
      await createMallAfterSale(selectedOrder.id, {
        userId,
        reason: afterSaleReason,
        description: '已上传破损照片与说明，请客服核验配送与冷链记录。',
        amountCents: selectedOrder.items[0]?.lineTotalCents || selectedOrder.payableCents,
      })
      Taro.showToast({ title: '售后已提交', icon: 'success' })
      await selectOrder(selectedOrder)
    } catch (error) {
      showError(error, '提交失败')
    }
  }

  return (
    <AppPageShell
      title="我的订单"
      subtitle={selectedOrder ? `${statusText(selectedOrder.status)} · ${selectedOrder.orderNo}` : '配送中 / 待支付 / 已完成'}
      icon={ReceiptText}
      bottom={<BottomNav type="merchant" active="orders" />}
      contentClassName="space-y-4"
    >
      <View className="flex flex-row gap-2 overflow-x-auto">
        {orders.map((order) => (
          <Button
            key={order.id}
            size="sm"
            variant={selectedOrder?.id === order.id ? 'default' : 'outline'}
            className="shrink-0 rounded-full"
            onClick={() => selectOrder(order)}
          >
            <Text className="text-xs font-black">{statusText(order.status)}</Text>
          </Button>
        ))}
      </View>

      {!selectedOrder ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Text className="block text-sm font-bold text-gray-500">暂无商城订单</Text>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="bg-blue-50">
            <CardContent className="p-4">
              <View className="flex items-center justify-between">
                <View className="flex-1">
                  <Text className="block text-base font-black text-gray-900">
                    {selectedOrder.orderNo}
                  </Text>
                  <Text className="mt-1 block text-xs font-bold text-blue-700">
                    {selectedOrder.vehicleCode || '无人车待派发'} · {selectedOrder.expectedDeliveryWindow || '今天 18:30-19:00'}
                  </Text>
                </View>
                <Badge className={selectedOrder.paymentStatus === 'paid' ? 'bg-emerald-500' : 'bg-orange-500'}>
                  <Text className="text-xs text-white">{selectedOrder.paymentStatus === 'paid' ? '已支付' : '待支付'}</Text>
                </Badge>
              </View>
            </CardContent>
          </Card>

          {selectedOrder.items.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <View className="flex items-center justify-between">
                  <View className="min-w-0 flex-1">
                    <Text className="block text-sm font-black text-gray-900">{item.productName}</Text>
                    <Text className="mt-1 block text-xs font-bold text-gray-500">
                      x{item.quantity} · {yuan(item.unitPriceCents)}
                    </Text>
                  </View>
                  <Text className="block text-sm font-black text-emerald-600">
                    {yuan(item.lineTotalCents)}
                  </Text>
                </View>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                <Text className="text-base font-black text-gray-900">履约进度</Text>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {events.length === 0 ? (
                <Text className="block text-sm text-gray-500">暂无履约事件</Text>
              ) : (
                events.map((event) => (
                  <View key={event.id} className="rounded-xl bg-gray-50 p-3">
                    <View className="flex items-center justify-between">
                      <Text className="block text-sm font-black text-gray-900">{event.title}</Text>
                      <Text className="block text-xs font-black text-emerald-600">{event.status}</Text>
                    </View>
                    <Text className="mt-1 block text-xs font-bold text-gray-500">
                      {event.description}
                    </Text>
                  </View>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="bg-gray-950">
            <CardContent className="p-4">
              <View className="flex items-center gap-3">
                <Truck size={24} color="#10B981" />
                <View className="flex-1">
                  <Text className="block text-lg font-black text-white">
                    {selectedOrder.status === 'delivering' ? '查看配送' : '订单总额'} {yuan(selectedOrder.payableCents)}
                  </Text>
                  <Text className="mt-1 block text-xs font-bold text-emerald-100">
                    {selectedOrder.cabinCode ? `开舱码 ${selectedOrder.cabinCode}` : '支付后短信发送开舱码'}
                  </Text>
                </View>
                {selectedOrder.paymentStatus !== 'paid' && (
                  <Button className="rounded-full bg-emerald-500" disabled={paying} onClick={payOrder}>
                    <Text className="text-sm font-black text-white">确认支付</Text>
                  </Button>
                )}
              </View>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                <View className="flex items-center gap-2">
                  <Headphones size={18} color="#0062FF" />
                  <Text className="text-base font-black text-gray-900">退款 / 售后</Text>
                </View>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={afterSaleReason}
                onInput={(event) => setAfterSaleReason(String(event.detail.value || ''))}
                placeholder="填写售后原因"
              />
              <Button className="w-full rounded-full bg-primary" onClick={submitAfterSale}>
                <Text className="text-sm font-black text-white">提交售后工单</Text>
              </Button>
              <Button
                className="w-full rounded-full"
                variant="outline"
                onClick={() => Taro.navigateTo({ url: `/pages/mall/support/index?orderId=${selectedOrder.id}` })}
              >
                <Text className="text-sm font-black text-primary">联系在线客服</Text>
              </Button>
              {(selectedOrder.afterSales || []).map((sale) => (
                <View key={sale.id} className="rounded-xl bg-orange-50 p-3">
                  <Text className="block text-sm font-black text-gray-900">{sale.reason}</Text>
                  <Text className="mt-1 block text-xs font-bold text-orange-700">
                    {sale.status} · {yuan(sale.amountCents)}
                  </Text>
                </View>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </AppPageShell>
  )
}

function statusText(status: string) {
  const map: Record<string, string> = {
    pending_payment: '待支付',
    paid: '已支付',
    dispatching: '待派车',
    delivering: '配送中',
    completed: '已完成',
    cancelled: '已取消',
  }
  return map[status] || status
}

function showError(error: unknown, fallback: string) {
  Taro.showToast({
    title: error instanceof Error ? error.message : fallback,
    icon: 'none',
  })
}
