import { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Network } from '@/network'
import { useNotificationPolling } from '@/hooks/useNotificationPolling'

interface Order {
  id: string
  demand_id: string
  vehicle_id: string | null
  merchant_id: string
  owner_id: string | null
  status: string
  payment_status: string
  pickup_time: string | null
  accept_time: string | null
  complete_time: string | null
  cancel_reason: string | null
  cancel_time: string | null
  fare_price: number | null
  merchant_confirmed: boolean
  confirm_time: string | null
  created_at: string
  cancellation_status?: 'pending' | 'approved' | 'rejected' | null // 取消申请状态
  demand?: {
    id: string
    cargo_name: string
    cargo_type: string
    weight: number
    volume: number
    pickup_time: string
    pickup_address: string
    delivery_address: string
    remarks: string | null
    status: string
  }
  vehicle?: {
    id: string
    brand: string
    model: string
    plate_number: string
    status: string
  }
  owner?: {
    id: string
    name: string
    phone: string
  }
}

export default function MerchantOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState('accepted')
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showRequestCancelDialog, setShowRequestCancelDialog] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  // 启用通知轮询
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  useNotificationPolling(30000) // 每30秒检查一次新通知

  useEffect(() => {
    const userInfo = Taro.getStorageSync('userInfo')
    if (!userInfo || userInfo.role !== 'merchant') {
      Taro.showToast({
        title: '无权限访问',
        icon: 'none'
      })
      setTimeout(() => {
        Taro.redirectTo({ url: '/pages/index/index' })
      }, 1500)
      return
    }
    loadOrders()
  }, [])

  useEffect(() => {
    loadOrders()
  }, [filterStatus])

  // 页面显示时刷新订单列表（从付款页面返回时需要刷新）
  useDidShow(() => {
    loadOrders()
  })

  const loadOrders = async () => {
    setLoading(true)

    try {
      const userInfo = Taro.getStorageSync('userInfo')

      let url = `/api/orders?merchant_id=${userInfo.id}`
      if (filterStatus) {
        url += `&status=${filterStatus}`
      }

      const res = await Network.request({
        url,
        method: 'GET'
      })

      console.log('订单列表响应:', res.data)

      if (res.data.code === 200) {
        const orderList = res.data.data || []

        // 为每个订单查询需求详情和取消申请状态
        const ordersWithDetails = await Promise.all(
          orderList.map(async (order: Order) => {
            try {
              const demandRes = await Network.request({
                url: `/api/demands/${order.demand_id}?id=${order.demand_id}`,
                method: 'GET'
              })

              if (demandRes.data.code === 200 && demandRes.data.data) {
                order.demand = demandRes.data.data
              }
            } catch (error) {
              console.error('查询需求详情失败:', error)
            }

            // 查询取消申请状态（仅针对已接单且已确认运费的订单）
            if (order.status === 'accepted' && order.merchant_confirmed) {
              try {
                const cancelRes = await Network.request({
                  url: '/api/cancellations/pending',
                  method: 'GET',
                  data: { owner_id: order.owner_id }
                })

                if (cancelRes.data.code === 200 && cancelRes.data.data) {
                  const cancelRequest = cancelRes.data.data.find(
                    (req: any) => req.order_id === order.id
                  )
                  if (cancelRequest) {
                    order.cancellation_status = cancelRequest.status
                  }
                }
              } catch (error) {
                console.error('查询取消申请状态失败:', error)
              }
            }

            return order
          })
        )

        setOrders(ordersWithDetails)
      } else {
        Taro.showToast({
          title: res.data.message || '加载失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('加载订单列表失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusText = (status: string, payment_status?: string) => {
    // 特殊处理 transport_completed 状态，根据 payment_status 显示不同文本
    if (status === 'transport_completed') {
      if (payment_status === 'paid') {
        return '运输完成（已付款）'
      }
      return '运输完成（待付款）'
    }

    const statuses: Record<string, string> = {
      pending: '待接单',
      accepted: '已接单',
      in_transit: '运输中',
      payment_confirmed: '收款已确认',
      commission_pending: '佣金待审核',
      completed: '已完成',
      cancelled: '已取消'
    }
    return statuses[status] || status
  }

  const getStatusColor = (status: string, payment_status?: string) => {
    // 特殊处理 transport_completed 状态，根据 payment_status 显示不同颜色
    if (status === 'transport_completed') {
      if (payment_status === 'paid') {
        return 'bg-primary' // 已付款用蓝色
      }
      return 'bg-amber-500' // 待付款用黄色
    }

    const colors: Record<string, string> = {
      pending: 'bg-amber-500',
      accepted: 'bg-primary',
      in_transit: 'bg-cyan-500',
      payment_confirmed: 'bg-indigo-500',
      commission_pending: 'bg-pink-500',
      completed: 'bg-emerald-500',
      cancelled: 'bg-red-500'
    }
    return colors[status] || 'bg-slate-500'
  }

  const handleConfirmFare = async (orderId: string) => {
    try {
      const res = await Network.request({
        url: `/api/orders/${orderId}/confirm-fare?id=${orderId}`,
        method: 'POST'
      })

      console.log('确认运费响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: '运费已确认',
          icon: 'success'
        })

        // 重新加载订单列表
        loadOrders()
      } else {
        Taro.showToast({
          title: res.data.message || '确认失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('确认运费失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    }
  }

  // 跳转到付款页面
  const handleGoToPayment = (order: Order) => {
    Taro.navigateTo({
      url: `/pages/merchant/payment/index?orderId=${order.id}`
    })
  }

  // 取消订单
  const handleCancelOrder = (order: Order) => {
    setSelectedOrder(order)
    setShowCancelDialog(true)
    setCancelReason('')
  }

  const handleCloseCancelDialog = () => {
    setShowCancelDialog(false)
    setSelectedOrder(null)
    setCancelReason('')
  }

  const handleConfirmCancel = async () => {
    if (!cancelReason.trim()) {
      Taro.showToast({
        title: '请输入取消原因',
        icon: 'none'
      })
      return
    }

    if (!selectedOrder) return

    const userInfo = Taro.getStorageSync('userInfo')
    if (!userInfo || userInfo.role !== 'merchant') {
      Taro.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    setLoading(true)

    try {
      const res = await Network.request({
        url: `/api/orders/${selectedOrder.id}/cancel?id=${selectedOrder.id}`,
        method: 'POST',
        data: {
          reason: cancelReason,
          merchant_id: userInfo.id
        }
      })

      console.log('取消订单响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: '订单已取消',
          icon: 'success'
        })

        setShowCancelDialog(false)
        setSelectedOrder(null)
        setCancelReason('')

        loadOrders()
      } else {
        Taro.showToast({
          title: res.data.message || '取消失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('取消订单失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  // 申请取消订单
  const handleRequestCancel = (order: Order) => {
    setSelectedOrder(order)
    setShowRequestCancelDialog(true)
    setCancelReason('')
  }

  const handleCloseRequestCancelDialog = () => {
    setShowRequestCancelDialog(false)
    setSelectedOrder(null)
    setCancelReason('')
  }

  const handleConfirmRequestCancel = async () => {
    if (!cancelReason.trim()) {
      Taro.showToast({
        title: '请输入取消原因',
        icon: 'none'
      })
      return
    }

    if (!selectedOrder) return

    const userInfo = Taro.getStorageSync('userInfo')
    if (!userInfo || userInfo.role !== 'merchant') {
      Taro.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    setLoading(true)

    try {
      const res = await Network.request({
        url: '/api/cancellations/request',
        method: 'POST',
        data: {
          order_id: selectedOrder.id,
          reason: cancelReason,
          merchant_id: userInfo.id
        }
      })

      console.log('申请取消订单响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: '取消申请已提交，等待车主处理',
          icon: 'success'
        })

        setShowRequestCancelDialog(false)
        setSelectedOrder(null)
        setCancelReason('')

        loadOrders()
      } else {
        Taro.showToast({
          title: res.data.message || '申请失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('申请取消失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const getCargoTypeText = (type: string) => {
    const types: Record<string, string> = {
      normal: '普通货物',
      fragile: '易碎品',
      refrigerated: '冷藏品',
      bulky: '大件货物',
      hazardous: '危险品'
    }
    return types[type] || type
  }

  const getCargoTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      normal: 'bg-primary',
      fragile: 'bg-amber-500',
      refrigerated: 'bg-cyan-500',
      bulky: 'bg-indigo-500',
      hazardous: 'bg-red-500'
    }
    return colors[type] || 'bg-slate-500'
  }

  return (
    <View className="min-h-screen bg-background">
      {/* 导航菜单 */}
      <View className="bg-white shadow-sm">
        <View className="px-4 py-3">
          <View className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => Taro.navigateTo({ url: '/pages/merchant/demands/index' })}
            >
              <Text className="text-xs">发布需求</Text>
            </Button>
            <Button
              size="sm"
              className="bg-primary"
            >
              <Text className="text-xs">订单管理</Text>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => Taro.navigateTo({ url: '/pages/merchant/stats/index' })}
            >
              <Text className="text-xs">数据统计</Text>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => Taro.navigateTo({ url: '/pages/merchant/profile/index' })}
            >
              <Text className="text-xs">我的</Text>
            </Button>
          </View>
        </View>
      </View>

      <View className="px-4 py-4">
        <Card className="bg-white rounded-lg shadow-sm">
          <CardHeader>
            <View className="flex justify-between items-center">
              <CardTitle className="text-lg font-semibold">
                我的订单
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={loadOrders}
                disabled={loading}
              >
                <Text className="text-xs">刷新</Text>
              </Button>
            </View>
          </CardHeader>
          <CardContent>
            {/* 筛选条件 */}
            <View className="flex gap-2 mb-4 flex-wrap">
              <Button
                size="sm"
                variant={filterStatus === '' ? 'default' : 'outline'}
                className={filterStatus === '' ? 'bg-primary' : ''}
                onClick={() => setFilterStatus('')}
              >
                <Text className="text-xs">全部</Text>
              </Button>
              <Button
                size="sm"
                variant={filterStatus === 'pending' ? 'default' : 'outline'}
                className={filterStatus === 'pending' ? 'bg-primary' : ''}
                onClick={() => setFilterStatus('pending')}
              >
                <Text className="text-xs">待接单</Text>
              </Button>
              <Button
                size="sm"
                variant={filterStatus === 'accepted' ? 'default' : 'outline'}
                className={filterStatus === 'accepted' ? 'bg-primary' : ''}
                onClick={() => setFilterStatus('accepted')}
              >
                <Text className="text-xs">已接单</Text>
              </Button>
              <Button
                size="sm"
                variant={filterStatus === 'in_transit' ? 'default' : 'outline'}
                className={filterStatus === 'in_transit' ? 'bg-primary' : ''}
                onClick={() => setFilterStatus('in_transit')}
              >
                <Text className="text-xs">运输中</Text>
              </Button>
              <Button
                size="sm"
                variant={filterStatus === 'completed' ? 'default' : 'outline'}
                className={filterStatus === 'completed' ? 'bg-primary' : ''}
                onClick={() => setFilterStatus('completed')}
              >
                <Text className="text-xs">已完成</Text>
              </Button>
              <Button
                size="sm"
                variant={filterStatus === 'cancelled' ? 'default' : 'outline'}
                className={filterStatus === 'cancelled' ? 'bg-primary' : ''}
                onClick={() => setFilterStatus('cancelled')}
              >
                <Text className="text-xs">已取消</Text>
              </Button>
            </View>

            {loading ? (
              <View className="text-center py-8">
                <Text className="block text-gray-500 text-sm">加载中...</Text>
              </View>
            ) : orders.length === 0 ? (
              <View className="text-center py-8">
                <Text className="block text-gray-500 text-sm mb-4">暂无订单</Text>
                <Button
                  className="bg-primary"
                  onClick={() => Taro.navigateTo({ url: '/pages/merchant/demands/index' })}
                >
                  <Text>发布需求</Text>
                </Button>
              </View>
            ) : (
              <View className="space-y-3">
                {orders.map((order) => (
                  <View key={order.id} className="bg-muted rounded-lg p-4">
                    <View className="flex justify-between items-start mb-3">
                      <View className="flex-1">
                        <Text className="block font-medium text-base mb-1">
                          {order.demand?.cargo_name || '货物'}
                        </Text>
                        <View className="flex items-center gap-2 mb-2 flex-wrap">
                          {order.demand && (
                            <Badge className={getCargoTypeColor(order.demand.cargo_type)}>
                              <Text className="text-white text-xs">
                                {getCargoTypeText(order.demand.cargo_type)}
                              </Text>
                            </Badge>
                          )}
                          <Badge className={getStatusColor(order.status, order.payment_status)}>
                            <Text className="text-white text-xs">
                              {getStatusText(order.status, order.payment_status)}
                            </Text>
                          </Badge>
                          {/* 显示取消申请状态 */}
                          {order.cancellation_status === 'pending' && (
                            <Badge className="bg-amber-500">
                              <Text className="text-white text-xs">
                                等待运力方同意
                              </Text>
                            </Badge>
                          )}
                          {order.cancellation_status === 'approved' && (
                            <Badge className="bg-emerald-500">
                              <Text className="text-white text-xs">
                                已同意取消
                              </Text>
                            </Badge>
                          )}
                          {order.cancellation_status === 'rejected' && (
                            <Badge className="bg-slate-500">
                              <Text className="text-white text-xs">
                                已拒绝取消
                              </Text>
                            </Badge>
                          )}
                        </View>
                      </View>
                    </View>

                    {/* 需求信息 */}
                    {order.demand && (
                      <View className="space-y-2 mb-3 pb-3 border-b border-border">
                        <View className="flex items-start">
                          <Text className="text-xs text-gray-500 w-16 flex-shrink-0">取货:</Text>
                          <Text className="text-xs text-gray-700 flex-1">
                            {order.demand.pickup_address}
                          </Text>
                        </View>
                        <View className="flex items-start">
                          <Text className="text-xs text-gray-500 w-16 flex-shrink-0">送货:</Text>
                          <Text className="text-xs text-gray-700 flex-1">
                            {order.demand.delivery_address}
                          </Text>
                        </View>
                        <View className="flex items-start">
                          <Text className="text-xs text-gray-500 w-16 flex-shrink-0">时间:</Text>
                          <Text className="text-xs text-gray-700 flex-1">
                            {new Date(order.demand.pickup_time).toLocaleString()}
                          </Text>
                        </View>
                        <View className="flex items-start">
                          <Text className="text-xs text-gray-500 w-16 flex-shrink-0">规格:</Text>
                          <Text className="text-xs text-gray-700 flex-1">
                            {order.demand.weight}kg / {order.demand.volume}m³
                          </Text>
                        </View>
                        {order.demand.remarks && (
                          <View className="flex items-start">
                            <Text className="text-xs text-gray-500 w-16 flex-shrink-0">备注:</Text>
                            <Text className="text-xs text-gray-700 flex-1">
                              {order.demand.remarks}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* 车辆和车主信息（仅已接单后显示） */}
                    {(order.vehicle || order.owner) && (
                      <View className="space-y-2 mb-3 pb-3 border-b border-border">
                        {order.vehicle && (
                          <View className="flex items-start">
                            <Text className="text-xs text-gray-500 w-16 flex-shrink-0">车辆:</Text>
                            <Text className="text-xs text-gray-700 flex-1">
                              {order.vehicle.brand} {order.vehicle.model}
                              {order.vehicle.plate_number && ` (${order.vehicle.plate_number})`}
                            </Text>
                          </View>
                        )}
                        {order.owner && (
                          <View className="flex items-start">
                            <Text className="text-xs text-gray-500 w-16 flex-shrink-0">车主:</Text>
                            <Text className="text-xs text-gray-700 flex-1">
                              {order.owner.name} ({order.owner.phone})
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* 运费信息（已接单后显示） */}
                    {(order.status === 'accepted' || order.status === 'transport_completed' || order.status === 'payment_confirmed') && order.fare_price && (
                      <View className="bg-amber-50 rounded-lg p-3 mb-3">
                        <View className="flex justify-between items-center">
                          <View>
                            <Text className="block text-xs text-gray-600 mb-1">运费报价</Text>
                            <Text className="block text-lg font-bold text-amber-600">
                              ¥{order.fare_price.toFixed(2)}
                            </Text>
                          </View>
                          <View className="flex gap-2">
                            {/* 取消订单按钮（仅已接单状态且未开始运输时显示） */}
                            {order.status === 'accepted' && (
                              <>
                                {order.merchant_confirmed ? (
                                  // 运费已确认，需要申请取消
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-amber-500 border-amber-500"
                                    onClick={() => handleRequestCancel(order)}
                                  >
                                    <Text className="text-xs">申请取消</Text>
                                  </Button>
                                ) : (
                                  // 运费未确认，可以直接取消
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-500 border-red-500"
                                    onClick={() => handleCancelOrder(order)}
                                  >
                                    <Text className="text-xs">取消</Text>
                                  </Button>
                                )}
                              </>
                            )}
                            {/* 旧版运费确认（保留兼容性） */}
                            {order.status === 'accepted' && !order.merchant_confirmed && (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-amber-500"
                                  onClick={() => handleConfirmFare(order.id)}
                                >
                                  <Text className="text-xs">确认运费</Text>
                                </Button>
                                <Text className="text-xs text-gray-500 mt-1 block">
                                  提示：确认运费后不可直接取消
                                </Text>
                              </>
                            )}
                            {order.status === 'accepted' && order.merchant_confirmed && (
                              <View className="bg-emerald-500 px-3 py-1 rounded-lg">
                                <Text className="text-xs text-white">已确认</Text>
                              </View>
                            )}
                            {/* 新版付款流程 */}
                            {order.status === 'transport_completed' && order.payment_status === 'unpaid' && (
                              <Button
                                size="sm"
                                className="bg-emerald-500"
                                onClick={() => handleGoToPayment(order)}
                              >
                                <Text className="text-xs">去付款</Text>
                              </Button>
                            )}
                            {order.status === 'transport_completed' && order.payment_status === 'paid' && (
                              <View className="bg-primary px-3 py-1 rounded-lg">
                                <Text className="text-xs text-white">已付款</Text>
                              </View>
                            )}
                            {order.status === 'payment_confirmed' && (
                              <View className="bg-indigo-500 px-3 py-1 rounded-lg">
                                <Text className="text-xs text-white">收款已确认</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        {order.confirm_time && (
                          <Text className="text-xs text-gray-500 mt-2 block">
                            确认时间: {new Date(order.confirm_time).toLocaleString()}
                          </Text>
                        )}
                      </View>
                    )}

                    {/* 时间信息 */}
                    {order.accept_time && (
                      <Text className="text-xs text-gray-500 mb-1">
                        接单时间: {new Date(order.accept_time).toLocaleString()}
                      </Text>
                    )}
                    {order.complete_time && (
                      <Text className="text-xs text-gray-500 mb-1">
                        完成时间: {new Date(order.complete_time).toLocaleString()}
                      </Text>
                    )}
                    {order.cancel_reason && (
                      <View className="mt-2 pt-2 border-t border-border">
                        <Text className="text-xs text-gray-500">
                          取消原因: {order.cancel_reason}
                        </Text>
                      </View>
                    )}

                    <Text className="text-xs text-gray-400 mt-2">
                      创建时间: {new Date(order.created_at).toLocaleString()}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </CardContent>
        </Card>
      </View>

      {/* 取消订单弹窗 */}
      {showCancelDialog && selectedOrder && (
        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <DialogContent>
            <View className="space-y-4">
              <View>
                <Text className="block text-base font-medium mb-2">
                  取消订单
                </Text>
                <View className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                  <Text className="block text-sm text-orange-800 mb-2">
                    ⚠️ 取消订单后：
                  </Text>
                  <Text className="block text-sm text-orange-700 mb-1">
                    • 该需求将恢复到待接单状态
                  </Text>
                  <Text className="block text-sm text-orange-700 mb-1">
                    • 其他车主可以继续接单
                  </Text>
                  <Text className="block text-sm text-orange-700">
                    • 此操作不可逆
                  </Text>
                </View>
                <Text className="block text-sm text-gray-600 mb-2">
                  确定要取消订单 &quot;{selectedOrder.demand?.cargo_name}&quot; 吗？
                </Text>
              </View>

              <View>
                <Label className="block text-sm font-medium mb-2">
                  <Text className="text-red-500">*</Text>取消原因
                </Label>
                <View className="bg-muted rounded-lg px-4 py-3">
                  <Textarea
                    className="w-full"
                    placeholder="请输入取消原因"
                    value={cancelReason}
                    onInput={(e) => setCancelReason(e.detail.value)}
                    maxlength={200}
                  />
                </View>
              </View>

              <View className="flex gap-3 pt-2">
                <Button
                  className="flex-1 bg-muted"
                  onClick={handleCloseCancelDialog}
                >
                  <Text>取消</Text>
                </Button>
                <Button
                  className="flex-1 bg-red-500"
                  onClick={handleConfirmCancel}
                  disabled={loading}
                >
                  <Text>{loading ? '处理中...' : '确认取消'}</Text>
                </Button>
              </View>
            </View>
          </DialogContent>
        </Dialog>
      )}

      {/* 申请取消订单弹窗 */}
      {showRequestCancelDialog && selectedOrder && (
        <Dialog open={showRequestCancelDialog} onOpenChange={setShowRequestCancelDialog}>
          <DialogContent>
            <View className="space-y-4">
              <View>
                <Text className="block text-base font-medium mb-2">
                  申请取消订单
                </Text>
                <Text className="block text-sm text-gray-600 mb-2">
                  订单 &quot;{selectedOrder.demand?.cargo_name}&quot; 运费已确认，需要向车主申请取消
                </Text>
                <Text className="block text-sm text-amber-500 mb-2">
                  注意：若车主同意，也将扣除您10分信用积分
                </Text>
              </View>

              <View>
                <Label className="block text-sm font-medium mb-2">
                  <Text className="text-red-500">*</Text>取消原因
                </Label>
                <View className="bg-muted rounded-lg px-4 py-3">
                  <Textarea
                    className="w-full"
                    placeholder="请输入取消原因，将发送给车主审核"
                    value={cancelReason}
                    onInput={(e) => setCancelReason(e.detail.value)}
                    maxlength={200}
                  />
                </View>
              </View>

              <View className="flex gap-3 pt-2">
                <Button
                  className="flex-1 bg-muted"
                  onClick={handleCloseRequestCancelDialog}
                >
                  <Text>取消</Text>
                </Button>
                <Button
                  className="flex-1 bg-amber-500"
                  onClick={handleConfirmRequestCancel}
                  disabled={loading}
                >
                  <Text>{loading ? '提交中...' : '提交申请'}</Text>
                </Button>
              </View>
            </View>
          </DialogContent>
        </Dialog>
      )}
    </View>
  )
}
