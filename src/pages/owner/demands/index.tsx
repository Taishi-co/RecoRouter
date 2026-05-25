import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
// import { useNotificationPolling } from '@/hooks/useNotificationPolling'

interface Demand {
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
  created_at: string
  merchant_id: string
  // 距离相关字段
  estimated_distance?: number | string
  pickup_lat?: number | string
  pickup_lng?: number | string
  delivery_lat?: number | string
  delivery_lng?: number | string
  merchant?: {
    phone: string
    name: string
  }
}

const demoDemands: Demand[] = [
  {
    id: 'demo-demand-1',
    cargo_name: '冷链鲜奶配送',
    cargo_type: 'refrigerated',
    weight: 820,
    volume: 3.2,
    pickup_time: '2026-05-26T08:30:00+10:00',
    pickup_address: '宝山城市仓 · 1号月台',
    delivery_address: '萧山中心站 · 北门',
    remarks: '需全程温控 2-8°C，优先派冷链车',
    status: 'pending',
    created_at: '2026-05-26T07:45:00+10:00',
    merchant_id: 'demo-merchant',
    estimated_distance: 168,
    merchant: {
      phone: '13800000000',
      name: '演示商户',
    },
  },
  {
    id: 'demo-demand-2',
    cargo_name: '社区补货专线',
    cargo_type: 'normal',
    weight: 460,
    volume: 2.1,
    pickup_time: '2026-05-26T14:30:00+10:00',
    pickup_address: '苏州前置仓',
    delivery_address: '昆山周市店群',
    remarks: '三点卸货，需司机电话回执',
    status: 'pending',
    created_at: '2026-05-26T11:20:00+10:00',
    merchant_id: 'demo-merchant',
    estimated_distance: 42,
  },
]

export default function OwnerDemands() {
  const [demands, setDemands] = useState<Demand[]>([])
  const [loading, setLoading] = useState(false)

  // 启用通知轮询（暂时注释，避免白屏问题）
  // useNotificationPolling(30000) // 每30秒检查一次新通知

  useEffect(() => {
    loadDemands()
  }, [])

  const loadDemands = async () => {
    setLoading(true)

    try {
      const res = await Network.request({
        url: '/api/demands?status=pending',
        method: 'GET'
      })

      console.log('需求列表响应:', res.data)

      if (res.data.code === 200) {
        setDemands(res.data.data || [])
      } else {
        Taro.showToast({
          title: res.data.message || '加载失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('加载需求列表失败:', error)
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
      normal: 'bg-blue-500',
      fragile: 'bg-orange-500',
      refrigerated: 'bg-cyan-500',
      bulky: 'bg-purple-500',
      hazardous: 'bg-red-500'
    }
    return colors[type] || 'bg-gray-500'
  }

  const handleAcceptDemand = (demand: Demand) => {
    // 跳转到独立页面
    Taro.navigateTo({
      url: `/pages/owner/accept-order/index?demandId=${demand.id}`
    })
  }

  const handleRefresh = () => {
    loadDemands()
  }

  const visibleDemands = demands.length > 0 ? demands : demoDemands
  const usingDemoDemands = !loading && demands.length === 0

  return (
    <AppPageShell
      title="需求大厅"
      subtitle="RecoRouter 运力端"
      contentClassName="space-y-3"
      bottom={<BottomNav type="owner" active="home" />}
    >
        <Card className="bg-white rounded-lg shadow-sm">
          <CardHeader>
            <View className="flex justify-between items-center">
              <CardTitle className="text-lg font-semibold">
                附近需求
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefresh}
                disabled={loading}
              >
                <Text className="text-xs">刷新</Text>
              </Button>
            </View>
          </CardHeader>
          <CardContent>
            {loading ? (
              <View className="text-center py-8">
                <Text className="block text-gray-500 text-sm">加载中...</Text>
              </View>
            ) : (
              <View className="space-y-3">
                {usingDemoDemands && (
                  <View className="bg-blue-50 rounded-lg p-3">
                    <Text className="block text-xs text-blue-700">
                      暂无真实待接单需求，以下为设计稿演示数据
                    </Text>
                  </View>
                )}
                {visibleDemands.map((demand) => (
                  <View key={demand.id} className="bg-gray-50 rounded-lg p-4">
                    <View className="flex justify-between items-start mb-3">
                      <View className="flex-1">
                        <Text className="block font-medium text-base mb-1">
                          {demand.cargo_name}
                        </Text>
                        <View className="flex items-center gap-2 mb-2">
                          <Badge className={getCargoTypeColor(demand.cargo_type)}>
                            <Text className="text-white text-xs">
                              {getCargoTypeText(demand.cargo_type)}
                            </Text>
                          </Badge>
                          <Badge className="bg-green-500">
                            <Text className="text-white text-xs">
                              待接单
                            </Text>
                          </Badge>
                        </View>
                      </View>
                      <Button
                        size="sm"
                        className="bg-blue-500"
                        onClick={() => handleAcceptDemand(demand)}
                      >
                        <Text className="text-xs">接单</Text>
                      </Button>
                    </View>
                    <View className="space-y-2 mb-3">
                      <View className="flex items-start">
                        <Text className="text-xs text-gray-500 w-16 flex-shrink-0">取货:</Text>
                        <Text className="text-xs text-gray-700 flex-1">
                          {demand.pickup_address}
                        </Text>
                      </View>
                      <View className="flex items-start">
                        <Text className="text-xs text-gray-500 w-16 flex-shrink-0">送货:</Text>
                        <Text className="text-xs text-gray-700 flex-1">
                          {demand.delivery_address}
                        </Text>
                      </View>
                      <View className="flex items-start">
                        <Text className="text-xs text-gray-500 w-16 flex-shrink-0">时间:</Text>
                        <Text className="text-xs text-gray-700 flex-1">
                          {new Date(demand.pickup_time).toLocaleString()}
                        </Text>
                      </View>
                      <View className="flex items-start">
                        <Text className="text-xs text-gray-500 w-16 flex-shrink-0">规格:</Text>
                        <Text className="text-xs text-gray-700 flex-1">
                          {demand.weight}kg / {demand.volume}m³
                        </Text>
                      </View>
                      {demand.remarks && (
                        <View className="flex items-start">
                          <Text className="text-xs text-gray-500 w-16 flex-shrink-0">备注:</Text>
                          <Text className="text-xs text-gray-700 flex-1">
                            {demand.remarks}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-xs text-gray-400">
                      发布时间: {new Date(demand.created_at).toLocaleString()}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </CardContent>
        </Card>
    </AppPageShell>
  )
}
