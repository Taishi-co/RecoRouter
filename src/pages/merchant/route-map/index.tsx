import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Map } from '@tarojs/components'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Navigation, MapPin, CircleCheck, Route } from 'lucide-react-taro'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Network } from '@/network'

interface RouteInfo {
  id: string
  route_name: string
  pickup_address: {
    id: string
    address_name: string
    address: string
    latitude: number
    longitude: number
  }
  delivery_address: {
    id: string
    address_name: string
    address: string
    latitude: number
    longitude: number
  }
  estimated_distance: number | null
  estimated_fare: number | null
  use_count: number
}

const demoRouteInfo: RouteInfo = {
  id: 'demo-route-1',
  route_name: '上海宝山 → 杭州萧山',
  pickup_address: {
    id: 'demo-address-1',
    address_name: '宝山钢贸园',
    address: '上海市宝山区铁山路 588 号',
    latitude: 31.405221,
    longitude: 121.489102,
  },
  delivery_address: {
    id: 'demo-address-2',
    address_name: '萧山中心仓',
    address: '杭州市萧山区建设四路 1688 号',
    latitude: 30.176124,
    longitude: 120.26432,
  },
  estimated_distance: 168,
  estimated_fare: 1680,
  use_count: 31,
}

export default function RouteMap() {
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null)
  const [markers, setMarkers] = useState<any[]>([])
  const [polyline, setPolyline] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingRoute, setLoadingRoute] = useState(false)

  const applyRouteInfo = (data: RouteInfo) => {
    setRouteInfo(data)

    const newMarkers = [
      {
        id: 1,
        latitude: data.pickup_address.latitude,
        longitude: data.pickup_address.longitude,
        iconPath: '/assets/icons/pin-start.png',
        width: 30,
        height: 30,
        title: data.pickup_address.address_name,
        callout: {
          content: data.pickup_address.address_name,
          padding: 10,
          borderRadius: 5,
          bgColor: '#ffffff',
          display: 'ALWAYS'
        }
      },
      {
        id: 2,
        latitude: data.delivery_address.latitude,
        longitude: data.delivery_address.longitude,
        iconPath: '/assets/icons/pin-end.png',
        width: 30,
        height: 30,
        title: data.delivery_address.address_name,
        callout: {
          content: data.delivery_address.address_name,
          padding: 10,
          borderRadius: 5,
          bgColor: '#ffffff',
          display: 'ALWAYS'
        }
      }
    ]
    setMarkers(newMarkers)
    loadRouteData(data.pickup_address, data.delivery_address)
    setLoading(false)
  }

  useEffect(() => {
    try {
      const instance = Taro.getCurrentInstance()
      const routeParams = instance.router?.params

      if (routeParams?.route) {
        const data = JSON.parse(decodeURIComponent(routeParams.route))
        console.log('[RouteMap] 线路信息:', data)
        applyRouteInfo(data)
      } else {
        applyRouteInfo(demoRouteInfo)
      }
    } catch (error) {
      console.error('[RouteMap] 解析线路信息失败:', error)
      applyRouteInfo(demoRouteInfo)
    }
  }, [])

  const loadRouteData = async (pickupAddr: any, deliveryAddr: any) => {
    setLoadingRoute(true)
    try {
      const res = await Network.request({
        url: '/api/demands/calculate-distance',
        method: 'POST',
        data: {
          pickup_address: pickupAddr.address,
          pickup_lat: pickupAddr.latitude,
          pickup_lng: pickupAddr.longitude,
          delivery_address: deliveryAddr.address,
          delivery_lat: deliveryAddr.latitude,
          delivery_lng: deliveryAddr.longitude
        }
      })

      console.log('[RouteMap] 路线数据响应:', res.data)

      if (res.data.code === 200 && res.data.data) {
        const { polyline: routePolyline } = res.data.data

        if (routePolyline && routePolyline.length > 0) {
          // 使用实际路线坐标点
          const newPolyline = [
            {
              points: routePolyline.map((point: any) => ({
                latitude: point.latitude,
                longitude: point.longitude
              })),
              color: '#3b82f6',
              width: 4,
              dottedLine: false,
              arrowLine: true
            }
          ]
          setPolyline(newPolyline)
          console.log('[RouteMap] 使用实际驾车路线，坐标点数:', routePolyline.length)
        } else {
          // 如果没有路线坐标，使用直线连接
          const newPolyline = [
            {
              points: [
                {
                  latitude: pickupAddr.latitude,
                  longitude: pickupAddr.longitude
                },
                {
                  latitude: deliveryAddr.latitude,
                  longitude: deliveryAddr.longitude
                }
              ],
              color: '#3b82f6',
              width: 4,
              dottedLine: true, // 虚线表示估算路线
              arrowLine: true
            }
          ]
          setPolyline(newPolyline)
          console.log('[RouteMap] 使用直线连接（估算路线）')
        }
      }
    } catch (error) {
      console.error('[RouteMap] 加载路线失败:', error)
      // 失败时使用直线连接
      const newPolyline = [
        {
          points: [
            {
              latitude: pickupAddr.latitude,
              longitude: pickupAddr.longitude
            },
            {
              latitude: deliveryAddr.latitude,
              longitude: deliveryAddr.longitude
            }
          ],
          color: '#3b82f6',
          width: 4,
          dottedLine: true,
          arrowLine: true
        }
      ]
      setPolyline(newPolyline)
    } finally {
      setLoadingRoute(false)
    }
  }

  const handleNavigation = () => {
    if (!routeInfo) return

    // 在小程序中使用地图导航
    const isMiniApp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP || Taro.getEnv() === Taro.ENV_TYPE.TT
    if (isMiniApp) {
      // 使用小程序的地图导航功能
      Taro.openLocation({
        latitude: routeInfo.delivery_address.latitude,
        longitude: routeInfo.delivery_address.longitude,
        name: routeInfo.delivery_address.address_name,
        address: routeInfo.delivery_address.address,
        scale: 14
      })
    } else {
      // H5环境提示
      Taro.showToast({
        title: '导航功能仅在小程序中可用',
        icon: 'none'
      })
    }
  }

  const handleBack = () => {
    Taro.navigateBack()
  }

  if (loading) {
    return (
      <AppPageShell
        title="路线地图"
        subtitle="RecoRouter 商户小程序"
        icon={Route}
        bottom={<BottomNav type="merchant" active="map" />}
      >
        <View className="flex items-center justify-center py-12">
          <Text className="text-gray-500">加载中...</Text>
        </View>
      </AppPageShell>
    )
  }

  if (!routeInfo) {
    return (
      <AppPageShell
        title="路线地图"
        subtitle="RecoRouter 商户小程序"
        icon={Route}
        bottom={<BottomNav type="merchant" active="map" />}
      >
      <View className="flex flex-col items-center justify-center py-12">
        <Text className="text-red-500 text-lg font-medium mt-4">线路信息加载失败</Text>
        <Button onClick={handleBack} className="mt-4">
          返回
        </Button>
      </View>
      </AppPageShell>
    )
  }

  const isMiniApp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP || Taro.getEnv() === Taro.ENV_TYPE.TT

  return (
    <AppPageShell
      title="路线地图"
      subtitle={routeInfo.route_name}
      icon={Route}
      contentClassName="space-y-3"
      bottom={<BottomNav type="merchant" active="map" />}
    >
      {/* 地图区域 */}
      {isMiniApp ? (
        <Map
          className="w-full h-96"
          latitude={routeInfo.pickup_address.latitude}
          longitude={routeInfo.pickup_address.longitude}
          scale={12}
          markers={markers}
          polyline={polyline}
          showLocation
          enableTraffic
          onError={(e) => console.error('[RouteMap] 地图加载失败:', e)}
        />
      ) : (
        <View className="w-full h-96 bg-gray-200 flex items-center justify-center">
          <Text className="text-gray-500">
            地图仅在小程序中可用{'\n'}请在小程序中查看完整功能
          </Text>
        </View>
      )}

      {/* 线路详情 */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <View className="flex items-center justify-between border-b pb-3">
            <View className="flex items-center gap-2">
              <CircleCheck size={20} color="#22c55e" />
              <Text className="text-base font-medium">线路信息</Text>
            </View>
            <Text className="text-sm text-gray-500">使用 {routeInfo.use_count} 次</Text>
          </View>

          {/* 路线加载提示 */}
          {loadingRoute && (
            <View className="bg-blue-50 p-3 rounded-lg">
              <Text className="block text-sm text-blue-600 text-center">
                正在加载实际驾车路线...
              </Text>
            </View>
          )}

          <View>
            <View className="flex items-start gap-2 mb-3">
              <MapPin size={16} color="#3b82f6" />
              <View>
                <Text className="block text-sm font-medium text-blue-600">
                  {routeInfo.pickup_address.address_name}
                </Text>
                <Text className="block text-xs text-gray-500 mt-1">
                  {routeInfo.pickup_address.address}
                </Text>
              </View>
            </View>

            <View className="flex items-start gap-2">
              <MapPin size={16} color="#ef4444" />
              <View>
                <Text className="block text-sm font-medium text-red-600">
                  {routeInfo.delivery_address.address_name}
                </Text>
                <Text className="block text-xs text-gray-500 mt-1">
                  {routeInfo.delivery_address.address}
                </Text>
              </View>
            </View>
          </View>

          {(routeInfo.estimated_distance || routeInfo.estimated_fare) && (
            <View className="flex gap-4 pt-2 border-t">
              {routeInfo.estimated_distance && (
                <Text className="text-sm text-gray-600">
                  📏 {Number(routeInfo.estimated_distance).toFixed(1)}公里
                </Text>
              )}
              {routeInfo.estimated_fare && (
                <Text className="text-sm text-gray-600">
                  💰 ¥{Number(routeInfo.estimated_fare).toFixed(2)}
                </Text>
              )}
            </View>
          )}

          {/* 路线类型提示 */}
          {polyline.length > 0 && polyline[0].points && polyline[0].points.length > 2 && (
            <View className="bg-green-50 p-2 rounded-lg mt-2">
              <Text className="block text-xs text-green-600 text-center">
                ✓ 已显示实际驾车路线（不走高速）
              </Text>
            </View>
          )}
        </CardContent>
      </Card>

      {/* 导航按钮 */}
      <Button
        className="w-full bg-blue-500 text-white"
        onClick={handleNavigation}
      >
        <Navigation size={20} color="#ffffff" className="mr-2" />
        <Text>开始导航</Text>
      </Button>
    </AppPageShell>
  )
}
