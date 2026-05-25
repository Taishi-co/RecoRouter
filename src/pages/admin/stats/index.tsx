import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import Taro from '@tarojs/taro'
import { ChartNoAxesCombined } from 'lucide-react-taro'
import { Network } from '@/network'

interface Statistics {
  users: {
    total: number
    owner: number
    merchant: number
    active: number
    disabled: number
  }
  orders: {
    total: number
    pending: number
    accepted: number
    in_transit: number
    completed: number
    cancelled: number
  }
  vehicles: {
    total: number
    pending: number
    active: number
    inactive: number
  }
  demands: {
    total: number
    pending: number
    accepted: number
    in_transit: number
    completed: number
    cancelled: number
  }
}

const demoStats: Statistics = {
  users: {
    total: 168,
    owner: 92,
    merchant: 70,
    active: 154,
    disabled: 14,
  },
  orders: {
    total: 328,
    pending: 18,
    accepted: 26,
    in_transit: 34,
    completed: 238,
    cancelled: 12,
  },
  vehicles: {
    total: 86,
    pending: 9,
    active: 68,
    inactive: 9,
  },
  demands: {
    total: 246,
    pending: 22,
    accepted: 35,
    in_transit: 31,
    completed: 146,
    cancelled: 12,
  },
}

export default function AdminStats() {
  const [stats, setStats] = useState<Statistics | null>(null)
  const [loading, setLoading] = useState(false)

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
    loadStatistics()
  }, [])

  const loadStatistics = async () => {
    setLoading(true)

    try {
      const res = await Network.request({
        url: '/api/admin/statistics',
        method: 'GET'
      })

      console.log('统计数据响应:', res.data)

      if (res.data.code === 200) {
        setStats(res.data.data)
      } else {
        Taro.showToast({
          title: res.data.message || '加载失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('加载统计数据失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const displayStats = stats || demoStats

  return (
    <AppPageShell
      title="运营统计"
      subtitle="RecoRouter 运营端"
      right={
        <View className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
          <ChartNoAxesCombined size={20} color="#0062FF" strokeWidth={2.3} />
        </View>
      }
      bottom={<BottomNav type="admin" active="stats" />}
      scroll={false}
      contentClassName="space-y-3"
    >
      <View>
        <Card className="bg-white rounded-lg shadow-sm mb-4">
          <CardHeader>
            <View className="flex justify-between items-center">
              <CardTitle className="text-lg font-semibold">
                数据统计
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={loadStatistics}
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
            ) : !displayStats ? (
              <View className="text-center py-8">
                <Text className="block text-gray-500 text-sm">暂无数据</Text>
              </View>
            ) : (
              <View className="space-y-4">
                {/* 用户统计 */}
                <Card className="bg-blue-50 rounded-lg">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">
                      用户统计
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <View className="grid grid-cols-2 gap-4">
                      <View className="text-center">
                        <Text className="block text-2xl font-bold text-blue-600 mb-1">
                          {displayStats.users.total}
                        </Text>
                        <Text className="block text-sm text-gray-600">
                          总用户数
                        </Text>
                      </View>
                      <View className="text-center">
                        <Text className="block text-2xl font-bold text-blue-600 mb-1">
                          {displayStats.users.active}
                        </Text>
                        <Text className="block text-sm text-gray-600">
                          正常用户
                        </Text>
                      </View>
                      <View className="text-center">
                        <Text className="block text-2xl font-bold text-green-600 mb-1">
                          {displayStats.users.owner}
                        </Text>
                        <Text className="block text-sm text-gray-600">
                          车主
                        </Text>
                      </View>
                      <View className="text-center">
                        <Text className="block text-2xl font-bold text-orange-600 mb-1">
                          {displayStats.users.merchant}
                        </Text>
                        <Text className="block text-sm text-gray-600">
                          需求方
                        </Text>
                      </View>
                    </View>
                    {displayStats.users.disabled > 0 && (
                      <View className="mt-4 pt-4 border-t border-blue-200">
                        <Text className="text-sm text-red-600 text-center">
                          已禁用用户: {displayStats.users.disabled}
                        </Text>
                      </View>
                    )}
                  </CardContent>
                </Card>

                {/* 订单统计 */}
                <Card className="bg-green-50 rounded-lg">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">
                      订单统计
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <View className="grid grid-cols-2 gap-4">
                      <View className="text-center">
                        <Text className="block text-2xl font-bold text-green-600 mb-1">
                          {displayStats.orders.total}
                        </Text>
                        <Text className="block text-sm text-gray-600">
                          总订单数
                        </Text>
                      </View>
                      <View className="text-center">
                        <Text className="block text-2xl font-bold text-blue-600 mb-1">
                          {displayStats.orders.completed}
                        </Text>
                        <Text className="block text-sm text-gray-600">
                          已完成
                        </Text>
                      </View>
                      <View className="text-center">
                        <Text className="block text-2xl font-bold text-orange-600 mb-1">
                          {displayStats.orders.pending + displayStats.orders.accepted}
                        </Text>
                        <Text className="block text-sm text-gray-600">
                          进行中
                        </Text>
                      </View>
                      <View className="text-center">
                        <Text className="block text-2xl font-bold text-red-600 mb-1">
                          {displayStats.orders.cancelled}
                        </Text>
                        <Text className="block text-sm text-gray-600">
                          已取消
                        </Text>
                      </View>
                    </View>
                  </CardContent>
                </Card>

                {/* 车辆统计 */}
                <Card className="bg-cyan-50 rounded-lg">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">
                      车辆统计
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <View className="grid grid-cols-2 gap-4">
                      <View className="text-center">
                        <Text className="block text-2xl font-bold text-cyan-600 mb-1">
                          {displayStats.vehicles.total}
                        </Text>
                        <Text className="block text-sm text-gray-600">
                          总车辆数
                        </Text>
                      </View>
                      <View className="text-center">
                        <Text className="block text-2xl font-bold text-green-600 mb-1">
                          {displayStats.vehicles.active}
                        </Text>
                        <Text className="block text-sm text-gray-600">
                          可用车辆
                        </Text>
                      </View>
                      <View className="text-center">
                        <Text className="block text-2xl font-bold text-orange-600 mb-1">
                          {displayStats.vehicles.pending}
                        </Text>
                        <Text className="block text-sm text-gray-600">
                          待审核
                        </Text>
                      </View>
                      <View className="text-center">
                        <Text className="block text-2xl font-bold text-gray-600 mb-1">
                          {displayStats.vehicles.inactive}
                        </Text>
                        <Text className="block text-sm text-gray-600">
                          不可用
                        </Text>
                      </View>
                    </View>
                  </CardContent>
                </Card>

                {/* 需求统计 */}
                <Card className="bg-purple-50 rounded-lg">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">
                      需求统计
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <View className="grid grid-cols-2 gap-4">
                      <View className="text-center">
                        <Text className="block text-2xl font-bold text-purple-600 mb-1">
                          {displayStats.demands.total}
                        </Text>
                        <Text className="block text-sm text-gray-600">
                          总需求数
                        </Text>
                      </View>
                      <View className="text-center">
                        <Text className="block text-2xl font-bold text-green-600 mb-1">
                          {displayStats.demands.completed}
                        </Text>
                        <Text className="block text-sm text-gray-600">
                          已完成
                        </Text>
                      </View>
                      <View className="text-center">
                        <Text className="block text-2xl font-bold text-orange-600 mb-1">
                          {displayStats.demands.pending}
                        </Text>
                        <Text className="block text-sm text-gray-600">
                          待接单
                        </Text>
                      </View>
                      <View className="text-center">
                        <Text className="block text-2xl font-bold text-red-600 mb-1">
                          {displayStats.demands.cancelled}
                        </Text>
                        <Text className="block text-sm text-gray-600">
                          已取消
                        </Text>
                      </View>
                    </View>
                  </CardContent>
                </Card>
              </View>
            )}
          </CardContent>
        </Card>
      </View>
    </AppPageShell>
  )
}
