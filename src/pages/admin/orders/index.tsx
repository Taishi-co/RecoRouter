import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import Taro from '@tarojs/taro'
import { ClipboardList } from 'lucide-react-taro'
import { Network } from '@/network'

interface Demand {
  id: string
  cargo_name: string
  cargo_type: string
  weight: number
  volume: number
  pickup_address: string
  delivery_address: string
  pickup_time: string
}

interface Vehicle {
  id: string
  vehicle_type: string
  license_plate: string
}

interface User {
  id: string
  username: string
  phone: string
}

interface Order {
  id: string
  demand_id: string
  demand: Demand
  vehicle_id: string | null
  vehicle: Vehicle | null
  merchant_id: string
  merchant: User
  owner_id: string | null
  owner: User | null
  status: string
  pickup_photo_key: string | null
  delivery_photo_key: string | null
  delivery_proof_key: string | null
  cancel_reason: string | null
  cancel_time: string | null
  accept_time: string | null
  complete_time: string | null
  created_at: string
}

const demoOrders: Order[] = [
  {
    id: 'demo-order-pending',
    demand_id: 'demo-demand-1',
    demand: {
      id: 'demo-demand-1',
      cargo_name: '冷链奶品配送',
      cargo_type: 'fresh',
      weight: 1800,
      volume: 12,
      pickup_address: '武汉东西湖中心仓',
      delivery_address: '江汉区前进四路门店',
      pickup_time: '2026-05-26T14:30:00+10:00',
    },
    vehicle_id: null,
    vehicle: null,
    merchant_id: 'demo-merchant-1',
    merchant: {
      id: 'demo-merchant-1',
      username: '武汉鲜配商贸',
      phone: '156****7098',
    },
    owner_id: null,
    owner: null,
    status: 'pending',
    pickup_photo_key: null,
    delivery_photo_key: null,
    delivery_proof_key: null,
    cancel_reason: null,
    cancel_time: null,
    accept_time: null,
    complete_time: null,
    created_at: '2026-05-26T09:10:00+10:00',
  },
  {
    id: 'demo-order-transit',
    demand_id: 'demo-demand-2',
    demand: {
      id: 'demo-demand-2',
      cargo_name: '商超日配补货',
      cargo_type: 'normal',
      weight: 3200,
      volume: 18,
      pickup_address: '汉阳四新配送站',
      delivery_address: '武昌徐东商圈',
      pickup_time: '2026-05-26T10:00:00+10:00',
    },
    vehicle_id: 'demo-vehicle-1',
    vehicle: {
      id: 'demo-vehicle-1',
      vehicle_type: '9.6m 厢式货车',
      license_plate: '鄂A·7K21',
    },
    merchant_id: 'demo-merchant-2',
    merchant: {
      id: 'demo-merchant-2',
      username: '上海某某贸易',
      phone: '138****2651',
    },
    owner_id: 'demo-owner-1',
    owner: {
      id: 'demo-owner-1',
      username: '张师傅',
      phone: '138****6621',
    },
    status: 'in_transit',
    pickup_photo_key: null,
    delivery_photo_key: null,
    delivery_proof_key: null,
    cancel_reason: null,
    cancel_time: null,
    accept_time: '2026-05-26T09:30:00+10:00',
    complete_time: null,
    created_at: '2026-05-26T08:45:00+10:00',
  },
]

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')

  useEffect(() => {
    const userInfo = Taro.getStorageSync('userInfo')
    if (!userInfo || userInfo.role !== 'admin') {
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
      let url = '/api/admin/orders'
      if (filterStatus) {
        url += `?status=${filterStatus}`
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

  const getStatusText = (status: string) => {
    const statuses: Record<string, string> = {
      pending: '待接单',
      accepted: '已接单',
      in_transit: '运输中',
      completed: '已完成',
      cancelled: '已取消'
    }
    return statuses[status] || status
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-orange-500',
      accepted: 'bg-blue-500',
      in_transit: 'bg-cyan-500',
      completed: 'bg-green-500',
      cancelled: 'bg-red-500'
    }
    return colors[status] || 'bg-gray-500'
  }

  const getCargoTypeText = (type: string) => {
    switch (type) {
      case 'normal':
        return '普通'
      case 'fresh':
        return '生鲜'
      case 'fragile':
        return '易碎'
      default:
        return '未知'
    }
  }

  const getCargoTypeColor = (type: string) => {
    switch (type) {
      case 'normal':
        return 'bg-blue-500'
      case 'fresh':
        return 'bg-green-500'
      case 'fragile':
        return 'bg-orange-500'
      default:
        return 'bg-gray-500'
    }
  }

  const filteredDemoOrders = filterStatus
    ? demoOrders.filter((order) => order.status === filterStatus)
    : demoOrders
  const displayOrders = orders.length > 0 ? orders : filteredDemoOrders

  return (
    <AppPageShell
      title="订单管理"
      subtitle="RecoRouter 运营端"
      right={
        <View className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
          <ClipboardList size={20} color="#0062FF" strokeWidth={2.3} />
        </View>
      }
      bottom={<BottomNav type="admin" active="orders" />}
      scroll={false}
      contentClassName="space-y-3"
    >
      <View>
        <Card className="bg-white rounded-lg shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              订单管理
            </CardTitle>
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
                variant={filterStatus === 'pending' ? 'default' : 'outline'}
                className={filterStatus === 'pending' ? 'bg-blue-500' : ''}
                onClick={() => setFilterStatus('pending')}
              >
                <Text className="text-xs">待接单</Text>
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
              <Button
                size="sm"
                variant={filterStatus === 'cancelled' ? 'default' : 'outline'}
                className={filterStatus === 'cancelled' ? 'bg-blue-500' : ''}
                onClick={() => setFilterStatus('cancelled')}
              >
                <Text className="text-xs">已取消</Text>
              </Button>
            </View>

            {loading ? (
              <View className="text-center py-8">
                <Text className="block text-gray-500 text-sm">加载中...</Text>
              </View>
            ) : displayOrders.length === 0 ? (
              <View className="text-center py-8">
                <Text className="block text-gray-500 text-sm">暂无订单</Text>
              </View>
            ) : (
              <View className="space-y-3">
                {displayOrders.map((order) => (
                  <View key={order.id} className="bg-gray-50 rounded-lg p-4">
                    <View className="flex justify-between items-start mb-3">
                      <View className="flex-1">
                        <Text className="block font-medium text-base mb-1">
                          {order.demand?.cargo_name || '未知货物'}
                        </Text>
                        <View className="flex items-center gap-2">
                          <Badge className={getStatusColor(order.status)}>
                            <Text className="text-white text-xs">
                              {getStatusText(order.status)}
                            </Text>
                          </Badge>
                          {order.demand && (
                            <Badge className={getCargoTypeColor(order.demand.cargo_type)}>
                              <Text className="text-white text-xs">
                                {getCargoTypeText(order.demand.cargo_type)}
                              </Text>
                            </Badge>
                          )}
                        </View>
                      </View>
                    </View>
                    <View className="space-y-2">
                      {order.demand && (
                        <>
                          <View className="flex items-start">
                            <Text className="text-xs text-gray-500 w-20 flex-shrink-0">取货:</Text>
                            <Text className="text-xs text-gray-700 flex-1">
                              {order.demand.pickup_address}
                            </Text>
                          </View>
                          <View className="flex items-start">
                            <Text className="text-xs text-gray-500 w-20 flex-shrink-0">送货:</Text>
                            <Text className="text-xs text-gray-700 flex-1">
                              {order.demand.delivery_address}
                            </Text>
                          </View>
                          <View className="flex items-start">
                            <Text className="text-xs text-gray-500 w-20 flex-shrink-0">规格:</Text>
                            <Text className="text-xs text-gray-700 flex-1">
                              {order.demand.weight}kg / {order.demand.volume}m³
                            </Text>
                          </View>
                          <View className="flex items-start">
                            <Text className="text-xs text-gray-500 w-20 flex-shrink-0">时间:</Text>
                            <Text className="text-xs text-gray-700 flex-1">
                              {new Date(order.demand.pickup_time).toLocaleString()}
                            </Text>
                          </View>
                        </>
                      )}
                      {order.merchant && (
                        <View className="flex items-start">
                          <Text className="text-xs text-gray-500 w-20 flex-shrink-0">需求方:</Text>
                          <Text className="text-xs text-gray-700 flex-1">
                            {order.merchant.username} ({order.merchant.phone})
                          </Text>
                        </View>
                      )}
                      {order.owner && (
                        <View className="flex items-start">
                          <Text className="text-xs text-gray-500 w-20 flex-shrink-0">车主:</Text>
                          <Text className="text-xs text-gray-700 flex-1">
                            {order.owner.username} ({order.owner.phone})
                          </Text>
                        </View>
                      )}
                      {order.vehicle && (
                        <View className="flex items-start">
                          <Text className="text-xs text-gray-500 w-20 flex-shrink-0">车辆:</Text>
                          <Text className="text-xs text-gray-700 flex-1">
                            {order.vehicle.vehicle_type} - {order.vehicle.license_plate || '未填写车牌'}
                          </Text>
                        </View>
                      )}
                    </View>
                    {order.accept_time && (
                      <View className="mt-2 pt-2 border-t border-gray-200">
                        <Text className="text-xs text-gray-500">
                          接单时间: {new Date(order.accept_time).toLocaleString()}
                        </Text>
                      </View>
                    )}
                    {order.complete_time && (
                      <View className="mt-2 pt-2 border-t border-gray-200">
                        <Text className="text-xs text-gray-500">
                          完成时间: {new Date(order.complete_time).toLocaleString()}
                        </Text>
                      </View>
                    )}
                    {order.cancel_reason && (
                      <View className="mt-2 pt-2 border-t border-gray-200">
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
    </AppPageShell>
  )
}
