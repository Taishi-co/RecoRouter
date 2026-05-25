import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Network } from '@/network'

interface UnifiedVehicle {
  id: string
  manufacturer: 'neolix' | 'ninebot'
  latitude: number
  longitude: number
  speed: number
  heading: number
  status: string
  battery: number
  mileage: number
  timestamp: string
}

export default function VehicleMockDemo() {
  const [vehicles, setVehicles] = useState<UnifiedVehicle[]>([])
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string>('')

  // 加载模拟数据
  const loadMockVehicles = async () => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/mock/vehicles/all',
        method: 'GET'
      })

      console.log('车机模拟数据:', res.data)

      if (res.data.code === 200) {
        setVehicles(res.data.data || [])
        setLastUpdate(new Date().toLocaleTimeString())
        Taro.showToast({
          title: '数据已更新',
          icon: 'success'
        })
      } else {
        Taro.showToast({
          title: res.data.message || '加载失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('加载模拟数据失败:', error)
      Taro.showToast({
        title: '网络错误',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  // 页面加载时获取数据
  useEffect(() => {
    loadMockVehicles()
  }, [])

  // 获取状态对应的颜色
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      idle: 'bg-blue-500',
      running: 'bg-green-500',
      delivering: 'bg-green-500',
      charging: 'bg-yellow-500',
      maintenance: 'bg-orange-500',
      error: 'bg-red-500',
    }
    return colors[status] || 'bg-gray-500'
  }

  // 获取状态文本
  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      idle: '空闲',
      running: '运行中',
      delivering: '配送中',
      charging: '充电中',
      maintenance: '维护中',
      error: '故障',
    }
    return texts[status] || status
  }

  // 获取厂商名称
  const getManufacturerName = (manufacturer: string) => {
    const names: Record<string, string> = {
      neolix: '新石器',
      ninebot: '九识',
    }
    return names[manufacturer] || manufacturer
  }

  return (
    <AppPageShell
      title="模拟数据与照片"
      subtitle="RecoRouter 运力端"
      contentClassName="space-y-4"
      bottom={<BottomNav type="owner" active="vehicles" />}
    >
        {/* 说明卡片 */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <Text className="block text-sm text-blue-800 mb-2 font-medium">
              功能说明
            </Text>
            {lastUpdate && (
              <Text className="block text-xs text-blue-700 mb-2">
                最后更新: {lastUpdate}
              </Text>
            )}
            <Text className="block text-xs text-blue-700 mb-1">
              • 模拟新石器（Neolix）和九识（Ninebot）无人车实时位置数据
            </Text>
            <Text className="block text-xs text-blue-700 mb-1">
              • 后端每5秒自动推送随机车辆位置更新
            </Text>
            <Text className="block text-xs text-blue-700">
              • 点击&quot;刷新数据&quot;按钮可手动获取最新数据
            </Text>
          </CardContent>
        </Card>

        {/* 车辆列表 */}
        <View className="space-y-4">
          <Text className="block text-sm font-medium text-gray-700 mb-2">
            模拟车辆列表 ({vehicles.length} 台)
          </Text>

          {loading ? (
            <View className="text-center py-8">
              <Text className="block text-gray-500 text-sm">加载中...</Text>
            </View>
          ) : vehicles.length === 0 ? (
            <View className="text-center py-8">
              <Text className="block text-gray-500 text-sm">暂无数据</Text>
            </View>
          ) : (
            vehicles.map((vehicle) => (
              <Card key={vehicle.id} className="bg-white">
                <CardHeader>
                  <View className="flex justify-between items-start">
                    <View className="flex-1">
                      <View className="flex items-center gap-2 mb-2">
                        <Badge className={vehicle.manufacturer === 'neolix' ? 'bg-purple-500' : 'bg-cyan-500'}>
                          <Text className="text-white text-xs">
                            {getManufacturerName(vehicle.manufacturer)}
                          </Text>
                        </Badge>
                        <Badge className={getStatusColor(vehicle.status)}>
                          <Text className="text-white text-xs">
                            {getStatusText(vehicle.status)}
                          </Text>
                        </Badge>
                      </View>
                      <CardTitle className="text-base font-semibold">
                        {vehicle.id}
                      </CardTitle>
                    </View>
                  </View>
                </CardHeader>
                <CardContent>
                  <View className="space-y-2">
                    {/* 位置信息 */}
                    <View className="flex items-start">
                      <Text className="text-xs text-gray-500 w-20 flex-shrink-0">经纬度:</Text>
                      <Text className="text-xs text-gray-700 flex-1 font-mono">
                        {vehicle.latitude.toFixed(6)}, {vehicle.longitude.toFixed(6)}
                      </Text>
                    </View>

                    {/* 速度 */}
                    <View className="flex items-start">
                      <Text className="text-xs text-gray-500 w-20 flex-shrink-0">速度:</Text>
                      <Text className="text-xs text-gray-700 flex-1">
                        {vehicle.speed.toFixed(1)} km/h
                      </Text>
                    </View>

                    {/* 方向 */}
                    <View className="flex items-start">
                      <Text className="text-xs text-gray-500 w-20 flex-shrink-0">方向:</Text>
                      <Text className="text-xs text-gray-700 flex-1">
                        {vehicle.heading}°
                      </Text>
                    </View>

                    {/* 电池 */}
                    <View className="flex items-start">
                      <Text className="text-xs text-gray-500 w-20 flex-shrink-0">电量:</Text>
                      <Text className={`text-xs flex-1 ${vehicle.battery < 20 ? 'text-red-500 font-bold' : 'text-gray-700'}`}>
                        {vehicle.battery}%
                      </Text>
                    </View>

                    {/* 里程 */}
                    <View className="flex items-start">
                      <Text className="text-xs text-gray-500 w-20 flex-shrink-0">里程:</Text>
                      <Text className="text-xs text-gray-700 flex-1">
                        {vehicle.mileage.toFixed(1)} km
                      </Text>
                    </View>

                    {/* 更新时间 */}
                    <View className="flex items-start">
                      <Text className="text-xs text-gray-500 w-20 flex-shrink-0">更新时间:</Text>
                      <Text className="text-xs text-gray-700 flex-1">
                        {new Date(vehicle.timestamp).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </CardContent>
              </Card>
            ))
          )}
        </View>

        <Button
          className="w-full bg-blue-500"
          onClick={loadMockVehicles}
          disabled={loading}
        >
          <Text>{loading ? '生成中...' : '一键生成演示车辆'}</Text>
        </Button>

        {/* JSON数据展示 */}
        {vehicles.length > 0 && (
          <Card className="bg-white mt-4">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                原始JSON数据
              </CardTitle>
            </CardHeader>
            <CardContent>
              <View className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                <Text className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                  {JSON.stringify(vehicles, null, 2)}
                </Text>
              </View>
            </CardContent>
          </Card>
        )}
    </AppPageShell>
  )
}
