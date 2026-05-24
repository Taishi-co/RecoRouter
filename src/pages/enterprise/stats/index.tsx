import { View, Text } from '@tarojs/components'
import { useEffect, useState } from 'react'
import type { FC } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getApiData, getApiMessage, isApiSuccess } from '@/lib/api-response'
import { Network } from '@/network'
import Taro from '@tarojs/taro'

interface StatsData {
  todayOrders: number
  monthOrders: number
  totalDistance: number
  avgDeliveryTime: number
  vehicleUsageRate: number
  activeVehicles: number
  totalVehicles: number
  stationStats: Array<{
    stationName: string
    orderCount: number
  }>
}

const EnterpriseStatsPage: FC = () => {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorText, setErrorText] = useState('')

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoading(true)
    try {
      const userInfo = Taro.getStorageSync('userInfo')
      if (!userInfo) {
        return
      }

      const enterpriseRes = await Network.request({
        url: `/api/enterprise/admin/${userInfo.id}`,
      })

      if (!isApiSuccess(enterpriseRes)) {
        setErrorText(getApiMessage(enterpriseRes, '获取企业信息失败'))
        return
      }

      const entId = getApiData<{ id?: string } | null>(enterpriseRes, null)?.id
      if (!entId) {
        setErrorText('企业信息缺失')
        return
      }

      const res = await Network.request({
        url: '/api/enterprise/stats',
        data: { enterprise_id: entId },
      })

      if (isApiSuccess(res)) {
        setStats(getApiData<StatsData | null>(res, null))
        setErrorText('')
      } else {
        setStats(null)
        setErrorText(getApiMessage(res, '加载统计失败'))
      }
    } catch {
      setStats(null)
      setErrorText('加载统计失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="enterprise-stats min-h-screen bg-gray-50 p-4 pb-20">
      <Text className="text-2xl font-bold block mb-4">数据统计</Text>

      {errorText && (
        <Card className="mb-4 border-red-100 bg-red-50">
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
      ) : stats ? (
        <View>
          {/* 订单统计 */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">订单统计</CardTitle>
            </CardHeader>
            <CardContent>
              <View className="grid grid-cols-2 gap-4">
                <View className="bg-blue-50 rounded-lg p-4">
                  <Text className="text-3xl font-bold text-blue-600 block">
                    {stats.todayOrders}
                  </Text>
                  <Text className="text-xs text-gray-500 mt-1 block">今日订单</Text>
                </View>
                <View className="bg-green-50 rounded-lg p-4">
                  <Text className="text-3xl font-bold text-green-600 block">
                    {stats.monthOrders}
                  </Text>
                  <Text className="text-xs text-gray-500 mt-1 block">本月订单</Text>
                </View>
              </View>
            </CardContent>
          </Card>

          {/* 配送效率 */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">配送效率</CardTitle>
            </CardHeader>
            <CardContent>
              <View className="space-y-4">
                <View>
                  <Text className="text-sm text-gray-600 block mb-1">
                    今日配送距离
                  </Text>
                  <Text className="text-xl font-bold text-orange-600 block">
                    {stats.totalDistance} 公里
                  </Text>
                </View>
                <View>
                  <Text className="text-sm text-gray-600 block mb-1">
                    平均配送时间
                  </Text>
                  <Text className="text-xl font-bold text-purple-600 block">
                    {stats.avgDeliveryTime} 分钟
                  </Text>
                </View>
              </View>
            </CardContent>
          </Card>

          {/* 车辆使用 */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">车辆使用</CardTitle>
            </CardHeader>
            <CardContent>
              <View>
                <View className="flex justify-between items-center mb-2">
                  <Text className="text-sm text-gray-600">使用率</Text>
                  <Text className="text-sm font-bold text-blue-600">
                    {stats.vehicleUsageRate}%
                  </Text>
                </View>
                <View className="w-full bg-gray-200 rounded-full h-3">
                  <View
                    className="bg-blue-600 h-3 rounded-full"
                    style={{ width: `${stats.vehicleUsageRate}%` }}
                  />
                </View>
                <Text className="text-xs text-gray-500 mt-2 block">
                  活跃车辆：{stats.activeVehicles} / {stats.totalVehicles}
                </Text>
              </View>
            </CardContent>
          </Card>

          {/* 奶站配送统计 */}
          {stats.stationStats && stats.stationStats.length > 0 && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="text-base">奶站配送统计</CardTitle>
              </CardHeader>
              <CardContent>
                <View className="space-y-3">
                  {stats.stationStats.map((station, index) => (
                    <View key={index} className="flex justify-between items-center">
                      <Text className="text-sm text-gray-600">
                        {station.stationName}
                      </Text>
                      <Text className="text-sm font-bold text-gray-900">
                        {station.orderCount} 单
                      </Text>
                    </View>
                  ))}
                </View>
              </CardContent>
            </Card>
          )}

          {/* 没有奶站时显示提示 */}
          {stats.stationStats && stats.stationStats.length === 0 && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="text-base">奶站配送统计</CardTitle>
              </CardHeader>
              <CardContent>
                <Text className="text-sm text-gray-500 text-center block">
                  暂无奶站数据
                </Text>
              </CardContent>
            </Card>
          )}
        </View>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Text className="block text-gray-500 text-sm">暂无统计数据</Text>
          </CardContent>
        </Card>
      )}
    </View>
  )
}

export default EnterpriseStatsPage
