import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Car, Phone, Mail, Calendar, DollarSign, Info, Truck } from 'lucide-react-taro'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Network } from '@/network'

interface VehicleOwner {
  id: string
  name: string
  phone: string
  avatar_url?: string
}

interface Vehicle {
  id: string
  license_plate: string
  vehicle_type: string
  load_capacity: number
  volume: number
  battery_life: number
  has_cold_chain: boolean
  photos: string[]
  owners?: VehicleOwner  // 使用 owners 字段
  owner?: VehicleOwner   // 兼容字段
  is_available_for_rent: boolean
  rent_monthly_price: number
  rent_yearly_price: number
  rent_deposit: number
  contact_phone?: string
  contact_wechat?: string
  has_applied: boolean
  application_status: string | null
}

const demoRentalVehicles: Vehicle[] = [
  {
    id: 'demo-rental-1',
    license_plate: '沪A·R8821',
    vehicle_type: 'van',
    load_capacity: 12000,
    volume: 45,
    battery_life: 380,
    has_cold_chain: false,
    photos: [],
    owners: {
      id: 'demo-owner-1',
      name: '上海锐驰车队',
      phone: '13800001234',
    },
    is_available_for_rent: true,
    rent_monthly_price: 14400,
    rent_yearly_price: 158000,
    rent_deposit: 5000,
    contact_phone: '13800001234',
    contact_wechat: 'recocar-demo',
    has_applied: false,
    application_status: null,
  },
  {
    id: 'demo-rental-2',
    license_plate: '苏E·P5518',
    vehicle_type: 'large_truck',
    load_capacity: 32000,
    volume: 62,
    battery_life: 420,
    has_cold_chain: false,
    photos: [],
    owners: {
      id: 'demo-owner-2',
      name: '苏州好运车队',
      phone: '13900005678',
    },
    is_available_for_rent: true,
    rent_monthly_price: 22800,
    rent_yearly_price: 246000,
    rent_deposit: 8000,
    contact_phone: '13900005678',
    has_applied: true,
    application_status: 'pending',
  },
  {
    id: 'demo-rental-3',
    license_plate: '浙B·C8620',
    vehicle_type: 'small_truck',
    load_capacity: 8600,
    volume: 38,
    battery_life: 320,
    has_cold_chain: true,
    photos: [],
    owners: {
      id: 'demo-owner-3',
      name: '宁波冷链联盟',
      phone: '13700004321',
    },
    is_available_for_rent: true,
    rent_monthly_price: 27600,
    rent_yearly_price: 298000,
    rent_deposit: 9000,
    contact_phone: '13700004321',
    contact_wechat: 'cold-demo',
    has_applied: false,
    application_status: null,
  },
]

