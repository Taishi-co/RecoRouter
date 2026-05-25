import { useEffect, useState } from 'react'
import { View, Text, Map } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import Taro from '@tarojs/taro'
import { Network } from '@/network'

interface Vehicle {
  id: string
  vehicle_type: string
  license_plate?: string
  load_capacity: number
  volume: number
  battery_life: number
  has_cold_chain: boolean
  status: string
  is_available: boolean
  trip_status: string
  base_price?: number
  base_distance?: number
  price_per_km?: number
  // 租赁相关字段
  ownership_type?: 'owned' | 'rented'
  current_renter_id?: string | null
}

interface Demand {
  id: string
  cargo_name: string
  pickup_address: string
  pickup_lat?: string
  pickup_lng?: string
  delivery_address: string
  delivery_lat?: string
  delivery_lng?: string
  pickup_time: string
  weight: string
  volume: string
  cargo_description?: string
}

const demoAcceptDemand: Demand = {
  id: 'demo-demand-1',
  cargo_name: '冷链鲜奶配送',
  pickup_address: '宝山城市仓 · 1号月台',
  pickup_lat: '31.4053',
  pickup_lng: '121.4890',
  delivery_address: '萧山中心站 · 北门',
  delivery_lat: '30.1838',
  delivery_lng: '120.2647',
  pickup_time: '2026-05-26T08:30:00+10:00',
  weight: '820',
  volume: '3.2',
  cargo_description: '演示需求：需全程温控 2-8°C',
}

const demoAcceptVehicles: Vehicle[] = [
  {
    id: 'demo-vehicle-1',
    vehicle_type: '8.6m 冷链无人车',
    license_plate: '沪A·D2688',
    load_capacity: 1200,
    volume: 8.6,
    battery_life: 220,
    has_cold_chain: true,
    status: 'active',
    is_available: true,
    trip_status: 'idle',
    base_price: 80,
    base_distance: 5,
    price_per_km: 4.8,
    ownership_type: 'owned',
    current_renter_id: null,
  },
]

