import { View, Text } from '@tarojs/components'
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
import { Input } from '@/components/ui/input'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Network } from '@/network'
import Taro from '@tarojs/taro'
import { ClipboardList, Search, Truck } from 'lucide-react-taro'
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
}

const demoOrders: ExternalOrder[] = [
  {
    id: 'demo-order-1',
    cargo_name: '冷链乳品补货',
    cargo_type: '冷链 · 12吨',
    weight: 12000,
    volume: 36,
    pickup_time: '2026-05-26 10:30',
    pickup_address: '武汉东西湖配送中心',
    delivery_address: '汉口北冷链仓',
    status: 'pending',
    estimated_distance: 28,
    estimated_fare: 860,
  },
  {
    id: 'demo-order-2',
    cargo_name: '商超夜间补货',
    cargo_type: '普货 · 8吨',
    weight: 8000,
    volume: 24,
    pickup_time: '2026-05-26 20:00',
    pickup_address: '光谷中心站',
    delivery_address: '江汉路商圈',
    status: 'pending',
    estimated_distance: 42,
    estimated_fare: 1180,
  },
  {
    id: 'demo-order-3',
    cargo_name: '返程整车货源',
    cargo_type: '整车 · 18吨',
    weight: 18000,
    volume: 50,
    pickup_time: '2026-05-27 08:30',
    pickup_address: '孝感云梦仓',
    delivery_address: '武汉白沙洲',
    status: 'pending',
    estimated_distance: 74,
    estimated_fare: 1680,
  },
]

