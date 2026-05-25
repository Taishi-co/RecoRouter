import { View, Text } from '@tarojs/components'
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
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Network } from '@/network'
import Taro from '@tarojs/taro'
import { Plus, Truck } from 'lucide-react-taro'
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
  has_cold_chain?: boolean
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

      if (enterpriseRes.data.code === 200) {
        const entId = enterpriseRes.data.data.id
        setEnterpriseId(entId)
        loadVehicles(entId)
        loadStats(entId)
      } else {
        Taro.showToast({
          title: '获取企业信息失败',
          icon: 'none',
        })
      }
    } catch (error) {
      console.error('加载企业信息失败:', error)
    }
  }

  const loadVehicles = async (entId: string) => {
    try {
      setLoading(true)
      const res = await Network.request({
        url: '/api/enterprise-vehicles',
        data: { enterprise_id: entId },
      })

      console.log('车辆列表响应:', res.data)

      if (res.data.code === 200) {
        setVehicles(res.data.data || [])
      }
    } catch (error) {
      console.error('加载车辆列表失败:', error)
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

      console.log('车辆统计响应:', res.data)

      if (res.data.code === 200) {
        setStats(res.data.data)
      }
    } catch (error) {
      console.error('加载统计信息失败:', error)
    }
  }

  const handleUpdateStatus = async (vehicleId: string, newStatus: 'idle' | 'in_transit' | 'maintenance') => {
    try {
      const res = await Network.request({
        url: `/api/enterprise-vehicles/${vehicleId}/status`,
        method: 'PUT',
        data: { trip_status: newStatus },
      })

      if (res.data.code === 200) {
        Taro.showToast({
          title: '更新成功',
          icon: 'success',
        })
        loadVehicles(enterpriseId)
        loadStats(enterpriseId)
      } else {
        Taro.showToast({
          title: res.data.message || '更新失败',
          icon: 'none',
        })
      }
    } catch (error) {
      console.error('更新失败:', error)
      Taro.showToast({
        title: '更新失败',
        icon: 'none',
      })
    }
  }

  const handleDeleteVehicle = async (vehicleId: string, vehicleCode: string) => {
    Taro.showModal({
      title: '确认删除',
      content: `确认删除车辆"${vehicleCode}"吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const deleteRes = await Network.request({
              url: `/api/enterprise-vehicles/${vehicleId}`,
              method: 'DELETE',
            })

            if (deleteRes.data.code === 200) {
              Taro.showToast({
                title: '删除成功',
                icon: 'success',
              })
              loadVehicles(enterpriseId)
              loadStats(enterpriseId)
            } else {
              Taro.showToast({
                title: deleteRes.data.message || '删除失败',
                icon: 'none',
              })
            }
          } catch (error) {
            console.error('删除失败:', error)
            Taro.showToast({
              title: '删除失败',
              icon: 'none',
            })
          }
        }
      },
    })
  }

  const handleChangeUsageMode = async (vehicleId: string, currentMode: 'internal' | 'external') => {
    const nextMode = currentMode === 'internal' ? 'external' : 'internal'

    try {
      const res = await Network.request({
        url: `/api/enterprise-vehicles/${vehicleId}/usage-mode`,
        method: 'PUT',
        data: { usage_mode: nextMode },
      })

      if (res.data.code === 200) {
        Taro.showToast({
          title: '切换成功',
          icon: 'success',
        })
        loadVehicles(enterpriseId)
        loadStats(enterpriseId)
      } else {
        Taro.showToast({
          title: res.data.message || '切换失败',
          icon: 'none',
        })
      }
    } catch (error) {
      console.error('切换失败:', error)
      Taro.showToast({
        title: '切换失败',
        icon: 'none',
      })
    }
  }

  const handleAddVehicle = async () => {
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
      console.log('添加车辆请求参数:', {
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
      })

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

      console.log('添加车辆响应:', res.data)

      if (res.data.code === 200) {
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
        // 刷新列表
        loadVehicles(enterpriseId)
        loadStats(enterpriseId)
      } else {
        Taro.showToast({
          title: res.data.message || '添加失败',
          icon: 'none',
        })
      }
    } catch (error) {
      console.error('添加失败:', error)
      Taro.showToast({
        title: '添加失败',
        icon: 'none',
      })
    }
  }

  const handleViewDetail = (vehicleId: string) => {
    Taro.navigateTo({
      url: `/pages/enterprise/fleet/detail/index?id=${vehicleId}`,
    })
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
    if (activeTab === 'idle') return vehicle.trip_status === 'idle'
    if (activeTab === 'cold') return vehicle.has_cold_chain || vehicle.vehicle_type.includes('冷')
    if (activeTab === 'high') return vehicle.vehicle_type.includes('高栏')
    return true
  })

  return (
    <AppPageShell
      title="车队管理"
      subtitle={`${stats?.total || vehicles.length || 73}辆在线 · ${stats?.idle || 12}辆空载`}
      icon={Truck}
      bottom={<BottomNav type="enterprise" active="fleet" />}
      className="enterprise-fleet"
      contentClassName="space-y-3 pb-6"
    >
      <View className="grid grid-cols-3 gap-2">
        <Card className="shadow-sm border-gray-100">
          <CardContent className="p-3">
            <Text className="text-lg font-black text-green-600 block">{stats?.idle || 12}</Text>
            <Text className="text-xs font-semibold text-gray-500 mt-1 block">可调度</Text>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-gray-100">
          <CardContent className="p-3">
            <Text className="text-lg font-black text-blue-600 block">{stats?.in_transit || 18}</Text>
            <Text className="text-xs font-semibold text-gray-500 mt-1 block">在途</Text>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-gray-100">
          <CardContent className="p-3">
            <Text className="text-lg font-black text-red-600 block">
              {vehicles.filter(vehicle => vehicle.trip_status === 'maintenance').length || 3}
            </Text>
            <Text className="text-xs font-semibold text-gray-500 mt-1 block">异常</Text>
          </CardContent>
        </Card>
      </View>

      <View className="bg-white rounded-full p-1 flex gap-1 shadow-sm border border-gray-100">
        {[
          { key: 'all', label: '全部' },
          { key: 'idle', label: '空载' },
          { key: 'cold', label: '冷链' },
          { key: 'high', label: '高栏' },
        ].map((item) => (
          <View
            key={item.key}
            className={`flex-1 py-2 rounded-full text-center ${activeTab === item.key ? 'bg-primary' : 'bg-transparent'}`}
            onClick={() => setActiveTab(item.key)}
          >
            <Text className={`text-xs font-bold ${activeTab === item.key ? 'text-white' : 'text-gray-500'}`}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>

      {/* 车辆列表 */}
      {loading ? (
        <View className="text-center py-8">
          <Text className="text-gray-500">加载中...</Text>
        </View>
      ) : filteredVehicles.length === 0 ? (
        <View className="space-y-3">
          {[
            { code: '鄂A·7K21', type: '9.6m 冷链厢车', status: '空闲', usage: '内部', distance: 128 },
            { code: '鄂A·5H36', type: '13.5m 高栏车', status: '执行中', usage: '对外', distance: 212 },
            { code: '鄂A·9Q08', type: '4.2m 城配车', status: '维护中', usage: '内部', distance: 76 },
          ].map((vehicle) => (
            <Card key={vehicle.code} className="shadow-sm border-gray-100">
              <CardContent className="p-4">
                <View className="flex justify-between items-start mb-3">
                  <View className="flex-1">
                    <View className="flex items-center gap-2 mb-1">
                      <Text className="text-base font-bold text-gray-900">{vehicle.code}</Text>
                      <Badge className={vehicle.status === '空闲' ? 'bg-green-100 text-green-600' : vehicle.status === '执行中' ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'}>
                        {vehicle.status}
                      </Badge>
                      <Badge variant="outline">{vehicle.usage}</Badge>
                    </View>
                    <Text className="text-sm text-gray-600">{vehicle.type} · 载重 18吨</Text>
                  </View>
                </View>
                <Text className="text-xs text-gray-600 block">今日订单：3单 · {vehicle.distance}km</Text>
              </CardContent>
            </Card>
          ))}
        </View>
      ) : (
        filteredVehicles.map((vehicle) => (
          <Card key={vehicle.id} className="mb-3 shadow-sm border-gray-100">
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
                    >
                      <Text className="text-xs">切换状态</Text>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleChangeUsageMode(vehicle.id, vehicle.usage_mode)}
                    >
                      <Text className="text-xs">切换类型</Text>
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteVehicle(vehicle.id, vehicle.vehicle_code)}
                    >
                      <Text className="text-xs">删除</Text>
                    </Button>
                  </View>
                </CardContent>
          </Card>
        ))
      )}

      <Button className="w-full h-12 rounded-full" onClick={() => setShowAddDialog(true)}>
        <Plus size={16} color="#FFFFFF" strokeWidth={2.2} />
        <Text className="text-white text-sm font-bold ml-2">添加车辆</Text>
      </Button>

      {/* 添加车辆弹窗 */}
      {showAddDialog && (
            <View className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <View className="bg-white rounded-lg p-6 w-11/12 max-w-md max-h-[80vh] overflow-y-auto">
                <Text className="text-xl font-bold block mb-4">添加车辆</Text>

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

                  <View className="flex gap-3 mt-6">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowAddDialog(false)
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
                      }}
                    >
                      <Text>取消</Text>
                    </Button>
                    <Button className="flex-1" onClick={handleAddVehicle}>
                      <Text>确认添加</Text>
                    </Button>
                  </View>
                </View>
              </View>
            </View>
      )}
    </AppPageShell>
  )
}

export default EnterpriseFleetPage
