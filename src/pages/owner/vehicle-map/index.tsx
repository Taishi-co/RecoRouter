import { useEffect, useState } from 'react'
import { View, Text, Map } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Network } from '@/network'

// 平台检测：判断是否在小程序环境
const currentEnv = Taro.getEnv()
const isMiniApp = currentEnv === Taro.ENV_TYPE.WEAPP || currentEnv === Taro.ENV_TYPE.TT

interface VehicleLocation {
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

export default function VehicleMap() {
  const [vehicles, setVehicles] = useState<VehicleLocation[]>([])
  const [trajectories, setTrajectories] = useState<Record<string, Array<{latitude: number, longitude: number, time: number}>>>({})
  const [loading, setLoading] = useState(false)
  const [mapCenter, setMapCenter] = useState({ latitude: 39.6304, longitude: 118.1802 })
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleLocation | null>(null)

  // 加载车辆位置数据
  const loadVehicleLocations = async () => {
    setLoading(true)
    try {
      // 并行请求位置数据和轨迹数据
      const [locationRes, trajectoryRes] = await Promise.all([
        Network.request({
          url: '/api/mock/vehicles/all',
          method: 'GET'
        }),
        Network.request({
          url: '/api/mock/vehicles/trajectories',
          method: 'GET'
        })
      ])

      console.log('车辆位置数据:', locationRes.data)
      console.log('车辆轨迹数据:', trajectoryRes.data)

      if (locationRes.data.code === 200) {
        const vehicleData = locationRes.data.data || []
        setVehicles(vehicleData)

        // 如果有车辆数据，设置地图中心为第一辆车的位置
        if (vehicleData.length > 0) {
          setMapCenter({
            latitude: vehicleData[0].latitude,
            longitude: vehicleData[0].longitude
          })
        }
      }

      if (trajectoryRes.data.code === 200) {
        setTrajectories(trajectoryRes.data.data || {})
      }
    } catch (error) {
      console.error('加载车辆位置失败:', error)
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
    loadVehicleLocations()
  }, [])

  // 页面显示时刷新数据
  useDidShow(() => {
    loadVehicleLocations()
  })

  // 定位到我的位置
  const handleLocateToMe = () => {
    if (!isMiniApp) {
      Taro.showToast({
        title: '定位功能仅在小程序中可用',
        icon: 'none'
      })
      return
    }

    Taro.getLocation({
      type: 'gcj02',
      success: (res) => {
        setMapCenter({
          latitude: res.latitude,
          longitude: res.longitude
        })
        Taro.showToast({
          title: '已定位到当前位置',
          icon: 'success'
        })
      },
      fail: () => {
        Taro.showToast({
          title: '获取位置失败',
          icon: 'none'
        })
      }
    })
  }

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

  // 生成地图标记点
  const markers = vehicles.map((vehicle, index) => ({
    id: index, // 使用数字索引作为id
    latitude: vehicle.latitude,
    longitude: vehicle.longitude,
    iconPath: vehicle.manufacturer === 'neolix'
      ? '/assets/icons/neolix-marker.png'
      : '/assets/icons/ninebot-marker.png',
    width: 30,
    height: 30,
    callout: {
      content: vehicle.id,
      color: '#333333',
      fontSize: 12,
      borderRadius: 4,
      bgColor: '#ffffff',
      padding: 4,
      display: 'ALWAYS' as const, // 使用const断言为"ALWAYS" | "BYCLICK"类型
      anchorX: 0,
      anchorY: 0,
      borderWidth: 1,
      borderColor: '#cccccc',
      textAlign: 'center' as const // 使用const断言为"center" | "left" | "right"类型
    }
  }))

  // 生成车辆轨迹线
  const polylines = vehicles
    .map((vehicle) => {
      const trajectory = trajectories[vehicle.id]
      if (!trajectory || trajectory.length < 2) return null

      return {
        points: trajectory.map(p => ({
          latitude: p.latitude,
          longitude: p.longitude
        })),
        color: vehicle.manufacturer === 'neolix' ? '#8B5CF6' : '#06B6D4', // 紫色=新石器，青色=九识
        width: 4,
        dottedLine: false,
        arrowLine: true
      }
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)

  // 点击标记点
  const handleMarkerTap = (e: any) => {
    const markerIndex = e.detail.markerId
    const vehicle = vehicles[markerIndex]
    if (vehicle) {
      setSelectedVehicle(vehicle)
    }
  }

  // 地图错误处理
  const handleMapError = (e: any) => {
    console.error('地图错误:', e)
    Taro.showToast({
      title: '地图加载失败',
      icon: 'none'
    })
  }

  // 点击车辆卡片
  const handleVehicleCardTap = (vehicle: VehicleLocation) => {
    setSelectedVehicle(vehicle)
    setMapCenter({
      latitude: vehicle.latitude,
      longitude: vehicle.longitude
    })
  }

  return (
    <View className="min-h-screen bg-gray-100">
      {/* 地图区域 */}
      <View className="relative w-full" style={{ height: '60vh' }}>
        {isMiniApp ? (
          // 小程序端：显示地图
          <Map
            id="vehicleMap"
            className="w-full h-full"
            longitude={mapCenter.longitude}
            latitude={mapCenter.latitude}
            scale={14}
            markers={markers}
            polyline={polylines}
            onMarkerTap={handleMarkerTap}
            onError={handleMapError}
            showLocation
            enableZoom
            enableScroll
          />
        ) : (
          // H5端：显示降级提示
          <View className="w-full h-full bg-gray-200 flex items-center justify-center">
            <View className="text-center px-4">
              <Text className="block text-lg font-semibold text-gray-700 mb-2">
                地图功能仅在小程序中可用
              </Text>
              <Text className="block text-sm text-gray-600 mb-4">
                H5 端暂不支持地图显示，请使用微信小程序或抖音小程序查看车辆实时位置
              </Text>
              <Button
                className="bg-blue-500"
                onClick={loadVehicleLocations}
                disabled={loading}
              >
                <Text>刷新数据</Text>
              </Button>
            </View>
          </View>
        )}

        {/* 地图控制按钮（仅小程序端显示） */}
        {isMiniApp && (
          <View className="absolute top-4 right-4 space-y-2">
            <Button
              size="sm"
              className="bg-white shadow-lg"
              onClick={loadVehicleLocations}
              disabled={loading}
            >
              <Text className="text-xs text-gray-700">刷新</Text>
            </Button>
            <Button
              size="sm"
              className="bg-white shadow-lg"
              onClick={handleLocateToMe}
            >
              <Text className="text-xs text-gray-700">定位</Text>
            </Button>
          </View>
        )}

        {/* 车辆数量提示 */}
        <View className="absolute top-4 left-4 bg-white bg-opacity-90 px-3 py-2 rounded-lg shadow">
          <Text className="text-xs text-gray-700">
            {vehicles.length} 台车辆
          </Text>
        </View>
      </View>

      {/* 车辆列表区域 */}
      <View className="px-4 py-4" style={{ height: '40vh', overflowY: 'auto' }}>
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              车辆列表
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <View className="text-center py-4">
                <Text className="text-sm text-gray-500">加载中...</Text>
              </View>
            ) : vehicles.length === 0 ? (
              <View className="text-center py-4">
                <Text className="text-sm text-gray-500">暂无车辆数据</Text>
              </View>
            ) : (
              <View className="space-y-3">
                {vehicles.map((vehicle) => (
                  <View
                    key={vehicle.id}
                    className="bg-gray-50 rounded-lg p-3"
                    onClick={() => handleVehicleCardTap(vehicle)}
                  >
                    <View className="flex justify-between items-start mb-2">
                      <View className="flex-1">
                        <View className="flex items-center gap-2 mb-1">
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
                        <Text className="font-medium text-sm">
                          {vehicle.id}
                        </Text>
                      </View>
                    </View>

                    <View className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <View>
                        <Text className="text-gray-400">速度:</Text>
                        <Text className="ml-1">{vehicle.speed.toFixed(1)} km/h</Text>
                      </View>
                      <View>
                        <Text className="text-gray-400">方向:</Text>
                        <Text className="ml-1">{vehicle.heading}°</Text>
                      </View>
                      <View>
                        <Text className="text-gray-400">电量:</Text>
                        <Text className={`ml-1 ${vehicle.battery < 20 ? 'text-red-500' : ''}`}>
                          {vehicle.battery}%
                        </Text>
                      </View>
                      <View>
                        <Text className="text-gray-400">里程:</Text>
                        <Text className="ml-1">{vehicle.mileage.toFixed(1)} km</Text>
                      </View>
                    </View>

                    <Text className="text-xs text-gray-400 mt-2 block">
                      更新时间: {new Date(vehicle.timestamp).toLocaleString()}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </CardContent>
        </Card>
      </View>

      {/* 选中车辆详情弹窗 */}
      {selectedVehicle && (
        <View className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 rounded-t-2xl shadow-lg p-4 z-50">
          <View className="flex justify-between items-start mb-3">
            <View className="flex-1">
              <View className="flex items-center gap-2 mb-2">
                <Badge className={selectedVehicle.manufacturer === 'neolix' ? 'bg-purple-500' : 'bg-cyan-500'}>
                  <Text className="text-white text-xs">
                    {getManufacturerName(selectedVehicle.manufacturer)}
                  </Text>
                </Badge>
                <Badge className={getStatusColor(selectedVehicle.status)}>
                  <Text className="text-white text-xs">
                    {getStatusText(selectedVehicle.status)}
                  </Text>
                </Badge>
              </View>
              <Text className="text-lg font-semibold">
                {selectedVehicle.id}
              </Text>
            </View>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedVehicle(null)}
            >
              <Text className="text-xs">关闭</Text>
            </Button>
          </View>

          <View className="space-y-2 text-sm">
            <View className="flex items-start">
              <Text className="text-gray-500 w-20 flex-shrink-0">经纬度:</Text>
              <Text className="text-gray-700 flex-1 font-mono">
                {selectedVehicle.latitude.toFixed(6)}, {selectedVehicle.longitude.toFixed(6)}
              </Text>
            </View>
            <View className="flex items-start">
              <Text className="text-gray-500 w-20 flex-shrink-0">速度:</Text>
              <Text className="text-gray-700 flex-1">
                {selectedVehicle.speed.toFixed(1)} km/h
              </Text>
            </View>
            <View className="flex items-start">
              <Text className="text-gray-500 w-20 flex-shrink-0">方向:</Text>
              <Text className="text-gray-700 flex-1">
                {selectedVehicle.heading}°
              </Text>
            </View>
            <View className="flex items-start">
              <Text className="text-gray-500 w-20 flex-shrink-0">电量:</Text>
              <Text className={`flex-1 ${selectedVehicle.battery < 20 ? 'text-red-500 font-bold' : 'text-gray-700'}`}>
                {selectedVehicle.battery}%
              </Text>
            </View>
            <View className="flex items-start">
              <Text className="text-gray-500 w-20 flex-shrink-0">里程:</Text>
              <Text className="text-gray-700 flex-1">
                {selectedVehicle.mileage.toFixed(1)} km
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
