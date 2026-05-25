import { View, Text } from '@tarojs/components'
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
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Network } from '@/network'
import Taro from '@tarojs/taro'
import { BadgeCheck, MapPinned, ShieldCheck, Truck } from 'lucide-react-taro'

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
  usage_mode: 'internal' | 'external' | 'both'
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

      if (res.data.code === 200) {
        setVehicle(res.data.data)
      } else {
        Taro.showToast({
          title: res.data.message || '加载失败',
          icon: 'none',
        })
        Taro.navigateBack()
      }
    } catch (error) {
      console.error('加载详情失败:', error)
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
      <AppPageShell
        title="车辆详情"
        subtitle="鄂A·7K21 · 张师傅"
        icon={BadgeCheck}
        bottom={<BottomNav type="enterprise" active="fleet" />}
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

  const displayVehicle: Vehicle = vehicle || {
    id: 'demo',
    vehicle_code: '鄂A·7K21',
    vehicle_type: '9.6m 冷链厢车',
    load_capacity: 18000,
    volume: 42,
    length: 9.6,
    width: 2.4,
    height: 2.6,
    current_location: '武汉东西湖配送中心',
    usage_mode: 'internal',
    trip_status: 'idle',
    today_internal_orders: 4,
    today_external_orders: 1,
    today_distance: 128,
    created_at: new Date().toISOString(),
  }

  return (
    <AppPageShell
      title="车辆详情"
      subtitle={`${displayVehicle.vehicle_code} · 张师傅`}
      icon={BadgeCheck}
      bottom={<BottomNav type="enterprise" active="fleet" />}
      contentClassName="space-y-3 pb-6"
    >
      <Card className="shadow-sm border-gray-100">
        <CardHeader className="pb-2">
          <View className="flex justify-between items-start">
            <View className="flex items-center gap-2 flex-1">
              <Truck size={19} color="#0062FF" strokeWidth={2.2} />
              <View>
                <CardTitle className="text-base">{displayVehicle.vehicle_code}</CardTitle>
                <Text className="text-xs text-gray-500 mt-1 block">{displayVehicle.vehicle_type}</Text>
              </View>
            </View>
            <Badge className={getTripStatusColor(displayVehicle.trip_status)}>
              {getTripStatusText(displayVehicle.trip_status)}
            </Badge>
          </View>
        </CardHeader>
        <CardContent>
          <View className="grid grid-cols-3 gap-3 mb-4">
            <View className="bg-blue-50 rounded-2xl p-3">
              <Text className="text-lg font-black text-blue-600 block">{displayVehicle.load_capacity}</Text>
              <Text className="text-xs font-semibold text-gray-500 block mt-1">载重 kg</Text>
            </View>
            <View className="bg-green-50 rounded-2xl p-3">
              <Text className="text-lg font-black text-green-600 block">{displayVehicle.volume}</Text>
              <Text className="text-xs font-semibold text-gray-500 block mt-1">空间 m³</Text>
            </View>
            <View className="bg-orange-50 rounded-2xl p-3">
              <Text className="text-lg font-black text-orange-600 block">{displayVehicle.today_distance}</Text>
              <Text className="text-xs font-semibold text-gray-500 block mt-1">今日 km</Text>
            </View>
          </View>
          {displayVehicle.length && displayVehicle.width && displayVehicle.height && (
            <View className="flex justify-between">
              <Text className="text-sm text-gray-600">车辆尺寸</Text>
              <Text className="text-sm font-bold text-gray-900">
                {displayVehicle.length}m × {displayVehicle.width}m × {displayVehicle.height}m
              </Text>
            </View>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm border-gray-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">当前位置</CardTitle>
        </CardHeader>
        <CardContent>
          <View className="h-36 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-3">
            <MapPinned size={30} color="#0062FF" strokeWidth={2.2} />
          </View>
          <Text className="block text-sm font-bold text-gray-900">{displayVehicle.current_location || '武汉东西湖配送中心'}</Text>
          <Text className="block text-xs text-gray-500 mt-1">GPS 已接入 · 2 分钟前更新</Text>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-gray-100">
        <CardHeader className="pb-2">
          <View className="flex items-center gap-2">
            <ShieldCheck size={18} color="#16A34A" strokeWidth={2.2} />
            <CardTitle className="text-base">证照状态</CardTitle>
          </View>
        </CardHeader>
        <CardContent>
          <View className="space-y-3">
            <View className="flex justify-between">
              <Text className="text-sm text-gray-600">行驶证</Text>
              <Text className="text-sm font-bold text-green-600">有效</Text>
            </View>
            <View className="flex justify-between">
              <Text className="text-sm text-gray-600">道路运输证</Text>
              <Text className="text-sm font-bold text-green-600">已认证</Text>
            </View>
            <View className="flex justify-between">
              <Text className="text-sm text-gray-600">创建时间</Text>
              <Text className="text-xs font-semibold text-gray-900">{new Date(displayVehicle.created_at).toLocaleString('zh-CN')}</Text>
            </View>
          </View>
        </CardContent>
      </Card>

      <Button className="w-full h-12 rounded-full" onClick={() => Taro.navigateBack()}>
        <Text className="text-white text-sm font-bold">返回车队管理</Text>
      </Button>
    </AppPageShell>
  )
}

export default VehicleDetailPage
