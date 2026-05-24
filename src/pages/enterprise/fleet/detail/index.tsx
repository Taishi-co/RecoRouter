import { View, Text, ScrollView } from '@tarojs/components'
import { useEffect, useState } from 'react'
import type { FC } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getApiData, getApiMessage, isApiSuccess } from '@/lib/api-response'
import { Network } from '@/network'
import Taro from '@tarojs/taro'

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

const VehicleDetailPage: FC = () => {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = Taro.getCurrentInstance().router?.params
    if (params?.id) {
      loadVehicleDetail(params.id)
    }
  }, [])

  const loadVehicleDetail = async (vehicleId: string) => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: `/api/enterprise-vehicles/${vehicleId}`,
      })

      if (isApiSuccess(res)) {
        const vehicleData = getApiData<Vehicle | null>(res, null)
        if (vehicleData) {
          setVehicle(vehicleData)
        } else {
          Taro.showToast({
            title: '车辆信息缺失',
            icon: 'none',
          })
          Taro.navigateBack()
        }
      } else {
        Taro.showToast({
          title: getApiMessage(res, '加载失败'),
          icon: 'none',
        })
        Taro.navigateBack()
      }
    } catch {
      Taro.showToast({
        title: '加载失败',
        icon: 'none',
      })
      Taro.navigateBack()
    } finally {
      setLoading(false)
    }
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

  if (loading) {
    return (
      <View className="min-h-screen bg-gray-50 p-4">
        <Text className="block text-center text-gray-500">加载中...</Text>
      </View>
    )
  }

  if (!vehicle) {
    return (
      <View className="min-h-screen bg-gray-50 p-4">
        <Text className="block text-center text-gray-500">未找到车辆信息</Text>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-gray-50 pb-20">
      <ScrollView scrollY className="h-full">
        <View className="p-4">
          {/* 基本信息 */}
          <Card className="mb-4">
            <CardHeader>
              <View className="flex justify-between items-start">
                <View className="flex-1">
                  <CardTitle className="text-lg mb-2">
                    {vehicle.vehicle_code}
                  </CardTitle>
                  <Text className="text-sm text-gray-600">
                    {vehicle.vehicle_type}
                  </Text>
                </View>
                <View className="flex flex-col gap-2">
                  <Badge className={getTripStatusColor(vehicle.trip_status)}>
                    {getTripStatusText(vehicle.trip_status)}
                  </Badge>
                </View>
              </View>
            </CardHeader>
            <CardContent>
              <View className="text-sm space-y-2">
                <View className="flex justify-between">
                  <Text className="text-gray-600">载重</Text>
                  <Text className="font-medium">{vehicle.load_capacity}公斤</Text>
                </View>
                <View className="flex justify-between">
                  <Text className="text-gray-600">空间</Text>
                  <Text className="font-medium">{vehicle.volume}立方米</Text>
                </View>
                {vehicle.length && vehicle.width && vehicle.height && (
                  <View className="flex justify-between">
                    <Text className="text-gray-600">尺寸</Text>
                    <Text className="font-medium">
                      {vehicle.length}m × {vehicle.width}m × {vehicle.height}m
                    </Text>
                  </View>
                )}
                <View className="flex justify-between">
                  <Text className="text-gray-600">创建时间</Text>
                  <Text className="font-medium text-xs">
                    {new Date(vehicle.created_at).toLocaleString('zh-CN')}
                  </Text>
                </View>
              </View>
            </CardContent>
          </Card>

          {/* 今日统计 */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">今日统计</CardTitle>
            </CardHeader>
            <CardContent>
              <View className="grid grid-cols-3 gap-3">
                <View className="text-center">
                  <Text className="text-lg font-bold text-blue-600 block">
                    {vehicle.today_internal_orders}
                  </Text>
                  <Text className="text-xs text-gray-500 mt-1 block">内部订单</Text>
                </View>
                <View className="text-center">
                  <Text className="text-lg font-bold text-green-600 block">
                    {vehicle.today_external_orders}
                  </Text>
                  <Text className="text-xs text-gray-500 mt-1 block">外部订单</Text>
                </View>
                <View className="text-center">
                  <Text className="text-lg font-bold text-orange-600 block">
                    {vehicle.today_distance}
                  </Text>
                  <Text className="text-xs text-gray-500 mt-1 block">行驶距离</Text>
                </View>
              </View>
            </CardContent>
          </Card>
        </View>
      </ScrollView>

      {/* 底部操作栏 */}
      <View style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTop: '1px solid #e5e5e5', padding: '12px', zIndex: 100 }}>
        <Button
          className="w-full"
          onClick={() => Taro.navigateBack()}
        >
          <Text>返回</Text>
        </Button>
      </View>
    </View>
  )
}

export default VehicleDetailPage