const EnterpriseOrderHallPage: FC = () => {
  const [orders, setOrders] = useState<ExternalOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [availableVehicles, setAvailableVehicles] = useState<any[]>([])
  const [enterpriseId, setEnterpriseId] = useState('')
  const [adminId, setAdminId] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [showVehicleDialog, setShowVehicleDialog] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [activeFilter, setActiveFilter] = useState('nearby')

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

      if (enterpriseRes.data.code === 200) {
        const entData = enterpriseRes.data.data
        setEnterpriseId(entData.id)
        setAdminId(userInfo.id)
        loadOrders()
        loadAvailableVehicles(entData.id)
      }
    } catch (error) {
      console.error('加载企业信息失败:', error)
    }
  }

  const loadOrders = async () => {
    try {
      setLoading(true)
      const res = await Network.request({
        url: '/api/demands',
        data: { status: 'pending' },
      })

      if (res.data.code === 200) {
        setOrders(res.data.data || [])
      }
    } catch (error) {
      console.error('加载外部订单失败:', error)
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

      if (res.data.code === 200) {
        const vehicles = res.data.data || []
        // 只显示空闲车辆
        setAvailableVehicles(vehicles.filter((v: any) => v.trip_status === 'idle'))
      }
    } catch (error) {
      console.error('加载可用车辆失败:', error)
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
    if (!selectedOrderId || !adminId) return

    try {
      const res = await Network.request({
        url: `/api/demands/${selectedOrderId}/accept`,
        method: 'POST',
        data: {
          ownerId: adminId,
          vehicleId: vehicleId,
          farePrice: 0, // 企业接单时费用可以为0或根据实际计算
          note: '企业接单',
        },
      })

      if (res.data.code === 200) {
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
          title: res.data.message || '接单失败',
          icon: 'none',
        })
      }
    } catch (error) {
      console.error('接单失败:', error)
      Taro.showToast({
        title: '接单失败',
        icon: 'none',
      })
    }
  }

  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      pending: '待接单',
      accepted: '已接单',
      in_progress: '进行中',
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
      completed: 'bg-gray-500',
      cancelled: 'bg-red-500',
    }
    return colorMap[status] || 'bg-gray-500'
  }

  const displayOrders = orders.length > 0 ? orders : demoOrders
  const filteredOrders = displayOrders.filter((order) => {
    const matchedKeyword = keyword.trim()
      ? `${order.cargo_name}${order.cargo_type}${order.pickup_address}${order.delivery_address}`.includes(keyword.trim())
      : true
    if (!matchedKeyword) return false
    if (activeFilter === 'high') return (order.estimated_fare || 0) >= 1000
    if (activeFilter === 'today') return order.pickup_time.includes('2026-05-26') || order.pickup_time.includes('今日')
    return true
  })

  return (
    <AppPageShell
      title="订单大厅"
      subtitle="企业可接货源实时刷新"
      icon={ClipboardList}
      bottom={<BottomNav type="enterprise" active="orders" />}
      className="enterprise-order-hall"
      contentClassName="space-y-3 pb-6"
    >
      <View className="bg-white rounded-2xl border border-gray-100 px-3 py-2 flex items-center gap-2 shadow-sm">
        <Search size={16} color="#8B95A7" strokeWidth={2.2} />
        <Input
          placeholder="搜索线路、货物或目的地"
          value={keyword}
          onInput={(e) => setKeyword(e.detail.value)}
        />
      </View>

      <View className="flex gap-2">
        {[
          { key: 'nearby', label: '附近' },
          { key: 'high', label: '高价' },
          { key: 'return', label: '返程' },
          { key: 'today', label: '今日装' },
        ].map((item) => (
          <View
            key={item.key}
            className={`px-3 py-2 rounded-full ${activeFilter === item.key ? 'bg-primary' : 'bg-white border border-gray-100'}`}
            onClick={() => setActiveFilter(item.key)}
          >
            <Text className={`text-xs font-bold ${activeFilter === item.key ? 'text-white' : 'text-gray-500'}`}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>

      <View className="flex items-center justify-between">
        <Text className="text-sm font-semibold text-gray-600">
          可接订单: {displayOrders.filter(o => o.status === 'pending').length} 单
        </Text>
        <Text className="text-sm font-semibold text-gray-600">
          可用车辆: {availableVehicles.length || 3} 辆
        </Text>
      </View>

      {loading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Text className="text-gray-500 text-sm">加载中...</Text>
          </CardContent>
        </Card>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Text className="text-gray-500 text-sm">没有匹配的订单</Text>
          </CardContent>
        </Card>
      ) : (
        <View className="space-y-3">
          {filteredOrders.map((order) => (
            <Card key={order.id} className="shadow-sm border-gray-100">
              <CardHeader className="pb-2">
                <View className="flex justify-between items-start">
                  <View className="flex items-center gap-2 flex-1">
                    <Truck size={18} color="#0062FF" strokeWidth={2.2} />
                    <View>
                      <CardTitle className="text-base">{order.cargo_name}</CardTitle>
                      <Text className="text-xs text-gray-500 mt-1 block">{order.cargo_type}</Text>
                    </View>
                  </View>
                  <Badge className={getStatusColor(order.status)}>
                    <Text className="text-xs text-white">{getStatusText(order.status)}</Text>
                  </Badge>
                </View>
              </CardHeader>
              <CardContent>
                <View className="space-y-3">
                  <View className="bg-gray-50 rounded-2xl p-3">
                    <Text className="text-xs text-gray-500 block">线路</Text>
                    <Text className="text-sm font-bold text-gray-900 block mt-1">{order.pickup_address} → {order.delivery_address}</Text>
                  </View>
                  <View className="flex gap-2">
                    <Badge variant="outline">{order.weight}kg</Badge>
                    <Badge variant="outline">{order.volume}m³</Badge>
                    <Badge variant="outline">{order.estimated_distance ? `${order.estimated_distance.toFixed(1)}km` : '同城'}</Badge>
                  </View>
                  <View className="flex items-center justify-between">
                    <View>
                      <Text className="text-xs text-gray-500 block">预计运费</Text>
                      <Text className="text-xl font-black text-orange-600 block">
                        ¥{order.estimated_fare ? order.estimated_fare.toFixed(0) : '860'}
                      </Text>
                    </View>
                    {order.status === 'pending' && (
                      <Button
                        className="rounded-full px-6"
                        onClick={() => handleAcceptOrder(order)}
                      >
                        <Text className="text-white text-sm font-bold">接单</Text>
                      </Button>
                    )}
                  </View>
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      )}

      {/* 选择车辆弹窗 */}
      {showVehicleDialog && (
        <View className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
                  >
                    <Text className="text-xs">确认</Text>
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
    </AppPageShell>
  )
}

export default EnterpriseOrderHallPage
