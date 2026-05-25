import { View, Text, ScrollView } from '@tarojs/components'
import { useEffect, useState } from 'react'
import type { FC } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getApiData, getApiMessage, isApiSuccess } from '@/lib/api-response'
import { Network } from '@/network'
import Taro from '@tarojs/taro'
import './index.css'

interface Vehicle {
  id: string
  vehicle_code: string
  vehicle_type: string
  load_capacity: number
  volume: number
  length?: number
  width?: number
  height?: number
  current_location: string
  usage_mode: 'internal' | 'external'
  trip_status: 'idle' | 'in_transit' | 'maintenance'
  today_internal_orders: number
  today_external_orders: number
  today_distance: number
  created_at: string
}

interface VehicleStats {
  total: number
  in_transit: number
  idle: number
  internal: number
  external: number
}

const EnterpriseFleetPage: FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [stats, setStats] = useState<VehicleStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [enterpriseId, setEnterpriseId] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [errorText, setErrorText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pendingVehicleIds, setPendingVehicleIds] = useState<string[]>([])

  // 添加车辆弹窗状态
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newVehicleId, setNewVehicleId] = useState('')
  const [newVehicleCode, setNewVehicleCode] = useState('')
  const [newVehicleType, setNewVehicleType] = useState('')
  const [newLoadCapacity, setNewLoadCapacity] = useState('')
  const [newVolume, setNewVolume] = useState('')
  const [newLength, setNewLength] = useState('')
  const [newWidth, setNewWidth] = useState('')
  const [newHeight, setNewHeight] = useState('')
  const [newHasColdChain, setNewHasColdChain] = useState(true)
  const [newUsageMode, setNewUsageMode] = useState<'internal' | 'external'>('internal')

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

      // 获取企业信息
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
        loadVehicles(entId)
        loadStats(entId)
      } else {
        setErrorText(getApiMessage(enterpriseRes, '获取企业信息失败'))
      }
    } catch {
      setErrorText('加载企业信息失败')
    }
  }

  const loadVehicles = async (entId: string) => {
    try {
      setLoading(true)
      const res = await Network.request({
        url: '/api/enterprise-vehicles',
        data: { enterprise_id: entId },
      })

      if (isApiSuccess(res)) {
        setVehicles(getApiData<Vehicle[]>(res, []))
        setErrorText('')
      } else {
        setErrorText(getApiMessage(res, '加载车辆列表失败'))
      }
    } catch {
      setErrorText('加载车辆列表失败')
      Taro.showToast({
        title: '加载失败',
        icon: 'none',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async (entId: string) => {
    try {
      const res = await Network.request({
        url: '/api/enterprise-vehicles/stats',
        data: { enterprise_id: entId },
      })

      if (isApiSuccess(res)) {
        setStats(getApiData<VehicleStats | null>(res, null))
      } else {
        setErrorText(getApiMessage(res, '加载统计信息失败'))
      }
    } catch {
      setErrorText('加载统计信息失败')
    }
  }

  const handleUpdateStatus = async (vehicleId: string, newStatus: 'idle' | 'in_transit' | 'maintenance') => {
    if (pendingVehicleIds.includes(vehicleId)) return

    try {
      setPendingVehicleIds(prev => prev.includes(vehicleId) ? prev : [...prev, vehicleId])
      const res = await Network.request({
        url: `/api/enterprise-vehicles/${vehicleId}/status`,
        method: 'PUT',
        data: { trip_status: newStatus },
      })

      if (isApiSuccess(res)) {
        Taro.showToast({
          title: '更新成功',
          icon: 'success',
        })
        loadVehicles(enterpriseId)
        loadStats(enterpriseId)
      } else {
        Taro.showToast({
          title: getApiMessage(res, '更新失败'),
          icon: 'none',
        })
      }
    } catch {
      Taro.showToast({
        title: '更新失败',
        icon: 'none',
      })
    } finally {
      setPendingVehicleIds(prev => prev.filter(id => id !== vehicleId))
    }
  }

  const handleDeleteVehicle = async (vehicleId: string, vehicleCode: string) => {
    Taro.showModal({
      title: '确认删除',
      content: `确认删除车辆"${vehicleCode}"吗？`,
      success: async (res) => {
        if (res.confirm) {
          if (pendingVehicleIds.includes(vehicleId)) return

          try {
            setPendingVehicleIds(prev => prev.includes(vehicleId) ? prev : [...prev, vehicleId])
            const deleteRes = await Network.request({
              url: `/api/enterprise-vehicles/${vehicleId}`,
              method: 'DELETE',
            })

            if (isApiSuccess(deleteRes)) {
              Taro.showToast({
                title: '删除成功',
                icon: 'success',
              })
              loadVehicles(enterpriseId)
              loadStats(enterpriseId)
            } else {
              Taro.showToast({
                title: getApiMessage(deleteRes, '删除失败'),
                icon: 'none',
              })
            }
          } catch {
            Taro.showToast({
              title: '删除失败',
              icon: 'none',
            })
          } finally {
            setPendingVehicleIds(prev => prev.filter(id => id !== vehicleId))
          }
        }
      },
    })
  }

  const handleChangeUsageMode = async (vehicleId: string, currentMode: 'internal' | 'external') => {
    if (pendingVehicleIds.includes(vehicleId)) return

    const nextMode = currentMode === 'internal' ? 'external' : 'internal'

    try {
      setPendingVehicleIds(prev => prev.includes(vehicleId) ? prev : [...prev, vehicleId])
      const res = await Network.request({
        url: `/api/enterprise-vehicles/${vehicleId}/usage-mode`,
        method: 'PUT',
        data: { usage_mode: nextMode },
      })

      if (isApiSuccess(res)) {
        Taro.showToast({
          title: '切换成功',
          icon: 'success',
        })
        loadVehicles(enterpriseId)
        loadStats(enterpriseId)
      } else {
        Taro.showToast({
          title: getApiMessage(res, '切换失败'),
          icon: 'none',
        })
      }
    } catch {
      Taro.showToast({
        title: '切换失败',
        icon: 'none',
      })
    } finally {
      setPendingVehicleIds(prev => prev.filter(id => id !== vehicleId))
    }
  }

  const handleAddVehicle = async () => {
    if (submitting) return

    if (!enterpriseId) {
      Taro.showToast({
        title: '企业信息缺失',
        icon: 'none',
      })
      return
    }

    if (!newVehicleId || !newVehicleCode || !newVehicleType || !newLoadCapacity || !newVolume) {
      Taro.showToast({
        title: '请填写完整信息',
        icon: 'none',
      })
      return
    }

    const capacity = parseFloat(newLoadCapacity)
    if (Number.isNaN(capacity) || capacity <= 0) {
      Taro.showToast({
        title: '请输入有效的载重',
        icon: 'none',
      })
      return
    }

    const volume = parseFloat(newVolume)
    if (Number.isNaN(volume) || volume <= 0) {
      Taro.showToast({
        title: '请输入有效的空间',
        icon: 'none',
      })
      return
    }

    // 解析长宽高（可选字段）
    const length = newLength ? parseFloat(newLength) : undefined
    const width = newWidth ? parseFloat(newWidth) : undefined
    const height = newHeight ? parseFloat(newHeight) : undefined

    if (length && (Number.isNaN(length) || length <= 0)) {
      Taro.showToast({
        title: '请输入有效的长度',
        icon: 'none',
      })
      return
    }

    if (width && (Number.isNaN(width) || width <= 0)) {
      Taro.showToast({
        title: '请输入有效的宽度',
        icon: 'none',
      })
      return
    }

    if (height && (Number.isNaN(height) || height <= 0)) {
      Taro.showToast({
        title: '请输入有效的高度',
        icon: 'none',
      })
      return
    }

    try {
      setSubmitting(true)
      const res = await Network.request({
        url: '/api/enterprise-vehicles',
        method: 'POST',
        data: {
          enterprise_id: enterpriseId,
          vehicle_id: newVehicleId,
          vehicle_code: newVehicleCode,
          vehicle_type: newVehicleType,
          load_capacity: capacity,
          volume: volume,
          length: length,
          width: width,
          height: height,
          has_cold_chain: newHasColdChain,
          usage_mode: newUsageMode,
        },
      })

      if (isApiSuccess(res)) {
        Taro.showToast({
          title: '添加成功',
          icon: 'success',
        })
        setShowAddDialog(false)
        // 清空表单
        setNewVehicleId('')
        setNewVehicleCode('')
        setNewVehicleType('')
        setNewLoadCapacity('')
        setNewVolume('')
        setNewLength('')
        setNewWidth('')
        setNewHeight('')
        setNewHasColdChain(true)
        setNewUsageMode('internal')
        // 刷新列表
        loadVehicles(enterpriseId)
        loadStats(enterpriseId)
      } else {
        Taro.showToast({
          title: getApiMessage(res, '添加失败'),
          icon: 'none',
        })
      }
    } catch {
      Taro.showToast({
        title: '添加失败',
        icon: 'none',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleViewDetail = (vehicleId: string) => {
    Taro.navigateTo({
      url: `/pages/enterprise/fleet/detail/index?id=${vehicleId}`,
    })
  }

  const resetAddVehicleForm = () => {
    setNewVehicleId('')
    setNewVehicleCode('')
    setNewVehicleType('')
    setNewLoadCapacity('')
    setNewVolume('')
    setNewLength('')
    setNewWidth('')
    setNewHeight('')
    setNewHasColdChain(true)
    setNewUsageMode('internal')
  }

  const handleAddDialogOpenChange = (open: boolean) => {
    if (submitting) return
    setShowAddDialog(open)
    if (!open) {
      resetAddVehicleForm()
    }
  }

  const getUsageModeText = (mode: string) => {
    const modeMap = {
      internal: '内部',
      external: '对外',
    }
    return modeMap[mode] || mode
  }

  const getTripStatusText = (status: string) => {
    const statusMap = {
      idle: '空闲',
      in_transit: '执行中',
      maintenance: '维护中',
    }
    return statusMap[status] || status
  }

  const getTripStatusColor = (status: string) => {
    const colorMap = {
      idle: 'bg-green-100 text-green-600',
      in_transit: 'bg-orange-100 text-orange-600',
      maintenance: 'bg-red-100 text-red-600',
    }
    return colorMap[status] || ''
  }

  // 筛选车辆
  const filteredVehicles = vehicles.filter((vehicle) => {
    if (activeTab === 'all') return true
    if (activeTab === 'own') return vehicle.usage_mode === 'internal'
    if (activeTab === 'external') return vehicle.usage_mode === 'external'
    return true
  })

  return (
    <View className="enterprise-fleet min-h-screen bg-gray-50 pb-20">
      <ScrollView scrollY className="h-full">
        <View className="p-4">
          {/* 页面标题和操作按钮 */}
          <View className="flex justify-between items-center mb-4">
            <Text className="text-lg font-bold text-gray-900">车辆管理</Text>
            <Button
              size="sm"
              onClick={() => setShowAddDialog(true)}
              disabled={!enterpriseId}
            >
              <Text className="text-xs">添加车辆</Text>
            </Button>
          </View>

          {errorText && (
            <Card className="mb-4 border-red-200 bg-red-50">
              <CardContent className="p-3">
                <Text className="block text-sm text-red-600">{errorText}</Text>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => {
                    if (enterpriseId) {
                      loadVehicles(enterpriseId)
                      loadStats(enterpriseId)
                    } else {
                      loadEnterpriseInfo()
                    }
                  }}
                  disabled={loading}
                >
                  <Text className="text-xs">重试</Text>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* 统计信息 */}
          {stats && (
            <Card className="mb-4">
              <CardContent className="p-4">
                <View className="grid grid-cols-4 gap-2">
                  <View className="text-center">
                    <Text className="text-lg font-bold text-blue-600 block">
                      {stats.total}
                    </Text>
                    <Text className="text-xs text-gray-500 mt-1 block">总车辆</Text>
                  </View>
                  <View className="text-center">
                    <Text className="text-lg font-bold text-orange-600 block">
                      {stats.in_transit}
                    </Text>
                    <Text className="text-xs text-gray-500 mt-1 block">执行中</Text>
                  </View>
                  <View className="text-center">
                    <Text className="text-lg font-bold text-green-600 block">
                      {stats.idle}
                    </Text>
                    <Text className="text-xs text-gray-500 mt-1 block">空闲</Text>
                  </View>
                  <View className="text-center">
                    <Text className="text-lg font-bold text-purple-600 block">
                      {stats.external}
                    </Text>
                    <Text className="text-xs text-gray-500 mt-1 block">对外</Text>
                  </View>
                </View>
              </CardContent>
            </Card>
          )}

          {/* 车辆筛选 */}
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="mb-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">
                <Text>全部</Text>
              </TabsTrigger>
              <TabsTrigger value="own">
                <Text>自有</Text>
              </TabsTrigger>
              <TabsTrigger value="external">
                <Text>外部</Text>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* 车辆列表 */}
          {loading ? (
            <View className="text-center py-8">
              <Text className="text-gray-500">加载中...</Text>
            </View>
          ) : filteredVehicles.length === 0 ? (
            <Card className="mb-4">
              <CardContent className="p-8 text-center">
                <Text className="text-gray-500 text-sm block">暂无车辆</Text>
              </CardContent>
            </Card>
          ) : (
            filteredVehicles.map((vehicle) => (
              <Card key={vehicle.id} className="mb-3">
                <CardContent className="p-4">
                  <View className="flex justify-between items-start mb-3">
                    <View className="flex-1">
                      <View className="flex items-center gap-2 mb-1">
                        <Text className="text-base font-bold text-gray-900">
                          {vehicle.vehicle_code}
                        </Text>
                        <Badge className={getTripStatusColor(vehicle.trip_status)}>
                          {getTripStatusText(vehicle.trip_status)}
                        </Badge>
                        <Badge variant="outline">
                          {getUsageModeText(vehicle.usage_mode)}
                        </Badge>
                      </View>
                      <Text className="text-sm text-gray-600">
                        {vehicle.vehicle_type} · {vehicle.load_capacity}公斤
                      </Text>
                      {vehicle.length && vehicle.width && vehicle.height && (
                        <Text className="text-xs text-gray-500 mt-1">
                          尺寸: {vehicle.length}m × {vehicle.width}m × {vehicle.height}m
                        </Text>
                      )}
                    </View>
                  </View>

                  <View className="text-xs text-gray-600 mb-3">
                    <Text className="block">
                      今日订单：{vehicle.today_internal_orders + vehicle.today_external_orders}单 · {vehicle.today_distance}km
                    </Text>
                  </View>

                  <View className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleViewDetail(vehicle.id)}
                      disabled={pendingVehicleIds.includes(vehicle.id)}
                    >
                      <Text className="text-xs">详情</Text>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        const statuses = ['idle', 'in_transit', 'maintenance'] as const
                        const currentIndex = statuses.indexOf(vehicle.trip_status)
                        const nextIndex = (currentIndex + 1) % statuses.length
                        handleUpdateStatus(vehicle.id, statuses[nextIndex])
                      }}
                      disabled={pendingVehicleIds.includes(vehicle.id)}
                    >
                      <Text className="text-xs">
                        {pendingVehicleIds.includes(vehicle.id) ? '处理中' : '切换状态'}
                      </Text>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleChangeUsageMode(vehicle.id, vehicle.usage_mode)}
                      disabled={pendingVehicleIds.includes(vehicle.id)}
                    >
                      <Text className="text-xs">切换类型</Text>
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteVehicle(vehicle.id, vehicle.vehicle_code)}
                      disabled={pendingVehicleIds.includes(vehicle.id)}
                    >
                      <Text className="text-xs">
                        {pendingVehicleIds.includes(vehicle.id) ? '处理中' : '删除'}
                      </Text>
                    </Button>
                  </View>
                </CardContent>
              </Card>
            ))
          )}

          {/* 添加车辆弹窗 */}
          <Dialog open={showAddDialog} onOpenChange={handleAddDialogOpenChange}>
            <DialogContent className="max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  <Text className="text-xl font-bold block">添加车辆</Text>
                </DialogTitle>
              </DialogHeader>
                <View className="space-y-4">
                  <View>
                    <Text className="text-sm text-gray-600 block mb-2">车辆ID</Text>
                    <Input
                      placeholder="请输入车辆ID"
                      value={newVehicleId}
                      onInput={(e) => setNewVehicleId(e.detail.value)}
                    />
                  </View>

                  <View>
                    <Text className="text-sm text-gray-600 block mb-2">车牌号</Text>
                    <Input
                      placeholder="请输入车牌号"
                      value={newVehicleCode}
                      onInput={(e) => setNewVehicleCode(e.detail.value)}
                    />
                  </View>

                  <View>
                    <Text className="text-sm text-gray-600 block mb-2">车型</Text>
                    <Input
                      placeholder="请输入车型"
                      value={newVehicleType}
                      onInput={(e) => setNewVehicleType(e.detail.value)}
                    />
                  </View>

                  <View>
                    <Text className="text-sm text-gray-600 block mb-2">载重（公斤）</Text>
                    <Input
                      placeholder="请输入载重"
                      value={newLoadCapacity}
                      onInput={(e) => setNewLoadCapacity(e.detail.value)}
                      type="number"
                    />
                  </View>

                  <View>
                    <Text className="text-sm text-gray-600 block mb-2">空间（立方米）</Text>
                    <Input
                      placeholder="请输入空间"
                      value={newVolume}
                      onInput={(e) => setNewVolume(e.detail.value)}
                      type="number"
                    />
                  </View>

                  <View>
                    <Text className="text-sm text-gray-600 block mb-2">长度（米）</Text>
                    <Input
                      placeholder="请输入长度"
                      value={newLength}
                      onInput={(e) => setNewLength(e.detail.value)}
                      type="number"
                    />
                  </View>

                  <View>
                    <Text className="text-sm text-gray-600 block mb-2">宽度（米）</Text>
                    <Input
                      placeholder="请输入宽度"
                      value={newWidth}
                      onInput={(e) => setNewWidth(e.detail.value)}
                      type="number"
                    />
                  </View>

                  <View>
                    <Text className="text-sm text-gray-600 block mb-2">高度（米）</Text>
                    <Input
                      placeholder="请输入高度"
                      value={newHeight}
                      onInput={(e) => setNewHeight(e.detail.value)}
                      type="number"
                    />
                  </View>

                  <View>
                    <Text className="text-sm text-gray-600 block mb-2">冷链车</Text>
                    <Switch
                      checked={newHasColdChain}
                      onCheckedChange={setNewHasColdChain}
                    />
                    <Text className="text-xs text-gray-500 ml-2">
                      {newHasColdChain ? '是' : '否'}
                    </Text>
                  </View>

                  <View>
                    <Text className="text-sm text-gray-600 block mb-2">车辆类型</Text>
                    <View className="flex gap-2">
                      <Button
                        size="sm"
                        variant={newUsageMode === 'internal' ? 'default' : 'outline'}
                        className="flex-1"
                        onClick={() => setNewUsageMode('internal')}
                      >
                        <Text className="text-xs">内部</Text>
                      </Button>
                      <Button
                        size="sm"
                        variant={newUsageMode === 'external' ? 'default' : 'outline'}
                        className="flex-1"
                        onClick={() => setNewUsageMode('external')}
                      >
                        <Text className="text-xs">外部</Text>
                      </Button>
                    </View>
                    <Text className="text-xs text-gray-500 mt-1 block">
                      {newUsageMode === 'internal' && '仅可接企业内部需求单'}
                      {newUsageMode === 'external' && '仅可接接单大厅的需求单'}
                    </Text>
                  </View>

                  <DialogFooter className="flex flex-row gap-3 mt-6">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleAddDialogOpenChange(false)}
                      disabled={submitting}
                    >
                      <Text>取消</Text>
                    </Button>
                    <Button className="flex-1" onClick={handleAddVehicle} disabled={submitting}>
                      <Text>{submitting ? '添加中...' : '确认添加'}</Text>
                    </Button>
                  </DialogFooter>
                </View>
            </DialogContent>
          </Dialog>
        </View>
      </ScrollView>
    </View>
  )
}

export default EnterpriseFleetPage
