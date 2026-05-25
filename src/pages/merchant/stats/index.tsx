import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Taro from '@tarojs/taro'
import { Network } from '@/network'

interface StatsData {
  total_demands: number
  status_counts: {
    pending: number
    accepted: number
    in_transit: number
    completed: number
    cancelled: number
  }
  cargo_type_counts: {
    normal: number
    fresh: number
    fragile: number
  }
  total_weight: number
  total_volume: number
  recent_demands: Array<{
    id: string
    cargo_name: string
    cargo_type: string
    status: string
    created_at: string
  }>
}

export default function MerchantStats() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const userInfo = Taro.getStorageSync('userInfo')
    if (!userInfo || userInfo.role !== 'merchant') {
      Taro.showToast({
        title: '请先登录',
        icon: 'none'
      })
      setTimeout(() => {
        Taro.redirectTo({ url: '/pages/index/index' })
      }, 1500)
      return
    }
    loadStats()
  }, [])

  const loadStats = async () => {
    const userInfo = Taro.getStorageSync('userInfo')
    setLoading(true)

    try {
      const res = await Network.request({
        url: '/api/demands/stats/merchant',
        data: { merchant_id: userInfo.id }
      })

      console.log('统计数据响应:', res.data)

      if (res.data.code === 200) {
        setStats(res.data.data)
      }
    } catch (error) {
      console.error('加载统计数据失败:', error)
      Taro.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '待接单'
      case 'accepted':
        return '已接单'
      case 'in_transit':
        return '运输中'
      case 'completed':
        return '已完成'
      case 'cancelled':
        return '已取消'
      default:
        return '未知'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500'
      case 'accepted':
        return 'bg-blue-500'
      case 'in_transit':
        return 'bg-purple-500'
      case 'completed':
        return 'bg-green-500'
      case 'cancelled':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
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

  if (loading && !stats) {
    return (
      <View className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Text className="text-gray-500">加载中...</Text>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-gray-100">
      {/* 导航菜单 */}
      <View className="bg-white shadow-sm">
        <View className="px-4 py-3">
          <View className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => Taro.navigateTo({ url: '/pages/merchant/demands/publish' })}
            >
              <Text className="text-xs">发布需求</Text>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => Taro.navigateTo({ url: '/pages/merchant/demands/list' })}
            >
              <Text className="text-xs">我的需求</Text>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => Taro.navigateTo({ url: '/pages/merchant/orders/index' })}
            >
              <Text className="text-xs">订单管理</Text>
            </Button>
            <Button
              size="sm"
              className="bg-blue-500"
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
        {/* 概览统计 */}
        <Card className="bg-white rounded-lg shadow-sm mb-4">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              数据概览
            </CardTitle>
          </CardHeader>
          <CardContent>
            <View className="grid grid-cols-2 gap-4">
              <View className="bg-blue-50 rounded-lg p-4">
                <Text className="block text-2xl font-bold text-blue-600 mb-1">
                  {stats?.total_demands || 0}
                </Text>
                <Text className="block text-sm text-gray-600">
                  总需求量
                </Text>
              </View>
              <View className="bg-green-50 rounded-lg p-4">
                <Text className="block text-2xl font-bold text-green-600 mb-1">
                  {stats?.status_counts.completed || 0}
                </Text>
                <Text className="block text-sm text-gray-600">
                  已完成订单
                </Text>
              </View>
              <View className="bg-yellow-50 rounded-lg p-4">
                <Text className="block text-2xl font-bold text-yellow-600 mb-1">
                  {stats?.status_counts.pending || 0}
                </Text>
                <Text className="block text-sm text-gray-600">
                  待接单
                </Text>
              </View>
              <View className="bg-purple-50 rounded-lg p-4">
                <Text className="block text-2xl font-bold text-purple-600 mb-1">
                  {stats?.total_weight.toFixed(1) || 0}
                </Text>
                <Text className="block text-sm text-gray-600">
                  总重量(kg)
                </Text>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* 需求状态分布 */}
        <Card className="bg-white rounded-lg shadow-sm mb-4">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              需求状态分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            <View className="space-y-3">
              {[
                { key: 'pending', label: '待接单', color: 'bg-yellow-500' },
                { key: 'accepted', label: '已接单', color: 'bg-blue-500' },
                { key: 'in_transit', label: '运输中', color: 'bg-purple-500' },
                { key: 'completed', label: '已完成', color: 'bg-green-500' },
                { key: 'cancelled', label: '已取消', color: 'bg-red-500' }
              ].map((item) => (
                <View key={item.key} className="flex items-center justify-between">
                  <View className="flex items-center">
                    <View className={`w-3 h-3 rounded-full ${item.color} mr-3`} />
                    <Text className="text-sm text-gray-700">{item.label}</Text>
                  </View>
                  <Text className="text-sm font-medium text-gray-900">
                    {stats?.status_counts[item.key as keyof typeof stats.status_counts] || 0}
                  </Text>
                </View>
              ))}
            </View>
          </CardContent>
        </Card>

        {/* 货品类型统计 */}
        <Card className="bg-white rounded-lg shadow-sm mb-4">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              货品类型统计
            </CardTitle>
          </CardHeader>
          <CardContent>
            <View className="space-y-3">
              {[
                { key: 'normal', label: '普通货物', color: 'bg-blue-500' },
                { key: 'fresh', label: '生鲜食品', color: 'bg-green-500' },
                { key: 'fragile', label: '易碎物品', color: 'bg-orange-500' }
              ].map((item) => (
                <View key={item.key} className="flex items-center justify-between">
                  <View className="flex items-center">
                    <View className={`w-3 h-3 rounded-full ${item.color} mr-3`} />
                    <Text className="text-sm text-gray-700">{item.label}</Text>
                  </View>
                  <Text className="text-sm font-medium text-gray-900">
                    {stats?.cargo_type_counts[item.key as keyof typeof stats.cargo_type_counts] || 0}
                  </Text>
                </View>
              ))}
            </View>
          </CardContent>
        </Card>

        {/* 最近需求 */}
        <Card className="bg-white rounded-lg shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">
              最近需求
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => Taro.navigateTo({ url: '/pages/merchant/demands/list' })}
            >
              <Text className="text-xs">查看全部</Text>
            </Button>
          </CardHeader>
          <CardContent>
            {stats?.recent_demands && stats.recent_demands.length > 0 ? (
              <View className="space-y-3">
                {stats.recent_demands.map((demand) => (
                  <View key={demand.id} className="bg-gray-50 rounded-lg p-3">
                    <View className="flex justify-between items-start mb-2">
                      <Text className="block font-medium text-sm">
                        {demand.cargo_name}
                      </Text>
                      <Badge className={getStatusColor(demand.status)}>
                        <Text className="text-white text-xs">
                          {getStatusText(demand.status)}
                        </Text>
                      </Badge>
                    </View>
                    <View className="flex items-center gap-2">
                      <Badge className={getCargoTypeColor(demand.cargo_type)}>
                        <Text className="text-white text-xs">
                          {getCargoTypeText(demand.cargo_type)}
                        </Text>
                      </Badge>
                      <Text className="text-xs text-gray-500">
                        {new Date(demand.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View className="text-center py-8">
                <Text className="block text-gray-500 text-sm">
                  暂无需求记录
                </Text>
              </View>
            )}
          </CardContent>
        </Card>

        {/* 刷新按钮 */}
        <View className="mt-4">
          <Button
            className="w-full bg-blue-500"
            onClick={loadStats}
            disabled={loading}
          >
            <Text>{loading ? '刷新中...' : '刷新数据'}</Text>
          </Button>
        </View>
      </View>
    </View>
  )
}
