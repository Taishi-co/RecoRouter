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
import { getApiData, getApiMessage, isApiSuccess } from '@/lib/api-response'
import { Network } from '@/network'
import Taro from '@tarojs/taro'
import AllocateVehicleDialog from './AllocateVehicleDialog'
import './index.css'

interface Demand {
  id: string
  status: string
  pickup_point_info: any
  delivery_points: any[]
  cargo_info: any
  time_window: any
  vehicle_source: string
  created_at: string
  vehicle_allocation?: any
}

interface DemandStats {
  pending: number
  in_transit: number
  completed: number
  cancelled: number
  total: number
}

interface Vehicle {
  id: string
  vehicle_code: string
  vehicle_type: string
  load_capacity: number
  current_location: string
  usage_mode: string
  trip_status: string
}

const EnterpriseDispatchPage: FC = () => {
  const [pendingDemands, setPendingDemands] = useState<Demand[]>([])
  const [inTransitDemands, setInTransitDemands] = useState<Demand[]>([])
  const [completedDemands, setCompletedDemands] = useState<Demand[]>([])
  const [stats, setStats] = useState<DemandStats | null>(null)
  const [activeTab, setActiveTab] = useState('pending')
  const [allocateDialogOpen, setAllocateDialogOpen] = useState(false)
  const [allocatingDemand, setAllocatingDemand] = useState<Demand | null>(null)
  const [availableVehicles, setAvailableVehicles] = useState<Vehicle[]>([])
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([])
  const [enterpriseId, setEnterpriseId] = useState('')
  const [loading, setLoading] = useState(true)
  const [errorText, setErrorText] = useState('')

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

      if (isApiSuccess(enterpriseRes)) {
        const entId = getApiData<{ id: string } | null>(enterpriseRes, null)?.id
        if (!entId) {
          setErrorText('企业信息缺失')
          return
        }
        setEnterpriseId(entId)
        loadStats(entId)
        loadPendingDemands(entId)
        loadInTransitDemands(entId)
        loadCompletedDemands(entId)
      } else {
        setErrorText(getApiMessage(enterpriseRes, '加载企业信息失败'))
      }
    } catch {
      setErrorText('加载企业信息失败')
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async (entId: string) => {
    try {
      const res = await Network.request({
        url: '/api/demand/stats/enterprise',
        data: { enterprise_id: entId },
      })

      if (isApiSuccess(res)) {
        setStats(getApiData<DemandStats | null>(res, null))
      } else {
        setErrorText(getApiMessage(res, '加载统计失败'))
      }
    } catch {
      setErrorText('加载统计失败')
    }
  }

  const loadPendingDemands = async (entId: string) => {
    try {
      const res = await Network.request({
        url: `/api/demand/pending/${entId}`,
      })

      if (isApiSuccess(res)) {
        setPendingDemands(getApiData<Demand[]>(res, []))
      } else {
        setErrorText(getApiMessage(res, '加载待调度订单失败'))
      }
    } catch {
      setErrorText('加载待调度订单失败')
    }
  }

  const loadInTransitDemands = async (entId: string) => {
    try {
      const res = await Network.request({
        url: '/api/demand',
        data: { enterpriseId: entId, status: 'in_transit' },
      })

      if (isApiSuccess(res)) {
        const data = getApiData<{ list?: Demand[] }>(res, {})
        setInTransitDemands(data.list || [])
      } else {
        setErrorText(getApiMessage(res, '加载进行中订单失败'))
      }
    } catch {
      setErrorText('加载进行中订单失败')
    }
  }

  const loadCompletedDemands = async (entId: string) => {
    try {
      const res = await Network.request({
        url: '/api/demand',
        data: { enterpriseId: entId, status: 'completed' },
      })

      if (isApiSuccess(res)) {
        const data = getApiData<{ list?: Demand[] }>(res, {})
        setCompletedDemands(data.list || [])
      } else {
        setErrorText(getApiMessage(res, '加载已完成订单失败'))
      }
    } catch {
      setErrorText('加载已完成订单失败')
    }
  }

  const handleAllocateVehicle = async (demand: Demand) => {
    try {
      // 获取可用车辆（只显示内部运力车辆）
      const res = await Network.request({
        url: '/api/enterprise-vehicles',
        data: { enterprise_id: enterpriseId, usage_mode: 'internal' },
      })

      if (isApiSuccess(res)) {
        const vehicles = getApiData<Vehicle[]>(res, [])
        // 只显示空闲车辆
        setAvailableVehicles(vehicles.filter((v: Vehicle) => v.trip_status === 'idle'))
        setSelectedVehicleIds([])
        setAllocatingDemand(demand)
        setAllocateDialogOpen(true)
      }
    } catch {
      Taro.showToast({
        title: '获取车辆列表失败',
        icon: 'none',
      })
    }
  }

  const handleToggleVehicle = (vehicleId: string) => {
    setSelectedVehicleIds(prev => {
      if (prev.includes(vehicleId)) {
        return prev.filter(id => id !== vehicleId)
      } else {
        return [...prev, vehicleId]
      }
    })
  }

  const handleConfirmAllocate = async () => {
    if (!allocatingDemand || selectedVehicleIds.length === 0) {
      return
    }

    try {
      const res = await Network.request({
        url: `/api/demand/${allocatingDemand.id}/allocate`,
        method: 'PUT',
        data: {
          vehicle_allocation: {
            vehicle_ids: selectedVehicleIds,
            allocated_at: new Date().toISOString(),
          },
        },
      })

      if (isApiSuccess(res)) {
        Taro.showToast({
          title: '分配成功',
          icon: 'success',
        })
        setAllocateDialogOpen(false)
        // 刷新订单列表
        loadPendingDemands(enterpriseId)
        loadInTransitDemands(enterpriseId)
        loadStats(enterpriseId)
      } else {
        Taro.showToast({
          title: getApiMessage(res, '分配失败'),
          icon: 'none',
        })
      }
    } catch {
      Taro.showToast({
        title: '分配失败',
        icon: 'none',
      })
    }
  }

  const handleViewDetail = (demandId: string) => {
    Taro.navigateTo({
      url: `/pages/enterprise/dispatch/detail/index?id=${demandId}`,
    })
  }

  const getBusinessModeLabel = (demand: Demand) => {
    const mode = demand.cargo_info?.businessMode || demand.delivery_points?.[0]?.businessMode
    if (mode === 'community_group_buy') return '社区团长'
    return '终端点'
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

  const handleCancelDemand = async (demandId: string) => {
    Taro.showModal({
      title: '确认取消',
      content: '确定要取消这个配送需求吗？',
      success: async (modalRes) => {
        if (modalRes.confirm) {
          try {
            const res = await Network.request({
              url: `/api/demand/${demandId}/cancel`,
              method: 'PUT',
            })

            if (isApiSuccess(res)) {
              Taro.showToast({
                title: '取消成功',
                icon: 'success',
              })
              // 刷新列表
              if (enterpriseId) {
                loadPendingDemands(enterpriseId)
                loadInTransitDemands(enterpriseId)
                loadCompletedDemands(enterpriseId)
                loadStats(enterpriseId)
              }
            } else {
              Taro.showToast({
                title: getApiMessage(res, '取消失败'),
                icon: 'none',
              })
            }
          } catch {
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

  const getStatusColor = (status: string) => {
    const colorMap = {
      pending: 'bg-orange-100 text-orange-600',
      in_transit: 'bg-blue-100 text-blue-600',
      completed: 'bg-green-100 text-green-600',
      cancelled: 'bg-gray-100 text-gray-600',
    }
    return colorMap[status] || ''
  }

  const renderDemandCard = (demand: Demand) => (
    <Card key={demand.id} className="mb-4">
      <CardHeader>
        <View className="flex justify-between items-center">
          <CardTitle className="text-base flex-1">
            {demand.cargo_info?.type || '配送订单'} - {demand.cargo_info?.quantity || 0}{demand.cargo_info?.unit || '箱'}
          </CardTitle>
          <Text className={`text-xs px-2 py-1 rounded ${getStatusColor(demand.status)}`}>
            {getStatusText(demand.status)}
          </Text>
        </View>
      </CardHeader>
      <CardContent>
        <View className="text-sm text-gray-600 mb-3">
          <Text className="block mb-1">
            📍 起点：{demand.pickup_point_info?.name || '仓库'} - {demand.pickup_point_info?.address}
          </Text>
          {demand.delivery_points && demand.delivery_points.length > 0 && (
            <View className="mb-2">
              <Text className="block mb-1 font-medium">
                📦 配送点：{demand.delivery_points.length}个{getBusinessModeLabel(demand)}
              </Text>
              <View className="ml-4">
                {demand.delivery_points.map((point: any, idx: number) => (
                  <View key={point.stationId || idx} className="flex items-center justify-between py-1">
                    <Text className="text-xs text-gray-500">
                      {idx + 1}. {point.name || point.stationName}
                    </Text>
                    {point.status && (
                      <Text
                        className={`text-xs px-2 py-1 rounded ${
                          point.status === 'completed'
                            ? 'bg-green-100 text-green-600'
                            : point.status === 'in_transit'
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {point.status === 'completed'
                          ? '已完成'
                          : point.status === 'in_transit'
                            ? '配送中'
                            : '待配送'}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}
          <Text className="block">
            ⏰ 配送时间：{formatTimeWindow(demand.time_window)}
          </Text>
          <Text className="block">
            🚚 运力来源：{demand.vehicle_source === 'external' ? '外部运力' : '自有车辆'} · {demand.cargo_info?.businessModeLabel || (getBusinessModeLabel(demand) === '社区团长' ? '社区团购' : '终端配送')}
          </Text>
          {demand.status !== 'pending' && demand.vehicle_allocation && (
            <Text className="block mt-1">
              🚗 分配车辆：{demand.vehicle_allocation.vehicle_ids?.length || 0}辆
            </Text>
          )}
        </View>

        <View className="flex gap-2">
          {demand.status === 'pending' && (
            <>
              {/* 外部运力需求不显示"分配车辆"按钮 */}
              {demand.vehicle_source !== 'external' && (
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => handleAllocateVehicle(demand)}
                >
                  <Text className="text-xs">分配车辆</Text>
                </Button>
              )}
              {/* 外部运力需求只显示"取消"按钮，自有运力需求显示两个按钮 */}
              <Button
                size="sm"
                variant="outline"
                className={demand.vehicle_source === 'external' ? 'flex-1' : 'flex-1'}
                onClick={() => handleCancelDemand(demand.id)}
              >
                <Text className="text-xs">取消</Text>
              </Button>
            </>
          )}
          {demand.status !== 'pending' && (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => handleViewDetail(demand.id)}
            >
              <Text className="text-xs">查看详情</Text>
            </Button>
          )}
        </View>
      </CardContent>
    </Card>
  )

  return (
    <View className="enterprise-dispatch min-h-screen bg-gray-50 pb-20">
      <ScrollView scrollY className="h-full">
        <View className="p-4">
          {errorText && (
            <Card className="mb-4 border-red-200 bg-red-50">
              <CardContent className="p-3">
                <Text className="block text-sm text-red-600">{errorText}</Text>
              </CardContent>
            </Card>
          )}

          {/* 统计信息 */}
          {stats && (
            <Card className="mb-4">
              <CardContent className="p-4">
                <View className="grid grid-cols-4 gap-2">
                  <View className="text-center">
                    <Text className="text-xl font-bold text-orange-600 block">
                      {stats.pending}
                    </Text>
                    <Text className="text-xs text-gray-500 mt-1 block">待调度</Text>
                  </View>
                  <View className="text-center">
                    <Text className="text-xl font-bold text-blue-600 block">
                      {stats.in_transit}
                    </Text>
                    <Text className="text-xs text-gray-500 mt-1 block">进行中</Text>
                  </View>
                  <View className="text-center">
                    <Text className="text-xl font-bold text-green-600 block">
                      {stats.completed}
                    </Text>
                    <Text className="text-xs text-gray-500 mt-1 block">已完成</Text>
                  </View>
                  <View className="text-center">
                    <Text className="text-xl font-bold text-gray-600 block">
                      {stats.total}
                    </Text>
                    <Text className="text-xs text-gray-500 mt-1 block">总计</Text>
                  </View>
                </View>
              </CardContent>
            </Card>
          )}

          {/* 订单列表 */}
          <View className="flex gap-2 mb-4">
            <Button
              className="flex-1"
              variant={activeTab === 'pending' ? 'default' : 'outline'}
              onClick={() => setActiveTab('pending')}
            >
              <Text className="text-sm">待调度</Text>
            </Button>
            <Button
              className="flex-1"
              variant={activeTab === 'in_transit' ? 'default' : 'outline'}
              onClick={() => setActiveTab('in_transit')}
            >
              <Text className="text-sm">进行中</Text>
            </Button>
            <Button
              className="flex-1"
              variant={activeTab === 'completed' ? 'default' : 'outline'}
              onClick={() => setActiveTab('completed')}
            >
              <Text className="text-sm">已完成</Text>
            </Button>
          </View>

          {loading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Text className="text-gray-500 text-sm block">加载中...</Text>
              </CardContent>
            </Card>
          ) : activeTab === 'pending' && (
            <View>
              {pendingDemands.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Text className="text-gray-500 text-sm block">暂无待调度订单</Text>
                  </CardContent>
                </Card>
              ) : (
                pendingDemands.map(demand => renderDemandCard(demand))
              )}
            </View>
          )}

          {!loading && activeTab === 'in_transit' && (
            <View>
              {inTransitDemands.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Text className="text-gray-500 text-sm block">暂无进行中订单</Text>
                  </CardContent>
                </Card>
              ) : (
                inTransitDemands.map(demand => renderDemandCard(demand))
              )}
            </View>
          )}

          {!loading && activeTab === 'completed' && (
            <View>
              {completedDemands.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Text className="text-gray-500 text-sm block">暂无已完成订单</Text>
                  </CardContent>
                </Card>
              ) : (
                completedDemands.map(demand => renderDemandCard(demand))
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* 分配车辆弹窗 */}
      <AllocateVehicleDialog
        open={allocateDialogOpen}
        onClose={() => setAllocateDialogOpen(false)}
        vehicles={availableVehicles}
        selectedVehicles={selectedVehicleIds}
        onToggleVehicle={handleToggleVehicle}
        onConfirm={handleConfirmAllocate}
      />
    </View>
  )
}

export default EnterpriseDispatchPage