export default function AcceptOrder() {
  const [demandId, setDemandId] = useState<string>('')
  const [selectedDemand, setSelectedDemand] = useState<Demand | null>(null)
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('')
  const [acceptNote, setAcceptNote] = useState('')
  const [farePrice, setFarePrice] = useState('')
  const [calculatedFare, setCalculatedFare] = useState<number | null>(null)
  const [fareCalculationDetail, setFareCalculationDetail] = useState<any>(null)
  const [routePolyline, setRoutePolyline] = useState<any[]>([])
  const [routeDistance, setRouteDistance] = useState<string>('')
  const [routeDuration, setRouteDuration] = useState<string>('')
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(false)
  const [showFullMap, setShowFullMap] = useState(false)

  useEffect(() => {
    const params = Taro.getCurrentInstance().router?.params
    if (params?.demandId) {
      setDemandId(params.demandId)
      loadDemandDetail(params.demandId)
      loadVehicles()
    }
  }, [])

  // 加载需求详情
  const loadDemandDetail = async (id: string) => {
    if (id.startsWith('demo-')) {
      setSelectedDemand(demoAcceptDemand)
      await fetchRouteData(demoAcceptDemand)
      return
    }

    try {
      const res = await Network.request({
        url: `/api/demands/${id}`
      })

      if (res.data.code === 200 && res.data.data) {
        setSelectedDemand(res.data.data)

        // 获取路线数据
        if (res.data.data.pickup_lat && res.data.data.pickup_lng &&
            res.data.data.delivery_lat && res.data.data.delivery_lng) {
          await fetchRouteData(res.data.data)
        }
      } else {
        setSelectedDemand(demoAcceptDemand)
      }
    } catch (error) {
      console.error('加载需求详情失败:', error)
      setSelectedDemand(demoAcceptDemand)
      Taro.showToast({
        title: '加载需求失败',
        icon: 'none'
      })
    }
  }

  // 加载车主的车辆列表
  const loadVehicles = async () => {
    try {
      const userInfo = Taro.getStorageSync('userInfo')

      const res = await Network.request({
        url: `/api/vehicles?owner_id=${userInfo.id}`
      })

      console.log('加载车辆列表响应:', res.data)

      if (res.data.code === 200) {
        const vehicleList = res.data.data || []

        // 过滤可用车辆
        // 1. 自有车辆：不能已出租（current_renter_id 为空）
        // 2. 租赁车辆：必须已租给当前用户（current_renter_id === userInfo.id）
        // 3. 通用条件：激活状态 + 出车中 + 空闲中
        const availableVehicles = vehicleList.filter((v: Vehicle) => {
          // 基础条件：激活、出车中、空闲
          const basicCondition = v.status === 'active' && v.is_available === true && v.trip_status === 'idle'
          if (!basicCondition) return false

          // 租赁权限检查
          if (v.ownership_type === 'owned') {
            // 自有车辆：不能已出租
            return !v.current_renter_id
          } else if (v.ownership_type === 'rented') {
            // 租赁车辆：必须已租给当前用户
            return v.current_renter_id === userInfo.id
          }

          // 兼容旧数据：如果没有 ownership_type 字段，当作自有车辆处理
          return !v.current_renter_id
        })

        console.log('可用车辆列表:', availableVehicles)
        setVehicles(availableVehicles.length > 0 ? availableVehicles : demoAcceptVehicles)
      }
    } catch (error) {
      console.error('加载车辆列表失败:', error)
      setVehicles(demoAcceptVehicles)
    }
  }

  // 获取路线数据
  const fetchRouteData = async (demand: Demand) => {
    if (!demand.pickup_lat || !demand.pickup_lng ||
        !demand.delivery_lat || !demand.delivery_lng) {
      return
    }

    try {
      const res = await Network.request({
        url: '/api/demands/calculate-distance',
        method: 'POST',
        data: {
          pickup_address: demand.pickup_address,
          pickup_lat: parseFloat(demand.pickup_lat),
          pickup_lng: parseFloat(demand.pickup_lng),
          delivery_address: demand.delivery_address,
          delivery_lat: parseFloat(demand.delivery_lat),
          delivery_lng: parseFloat(demand.delivery_lng)
        }
      })

      console.log('路线数据响应:', res.data)

      if (res.data.code === 200 && res.data.data) {
        // 设置距离和时间
        const distanceText = res.data.data.distance_text || ''
        const durationText = res.data.data.duration_text || ''
        setRouteDistance(distanceText)
        setRouteDuration(durationText)
        console.log('设置路线信息:', { distanceText, durationText })

        // 提取路线坐标点
        if (res.data.data.polyline && Array.isArray(res.data.data.polyline)) {
          const points = res.data.data.polyline.map((point: any) => ({
            latitude: point.latitude,
            longitude: point.longitude
          }))
          setRoutePolyline(points)
          console.log('路线点数:', points.length)
        } else {
          setRoutePolyline([])
          console.log('没有路线数据，使用降级方案')
        }
      } else {
        console.log('路线数据返回错误:', res.data)
      }
    } catch (error) {
      console.error('获取路线数据失败:', error)
    }
  }

  // 关闭全屏地图
  const handleCloseFullMap = () => {
    setShowFullMap(false)
  }

  // 选择车辆
  const handleVehicleSelect = async (vehicleId: string) => {
    setSelectedVehicleId(vehicleId)

    // 自动计算运费
    try {
      const vehicle = vehicles.find(v => v.id === vehicleId)
      if (!vehicle) return

      if (!selectedDemand || !selectedDemand.pickup_lat || !selectedDemand.pickup_lng ||
          !selectedDemand.delivery_lat || !selectedDemand.delivery_lng) {
        return
      }

      const res = await Network.request({
        url: '/api/fare/calculate',
        method: 'POST',
        data: {
          vehicle_id: vehicleId,
          total_distance: 0 // 将由服务端计算
        }
      })

      console.log('运费计算响应:', res.data)

      if (res.data.code === 200 && res.data.data) {
        // 先计算距离
        const distanceRes = await Network.request({
          url: '/api/demands/calculate-distance',
          method: 'POST',
          data: {
            pickup_address: selectedDemand.pickup_address,
            pickup_lat: parseFloat(selectedDemand.pickup_lat),
            pickup_lng: parseFloat(selectedDemand.pickup_lng),
            delivery_address: selectedDemand.delivery_address,
            delivery_lat: parseFloat(selectedDemand.delivery_lat),
            delivery_lng: parseFloat(selectedDemand.delivery_lng)
          }
        })

        if (distanceRes.data.code === 200) {
          const distance = distanceRes.data.data.distance

          const basePrice = vehicle.base_price || 20
          const baseDistance = vehicle.base_distance || 3
          const pricePerKm = vehicle.price_per_km || 2
          const extraDistance = Math.max(0, distance - baseDistance)
          const extraFare = extraDistance * pricePerKm
          const totalFare = basePrice + extraFare

          const fareData = {
            total_fare: totalFare,
            calculation_detail: {
              base_price: basePrice,
              base_distance: baseDistance,
              price_per_km: pricePerKm,
              total_distance: distance,
              extra_distance: extraDistance,
              extra_fare: extraFare,
              total_fare: totalFare
            }
          }

          setCalculatedFare(fareData.total_fare)
          setFareCalculationDetail(fareData.calculation_detail)
          setFarePrice(Math.floor(fareData.total_fare).toString())

          Taro.showToast({
            title: `已自动计算运费：¥${Math.floor(totalFare)}`,
            icon: 'success'
          })
        }
      }
    } catch (error) {
      console.error('计算运费失败:', error)
    }
  }

  // 确认接单
  const handleConfirmAccept = async () => {
    if (!selectedDemand || !demandId) {
      Taro.showToast({
        title: '需求信息不完整',
        icon: 'none'
      })
      return
    }

    if (!selectedVehicleId) {
      Taro.showToast({
        title: '请选择车辆',
        icon: 'none'
      })
      return
    }

    if (!farePrice || !parseFloat(farePrice)) {
      Taro.showToast({
        title: '请输入运费',
        icon: 'none'
      })
      return
    }

    setLoading(true)

    try {
      const userInfo = Taro.getStorageSync('userInfo')
      const lastSwitchTime = Taro.getStorageSync('lastRoleSwitchTime')

      // ✅ 增加调试日志
      console.log('========== 接单调试信息 ==========')
      console.log('1. 当前用户 ID:', userInfo?.id)
      console.log('2. 当前用户角色:', userInfo?.role)
      console.log('3. 选择车辆 ID:', selectedVehicleId)
      console.log('4. 需求 ID:', demandId)
      console.log('5. 角色切换时间:', lastSwitchTime)
      console.log('6. 运费报价:', farePrice)
      console.log('===================================')

      const res = await Network.request({
        url: `/api/demands/${demandId}/accept`,
        method: 'POST',
        data: {
          ownerId: userInfo.id,
          vehicleId: selectedVehicleId,
          farePrice: parseFloat(farePrice),
          note: acceptNote
        }
      })

      console.log('接单响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: '接单成功',
          icon: 'success',
          duration: 2000
        })

        setTimeout(() => {
          Taro.navigateBack()
        }, 2000)
      } else {
        Taro.showToast({
          title: res.data.message || '接单失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('接单失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  if (!selectedDemand) {
    return (
      <AppPageShell
        title="接单确认"
        subtitle="RecoRouter 运力端"
        bottom={<BottomNav type="owner" active="demands" />}
      >
        <Text className="text-gray-500">加载中...</Text>
      </AppPageShell>
    )
  }

  return (
    <AppPageShell
      title="接单确认"
      subtitle="RecoRouter 运力端"
      contentClassName="space-y-4"
      bottom={<BottomNav type="owner" active="demands" />}
    >
        <View className="bg-white rounded-lg p-4">
          <Text className="block text-sm font-semibold text-gray-900">
            请确认接单：{selectedDemand.cargo_name}
          </Text>
          <Text className="block text-xs text-gray-500 mt-1">
            选择车辆并确认运费后即可接单
          </Text>
        </View>
          {/* 地图展示 */}
          {(selectedDemand.pickup_lat && selectedDemand.pickup_lng) && (
            <View className="bg-white rounded-lg p-4">
              <Text className="font-medium mb-3 text-sm">路线地图</Text>
              <View className="rounded-lg overflow-hidden bg-gray-100">
                {Taro.getEnv() === Taro.ENV_TYPE.WEAPP ? (
                  <Map
                    id="accept-map"
                    className="w-full"
                    style={{ height: '400px' }}
                    latitude={parseFloat(selectedDemand.pickup_lat)}
                    longitude={parseFloat(selectedDemand.pickup_lng)}
                    scale={10}
                    showLocation
                    enableZoom
                    enableScroll
                    onError={(e) => console.log('地图加载失败:', e)}
                    markers={([
                      {
                        id: 1,
                        latitude: parseFloat(selectedDemand.pickup_lat),
                        longitude: parseFloat(selectedDemand.pickup_lng),
                        title: selectedDemand.pickup_address || '取货点',
                        iconPath: '',
                        width: 24,
                        height: 24,
                        callout: {
                          content: '起点',
                          color: '#fff',
                          fontSize: 12,
                          borderRadius: 4,
                          bgColor: '#3b82f6',
                          padding: 4,
                          display: 'ALWAYS',
                          textAlign: 'center',
                          anchorX: 0,
                          anchorY: 0
                        }
                      },
                      ...(selectedDemand.delivery_lat && selectedDemand.delivery_lng ? [{
                        id: 2,
                        latitude: parseFloat(selectedDemand.delivery_lat),
                        longitude: parseFloat(selectedDemand.delivery_lng),
                        title: selectedDemand.delivery_address || '送货点',
                        iconPath: '',
                        width: 24,
                        height: 24,
                        callout: {
                          content: '终点',
                          color: '#fff',
                          fontSize: 12,
                          borderRadius: 4,
                          bgColor: '#ef4444',
                          padding: 4,
                          display: 'ALWAYS',
                          textAlign: 'center',
                          anchorX: 0,
                          anchorY: 0
                        }
                      }] : [])
                    ] as any)}
                    polyline={
                      routePolyline.length > 0
                        ? [
                            {
                              points: routePolyline,
                              color: '#3b82f6',
                              width: 4,
                              dottedLine: false
                            }
                          ]
                        : selectedDemand.delivery_lat && selectedDemand.delivery_lng
                          ? [
                              {
                                points: [
                                  {
                                    latitude: parseFloat(selectedDemand.pickup_lat),
                                    longitude: parseFloat(selectedDemand.pickup_lng)
                                  },
                                  {
                                    latitude: parseFloat(selectedDemand.delivery_lat),
                                    longitude: parseFloat(selectedDemand.delivery_lng)
                                  }
                                ],
                                color: '#3b82f6',
                                width: 4,
                                dottedLine: true
                              }
                            ]
                          : []
                    }
                  />
                ) : (
                  <View className="flex items-center justify-center h-48">
                    <Text className="text-sm text-gray-500 text-center">
                      地图功能仅在小程序中可用
                    </Text>
                  </View>
                )}
              </View>

              {/* 距离和时间信息 */}
              {(routeDistance || routeDuration) && (
                <View className="mt-2 flex items-center justify-center">
                  <Text className="text-xs text-gray-600 text-center">
                    {routeDistance && routeDuration
                      ? `${routeDistance} · ${routeDuration}`
                      : routeDistance || routeDuration
                    }
                  </Text>
                </View>
              )}

              <View className="mt-2 flex items-center justify-center">
                <Text
                  className="text-xs text-blue-500 text-center"
                  onClick={() => setShowFullMap(true)}
                >
                  🔍 点击查看全屏路线
                </Text>
              </View>
            </View>
          )}

          {/* 车辆选择 */}
          <View className="bg-white rounded-lg p-4">
            <Text className="font-medium mb-3 text-sm">
              <Text className="text-red-500">*</Text>选择车辆
            </Text>
            {vehicles.length === 0 ? (
              <View className="bg-gray-50 rounded-lg p-4 text-center">
                <Text className="text-gray-500 text-sm mb-2">
                  暂无可用车辆
                </Text>
                <Text className="text-gray-400 text-xs">
                  请确保车辆状态为：已激活 + 出车中 + 空闲中{'\n'}自有车辆不能已出租
                </Text>
              </View>
            ) : (
              <View className="space-y-3">
                {vehicles.map((vehicle) => (
                  <View
                    key={vehicle.id}
                    className={`bg-gray-50 rounded-lg p-4 ${
                      selectedVehicleId === vehicle.id ? 'border-2 border-blue-500' : 'border-2 border-transparent'
                    }`}
                    onClick={() => handleVehicleSelect(vehicle.id)}
                  >
                    <View className="flex items-center justify-between">
                      <View className="flex-1">
                        <View className="flex items-center gap-2 mb-2">
                          <Text className="font-medium text-sm">
                            {vehicle.vehicle_type}
                          </Text>
                          {/* 车辆归属类型标签 */}
                          {vehicle.ownership_type && (
                            <Badge className={vehicle.ownership_type === 'owned' ? 'bg-blue-600' : 'bg-purple-600'}>
                              <Text className="text-white text-xs">
                                {vehicle.ownership_type === 'owned' ? '自有' : '租赁'}
                              </Text>
                            </Badge>
                          )}
                        </View>
                        <View className="flex items-center gap-2 mb-2">
                          <Text className="text-xs text-gray-600">
                            车牌: {vehicle.license_plate || '未填写'}
                          </Text>
                          {vehicle.has_cold_chain && (
                            <Badge className="bg-cyan-500">
                              <Text className="text-white text-xs">冷链</Text>
                            </Badge>
                          )}
                        </View>
                        <Text className="text-xs text-gray-500 mb-2">
                          载重: {vehicle.load_capacity}kg | 容积: {vehicle.volume}m³ | 续航: {vehicle.battery_life}km
                        </Text>
                        {(vehicle.base_price || vehicle.base_distance || vehicle.price_per_km) && (
                          <Text className="text-xs text-blue-600 font-medium">
                            💰 起步¥{vehicle.base_price || 20}（{vehicle.base_distance || 3}公里）+ ¥{vehicle.price_per_km || 2}/公里
                          </Text>
                        )}
                      </View>
                      <View className="flex-shrink-0">
                        <View
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            border: '2px solid #d1d5db',
                            backgroundColor: selectedVehicleId === vehicle.id ? '#3b82f6' : 'transparent',
                            borderWidth: selectedVehicleId === vehicle.id ? '6px' : '2px'
                          }}
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* 运费设置 */}
          <View className="bg-white rounded-lg p-4">
            <Text className="font-medium mb-3 text-sm">
              <Text className="text-red-500">*</Text>运费设置
            </Text>

            {calculatedFare && fareCalculationDetail && (
              <View className="bg-green-50 rounded-lg p-4 mb-3">
                <Text className="text-sm font-medium text-green-700 mb-2">
                  ✅ 系统自动计算运费
                </Text>
                <View className="space-y-1">
                  <Text className="text-xs text-green-600">
                    • 起步价：¥{fareCalculationDetail.base_price}（{fareCalculationDetail.base_distance}公里）
                  </Text>
                  <Text className="text-xs text-green-600">
                    • 总距离：{fareCalculationDetail.total_distance.toFixed(2)}公里
                  </Text>
                  <Text className="text-xs text-green-600">
                    • 额外距离：{fareCalculationDetail.extra_distance.toFixed(2)}公里
                  </Text>
                  <Text className="text-xs text-green-600">
                    • 额外费用：¥{fareCalculationDetail.extra_fare.toFixed(2)}
                  </Text>
                  <Text className="text-xs text-green-700 font-bold">
                    • 总运费：¥{Math.floor(fareCalculationDetail.total_fare)}
                  </Text>
                </View>
              </View>
            )}

            <View className="bg-gray-50 rounded-lg px-4 py-3 mb-2">
              <View className="flex items-center">
                <View className="flex-1">
                  <Input
                    className="w-full bg-transparent"
                    placeholder={calculatedFare ? `系统计算: ¥${Math.floor(calculatedFare)}` : '请输入运费价格'}
                    type="digit"
                    value={farePrice}
                    onInput={(e) => setFarePrice(e.detail.value)}
                  />
                </View>
                <Text className="text-sm text-gray-600 ml-2">元</Text>
              </View>
            </View>
            <Text className="text-xs text-gray-400">
              {calculatedFare ? '提示：可修改系统计算的运费' : '提示：选择车辆后系统将自动计算运费'}
            </Text>
          </View>

          {/* 备注说明 */}
          <View className="bg-white rounded-lg p-4">
            <Text className="font-medium mb-3 text-sm">
              备注说明（可选）
            </Text>
            <View className="bg-gray-50 rounded-lg p-4">
              <Textarea
                style={{ width: '100%', minHeight: '100px', backgroundColor: 'transparent' }}
                placeholder="如：预计10分钟内到达取货点"
                maxlength={200}
                value={acceptNote}
                onInput={(e) => setAcceptNote(e.detail.value)}
              />
            </View>
            <Text className="text-xs text-gray-400 mt-2 text-right">
              {acceptNote.length}/200
            </Text>
          </View>

      {/* 底部按钮区域 */}
      <View className="flex gap-3 pb-2">
        <Button
          className="flex-1 bg-gray-200 h-12"
          onClick={() => Taro.navigateBack()}
          disabled={loading}
        >
          <Text>取消</Text>
        </Button>
        <Button
          className="flex-1 bg-blue-500 h-12"
          onClick={handleConfirmAccept}
          disabled={loading}
        >
          <Text>{loading ? '接单中...' : '确认接单'}</Text>
        </Button>
      </View>

      {/* 全屏地图 */}
      {showFullMap && selectedDemand && (
        <View
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            backgroundColor: '#fff'
          }}
        >
          {/* 顶部信息栏 */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              padding: '12px 16px',
              zIndex: 10000,
              borderBottom: '1px solid #e5e5e5'
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>路线详情</Text>
                {routeDistance || routeDuration ? (
                  <Text style={{ fontSize: '12px', color: '#666' }}>
                    {routeDistance && routeDuration
                      ? `${routeDistance} · ${routeDuration}`
                      : routeDistance || routeDuration
                    }
                  </Text>
                ) : (
                  <Text style={{ fontSize: '12px', color: '#999' }}>计算中...</Text>
                )}
              </View>
              <View
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#f5f5f5',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: '12px'
                }}
                onClick={handleCloseFullMap}
              >
                <Text style={{ fontSize: '20px', color: '#666' }}>✕</Text>
              </View>
            </View>
            {/* 取货和送货地址 */}
            <View style={{ marginTop: '8px' }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: '4px' }}>
                <Text style={{ fontSize: '12px', color: '#666', width: '40px' }}>取货:</Text>
                <Text style={{ fontSize: '12px', color: '#333', flex: 1 }}>{selectedDemand.pickup_address}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Text style={{ fontSize: '12px', color: '#666', width: '40px' }}>送货:</Text>
                <Text style={{ fontSize: '12px', color: '#333', flex: 1 }}>{selectedDemand.delivery_address}</Text>
              </View>
            </View>
          </View>

          {/* 全屏地图 */}
          {Taro.getEnv() === Taro.ENV_TYPE.WEAPP ? (
            <Map
              id="full-map"
              className="w-full"
              style={{ height: '100vh' }}
              latitude={selectedDemand.pickup_lat ? parseFloat(selectedDemand.pickup_lat) : 39.9042}
              longitude={selectedDemand.pickup_lng ? parseFloat(selectedDemand.pickup_lng) : 116.4074}
              scale={11}
              showLocation
              enableZoom
              enableScroll
              onError={(e) => console.log('地图加载失败:', e)}
              markers={([
                {
                  id: 1,
                  latitude: selectedDemand.pickup_lat ? parseFloat(selectedDemand.pickup_lat) : 39.9042,
                  longitude: selectedDemand.pickup_lng ? parseFloat(selectedDemand.pickup_lng) : 116.4074,
                  title: selectedDemand.pickup_address || '取货点',
                  iconPath: '',
                  width: 32,
                  height: 32,
                  callout: {
                    content: '起点',
                    color: '#fff',
                    fontSize: 14,
                    borderRadius: 4,
                    bgColor: '#3b82f6',
                    padding: 6,
                    display: 'ALWAYS',
                    textAlign: 'center',
                    anchorX: 0,
                    anchorY: 0
                  }
                },
                ...(selectedDemand.delivery_lat && selectedDemand.delivery_lng ? [{
                  id: 2,
                  latitude: parseFloat(selectedDemand.delivery_lat),
                  longitude: parseFloat(selectedDemand.delivery_lng),
                  title: selectedDemand.delivery_address || '送货点',
                  iconPath: '',
                  width: 32,
                  height: 32,
                  callout: {
                    content: '终点',
                    color: '#fff',
                    fontSize: 14,
                    borderRadius: 4,
                    bgColor: '#ef4444',
                    padding: 6,
                    display: 'ALWAYS',
                    textAlign: 'center',
                    anchorX: 0,
                    anchorY: 0
                  }
                }] : [])
              ] as any)}
              polyline={
                routePolyline.length > 0
                  ? [
                      {
                        points: routePolyline,
                        color: '#3b82f6',
                        width: 6,
                        dottedLine: false
                      }
                    ]
                  : selectedDemand.delivery_lat && selectedDemand.delivery_lng
                    ? [
                        {
                          points: [
                            {
                              latitude: selectedDemand.pickup_lat ? parseFloat(selectedDemand.pickup_lat) : 39.9042,
                              longitude: selectedDemand.pickup_lng ? parseFloat(selectedDemand.pickup_lng) : 116.4074
                            },
                            {
                              latitude: parseFloat(selectedDemand.delivery_lat),
                              longitude: parseFloat(selectedDemand.delivery_lng)
                            }
                          ],
                          color: '#3b82f6',
                          width: 6,
                          dottedLine: true
                        }
                      ]
                    : []
              }
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: '14px', color: '#999', textAlign: 'center' }}>
                地图功能仅在小程序中可用
              </Text>
            </View>
          )}

          {/* 底部提示 */}
          <View
            style={{
              position: 'absolute',
              bottom: '20px',
              left: '16px',
              right: '16px',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              padding: '8px 12px',
              borderRadius: '8px'
            }}
          >
            <Text style={{ fontSize: '12px', color: '#fff', textAlign: 'center' }}>
              再次点击右上角关闭按钮退出全屏
            </Text>
          </View>
        </View>
      )}
    </AppPageShell>
  )
}
