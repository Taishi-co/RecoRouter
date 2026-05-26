import { useEffect, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import Taro from '@tarojs/taro'
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
  commission_payment_status: string
  pickup_time: string | null
  pickup_photo_key: string | null
  delivery_photo_key: string | null
  accept_time: string | null
  complete_time: string | null
  fare_price: number | null
  commission_amount: number | null
  merchant_confirmed: boolean
  confirm_time: string | null
  payment_confirm_time: string | null
  created_at: string
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
  }
  vehicle?: {
    id: string
    brand?: string
    model?: string
    plate_number?: string
    vehicle_type?: string
    license_plate?: string
    status: string
  }
}

export default function OwnerOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [showStartDialog, setShowStartDialog] = useState(false)
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [pickupImage, setPickupImage] = useState('')
  const [deliveryImage, setDeliveryImage] = useState('')
  const [cancelReason, setCancelReason] = useState('')

  // 启用通知轮询
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  useNotificationPolling(30000) // 每30秒检查一次新通知

  useEffect(() => {
    const userInfo = Taro.getStorageSync('userInfo')
    if (!userInfo || userInfo.role !== 'owner') {
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

  const loadOrders = async () => {
    setLoading(true)

    try {
      const userInfo = Taro.getStorageSync('userInfo')

      let url = `/api/orders?owner_id=${userInfo.id}`
      if (filterStatus) {
        url += `&status=${filterStatus}`
      }

      const res = await Network.request({
        url,
        method: 'GET'
      })

      console.log('订单列表响应:', res.data)

      if (res.data.code === 200) {
        setOrders(res.data.data || [])
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
      payment_confirmed: '收款已确认（待付佣金）',
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
        return 'bg-blue-500' // 已付款用蓝色
      }
      return 'bg-yellow-500' // 待付款用黄色
    }

    const colors: Record<string, string> = {
      pending: 'bg-orange-500',
      accepted: 'bg-blue-500',
      in_transit: 'bg-cyan-500',
      payment_confirmed: 'bg-purple-500',
      commission_pending: 'bg-pink-500',
      completed: 'bg-green-500',
      cancelled: 'bg-red-500'
    }
    return colors[status] || 'bg-gray-500'
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

  const handleStartTransport = (order: Order) => {
    setSelectedOrder(order)
    setShowStartDialog(true)
  }

  const handleCloseStartDialog = () => {
    setShowStartDialog(false)
    setSelectedOrder(null)
  }

  const handleConfirmStart = async () => {
    if (!selectedOrder) return

    setLoading(true)

    try {
      const res = await Network.request({
        url: `/api/orders/${selectedOrder.id}/start-transport`,
        method: 'POST'
      })

      console.log('开始运输响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: '已开始运输',
          icon: 'success'
        })

        setShowStartDialog(false)
        setSelectedOrder(null)

        loadOrders()
      } else {
        Taro.showToast({
          title: res.data.message || '操作失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('开始运输失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteOrder = (order: Order) => {
    setSelectedOrder(order)
    setShowCompleteDialog(true)
    setPickupImage('')
    setDeliveryImage('')
  }

  const handleCloseCompleteDialog = () => {
    setShowCompleteDialog(false)
    setSelectedOrder(null)
    setPickupImage('')
    setDeliveryImage('')
  }

  const handleChoosePickupPhoto = () => {
    Taro.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success: (res) => {
        setPickupImage(res.tempFilePaths[0])
      }
    })
  }

  const handleChooseDeliveryPhoto = () => {
    Taro.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success: (res) => {
        setDeliveryImage(res.tempFilePaths[0])
      }
    })
  }

  const handleConfirmComplete = async () => {
    if (!selectedOrder) return

    if (!pickupImage || !deliveryImage) {
      Taro.showToast({
        title: '请上传取货和送货凭证',
        icon: 'none'
      })
      return
    }

    setLoading(true)

    try {
      // TODO: 上传图片到TOS，这里先使用临时文件路径
      const res = await Network.request({
        url: `/api/orders/${selectedOrder.id}/complete`,
        method: 'PUT',
        data: {
          pickup_photo_key: pickupImage,
          delivery_photo_key: deliveryImage
        }
      })

      console.log('完成订单响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: '运输已完成，等待需求方付款',
          icon: 'success'
        })

        setShowCompleteDialog(false)
        setSelectedOrder(null)
        setPickupImage('')
        setDeliveryImage('')

        loadOrders()
      } else {
        Taro.showToast({
          title: res.data.message || '操作失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('完成订单失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  // 确认收款
  const handleConfirmPayment = async (order: Order) => {
    setLoading(true)

    try {
      const res = await Network.request({
        url: `/api/orders/${order.id}/payment-confirm`,
        method: 'PUT'
      })

      console.log('确认收款响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: '收款已确认，请向平台支付撮合佣金',
          icon: 'success'
        })

        loadOrders()
      } else {
        Taro.showToast({
          title: res.data.message || '操作失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('确认收款失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  // 跳转到佣金支付页
  const handleGoToCommissionPayment = (order: Order) => {
    Taro.navigateTo({
      url: `/pages/owner/commission-payment/index?orderId=${order.id}`
    })
  }

  // 打开取消订单对话框
  const handleCancelOrder = (order: Order) => {
    setSelectedOrder(order)
    setCancelReason('')
    setShowCancelDialog(true)
  }

  // 关闭取消订单对话框
  const handleCloseCancelDialog = () => {
    setShowCancelDialog(false)
    setSelectedOrder(null)
    setCancelReason('')
  }

  // 确认取消订单
  const handleConfirmCancelOrder = async () => {
    if (!selectedOrder) return

    if (!cancelReason.trim()) {
      Taro.showToast({
        title: '请输入取消原因',
        icon: 'none'
      })
      return
    }

    setLoading(true)

    try {
      const userInfo = Taro.getStorageSync('userInfo')

      const res = await Network.request({
        url: `/api/orders/${selectedOrder.id}/owner-cancel`,
        method: 'POST',
        data: {
          reason: cancelReason,
          owner_id: userInfo.id
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

  return (
    <AppPageShell
      title="我的订单"
      subtitle="RecoRouter 运力端"
      contentClassName="space-y-3"
      bottom={<BottomNav type="owner" active="orders" />}
    >
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
                className={filterStatus === '' ? 'bg-blue-500' : ''}
                onClick={() => setFilterStatus('')}
              >
                <Text className="text-xs">全部</Text>
              </Button>
              <Button
                size="sm"
                variant={filterStatus === 'accepted' ? 'default' : 'outline'}
                className={filterStatus === 'accepted' ? 'bg-blue-500' : ''}
                onClick={() => setFilterStatus('accepted')}
              >
                <Text className="text-xs">已接单</Text>
              </Button>
              <Button
                size="sm"
                variant={filterStatus === 'in_transit' ? 'default' : 'outline'}
                className={filterStatus === 'in_transit' ? 'bg-blue-500' : ''}
                onClick={() => setFilterStatus('in_transit')}
              >
                <Text className="text-xs">运输中</Text>
              </Button>
              <Button
                size="sm"
                variant={filterStatus === 'completed' ? 'default' : 'outline'}
                className={filterStatus === 'completed' ? 'bg-blue-500' : ''}
                onClick={() => setFilterStatus('completed')}
              >
                <Text className="text-xs">已完成</Text>
              </Button>
            </View>

            {/* 取消申请提示 */}
            <View
              className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 mb-4"
              onClick={() => Taro.navigateTo({ url: '/pages/owner/cancellations/index' })}
            >
              <View className="flex items-center justify-between">
                <View className="flex items-center">
                  <Text className="text-xs text-orange-600">
                    📋 有需求方申请取消订单，请及时处理
                  </Text>
                </View>
                <Text className="text-xs text-orange-500">查看处理 ›</Text>
              </View>
            </View>

            {loading ? (
              <View className="text-center py-8">
                <Text className="block text-gray-500 text-sm">加载中...</Text>
              </View>
            ) : orders.length === 0 ? (
              <View className="text-center py-8">
                <Text className="block text-gray-500 text-sm mb-4">暂无订单</Text>
                <Button
                  className="bg-blue-500"
                  onClick={() => Taro.navigateTo({ url: '/pages/owner/demands/index' })}
                >
                  <Text>去接单</Text>
                </Button>
              </View>
            ) : (
              <View className="space-y-3">
                {orders.map((order) => (
                  <View key={order.id} className="bg-gray-50 rounded-lg p-4">
                    <View className="flex justify-between items-start mb-3">
                      <View className="flex-1">
                        <Text className="block font-medium text-base mb-1">
                          {order.demand?.cargo_name || '货物'}
                        </Text>
                        <View className="flex items-center gap-2 mb-2">
                          {order.demand && (
                            <Badge className="bg-blue-500">
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
                        </View>
                      </View>
                      {order.status === 'accepted' && !order.merchant_confirmed && (
                        <View className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-red-50 border-red-200"
                            onClick={() => handleCancelOrder(order)}
                          >
                            <Text className="text-xs text-red-600">取消</Text>
                          </Button>
                          <View className="bg-gray-200 px-3 py-1 rounded-lg">
                            <Text className="text-xs text-gray-600">等待确认运费</Text>
                          </View>
                        </View>
                      )}
                      {order.status === 'accepted' && order.merchant_confirmed && (
                        <Button
                          size="sm"
                          className="bg-green-500"
                          onClick={() => handleStartTransport(order)}
                        >
                          <Text className="text-xs">开始运输</Text>
                        </Button>
                      )}
                      {order.status === 'in_transit' && (
                        <Button
                          size="sm"
                          className="bg-blue-500"
                          onClick={() => handleCompleteOrder(order)}
                        >
                          <Text className="text-xs">完成运输</Text>
                        </Button>
                      )}
                      {order.status === 'transport_completed' && order.payment_status === 'paid' && (
                        <Button
                          size="sm"
                          className="bg-green-500"
                          onClick={() => handleConfirmPayment(order)}
                        >
                          <Text className="text-xs">确认收款</Text>
                        </Button>
                      )}
                      {order.status === 'payment_confirmed' && (
                        <Button
                          size="sm"
                          className="bg-purple-500"
                          onClick={() => handleGoToCommissionPayment(order)}
                        >
                          <Text className="text-xs">支付佣金</Text>
                        </Button>
                      )}
                      {order.status === 'commission_pending' && (
                        <Button
                          size="sm"
                          className="bg-gray-400"
                          disabled
                        >
                          <Text className="text-xs">等待审核</Text>
                        </Button>
                      )}
                    </View>

                    {/* 需求信息 */}
                    {order.demand && (
                      <View className="space-y-2 mb-3 pb-3 border-b border-gray-200">
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

                    {/* 运费信息（仅已接单后显示） */}
                    {order.status === 'accepted' && order.fare_price && (
                      <View className="bg-yellow-50 rounded-lg p-3 mb-3">
                        <View className="flex justify-between items-center">
                          <View>
                            <Text className="block text-xs text-gray-600 mb-1">运费报价</Text>
                            <Text className="block text-lg font-bold text-orange-600">
                              ¥{order.fare_price.toFixed(2)}
                            </Text>
                          </View>
                          {!order.merchant_confirmed && (
                            <View className="bg-gray-200 px-3 py-1 rounded-lg">
                              <Text className="text-xs text-gray-600">待确认</Text>
                            </View>
                          )}
                          {order.merchant_confirmed && (
                            <View className="bg-green-500 px-3 py-1 rounded-lg">
                              <Text className="text-xs text-white">已确认</Text>
                            </View>
                          )}
                        </View>
                        {order.confirm_time && (
                          <Text className="text-xs text-gray-500 mt-2 block">
                            确认时间: {new Date(order.confirm_time).toLocaleString()}
                          </Text>
                        )}
                        {!order.merchant_confirmed && (
                          <Text className="text-xs text-gray-500 mt-2 block">
                            需求方确认后才能开始运输，期间可取消订单
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
                    {order.pickup_photo_key && (
                      <View className="mt-2">
                        <Text className="block text-xs text-gray-500 mb-1">取货凭证:</Text>
                        <Image
                          src={order.pickup_photo_key}
                          className="w-20 h-20 rounded"
                          mode="aspectFill"
                        />
                      </View>
                    )}
                    {order.delivery_photo_key && (
                      <View className="mt-2">
                        <Text className="block text-xs text-gray-500 mb-1">送货凭证:</Text>
                        <Image
                          src={order.delivery_photo_key}
                          className="w-20 h-20 rounded"
                          mode="aspectFill"
                        />
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </CardContent>
        </Card>

      {/* 开始运输确认弹窗 */}
      {showStartDialog && selectedOrder && (
        <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
          <DialogContent className="sm:max-w-md">
            <View className="p-6">
              <Text className="block text-lg font-semibold mb-2">
                确认开始运输
              </Text>
              <Text className="block text-sm text-gray-500 mb-4">
                确认开始运输订单：{selectedOrder.demand?.cargo_name}
              </Text>
              {selectedOrder.demand && (
                <View className="bg-gray-50 rounded-lg p-4 mb-4">
                  <View className="space-y-2">
                    <View className="flex items-start">
                      <Text className="text-xs text-gray-500 w-16 flex-shrink-0">取货:</Text>
                      <Text className="text-xs text-gray-700 flex-1">
                        {selectedOrder.demand.pickup_address}
                      </Text>
                    </View>
                    <View className="flex items-start">
                      <Text className="text-xs text-gray-500 w-16 flex-shrink-0">送货:</Text>
                      <Text className="text-xs text-gray-700 flex-1">
                        {selectedOrder.demand.delivery_address}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
              <View className="flex gap-3">
                <Button
                  className="flex-1 bg-gray-200"
                  onClick={handleCloseStartDialog}
                  disabled={loading}
                >
                  <Text>取消</Text>
                </Button>
                <Button
                  className="flex-1 bg-green-500"
                  onClick={handleConfirmStart}
                  disabled={loading}
                >
                  <Text>{loading ? '处理中...' : '确认开始'}</Text>
                </Button>
              </View>
            </View>
          </DialogContent>
        </Dialog>
      )}

      {/* 完成订单弹窗 */}
      {showCompleteDialog && selectedOrder && (
        <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
          <DialogContent className="sm:max-w-md">
            <View className="p-6">
              <Text className="block text-lg font-semibold mb-2">
                完成订单
              </Text>
              <Text className="block text-sm text-gray-500 mb-4">
                请上传取货和送货凭证照片
              </Text>

              <View className="space-y-4 mb-4">
                <View>
                  <Text className="block text-sm font-medium mb-2">
                    <Text className="text-red-500">*</Text>取货凭证
                  </Text>
                  <View
                    className="bg-gray-50 rounded-lg p-4 text-center"
                    onClick={handleChoosePickupPhoto}
                  >
                    {pickupImage ? (
                      <Image
                        src={pickupImage}
                        className="w-full h-32 rounded"
                        mode="aspectFill"
                      />
                    ) : (
                      <View>
                        <Text className="block text-gray-500 mb-2">点击上传</Text>
                        <Text className="text-xs text-gray-400">支持拍照或相册</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View>
                  <Text className="block text-sm font-medium mb-2">
                    <Text className="text-red-500">*</Text>送货凭证
                  </Text>
                  <View
                    className="bg-gray-50 rounded-lg p-4 text-center"
                    onClick={handleChooseDeliveryPhoto}
                  >
                    {deliveryImage ? (
                      <Image
                        src={deliveryImage}
                        className="w-full h-32 rounded"
                        mode="aspectFill"
                      />
                    ) : (
                      <View>
                        <Text className="block text-gray-500 mb-2">点击上传</Text>
                        <Text className="text-xs text-gray-400">支持拍照或相册</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              <View className="flex gap-3">
                <Button
                  className="flex-1 bg-gray-200"
                  onClick={handleCloseCompleteDialog}
                  disabled={loading}
                >
                  <Text>取消</Text>
                </Button>
                <Button
                  className="flex-1 bg-blue-500"
                  onClick={handleConfirmComplete}
                  disabled={loading}
                >
                  <Text>{loading ? '提交中...' : '确认完成'}</Text>
                </Button>
              </View>
            </View>
          </DialogContent>
        </Dialog>
      )}

      {/* 取消订单弹窗 */}
      {showCancelDialog && selectedOrder && (
        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <DialogContent className="sm:max-w-md">
            <View className="p-6">
              <Text className="block text-lg font-semibold mb-2">
                取消订单
              </Text>
              <View className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
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
                  • 需求方将收到取消通知
                </Text>
              </View>
              <Text className="block text-sm text-gray-600 mb-2">
                确定要取消订单 &quot;{selectedOrder.demand?.cargo_name}&quot; 吗？
              </Text>
              <View>
                <Text className="block text-sm font-medium mb-2">
                  <Text className="text-red-500">*</Text>取消原因
                </Text>
                <View className="bg-gray-50 rounded-lg p-3">
                  <Input
                    className="w-full bg-transparent"
                    placeholder="请输入取消原因"
                    value={cancelReason}
                    onInput={(e) => setCancelReason(e.detail.value)}
                    maxlength={200}
                  />
                </View>
              </View>
              <View className="flex gap-3 mt-4">
                <Button
                  className="flex-1 bg-gray-200"
                  onClick={handleCloseCancelDialog}
                  disabled={loading}
                >
                  <Text>取消</Text>
                </Button>
                <Button
                  className="flex-1 bg-red-500"
                  onClick={handleConfirmCancelOrder}
                  disabled={loading}
                >
                  <Text>{loading ? '处理中...' : '确认取消'}</Text>
                </Button>
              </View>
            </View>
          </DialogContent>
        </Dialog>
      )}
    </AppPageShell>
  )
}
