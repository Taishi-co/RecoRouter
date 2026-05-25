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
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Network } from '@/network'
import Taro from '@tarojs/taro'
import { CircleCheck, Clock3, MapPinned, Route, Truck } from 'lucide-react-taro'

interface DeliveryPoint {
  stationId: string
  name: string
  address: string
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

  const calculateProgress = () => {
    if (!demand || !demand.delivery_points) return 0
    const completedCount = demand.delivery_points.filter(p => p.status === 'completed').length
    return (completedCount / demand.delivery_points.length) * 100
  }

  if (loading) {
    return (
      <AppPageShell
        title="调度详情"
        subtitle="R240525-018 · 钢卷运输"
        icon={MapPinned}
        bottom={<BottomNav type="enterprise" active="dispatch" />}
        contentClassName="pb-6"
      >
        <Card>
          <CardContent className="p-8 text-center">
            <Text className="text-gray-500 text-sm">加载中...</Text>
          </CardContent>
        </Card>
      </AppPageShell>
    )
  }

  if (!demand) {
    return (
      <AppPageShell
        title="调度详情"
        subtitle="R240525-018 · 钢卷运输"
        icon={MapPinned}
        bottom={<BottomNav type="enterprise" active="dispatch" />}
        contentClassName="pb-6"
      >
        <Card>
          <CardContent className="p-8 text-center">
            <Text className="text-gray-500 text-sm">未找到配送需求</Text>
          </CardContent>
        </Card>
      </AppPageShell>
    )
  }

  const progress = calculateProgress()
  const completedCount = demand.delivery_points?.filter(p => p.status === 'completed').length || 0
  const totalCount = demand.delivery_points?.length || 0

  return (
    <AppPageShell
      title="调度详情"
      subtitle={`${demand.id || 'R240525-018'} · ${demand.cargo_info.type || '钢卷运输'}`}
      icon={MapPinned}
      bottom={<BottomNav type="enterprise" active="dispatch" />}
      contentClassName="space-y-3 pb-6"
    >
      <Card className="shadow-sm border-gray-100">
        <CardHeader className="pb-2">
          <View className="flex justify-between items-center">
            <View className="flex items-center gap-2 flex-1">
              <Route size={18} color="#0062FF" strokeWidth={2.2} />
              <CardTitle className="text-base">Route card</CardTitle>
            </View>
            <Badge className="ml-2">
              {getStatusText(demand.status)}
            </Badge>
          </View>
        </CardHeader>
        <CardContent>
          <View className="space-y-3">
            <View>
              <Text className="block text-xs font-semibold text-gray-500">装货地</Text>
              <Text className="block text-sm font-bold text-gray-900 mt-1">{demand.pickup_point_info?.name || '仓库'}</Text>
              <Text className="block text-xs text-gray-500 mt-1">{demand.pickup_point_info?.address}</Text>
            </View>
            <View className="h-20 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
              <MapPinned size={28} color="#0062FF" strokeWidth={2.2} />
              <Text className="ml-2 text-xs font-semibold text-blue-600">线路规划中 · {totalCount} 个站点</Text>
            </View>
            <View className="grid grid-cols-2 gap-3">
              <View>
                <Text className="block text-xs font-semibold text-gray-500">货物数量</Text>
                <Text className="block text-sm font-bold text-gray-900 mt-1">{demand.cargo_info.quantity}箱</Text>
              </View>
              <View>
                <Text className="block text-xs font-semibold text-gray-500">配送时间</Text>
                <Text className="block text-sm font-bold text-gray-900 mt-1">
                  {demand.time_window?.start?.split(' ')[1]} - {demand.time_window?.end?.split(' ')[1]}
                </Text>
              </View>
            </View>
          </View>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-gray-100">
        <CardHeader className="pb-2">
          <View className="flex items-center gap-2">
            <Truck size={18} color="#0062FF" strokeWidth={2.2} />
            <CardTitle className="text-base">车辆分配</CardTitle>
          </View>
        </CardHeader>
        <CardContent>
          <View className="space-y-3">
            {demand.vehicle_allocation ? (
              <View className="flex justify-between">
                <Text className="text-sm text-gray-600">已分配车辆</Text>
                <Text className="text-sm font-bold text-gray-900">{demand.vehicle_allocation.vehicle_ids?.length || 0}辆</Text>
              </View>
            ) : (
              <Text className="block text-sm text-gray-500">暂未分配车辆</Text>
            )}
            <View className="flex justify-between">
              <Text className="text-sm text-gray-600">运力来源</Text>
              <Text className="text-sm font-bold text-gray-900">{demand.vehicle_source === 'external' ? '外部运力' : '自有车辆'}</Text>
            </View>
            <View className="flex justify-between">
              <Text className="text-sm text-gray-600">创建时间</Text>
              <Text className="text-xs font-semibold text-gray-900">{new Date(demand.created_at).toLocaleString('zh-CN')}</Text>
            </View>
          </View>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-gray-100">
        <CardHeader className="pb-2">
          <View className="flex items-center gap-2">
            <Clock3 size={18} color="#0062FF" strokeWidth={2.2} />
            <CardTitle className="text-base">履约时间线</CardTitle>
          </View>
        </CardHeader>
        <CardContent>
          {demand.status !== 'pending' && (
            <View className="mb-4">
              <Text className="block text-sm font-bold text-gray-900 mb-2">
                已完成 {completedCount}/{totalCount} 个配送点
              </Text>
              <Progress value={progress} className="h-2" />
            </View>
          )}
          <View className="space-y-3">
            {demand.delivery_points?.map((point, index) => (
              <View key={point.stationId || index} className="border border-gray-100 rounded-2xl p-3 bg-gray-50">
                <View className="flex justify-between items-start">
                  <View className="flex gap-3 flex-1">
                    <View className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                      {point.status === 'completed' ? (
                        <CircleCheck size={16} color="#16A34A" strokeWidth={2.2} />
                      ) : (
                        <Text className="text-xs font-black text-blue-600">{index + 1}</Text>
                      )}
                    </View>
                    <View className="flex-1">
                      <View className="flex items-center gap-2 mb-1">
                        <Text className="text-sm font-bold text-gray-900">{point.name}</Text>
                        {point.status && (
                          <Badge className={getPointStatusColor(point.status)}>
                            {getPointStatusText(point.status)}
                          </Badge>
                        )}
                      </View>
                      <Text className="text-xs text-gray-500 block">{point.address}</Text>
                    </View>
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

      <Button className="w-full h-12 rounded-full" onClick={() => Taro.navigateBack()}>
        <Text className="text-white text-sm font-bold">返回调度看板</Text>
      </Button>
    </AppPageShell>
  )
}

export default DemandDetailPage
