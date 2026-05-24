import { View, Text, ScrollView } from '@tarojs/components'
import { useEffect, useState } from 'react'
import type { FC } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getApiData, getApiMessage, isApiSuccess } from '@/lib/api-response'
import { Network } from '@/network'
import Taro from '@tarojs/taro'
import './index.css'

interface ExternalOrder {
  id: string
  cargo_name: string
  cargo_type: string
  weight: number
  volume: number
  pickup_time: string
  pickup_address: string
  delivery_address: string
  status: string
  estimated_distance?: number
  estimated_fare?: number
  cargo_info?: {
    businessMode?: 'enterprise_terminal' | 'community_group_buy'
    businessModeLabel?: string
  }
  delivery_points?: Array<{
    businessMode?: 'enterprise_terminal' | 'community_group_buy'
    pointType?: string
  }>
}

const EnterpriseOrderHallPage: FC = () => {
  const [orders, setOrders] = useState<ExternalOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [availableVehicles, setAvailableVehicles] = useState<any[]>([])
  const [enterpriseId, setEnterpriseId] = useState('')
  const [adminId, setAdminId] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [showVehicleDialog, setShowVehicleDialog] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    loadEnterpriseInfo()
  }, [])

  const loadEnterpriseInfo = async () => {
    try {
      const userInfo = Taro.getStorageSync('userInfo')
      if (!userInfo) {
        Taro.redirectTo({ url: '/pages/index/index' })
        return
      }

      const enterpriseRes = await Network.request({
        url: `/api/enterprise/admin/${userInfo.id}`,
      })

      if (isApiSuccess(enterpriseRes)) {
        const entData = getApiData<{ id: string } | null>(enterpriseRes, null)
        if (!entData?.id) {
          setErrorText('企业信息缺失')
          return
        }
        setEnterpriseId(entData.id)
        setAdminId(userInfo.id)
        loadOrders()
        loadAvailableVehicles(entData.id)
      } else {
        setErrorText(getApiMessage(enterpriseRes, '加载企业信息失败'))
      }
    } catch {
      setErrorText('加载企业信息失败')
    }
  }

  const loadOrders = async () => {
    try {
      setLoading(true)
      const res = await Network.request({
        url: '/api/demand/external/pending',
      })

      if (isApiSuccess(res)) {
        setOrders(getApiData<ExternalOrder[]>(res, []))
        setErrorText('')
      } else {
        setErrorText(getApiMessage(res, '加载外部订单失败'))
      }
    } catch {
      setErrorText('加载外部订单失败')
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableVehicles = async (entId: string) => {
    try {
      const res = await Network.request({
        url: '/api/enterprise-vehicles',
        data: { enterprise_id: entId, usage_mode: 'external' },
      })

      if (isApiSuccess(res)) {
        const vehicles = getApiData<any[]>(res, [])
        // 只显示空闲车辆
        setAvailableVehicles(vehicles.filter((v: any) => v.trip_status === 'idle'))
      } else {
        setErrorText(getApiMessage(res, '加载可用车辆失败'))
      }
    } catch {
      setErrorText('加载可用车辆失败')
    }
  }

  const handleAcceptOrder = (order: ExternalOrder) => {
    if (availableVehicles.length === 0) {
      Taro.showToast({
        title: '暂无可用车辆',
        icon: 'none',
      })
      return
    }

    setSelectedOrderId(order.id)
    setShowVehicleDialog(true)
  }

  const handleConfirmAccept = async (vehicleId: string) => {
    if (!selectedOrderId || !enterpriseId || !adminId) return

    try {
      setAccepting(true)
      const res = await Network.request({
        url: `/api/demand/external/${selectedOrderId}/accept`,
        method: 'POST',
        data: {
          enterprise_id: enterpriseId,
          vehicle_ids: [vehicleId],
        },
      })

      if (isApiSuccess(res)) {
        Taro.showToast({
          title: '接单成功',
          icon: 'success',
        })
        setShowVehicleDialog(false)
        setSelectedOrderId(null)
        // 刷新订单列表
        loadOrders()
        loadAvailableVehicles(enterpriseId)
      } else {
        Taro.showToast({
          title: getApiMessage(res, '接单失败'),
          icon: 'none',
        })
      }
    } catch {
      Taro.showToast({
        title: '接单失败',
        icon: 'none',
      })
    } finally {
      setAccepting(false)
    }
  }

  const getBusinessModeText = (order: ExternalOrder) => {
    const mode = order.cargo_info?.businessMode || order.delivery_points?.[0]?.businessMode
    if (mode === 'community_group_buy') return '社区团购'
    return order.cargo_info?.businessModeLabel || '终端配送'
  }

  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      pending: '待接单',
      accepted: '已接单',
      in_progress: '进行中',
      in_transit: '进行中',
      completed: '已完成',
      cancelled: '已取消',
    }
    return statusMap[status] || status
  }

  const getStatusColor = (status: string) => {
    const colorMap: { [key: string]: string } = {
      pending: 'bg-yellow-500',
      accepted: 'bg-blue-500',
      in_progress: 'bg-green-500',
      in_transit: 'bg-green-500',
      completed: 'bg-gray-500',
      cancelled: 'bg-red-500',
    }
    return colorMap[status] || 'bg-gray-500'
  }

  return (
    <View className="enterprise-order-hall min-h-screen bg-gray-50 pb-20">
      <View className="bg-blue-600 text-white p-4">
        <Text className="text-lg font-bold block">接单大厅</Text>
        <Text className="text-sm opacity-90 block mt-1">承接外部配送订单</Text>
      </View>

      <ScrollView scrollY className="h-full" style={{ height: 'calc(100vh - 60px)' }}>
        <View className="p-4">
          {errorText && (
            <Card className="mb-4 border-red-200 bg-red-50">
              <CardContent className="p-3">
                <Text className="block text-sm text-red-600">{errorText}</Text>
              </CardContent>
            </Card>
          )}

          <View className="flex items-center justify-between mb-4">
            <Text className="text-sm text-gray-600">
              可接订单: {orders.filter(o => o.status === 'pending').length} 单
            </Text>
            <Text className="text-sm text-gray-600">
              可用车辆: {availableVehicles.length} 辆
            </Text>
          </View>

          {loading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Text className="text-gray-500 text-sm">加载中...</Text>
              </CardContent>
            </Card>
          ) : orders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Text className="text-gray-500 text-sm">暂无可接订单</Text>
              </CardContent>
            </Card>
          ) : (
            <View className="space-y-3">
              {orders.map((order) => (
                <Card key={order.id}>
                  <CardHeader className="pb-2">
                    <View className="flex justify-between items-start">
                      <CardTitle className="text-base">
                        {order.cargo_name}
                      </CardTitle>
                      <Badge className={getStatusColor(order.status)}>
                        <Text className="text-xs text-white">
                          {getStatusText(order.status)}
                        </Text>
                      </Badge>
                    </View>
                  </CardHeader>
                  <CardContent>
                    <View className="space-y-2">
                      <View>
                        <Text className="text-xs text-gray-500 block">货物类型</Text>
                        <Text className="text-sm block">{order.cargo_type}</Text>
                      </View>
                      <View>
                        <Text className="text-xs text-gray-500 block">业务模式</Text>
                        <Text className="text-sm block">{getBusinessModeText(order)}</Text>
                      </View>
                      <View className="flex gap-4">
                        <View>
                          <Text className="text-xs text-gray-500 block">重量</Text>
                          <Text className="text-sm block">{order.weight}kg</Text>
                        </View>
                        <View>
                          <Text className="text-xs text-gray-500 block">体积</Text>
                          <Text className="text-sm block">{order.volume}m³</Text>
                        </View>
                      </View>
                      <View>
                        <Text className="text-xs text-gray-500 block">取货地址</Text>
                        <Text className="text-sm block">{order.pickup_address}</Text>
                      </View>
                      <View>
                        <Text className="text-xs text-gray-500 block">送货地址</Text>
                        <Text className="text-sm block">{order.delivery_address}</Text>
                      </View>
                      <View className="flex gap-4">
                        <View>
                          <Text className="text-xs text-gray-500 block">预计距离</Text>
                          <Text className="text-sm block">
                            {order.estimated_distance ? order.estimated_distance.toFixed(1) : '-'} km
                          </Text>
                        </View>
                        <View>
                          <Text className="text-xs text-gray-500 block">预计费用</Text>
                          <Text className="text-sm block">
                            ¥{order.estimated_fare ? order.estimated_fare.toFixed(2) : '-'}
                          </Text>
                        </View>
                      </View>
                      {order.status === 'pending' && (
                        <Button
                          className="w-full mt-2"
                          onClick={() => handleAcceptOrder(order)}
                        >
                          <Text>接单</Text>
                        </Button>
                      )}
                    </View>
                  </CardContent>
                </Card>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* 选择车辆弹窗 */}
      {showVehicleDialog && (
        <View
          className="bg-black bg-opacity-50 z-50"
          style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <View className="bg-white rounded-lg p-6 w-11/12 max-w-md">
            <Text className="text-xl font-bold block mb-4">选择车辆</Text>

            <View className="space-y-2 max-h-60 overflow-y-auto">
              {availableVehicles.map((vehicle) => (
                <View
                  key={vehicle.id}
                  className="p-3 border rounded-lg flex justify-between items-center"
                >
                  <View>
                    <Text className="text-sm font-medium block">
                      {vehicle.vehicle_code}
                    </Text>
                    <Text className="text-xs text-gray-600 block">
                      {vehicle.vehicle_type} · {vehicle.load_capacity}kg
                    </Text>
                  </View>
                  <Button
                    size="sm"
                    onClick={() => handleConfirmAccept(vehicle.id)}
                    disabled={accepting}
                  >
                    <Text className="text-xs">{accepting ? '提交中' : '确认'}</Text>
                  </Button>
                </View>
              ))}
            </View>

            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => {
                setShowVehicleDialog(false)
                setSelectedOrderId(null)
              }}
            >
              <Text>取消</Text>
            </Button>
          </View>
        </View>
      )}
    </View>
  )
}

export default EnterpriseOrderHallPage