export default function VehicleRentals() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(false)
  const visibleVehicles = vehicles.length > 0 ? vehicles : demoRentalVehicles

  useDidShow(() => {
    loadVehicles()
  })

  useEffect(() => {
    loadVehicles()
  }, [])

  const loadVehicles = async () => {
    console.log('🔄 开始加载可租赁车辆')
    setLoading(true)
    try {
      const userInfo = Taro.getStorageSync('userInfo')
      const userId = userInfo?.id

      const res = await Network.request({
        url: '/api/rentals/available-vehicles',
        data: userId ? { user_id: userId } : {}
      })

      console.log('📦 可租赁车辆完整响应:', res)
      console.log('📦 可租赁车辆响应数据:', res.data)

      if (res.data && res.data.code === 200) {
        const vehiclesData = res.data.data || []
        console.log('✓ 加载成功，车辆数量:', vehiclesData.length)
        console.log('✓ 车辆数据:', vehiclesData)
        setVehicles(vehiclesData)
      } else {
        console.error('✗ 接口返回错误:', res.data)
        Taro.showToast({
          title: res.data?.message || '加载失败',
          icon: 'none',
          duration: 2000
        })
      }
    } catch (error) {
      console.error('✗ 加载可租赁车辆异常:', error)
      Taro.showToast({
        title: '加载失败，请重试',
        icon: 'none',
        duration: 2000
      })
    } finally {
      console.log('✓ 加载完成，设置 loading 为 false')
      setLoading(false)
    }
  }

  const handleContactOwner = (vehicle: Vehicle) => {
    const owner = vehicle.owners || vehicle.owner
    if (!owner) {
      Taro.showToast({
        title: '车主信息不存在',
        icon: 'none'
      })
      return
    }

    const phone = vehicle.contact_phone || owner.phone
    const wechat = vehicle.contact_wechat

    if (wechat) {
      Taro.showModal({
        title: '联系车主',
        content: `电话：${phone}\n微信：${wechat}\n\n请通过电话或微信联系车主，商谈租赁细节。`,
        showCancel: false
      })
    } else {
      Taro.showModal({
        title: '联系车主',
        content: `电话：${phone}\n\n请通过电话联系车主，商谈租赁细节。`,
        showCancel: false
      })
    }
  }

  const handleViewDetail = (vehicle: Vehicle) => {
    Taro.navigateTo({
      url: `/pages/merchant/rentals/detail?vehicleId=${vehicle.id}`
    })
  }

  const getVehicleTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      'small_truck': '小货车',
      'medium_truck': '中型货车',
      'large_truck': '大型货车',
      'van': '面包车',
      'pickup': '皮卡'
    }
    return typeMap[type] || type
  }

  return (
    <AppPageShell
      title="租赁列表"
      subtitle="RecoRouter 商户小程序"
      icon={Truck}
      contentClassName="space-y-3"
      bottom={<BottomNav type="merchant" active="profile" />}
    >
      {/* 提示信息 */}
      <View className="p-3 bg-blue-50 rounded-lg">
        <View className="flex items-start">
          <Info size={16} color="#1890ff" className="mr-2 flex-shrink-0 mt-1" />
          <Text className="block text-sm text-blue-700">
            平台只提供信息撮合服务。租金、押金、合同等交易均在线下完成。
          </Text>
        </View>
      </View>

      {/* 车辆列表 */}
      <View className="space-y-4">
        {loading ? (
          <View className="text-center py-8">
            <Text className="block text-gray-500">加载中...</Text>
          </View>
        ) : visibleVehicles.length === 0 ? (
          <View className="text-center py-8">
            <Text className="block text-gray-500">暂无可租赁车辆</Text>
          </View>
        ) : (
          visibleVehicles.map((vehicle) => (
            <Card key={vehicle.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <View className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">
                    {getVehicleTypeLabel(vehicle.vehicle_type)}（{vehicle.license_plate}）
                  </CardTitle>
                  <View className="flex gap-2">
                    {vehicle.has_cold_chain && (
                      <Badge className="bg-blue-500">冷链</Badge>
                    )}
                    {vehicle.has_applied && vehicle.application_status === 'pending' && (
                      <Badge className="bg-orange-500">已申请</Badge>
                    )}
                    {vehicle.has_applied && vehicle.application_status === 'active' && (
                      <Badge className="bg-green-500">已租赁</Badge>
                    )}
                  </View>
                </View>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* 车辆基本信息 */}
                <View className="space-y-2">
                  <View className="flex items-center text-sm text-gray-600">
                    <Car size={14} className="mr-2" color="#6b7280" />
                    <Text className="block">载重：{vehicle.load_capacity}kg</Text>
                  </View>
                  <View className="flex items-center text-sm text-gray-600">
                    <Car size={14} className="mr-2" color="#6b7280" />
                    <Text className="block">容积：{vehicle.volume}m³</Text>
                  </View>
                  <View className="flex items-center text-sm text-gray-600">
                    <Car size={14} className="mr-2" color="#6b7280" />
                    <Text className="block">续航：{vehicle.battery_life}km</Text>
                  </View>
                </View>

                <Separator />

                {/* 租赁信息 */}
                <View className="bg-gray-50 p-3 rounded-lg">
                  <View className="flex items-center text-sm text-gray-700 mb-2">
                    <Calendar size={14} className="mr-2" color="#6b7280" />
                    <Text className="block font-medium">租赁价格</Text>
                  </View>
                  <View className="flex items-baseline text-sm text-gray-600">
                    <Text className="block mr-4">月租：¥{vehicle.rent_monthly_price}/月</Text>
                    <Text className="block">年租：¥{vehicle.rent_yearly_price}/年</Text>
                  </View>
                  <View className="flex items-center text-sm text-gray-600 mt-1">
                    <DollarSign size={14} className="mr-2" color="#6b7280" />
                    <Text className="block">押金：¥{vehicle.rent_deposit}</Text>
                  </View>
                </View>

                <Separator />

                {/* 车主信息 */}
                <View>
                  <Text className="block text-sm font-medium text-gray-700 mb-2">车主信息</Text>
                  <View className="space-y-2">
                    <View className="flex items-center text-sm text-gray-600">
                      <Text className="block">{(vehicle.owners || vehicle.owner)?.name || '未知'}</Text>
                    </View>
                    {vehicle.contact_wechat && (
                      <View className="flex items-center text-sm text-gray-600">
                        <Mail size={14} className="mr-2" color="#6b7280" />
                        <Text className="block">微信：{vehicle.contact_wechat}</Text>
                      </View>
                    )}
                    <View className="flex items-center text-sm text-gray-600">
                      <Phone size={14} className="mr-2" color="#6b7280" />
                      <Text className="block">电话：{vehicle.contact_phone || (vehicle.owners || vehicle.owner)?.phone}</Text>
                    </View>
                  </View>
                </View>

                {/* 操作按钮 */}
                <View className="flex gap-2 pt-2">
                  <Button
                    className="flex-1"
                    variant="outline"
                    onClick={() => handleViewDetail(vehicle)}
                  >
                    查看详情
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => handleContactOwner(vehicle)}
                  >
                    联系车主
                  </Button>
                </View>
              </CardContent>
            </Card>
          ))
        )}
      </View>
    </AppPageShell>
  )
}
