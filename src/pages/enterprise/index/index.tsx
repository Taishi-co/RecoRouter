import { View, Text } from '@tarojs/components'
import { useEffect, useState } from 'react'
import type { FC } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { getApiData, isApiSuccess } from '@/lib/api-response'
import { Network } from '@/network'
import Taro from '@tarojs/taro'
import './index.css'

interface DashboardStats {
  pending: number
  in_transit: number
  completed: number
  cancelled: number
  total: number
  availableVehicles: number
  activeVehicles: number
  totalVehicles: number
  externalOpportunities: number
}

const EnterpriseHomePage: FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [enterpriseName, setEnterpriseName] = useState('企业配送中心')
  const [loading, setLoading] = useState(true)
  const [errorText, setErrorText] = useState('')

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const userInfo = Taro.getStorageSync('userInfo')
      if (!userInfo) {
        Taro.redirectTo({ url: '/pages/index/index' })
        return
      }

      // 获取企业ID
      const enterpriseRes = await Network.request({
        url: `/api/enterprise/admin/${userInfo.id}`,
      })

      if (!isApiSuccess(enterpriseRes)) {
        setErrorText('获取企业信息失败')
        return
      }

      const enterprise = getApiData<{ id?: string; name?: string } | null>(enterpriseRes, null)
      const entId = enterprise?.id
      if (!entId) {
        setErrorText('企业信息缺失')
        return
      }
      setEnterpriseName(enterprise?.name || '企业配送中心')

      const statsRes = await Network.request({
        url: '/api/enterprise/stats',
        data: { enterprise_id: entId },
      })

      if (isApiSuccess(statsRes)) {
        setStats(getApiData<DashboardStats | null>(statsRes, null))
        setErrorText('')
      } else {
        setErrorText('加载仪表盘数据失败')
      }
    } catch {
      setErrorText('加载仪表盘数据失败')
    } finally {
      setLoading(false)
    }
  }

  const navigateToDispatch = () => {
    Taro.navigateTo({ url: '/pages/enterprise/dispatch/index' })
  }

  const navigateToPublish = () => {
    Taro.navigateTo({ url: '/pages/enterprise/publish/index' })
  }

  const navigateToFleet = () => {
    Taro.navigateTo({ url: '/pages/enterprise/fleet/index' })
  }

  const navigateToStations = () => {
    Taro.navigateTo({
      url: '/pages/enterprise/stations/index',
      fail: () => {
        Taro.showToast({
          title: '跳转失败',
          icon: 'none',
        })
      }
    })
  }

  const navigateToStats = () => {
    Taro.navigateTo({
      url: '/pages/enterprise/stats/index',
      fail: () => {
        Taro.showToast({
          title: '跳转失败',
          icon: 'none',
        })
      }
    })
  }

  const navigateToOrderHall = () => {
    Taro.navigateTo({
      url: '/pages/enterprise/order-hall/index',
      fail: () => {
        Taro.showToast({
          title: '跳转失败',
          icon: 'none',
        })
      }
    })
  }

  const hasPendingItems = Boolean(
    stats && (
      stats.pending > 0 ||
      stats.in_transit > 0 ||
      stats.externalOpportunities > 0 ||
      stats.availableVehicles === 0
    )
  )

  return (
    <View className="enterprise-home min-h-screen bg-background pb-20">
      {/* 顶部信息栏 */}
      <View className="bg-primary px-4 py-6">
        <Text className="text-white text-xl font-bold block">{enterpriseName}</Text>
      </View>

      {/* 今日概览 */}
      <View className="p-4">
        <Text className="text-base font-bold text-gray-900 mb-3 block">今日概览</Text>

        {errorText && (
          <Card className="mb-3 border-red-100 bg-red-50">
            <CardContent className="p-3">
              <Text className="block text-sm text-red-600">{errorText}</Text>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Text className="block text-gray-500 text-sm">加载中...</Text>
            </CardContent>
          </Card>
        ) : (
          <View>
            <View className="grid grid-cols-3 gap-2 mb-3">
              <Card>
                <CardContent className="p-3 text-center">
                  <Text className="text-xl font-bold text-gray-900 block">
                    {stats?.pending || 0}
                  </Text>
                  <Text className="text-xs text-gray-500 block">待调度</Text>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <Text className="text-xl font-bold text-primary block">
                    {stats?.in_transit || 0}
                  </Text>
                  <Text className="text-xs text-gray-500 block">运输中</Text>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <Text className="text-xl font-bold text-emerald-600 block">
                    {stats?.completed || 0}
                  </Text>
                  <Text className="text-xs text-gray-500 block">已完成</Text>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <Text className="text-xl font-bold text-red-600 block">
                    {stats?.cancelled || 0}
                  </Text>
                  <Text className="text-xs text-gray-500 block">异常/取消</Text>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <Text className="text-xl font-bold text-teal-600 block">
                    {stats?.availableVehicles || 0}
                  </Text>
                  <Text className="text-xs text-gray-500 block">可用车辆</Text>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <Text className="text-xl font-bold text-amber-600 block">
                    {stats?.externalOpportunities || 0}
                  </Text>
                  <Text className="text-xs text-gray-500 block">外部机会</Text>
                </CardContent>
              </Card>
            </View>
          </View>
        )}

        {/* 待处理事项 */}
        <Text className="text-base font-bold text-gray-900 mb-3 block">待处理事项</Text>
        {loading ? null : (
          <View>
            {stats?.pending !== undefined && stats.pending > 0 && (
              <Card className="mb-3">
                <CardContent className="p-3">
                  <View className="flex justify-between items-center mb-2">
                    <Text className="text-sm text-gray-900 font-medium block">
                      {stats.pending} 个配送需求待调度
                    </Text>
                  </View>
                  <Button size="sm" className="w-full" onClick={navigateToDispatch}>
                    去调度
                  </Button>
                </CardContent>
              </Card>
            )}
            {stats?.in_transit !== undefined && stats.in_transit > 0 && (
              <Card className="mb-4">
                <CardContent className="p-3">
                  <View className="flex justify-between items-center mb-2">
                    <Text className="text-sm text-gray-900 font-medium block">
                      {stats.in_transit} 个配送需求运输中
                    </Text>
                  </View>
                  <Button size="sm" variant="outline" className="w-full" onClick={navigateToDispatch}>
                    查看进度
                  </Button>
                </CardContent>
              </Card>
            )}
            {stats?.externalOpportunities !== undefined && stats.externalOpportunities > 0 && (
              <Card className="mb-4">
                <CardContent className="p-3">
                  <View className="flex justify-between items-center mb-2">
                    <Text className="text-sm text-gray-900 font-medium block">
                      {stats.externalOpportunities} 个外部订单可接
                    </Text>
                  </View>
                  <Button size="sm" variant="outline" className="w-full" onClick={navigateToOrderHall}>
                    去接单
                  </Button>
                </CardContent>
              </Card>
            )}
            {stats && stats.availableVehicles === 0 && (
              <Card className="mb-4">
                <CardContent className="p-3">
                  <View className="flex justify-between items-center mb-2">
                    <Text className="text-sm text-gray-900 font-medium block">
                      当前没有空闲可用车辆
                    </Text>
                  </View>
                  <Button size="sm" variant="outline" className="w-full" onClick={navigateToFleet}>
                    查看车辆
                  </Button>
                </CardContent>
              </Card>
            )}
            {!hasPendingItems && (
              <Card className="mb-4">
                <CardContent className="p-3">
                  <Text className="text-sm text-gray-500 text-center block">
                    暂无待处理事项
                  </Text>
                </CardContent>
              </Card>
            )}
          </View>
        )}

        {/* 快捷入口 */}
        <Text className="text-base font-bold text-gray-900 mb-3 block">快捷入口</Text>
        <View className="grid grid-cols-3 gap-2">
          <View className="h-16" onClick={navigateToPublish}>
            <Button className="w-full h-full" variant="default">
              <Text className="text-white text-sm">发布配送</Text>
            </Button>
          </View>
          <View className="h-16" onClick={navigateToOrderHall}>
            <Button className="w-full h-full" variant="outline">
              <Text className="text-gray-900 text-sm">接单大厅</Text>
            </Button>
          </View>
          <View className="h-16" onClick={navigateToFleet}>
            <Button className="w-full h-full" variant="outline">
              <Text className="text-gray-900 text-sm">车辆管理</Text>
            </Button>
          </View>
          <View className="h-16" onClick={navigateToStations}>
            <Button className="w-full h-full" variant="outline">
              <Text className="text-gray-900 text-sm">配送点</Text>
            </Button>
          </View>
          <View className="h-16" onClick={navigateToDispatch}>
            <Button className="w-full h-full" variant="outline">
              <Text className="text-gray-900 text-sm">调度中心</Text>
            </Button>
          </View>
          <View className="h-16" onClick={navigateToStats}>
            <Button className="w-full h-full" variant="outline">
              <Text className="text-gray-900 text-sm">数据统计</Text>
            </Button>
          </View>
        </View>
      </View>
    </View>
  )
}

export default EnterpriseHomePage
