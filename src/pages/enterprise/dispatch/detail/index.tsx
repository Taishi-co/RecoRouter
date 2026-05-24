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
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Network } from '@/network'
import Taro from '@tarojs/taro'

interface DeliveryPoint {
  stationId: string
  name: string
  address: string
  businessMode?: 'enterprise_terminal' | 'community_group_buy'
  pointType?: 'terminal' | 'community_leader'
  status?: 'pending' | 'in_transit' | 'completed'
}

interface Demand {
  id: string
  status: string
  pickup_point_info: any
  delivery_points: DeliveryPoint[]
  cargo_info: any
  time_window: any
  vehicle_source: string
  created_at: string
  vehicle_allocation?: any
}

const DemandDetailPage: FC = () => {
  const [demand, setDemand] = useState<Demand | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = Taro.getCurrentInstance().router?.params
    if (params?.id) {
      loadDemandDetail(params.id)
    }
  }, [])

  const loadDemandDetail = async (demandId: string) => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: `/api/demand/${demandId}`,
      })

      if (res.data.code === 200) {
        setDemand(res.data.data)
      } else {
        Taro.showToast({
          title: res.data.message || '加载失败',
          icon: 'none',
        })
      }
    } catch (error) {
      console.error('加载详情失败:', error)
      Taro.showToast({
        title: '加载失败',
        icon: 'none',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCancelDeliveryPoint = async (point: DeliveryPoint) => {
    if (!demand) return

    Taro.showModal({
      title: '确认取消',
      content: `确认取消配送点"${point.name}"吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const updateRes = await Network.request({
              url: `/api/demand/${demand.id}/delivery-points`,
              method: 'PUT',
              data: {
                action: 'remove',
                stationId: point.stationId,
              },
            })

            if (updateRes.data.code === 200) {
              Taro.showToast({
                title: '取消成功',
                icon: 'success',
              })
              loadDemandDetail(demand.id)
            } else {
              Taro.showToast({
                title: updateRes.data.message || '取消失败',
                icon: 'none',
              })
            }
          } catch (error) {
            console.error('取消配送点失败:', error)
            Taro.showToast({
              title: '取消失败',
              icon: 'none',
            })
          }
        }
      },
    })
  }

  const getStatusText = (status: string) => {
    const statusMap = {
      pending: '待调度',
      in_transit: '进行中',
      completed: '已完成',
      cancelled: '已取消',
    }
    return statusMap[status] || status
  }

  const getPointStatusText = (status: string) => {
    const statusMap = {
      pending: '待配送',
      in_transit: '配送中',
      completed: '已完成',
    }
    return statusMap[status] || status
  }

  const getPointStatusColor = (status: string) => {
    const colorMap = {
      pending: 'bg-gray-100 text-gray-600',
      in_transit: 'bg-blue-100 text-blue-600',
      completed: 'bg-green-100 text-green-600',
    }
    return colorMap[status] || ''
  }

  const getBusinessModeText = () => {
    const mode = demand?.cargo_info?.businessMode || demand?.delivery_points?.[0]?.businessMode
    if (mode === 'community_group_buy') return '社区团购'
    return demand?.cargo_info?.businessModeLabel || '终端配送'
  }

  const getDeliveryPointLabel = () => {
    const mode = demand?.cargo_info?.businessMode || demand?.delivery_points?.[0]?.businessMode
    return mode === 'community_group_buy' ? '社区团长' : '终端点'
  }

  const formatTimeWindowValue = (value?: string) => {
    if (!value) return '-'
    if (value.includes(' ')) return value.split(' ')[1]?.slice(0, 5) || value
    if (value.includes('T')) return value.split('T')[1]?.slice(0, 5) || value
    return value.slice(0, 5)
  }

  const formatTimeWindow = (timeWindow: any) => {
    const start = formatTimeWindowValue(timeWindow?.start)
    const end = formatTimeWindowValue(timeWindow?.end)
    return `${start} - ${end}`
  }

  const calculateProgress = () => {
    if (!demand || !demand.delivery_points) return 0
    if (demand.delivery_points.length === 0) return 0
    const completedCount = demand.delivery_points.filter(p => p.status === 'completed').length
    return (completedCount / demand.delivery_points.length) * 100
  }

  if (loading) {
    return (
      <View className="min-h-screen bg-gray-50 p-4">
        <Text className="text-center text-gray-500">加载中...</Text>
      </View>
    )
  }

  if (!demand) {
    return (
      <View className="min-h-screen bg-gray-50 p-4">
        <Text className="text-center text-gray-500">未找到配送需求</Text>
      </View>
    )
  }

  const progress = calculateProgress()
  const completedCount = demand.delivery_points?.filter(p => p.status === 'completed').length || 0
  const totalCount = demand.delivery_points?.length || 0

  return (
    <View className="min-h-screen bg-gray-50 pb-20">
      <ScrollView scrollY className="h-full">
        <View className="p-4">
          {/* 基本信息 */}
          <Card className="mb-4">
            <CardHeader>
              <View className="flex justify-between items-center">
                <CardTitle className="text-base flex-1">
                  {demand.cargo_info?.type || '配送订单'}
                </CardTitle>
                <Badge className="ml-2">
                  {getStatusText(demand.status)}
                </Badge>
              </View>
            </CardHeader>
            <CardContent>
              <View className="text-sm space-y-2">
                <View className="flex justify-between">
                  <Text className="text-gray-600">业务模式</Text>
                  <Text className="font-medium">{getBusinessModeText()}</Text>
                </View>
                <View className="flex justify-between">
                  <Text className="text-gray-600">货物数量</Text>
                  <Text className="font-medium">{demand.cargo_info?.quantity || 0}{demand.cargo_info?.unit || '箱'}</Text>
                </View>
                <View className="flex justify-between">
                  <Text className="text-gray-600">配送时间</Text>
                  <Text className="font-medium">
                    {formatTimeWindow(demand.time_window)}
                  </Text>
                </View>
                {demand.vehicle_allocation && (
                  <View className="flex justify-between">
                    <Text className="text-gray-600">分配车辆</Text>
                    <Text className="font-medium">{demand.vehicle_allocation.vehicle_ids?.length || 0}辆</Text>
                  </View>
                )}
                <View className="flex justify-between">
                  <Text className="text-gray-600">创建时间</Text>
                  <Text className="font-medium text-xs">
                    {new Date(demand.created_at).toLocaleString('zh-CN')}
                  </Text>
                </View>
              </View>
            </CardContent>
          </Card>

          {/* 配送进度 */}
          {demand.status !== 'pending' && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="text-base">配送进度</CardTitle>
              </CardHeader>
              <CardContent>
                <View className="mb-2">
                  <Text className="text-sm font-medium mb-2">
                    已完成 {completedCount}/{totalCount} 个配送点
                  </Text>
                  <Progress value={progress} className="h-2" />
                </View>
              </CardContent>
            </Card>
          )}

          {/* 配送点列表 */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">{getDeliveryPointLabel()}列表 ({totalCount}个)</CardTitle>
            </CardHeader>
            <CardContent>
              <View className="space-y-3">
                {demand.delivery_points?.map((point, index) => (
                  <View key={point.stationId || index} className="border border-gray-200 rounded-lg p-3">
                    <View className="flex justify-between items-start mb-2">
                      <View className="flex-1">
                        <View className="flex items-center mb-1">
                          <Text className="text-xs text-gray-500 mr-2">序号 {index + 1}</Text>
                          {point.status && (
                            <Badge className={getPointStatusColor(point.status)}>
                              {getPointStatusText(point.status)}
                            </Badge>
                          )}
                        </View>
                        <Text className="text-sm font-medium block mb-1">{point.name}</Text>
                        <Text className="text-xs text-gray-500 block">{point.address}</Text>
                      </View>
                      {demand.status === 'pending' && point.status !== 'completed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-500 border-red-500"
                          onClick={() => handleCancelDeliveryPoint(point)}
                        >
                          <Text className="text-xs">取消</Text>
                        </Button>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </CardContent>
          </Card>

          {/* 起点信息 */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">起点信息</CardTitle>
            </CardHeader>
            <CardContent>
              <Text className="text-sm font-medium block mb-1">
                {demand.pickup_point_info?.name || '仓库'}
              </Text>
              <Text className="text-xs text-gray-500 block">
                {demand.pickup_point_info?.address}
              </Text>
            </CardContent>
          </Card>
        </View>
      </ScrollView>

      {/* 底部操作栏 */}
      {demand.status === 'pending' && (
        <View style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTop: '1px solid #e5e5e5', padding: '12px', zIndex: 100 }}>
          <Button
            className="w-full"
            onClick={() => Taro.navigateBack()}
          >
            <Text>返回</Text>
          </Button>
        </View>
      )}
    </View>
  )
}

export default DemandDetailPage
