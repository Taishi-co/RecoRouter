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
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Network } from '@/network'
import Taro from '@tarojs/taro'
import { MapPinned, Route, Sparkles, Truck } from 'lucide-react-taro'
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
  usage_mode: 'internal' | 'external'
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
        const entId = enterpriseRes.data.data.id
        setEnterpriseId(entId)
        loadStats(entId)
        loadPendingDemands(entId)
        loadInTransitDemands(entId)
        loadCompletedDemands(entId)
      }
    } catch (error) {
      console.error('加载企业信息失败:', error)
    }
  }

  const loadStats = async (entId: string) => {
    try {
      const res = await Network.request({
        url: '/api/demand/stats/enterprise',
        data: { enterprise_id: entId },
      })

      if (res.data.code === 200) {
        setStats(res.data.data)
      }
    } catch (error) {
      console.error('加载统计失败:', error)
    }
  }

  const loadPendingDemands = async (entId: string) => {
    try {
      const res = await Network.request({
        url: `/api/demand/pending/${entId}`,
      })

      if (res.data.code === 200) {
        setPendingDemands(res.data.data || [])
      }
    } catch (error) {
      console.error('加载待调度订单失败:', error)
    }
  }

  const loadInTransitDemands = async (entId: string) => {
    try {
      const res = await Network.request({
        url: '/api/demand',
        data: { enterpriseId: entId, status: 'in_transit' },
      })

      if (res.data.code === 200) {
        setInTransitDemands(res.data.data.list || [])
      }
    } catch (error) {
      console.error('加载进行中订单失败:', error)
    }
  }

  const loadCompletedDemands = async (entId: string) => {
    try {
      const res = await Network.request({
        url: '/api/demand',
        data: { enterpriseId: entId, status: 'completed' },
      })

      if (res.data.code === 200) {
        setCompletedDemands(res.data.data.list || [])
      }
    } catch (error) {
      console.error('加载已完成订单失败:', error)
    }
  }

  const handleAllocateVehicle = async (demand: Demand) => {
    try {
      // 获取可用车辆（只显示内部运力车辆）
      const res = await Network.request({
        url: '/api/enterprise-vehicles',
        data: { enterprise_id: enterpriseId, usage_mode: 'internal' },
      })

      if (res.data.code === 200) {
        const vehicles = res.data.data || []
        // 只显示空闲车辆
        setAvailableVehicles(vehicles.filter((v: Vehicle) => v.trip_status === 'idle'))
        setSelectedVehicleIds([])
        setAllocatingDemand(demand)
        setAllocateDialogOpen(true)
      }
    } catch (error) {
      console.error('获取车辆列表失败:', error)
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

      if (res.data.code === 200) {
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
          title: res.data.message || '分配失败',
          icon: 'none',
        })
      }
    } catch (error) {
      console.error('分配车辆失败:', error)
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

            if (res.data.code === 200) {
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
                title: res.data.message || '取消失败',
                icon: 'none',
              })
            }
          } catch (error) {
            console.error('取消需求失败:', error)
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
    <Card key={demand.id} className="mb-3 shadow-sm border-gray-100">
      <CardHeader className="pb-2">
        <View className="flex justify-between items-center">
          <CardTitle className="text-base flex-1">
            {demand.cargo_info.type || '配送订单'} - {demand.cargo_info.quantity}箱
          </CardTitle>
          <Text className={`text-xs px-2 py-1 rounded ${getStatusColor(demand.status)}`}>
            {getStatusText(demand.status)}
          </Text>
        </View>
      </CardHeader>
      <CardContent>
        <View className="text-sm text-gray-600 mb-3">
          <Text className="block mb-1">
            起点：{demand.pickup_point_info?.name || '仓库'} - {demand.pickup_point_info?.address}
          </Text>
          {demand.delivery_points && demand.delivery_points.length > 0 && (
            <View className="mb-2">
              <Text className="block mb-1 font-medium">
                配送点：{demand.delivery_points.length}个站点
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
            配送时间：{demand.time_window?.start?.split(' ')[1]} - {demand.time_window?.end?.split(' ')[1]}
          </Text>
          <Text className="block">
            运力来源：{demand.vehicle_source === 'external' ? '外部运力' : '自有车辆'}
          </Text>
          {demand.status !== 'pending' && demand.vehicle_allocation && (
            <Text className="block mt-1">
              分配车辆：{demand.vehicle_allocation.vehicle_ids?.length || 0}辆
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
    <AppPageShell
      title="调度看板"
      subtitle="按线路、车辆、时效分配"
      icon={Route}
      bottom={<BottomNav type="enterprise" active="dispatch" />}
      className="enterprise-dispatch"
      contentClassName="space-y-3 pb-6"
    >
      <View className="bg-white rounded-full p-1 flex gap-1 shadow-sm border border-gray-100">
        <View
          className={`flex-1 py-2 rounded-full text-center ${activeTab === 'pending' ? 'bg-primary' : 'bg-transparent'}`}
          onClick={() => setActiveTab('pending')}
        >
          <Text className={`text-sm font-bold ${activeTab === 'pending' ? 'text-white' : 'text-gray-500'}`}>待派</Text>
        </View>
        <View
          className={`flex-1 py-2 rounded-full text-center ${activeTab === 'in_transit' ? 'bg-primary' : 'bg-transparent'}`}
          onClick={() => setActiveTab('in_transit')}
        >
          <Text className={`text-sm font-bold ${activeTab === 'in_transit' ? 'text-white' : 'text-gray-500'}`}>在途</Text>
        </View>
        <View
          className={`flex-1 py-2 rounded-full text-center ${activeTab === 'completed' ? 'bg-primary' : 'bg-transparent'}`}
          onClick={() => setActiveTab('completed')}
        >
          <Text className={`text-sm font-bold ${activeTab === 'completed' ? 'text-white' : 'text-gray-500'}`}>已完</Text>
        </View>
      </View>

      {stats && (
        <Card className="shadow-sm border-gray-100">
          <CardContent className="p-4">
            <View className="grid grid-cols-3 gap-3">
              <View>
                <Text className="text-xl font-black text-orange-600 block">{stats.pending}</Text>
                <Text className="text-xs font-semibold text-gray-500 mt-1 block">急单</Text>
              </View>
              <View>
                <Text className="text-xl font-black text-blue-600 block">{stats.in_transit}</Text>
                <Text className="text-xs font-semibold text-gray-500 mt-1 block">今日</Text>
              </View>
              <View>
                <Text className="text-xl font-black text-green-600 block">{stats.completed}</Text>
                <Text className="text-xs font-semibold text-gray-500 mt-1 block">明日</Text>
              </View>
            </View>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm border-gray-100">
        <CardContent className="p-4">
          <View className="flex items-center justify-between mb-3">
            <View>
              <Text className="block text-base font-black text-gray-900">智能分配抽屉</Text>
              <Text className="block text-xs font-semibold text-gray-500 mt-1">按距离、载重、时窗推荐车辆</Text>
            </View>
            <View className="w-9 h-9 rounded-2xl bg-blue-50 flex items-center justify-center">
              <Sparkles size={18} color="#0062FF" strokeWidth={2.2} />
            </View>
          </View>
          <View className="space-y-2">
            <View className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3">
              <Truck size={17} color="#0062FF" strokeWidth={2.2} />
              <View className="flex-1">
                <Text className="block text-sm font-bold text-gray-900">鄂A·7K21 · 冷链车</Text>
                <Text className="block text-xs font-semibold text-gray-500 mt-1">距仓 2.8km · 空载 · 匹配度 96%</Text>
              </View>
            </View>
            <View className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3">
              <MapPinned size={17} color="#16A34A" strokeWidth={2.2} />
              <View className="flex-1">
                <Text className="block text-sm font-bold text-gray-900">汉口线 · 优先履约</Text>
                <Text className="block text-xs font-semibold text-gray-500 mt-1">预计 42 分钟到达首站</Text>
              </View>
            </View>
          </View>
        </CardContent>
      </Card>

      {activeTab === 'pending' && (
        <View>
          {pendingDemands.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Text className="text-gray-500 text-sm">暂无待调度订单</Text>
              </CardContent>
            </Card>
          ) : (
            pendingDemands.map(demand => renderDemandCard(demand))
          )}
        </View>
      )}

      {activeTab === 'in_transit' && (
        <View>
          {inTransitDemands.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Text className="text-gray-500 text-sm">暂无进行中订单</Text>
              </CardContent>
            </Card>
          ) : (
            inTransitDemands.map(demand => renderDemandCard(demand))
          )}
        </View>
      )}

      {activeTab === 'completed' && (
        <View>
          {completedDemands.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Text className="text-gray-500 text-sm">暂无已完成订单</Text>
              </CardContent>
            </Card>
          ) : (
            completedDemands.map(demand => renderDemandCard(demand))
          )}
        </View>
      )}

      {/* 分配车辆弹窗 */}
      <AllocateVehicleDialog
        open={allocateDialogOpen}
        onClose={() => setAllocateDialogOpen(false)}
        vehicles={availableVehicles}
        selectedVehicles={selectedVehicleIds}
        onToggleVehicle={handleToggleVehicle}
        onConfirm={handleConfirmAllocate}
      />
    </AppPageShell>
  )
}

export default EnterpriseDispatchPage
