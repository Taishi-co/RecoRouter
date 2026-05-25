import { useEffect, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import { DollarSign, TrendingUp, CircleAlert } from 'lucide-react-taro'

interface RevenueSummary {
  totalFare: number
  totalCommission: number
  netRevenue: number
  totalOrders: number
  paidOrders: number
  pendingPaymentOrders: number
}

interface RevenueItem {
  id: string
  cargoName: string
  farePrice: number | null
  commissionAmount: number | null
  receivedFare: number
  paidCommission: number
  netIncome: number
  completedTime: string | null
  paymentStatus: string
  commissionPaymentStatus: string
}

interface RevenueData {
  summary: RevenueSummary
  revenueList: RevenueItem[]
}

export default function OwnerStats() {
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(false)

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
    loadRevenueStats()
  }, [])

  const loadRevenueStats = async () => {
    setLoading(true)

    try {
      const userInfo = Taro.getStorageSync('userInfo')

      const res = await Network.request({
        url: `/api/orders/owner-revenue/${userInfo.id}`,
        method: 'GET'
      })

      console.log('收益统计响应:', res.data)

      if (res.data.code === 200) {
        setRevenueData(res.data.data)
      } else {
        Taro.showToast({
          title: res.data.message || '加载失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('加载收益统计失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const getPaymentStatusText = (status: string) => {
    switch (status) {
      case 'paid':
        return '已收款'
      case 'unpaid':
        return '未收款'
      default:
        return '未知'
    }
  }

  return (
    <View className="min-h-screen bg-background">
      {/* 导航菜单 */}
      <View className="bg-white shadow-sm sticky top-0 z-10">
        <View className="px-4 py-3">
          <View className="flex gap-2 overflow-x-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={() => Taro.navigateTo({ url: '/pages/owner/demands/index' })}
            >
              <Text className="text-xs">接单大厅</Text>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => Taro.navigateTo({ url: '/pages/owner/orders/index' })}
            >
              <Text className="text-xs">订单管理</Text>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => Taro.navigateTo({ url: '/pages/owner/vehicles/index' })}
            >
              <Text className="text-xs">车辆管理</Text>
            </Button>
            <Button size="sm" className="bg-primary">
              <Text className="text-xs">收益统计</Text>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => Taro.navigateTo({ url: '/pages/owner/profile/index' })}
            >
              <Text className="text-xs">我的</Text>
            </Button>
          </View>
        </View>
      </View>

      <ScrollView scrollY className="pb-4">
        <View className="px-4 py-4">
          <Card className="bg-white rounded-lg shadow-sm mb-4">
            <CardHeader>
              <View className="flex justify-between items-center">
                <CardTitle className="text-lg font-semibold">收益概览</CardTitle>
                <Button size="sm" variant="outline" onClick={loadRevenueStats} disabled={loading}>
                  <Text className="text-xs">刷新</Text>
                </Button>
              </View>
            </CardHeader>
            <CardContent>
              {loading ? (
                <View className="text-center py-8">
                  <Text className="block text-gray-500 text-sm">加载中...</Text>
                </View>
              ) : !revenueData ? (
                <View className="text-center py-8">
                  <Text className="block text-gray-500 text-sm">暂无数据</Text>
                </View>
              ) : (
                <View className="space-y-4">
                  {/* 收益统计 */}
                  <Card className="bg-gradient-to-br from-accent to-indigo-100 rounded-lg border-primary">
                    <CardContent className="p-4">
                      <Text className="block text-sm font-semibold text-gray-700 mb-3">收入统计</Text>
                      <View className="grid grid-cols-3 gap-4">
                        <View className="text-center">
                          <View className="flex items-center justify-center mb-1">
                            <DollarSign size={16} color="#0062ff" />
                          </View>
                          <Text className="block text-lg font-bold text-primary">
                            ¥{(revenueData.summary.totalFare || 0).toFixed(2)}
                          </Text>
                          <Text className="block text-xs text-gray-600">总运费</Text>
                        </View>
                        <View className="text-center">
                          <View className="flex items-center justify-center mb-1">
                            <CircleAlert size={16} color="#ef4444" />
                          </View>
                          <Text className="block text-lg font-bold text-red-600">
                            ¥{(revenueData.summary.totalCommission || 0).toFixed(2)}
                          </Text>
                          <Text className="block text-xs text-gray-600">佣金支出</Text>
                        </View>
                        <View className="text-center">
                          <View className="flex items-center justify-center mb-1">
                            <TrendingUp size={16} color="#10b981" />
                          </View>
                          <Text className="block text-lg font-bold text-emerald-600">
                            ¥{(revenueData.summary.netRevenue || 0).toFixed(2)}
                          </Text>
                          <Text className="block text-xs text-gray-600">净收益</Text>
                        </View>
                      </View>
                    </CardContent>
                  </Card>

                  {/* 订单统计 */}
                  <Card className="bg-emerald-50 rounded-lg border-green-200">
                    <CardContent className="p-4">
                      <Text className="block text-sm font-semibold text-gray-700 mb-3">订单统计</Text>
                      <View className="grid grid-cols-3 gap-4">
                        <View className="text-center">
                          <Text className="block text-2xl font-bold text-emerald-600 mb-1">
                            {revenueData.summary.totalOrders}
                          </Text>
                          <Text className="block text-xs text-gray-600">完成订单</Text>
                        </View>
                        <View className="text-center">
                          <Text className="block text-2xl font-bold text-primary mb-1">
                            {revenueData.summary.paidOrders}
                          </Text>
                          <Text className="block text-xs text-gray-600">已收款</Text>
                        </View>
                        <View className="text-center">
                          <Text className="block text-2xl font-bold text-amber-600 mb-1">
                            {revenueData.summary.pendingPaymentOrders}
                          </Text>
                          <Text className="block text-xs text-gray-600">待收款</Text>
                        </View>
                      </View>

                      {/* 待收款提醒 */}
                      {revenueData.summary.pendingPaymentOrders > 0 && (
                        <View className="mt-3 pt-3 border-t border-yellow-200">
                          <View className="flex items-center justify-center">
                            <CircleAlert size={14} color="#ca8a04" />
                            <Text className="text-xs text-yellow-700 ml-2">
                              有 {revenueData.summary.pendingPaymentOrders} 个订单待收款
                            </Text>
                          </View>
                        </View>
                      )}
                    </CardContent>
                  </Card>
                </View>
              )}
            </CardContent>
          </Card>

          {/* 收益明细 */}
          {revenueData?.revenueList && revenueData.revenueList.length > 0 && (
            <Card className="bg-white rounded-lg shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">收益明细</CardTitle>
              </CardHeader>
              <CardContent>
                <View className="space-y-3">
                  {revenueData.revenueList.map((item) => (
                    <Card key={item.id} className="bg-muted rounded-lg border border-border">
                      <CardContent className="p-3">
                        <View className="flex justify-between items-start mb-2">
                          <View className="flex-1">
                            <Text className="block text-sm font-medium text-gray-800 mb-1">
                              {item.cargoName || '未知货物'}
                            </Text>
                            <Text className="block text-xs text-gray-500">
                              运费: ¥{(item.farePrice || 0).toFixed(2)}
                              {item.commissionAmount && ` | 佣金: ¥${item.commissionAmount.toFixed(2)}`}
                            </Text>
                          </View>
                          <View className="text-right">
                            <Text
                              className={`block text-sm font-bold ${
                                item.paymentStatus === 'paid' ? 'text-emerald-600' : 'text-amber-600'
                              }`}
                            >
                              ¥{item.netIncome.toFixed(2)}
                            </Text>
                            <Text
                              className={`text-xs ${
                                item.paymentStatus === 'paid' ? 'text-emerald-500' : 'text-amber-500'
                              }`}
                            >
                              {getPaymentStatusText(item.paymentStatus)}
                            </Text>
                          </View>
                        </View>
                        {item.completedTime && (
                          <Text className="block text-xs text-gray-400 mt-2">
                            完成时间: {item.completedTime}
                          </Text>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </View>
              </CardContent>
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
