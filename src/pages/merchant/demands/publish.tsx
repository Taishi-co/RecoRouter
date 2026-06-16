import { useEffect, useMemo, useState } from 'react'
import { Picker, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { BottomNav } from '@/components/layout/bottom-nav'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { Network } from '@/network'
import { CircleAlert, Navigation, Plus, Route, Truck } from 'lucide-react-taro'

type VehicleKey = 'six-cubic' | 'ten-cubic' | 'autonomous'
type AddressTarget =
  | { type: 'pickup' }
  | { type: 'delivery' }
  | { type: 'waypoint'; index: number }

interface AddressBook {
  id: string
  address_name: string
  address: string
  latitude: number
  longitude: number
  is_default: boolean
}

interface FavoriteRoute {
  id: string
  route_name: string
  estimated_distance: number | null
  pickup_address?: AddressBook
  delivery_address?: AddressBook
}

interface LocationPoint {
  address: string
  location: { latitude: number; longitude: number } | null
}

interface ServiceValidation {
  serviceable: boolean
  supportDirect: boolean
  requiresTransfer: boolean
  restrictionCode: string | null
  restrictionMessage: string | null
}

interface PublishForm {
  cargo_name: string
  cargo_type: string
  weight: string
  volume: string
  pickup_time: string
  remarks: string
  pickup: LocationPoint
  delivery: LocationPoint
  waypoints: LocationPoint[]
}

const vehicleOptions: Array<{
  key: VehicleKey
  title: string
  volumeLabel: string
  subtitle: string
  basePrice: number
  perKmPrice: number
}> = [
  {
    key: 'six-cubic',
    title: '6方',
    volumeLabel: '约 6m³',
    subtitle: '适合小批量货物与社区配送',
    basePrice: 58,
    perKmPrice: 3.2,
  },
  {
    key: 'ten-cubic',
    title: '10方',
    volumeLabel: '约 10m³',
    subtitle: '适合大件与多站点运输',
    basePrice: 88,
    perKmPrice: 4.6,
  },
  {
    key: 'autonomous',
    title: '无人车',
    volumeLabel: '平台调度',
    subtitle: '适合固定运营区内标准化线路',
    basePrice: 46,
    perKmPrice: 2.8,
  },
]

const cargoTypeOptions = [
  { label: '普通货物', value: 'normal' },
  { label: '冷链货物', value: 'refrigerated' },
  { label: '易碎品', value: 'fragile' },
]

const emptyPoint = (): LocationPoint => ({
  address: '',
  location: null,
})

const calculateDistanceKm = (points: Array<{ latitude: number; longitude: number }>) => {
  if (points.length < 2) return 0

  let total = 0

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    const earthRadius = 6371
    const dLat = (next.latitude - current.latitude) * Math.PI / 180
    const dLng = (next.longitude - current.longitude) * Math.PI / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(current.latitude * Math.PI / 180) *
        Math.cos(next.latitude * Math.PI / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    total += earthRadius * c
  }

  return Math.round(total * 10) / 10
}

const formatPrice = (value: number | null) => (value == null ? '--' : `¥${value.toFixed(0)}`)

export default function PublishDemand() {
  const [addressBooks, setAddressBooks] = useState<AddressBook[]>([])
  const [favoriteRoutes, setFavoriteRoutes] = useState<FavoriteRoute[]>([])
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleKey>('autonomous')
  const [showAddressPicker, setShowAddressPicker] = useState<AddressTarget | null>(null)
  const [showRoutePicker, setShowRoutePicker] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<PublishForm>({
    cargo_name: '',
    cargo_type: 'normal',
    weight: '',
    volume: '',
    pickup_time: '',
    remarks: '',
    pickup: emptyPoint(),
    delivery: emptyPoint(),
    waypoints: [],
  })
  const [estimatedDistance, setEstimatedDistance] = useState<number | null>(null)
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null)
  const [validation, setValidation] = useState<ServiceValidation>({
    serviceable: false,
    supportDirect: false,
    requiresTransfer: false,
    restrictionCode: 'missing-address',
    restrictionMessage: '请先填写装货地和卸货地',
  })

  const selectedVehicleMeta = useMemo(
    () => vehicleOptions.find((item) => item.key === selectedVehicle) || vehicleOptions[0],
    [selectedVehicle],
  )

  useEffect(() => {
    loadAddressData()
  }, [])

  useDidShow(() => {
    loadAddressData()
  })

  useEffect(() => {
    try {
      const params = Taro.getCurrentInstance().router?.params

      if (params?.route) {
        const routeData = JSON.parse(decodeURIComponent(params.route))
        setFormData((prev) => ({
          ...prev,
          pickup: {
            address: routeData.pickup_address?.address || '',
            location:
              routeData.pickup_address?.latitude && routeData.pickup_address?.longitude
                ? {
                    latitude: routeData.pickup_address.latitude,
                    longitude: routeData.pickup_address.longitude,
                  }
                : null,
          },
          delivery: {
            address: routeData.delivery_address?.address || '',
            location:
              routeData.delivery_address?.latitude && routeData.delivery_address?.longitude
                ? {
                    latitude: routeData.delivery_address.latitude,
                    longitude: routeData.delivery_address.longitude,
                  }
                : null,
          },
        }))
      }

      if (params?.template_id) {
        const decodeValue = (value?: string) => (value ? decodeURIComponent(value) : '')

        setFormData((prev) => ({
          ...prev,
          cargo_name: decodeValue(params.cargo_name),
          cargo_type: decodeValue(params.cargo_type) || 'normal',
          weight: decodeValue(params.weight),
          volume: decodeValue(params.volume),
          pickup: {
            address: decodeValue(params.pickup_address),
            location:
              params.pickup_lat && params.pickup_lng
                ? {
                    latitude: parseFloat(decodeValue(params.pickup_lat)),
                    longitude: parseFloat(decodeValue(params.pickup_lng)),
                  }
                : null,
          },
          delivery: {
            address: decodeValue(params.delivery_address),
            location:
              params.delivery_lat && params.delivery_lng
                ? {
                    latitude: parseFloat(decodeValue(params.delivery_lat)),
                    longitude: parseFloat(decodeValue(params.delivery_lng)),
                  }
                : null,
          },
          remarks: decodeValue(params.remarks),
        }))
      }
    } catch (error) {
      console.error('[PublishDemand] 解析快捷参数失败:', error)
    }
  }, [])

  useEffect(() => {
    const routeLocations = [
      formData.pickup.location,
      ...formData.waypoints.map((point) => point.location),
      formData.delivery.location,
    ].filter(Boolean) as Array<{ latitude: number; longitude: number }>

    if (!formData.pickup.location || !formData.delivery.location || routeLocations.length < 2) {
      setEstimatedDistance(null)
      setEstimatedPrice(null)
      setValidation({
        serviceable: false,
        supportDirect: false,
        requiresTransfer: false,
        restrictionCode: 'missing-address',
        restrictionMessage: '请先填写装货地和卸货地',
      })
      return
    }

    const distance = calculateDistanceKm(routeLocations)
    const extraDistance = Math.max(0, distance - 3)
    const nextPrice = Math.round(
      (selectedVehicleMeta.basePrice + extraDistance * selectedVehicleMeta.perKmPrice) * 10,
    ) / 10

    setEstimatedDistance(distance)
    setEstimatedPrice(nextPrice)
    setValidation({
      serviceable: true,
      supportDirect: true,
      requiresTransfer: false,
      restrictionCode: null,
      restrictionMessage: '线路已生成预估，服务范围与通行规则待后台校验接入',
    })
  }, [formData.delivery.location, formData.pickup.location, formData.waypoints, selectedVehicleMeta])

  const loadAddressData = async () => {
    const userInfo = Taro.getStorageSync('userInfo')
    if (!userInfo?.id) return

    try {
      const [addressRes, routeRes] = await Promise.all([
        Network.request({
          url: '/api/address-books',
          data: { user_id: userInfo.id },
        }),
        Network.request({
          url: '/api/favorite-routes',
          data: { user_id: userInfo.id },
        }),
      ])

      if (addressRes.data.code === 200) {
        setAddressBooks(addressRes.data.data || [])
      }

      if (routeRes.data.code === 200) {
        setFavoriteRoutes(routeRes.data.data || [])
      }
    } catch (error) {
      console.error('[PublishDemand] 加载地址与路线失败:', error)
    }
  }

  const patchLocationPoint = (target: AddressTarget, nextPoint: LocationPoint) => {
    setFormData((prev) => {
      if (target.type === 'pickup') {
        return { ...prev, pickup: nextPoint }
      }

      if (target.type === 'delivery') {
        return { ...prev, delivery: nextPoint }
      }

      const nextWaypoints = [...prev.waypoints]
      nextWaypoints[target.index] = nextPoint
      return { ...prev, waypoints: nextWaypoints }
    })
  }

  const handleSelectAddress = (address: AddressBook) => {
    if (!showAddressPicker) return

    patchLocationPoint(showAddressPicker, {
      address: address.address,
      location: {
        latitude: address.latitude,
        longitude: address.longitude,
      },
    })
    setShowAddressPicker(null)
  }

  const handleChooseLocation = async (target: AddressTarget) => {
    try {
      const location = await Taro.chooseLocation({})
      if (!location) return

      patchLocationPoint(target, {
        address: location.name || location.address,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
      })
    } catch (error) {
      console.error('[PublishDemand] 地图选点失败:', error)
      Taro.showToast({
        title: '请使用地址簿或稍后重试',
        icon: 'none',
      })
    }
  }

  const handleUseRoute = (route: FavoriteRoute) => {
    setFormData((prev) => ({
      ...prev,
      pickup: {
        address: route.pickup_address?.address || '',
        location:
          route.pickup_address?.latitude && route.pickup_address?.longitude
            ? {
                latitude: route.pickup_address.latitude,
                longitude: route.pickup_address.longitude,
              }
            : null,
      },
      delivery: {
        address: route.delivery_address?.address || '',
        location:
          route.delivery_address?.latitude && route.delivery_address?.longitude
            ? {
                latitude: route.delivery_address.latitude,
                longitude: route.delivery_address.longitude,
              }
            : null,
      },
      waypoints: [],
    }))
    setShowRoutePicker(false)
  }

  const handleAddWaypoint = () => {
    setFormData((prev) => ({
      ...prev,
      waypoints: [...prev.waypoints, emptyPoint()],
    }))
  }

  const handleRemoveWaypoint = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      waypoints: prev.waypoints.filter((_, currentIndex) => currentIndex !== index),
    }))
  }

  const handleOpenDetailStep = () => {
    if (!validation.serviceable || !validation.supportDirect) {
      Taro.showToast({
        title: validation.restrictionMessage || '请先完善线路信息',
        icon: 'none',
      })
      return
    }

    setShowDetailDialog(true)
  }

  const handlePickupDateSelect = (value: string) => {
    const currentTime = formData.pickup_time.split(' ')[1] || '09:00'
    setFormData((prev) => ({
      ...prev,
      pickup_time: `${value} ${currentTime}`,
    }))
  }

  const handlePickupTimeSelect = (value: string) => {
    const currentDate = formData.pickup_time.split(' ')[0] || new Date().toISOString().slice(0, 10)
    setFormData((prev) => ({
      ...prev,
      pickup_time: `${currentDate} ${value}`,
    }))
  }

  const handleSubmit = async () => {
    if (!formData.cargo_name || !formData.weight || !formData.volume || !formData.pickup_time) {
      Taro.showToast({
        title: '请补充货物信息与时间',
        icon: 'none',
      })
      return
    }

    if (!formData.pickup.location || !formData.delivery.location) {
      Taro.showToast({
        title: '请先填写线路信息',
        icon: 'none',
      })
      return
    }

    const userInfo = Taro.getStorageSync('userInfo')
    if (!userInfo?.id) {
      Taro.showToast({
        title: '请先登录',
        icon: 'none',
      })
      return
    }

    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/demands',
        method: 'POST',
        data: {
          merchant_id: userInfo.id,
          cargo_name: formData.cargo_name,
          cargo_type: formData.cargo_type,
          weight: formData.weight,
          volume: formData.volume,
          pickup_time: formData.pickup_time,
          pickup_address: formData.pickup.address,
          pickup_location: JSON.stringify(formData.pickup.location),
          delivery_address: formData.delivery.address,
          delivery_location: JSON.stringify(formData.delivery.location),
          remarks: formData.remarks,
          pickup_lat: formData.pickup.location.latitude,
          pickup_lng: formData.pickup.location.longitude,
          delivery_lat: formData.delivery.location.latitude,
          delivery_lng: formData.delivery.location.longitude,
          estimated_distance: estimatedDistance,
          estimated_fare: estimatedPrice,
          vehicle_type: selectedVehicleMeta.title,
          waypoints: formData.waypoints.filter((point) => point.address),
        },
      })

      if (res.data.code === 200) {
        Taro.showToast({
          title: '已发起调度',
          icon: 'success',
        })
        setShowDetailDialog(false)
        setTimeout(() => {
          Taro.redirectTo({ url: '/pages/merchant/orders/index' })
        }, 1200)
      } else {
        Taro.showToast({
          title: res.data.message || '提交失败',
          icon: 'none',
        })
      }
    } catch (error) {
      console.error('[PublishDemand] 提交失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none',
      })
    } finally {
      setLoading(false)
    }
  }

  const renderAddressRow = (
    label: string,
    point: LocationPoint,
    target: AddressTarget,
    placeholder: string,
  ) => (
    <View className="rounded-2xl border border-gray-100 bg-white p-4">
      <View className="mb-2 flex items-center justify-between">
        <View className="flex items-center gap-2">
          <Badge className="bg-orange-500">
            <Text className="text-xs text-white">{label}</Text>
          </Badge>
          <Text className="text-xs text-gray-500">支持地址簿与地图选点</Text>
        </View>
        {point.address ? (
          <Text className="text-xs font-medium text-primary">已选择</Text>
        ) : null}
      </View>
      <Text className={`block text-base font-semibold ${point.address ? 'text-gray-900' : 'text-gray-400'}`}>
        {point.address || placeholder}
      </Text>
      <View className="mt-3 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 rounded-full"
          onClick={() => setShowAddressPicker(target)}
        >
          <Text className="text-xs">地址簿选择</Text>
        </Button>
        <Button
          size="sm"
          className="flex-1 rounded-full bg-primary"
          onClick={() => handleChooseLocation(target)}
        >
          <Text className="text-xs">地图选点</Text>
        </Button>
      </View>
    </View>
  )

  return (
    <AppPageShell
      title="运力调度"
      subtitle="像货拉拉一样快速发起运输需求"
      icon={Truck}
      bottom={<BottomNav type="merchant" active="home" />}
      contentClassName="space-y-3 pb-6"
    >
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-orange-50 via-white to-orange-100 shadow-sm">
        <CardContent className="space-y-4 p-4">
          <View className="flex items-center justify-between">
            <View>
              <Text className="block text-sm font-semibold text-gray-500">当前城市</Text>
              <Text className="block text-2xl font-black text-gray-900">上海</Text>
            </View>
            <Badge className="bg-orange-500 px-3 py-1">
              <Text className="text-xs text-white">实时预估</Text>
            </Badge>
          </View>

          <View className="grid grid-cols-3 gap-2">
            {vehicleOptions.map((vehicle) => {
              const selected = vehicle.key === selectedVehicle
              return (
                <View
                  key={vehicle.key}
                  className={`rounded-2xl border p-3 ${selected ? 'border-orange-500 bg-orange-50' : 'border-gray-100 bg-white'}`}
                  onClick={() => setSelectedVehicle(vehicle.key)}
                >
                  <Text className={`block text-base font-black ${selected ? 'text-orange-600' : 'text-gray-900'}`}>
                    {vehicle.title}
                  </Text>
                  <Text className="mt-1 block text-xs text-gray-500">{vehicle.volumeLabel}</Text>
                </View>
              )
            })}
          </View>

          <View className="rounded-2xl bg-white p-4">
            <Text className="block text-sm font-semibold text-gray-900">{selectedVehicleMeta.title}</Text>
            <Text className="mt-1 block text-xs text-gray-500">{selectedVehicleMeta.subtitle}</Text>
            <Text className="mt-2 block text-xs text-gray-400">
              计价规则待接入里程价格表，当前使用临时预估单价
            </Text>
          </View>
        </CardContent>
      </Card>

      <Card className="border-0 bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-black">填写线路</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {renderAddressRow('装', formData.pickup, { type: 'pickup' }, '请输入装货地')}

          {formData.waypoints.map((waypoint, index) => (
            <View key={`waypoint-${index}`} className="space-y-2 rounded-2xl border border-dashed border-orange-200 bg-orange-50 p-3">
              {renderAddressRow('途', waypoint, { type: 'waypoint', index }, '请输入途经点')}
              <Button size="sm" variant="outline" className="w-full rounded-full" onClick={() => handleRemoveWaypoint(index)}>
                <Text className="text-xs">删除途经点</Text>
              </Button>
            </View>
          ))}

          <Button size="sm" variant="outline" className="w-full rounded-full" onClick={handleAddWaypoint}>
            <Plus size={14} color="#111827" />
            <Text className="text-xs">添加途经点</Text>
          </Button>

          {renderAddressRow('卸', formData.delivery, { type: 'delivery' }, '请输入卸货地')}

          <View className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 rounded-full" onClick={() => setShowRoutePicker(true)}>
              <Route size={14} color="#111827" />
              <Text className="text-xs">常用路线</Text>
            </Button>
            <Button size="sm" variant="outline" className="flex-1 rounded-full" onClick={() => Taro.navigateTo({ url: '/pages/merchant/address-books/index' })}>
              <Navigation size={14} color="#111827" />
              <Text className="text-xs">管理地址簿</Text>
            </Button>
          </View>
        </CardContent>
      </Card>

      <Card className="border-0 bg-white shadow-sm">
        <CardContent className="space-y-3 p-4">
          <View className="flex items-center gap-2">
            <CircleAlert size={16} color={validation.serviceable ? '#16a34a' : '#f97316'} />
            <Text className={`text-sm font-semibold ${validation.serviceable ? 'text-green-600' : 'text-orange-600'}`}>
              {validation.serviceable ? '可生成预估' : '待完善线路'}
            </Text>
          </View>
          <Text className="block text-xs text-gray-500">
            {validation.restrictionMessage}
          </Text>

          <View className="grid grid-cols-2 gap-3">
            <View className="rounded-2xl bg-gray-50 p-4">
              <Text className="block text-xs text-gray-500">预估里程</Text>
              <Text className="mt-1 block text-2xl font-black text-gray-900">
                {estimatedDistance == null ? '--' : `${estimatedDistance} km`}
              </Text>
            </View>
            <View className="rounded-2xl bg-orange-50 p-4">
              <Text className="block text-xs text-orange-500">实时预估</Text>
              <Text className="mt-1 block text-2xl font-black text-orange-600">
                {formatPrice(estimatedPrice)}
              </Text>
            </View>
          </View>

          <Button
            className="w-full rounded-full bg-orange-500"
            disabled={!validation.serviceable || loading}
            onClick={handleOpenDetailStep}
          >
            <Text className="text-sm font-bold text-white">下一步，补充要求</Text>
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showAddressPicker !== null} onOpenChange={(open) => !open && setShowAddressPicker(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>从地址簿选择</DialogTitle>
          </DialogHeader>
          <View className="space-y-2">
            {addressBooks.length === 0 ? (
              <Text className="block py-8 text-center text-sm text-gray-500">请先在“我的 - 地址簿”中新增地址</Text>
            ) : (
              addressBooks.map((address) => (
                <View
                  key={address.id}
                  className="rounded-2xl border border-gray-100 p-3"
                  onClick={() => handleSelectAddress(address)}
                >
                  <View className="flex items-center justify-between">
                    <Text className="text-sm font-semibold text-gray-900">{address.address_name}</Text>
                    {address.is_default ? (
                      <Badge className="bg-green-500">
                        <Text className="text-xs text-white">默认</Text>
                      </Badge>
                    ) : null}
                  </View>
                  <Text className="mt-1 block text-xs text-gray-500">{address.address}</Text>
                </View>
              ))
            )}
          </View>
        </DialogContent>
      </Dialog>

      <Dialog open={showRoutePicker} onOpenChange={setShowRoutePicker}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>选择常用路线</DialogTitle>
          </DialogHeader>
          <View className="space-y-2">
            {favoriteRoutes.length === 0 ? (
              <Text className="block py-8 text-center text-sm text-gray-500">暂无常用路线</Text>
            ) : (
              favoriteRoutes.map((route) => (
                <View
                  key={route.id}
                  className="rounded-2xl border border-gray-100 p-3"
                  onClick={() => handleUseRoute(route)}
                >
                  <Text className="text-sm font-semibold text-gray-900">{route.route_name}</Text>
                  <Text className="mt-1 block text-xs text-gray-500">
                    {route.pickup_address?.address || '未设置起点'} → {route.delivery_address?.address || '未设置终点'}
                  </Text>
                  {route.estimated_distance ? (
                    <Text className="mt-1 block text-xs text-orange-500">历史里程 {route.estimated_distance} km</Text>
                  ) : null}
                </View>
              ))
            )}
          </View>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>补充运输要求</DialogTitle>
          </DialogHeader>
          <View className="space-y-3">
            <View>
              <Label className="mb-2 block text-sm font-medium">货物名称</Label>
              <Input
                value={formData.cargo_name}
                placeholder="例如：餐饮食材、社区快补货"
                onInput={(event) => setFormData((prev) => ({ ...prev, cargo_name: event.detail.value }))}
              />
            </View>

            <View className="grid grid-cols-2 gap-3">
              <View>
                <Label className="mb-2 block text-sm font-medium">重量(kg)</Label>
                <Input
                  type="number"
                  value={formData.weight}
                  placeholder="请输入重量"
                  onInput={(event) => setFormData((prev) => ({ ...prev, weight: event.detail.value }))}
                />
              </View>
              <View>
                <Label className="mb-2 block text-sm font-medium">体积(m³)</Label>
                <Input
                  type="number"
                  value={formData.volume}
                  placeholder="请输入体积"
                  onInput={(event) => setFormData((prev) => ({ ...prev, volume: event.detail.value }))}
                />
              </View>
            </View>

            <View>
              <Label className="mb-2 block text-sm font-medium">货物类型</Label>
              <Picker
                mode="selector"
                range={cargoTypeOptions.map((item) => item.label)}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    cargo_type: cargoTypeOptions[event.detail.value].value,
                  }))
                }
              >
                <View className="rounded-2xl bg-gray-50 px-4 py-3">
                  <Text className="text-sm text-gray-900">
                    {cargoTypeOptions.find((item) => item.value === formData.cargo_type)?.label}
                  </Text>
                </View>
              </Picker>
            </View>

            <View className="grid grid-cols-2 gap-3">
              <View>
                <Label className="mb-2 block text-sm font-medium">装货日期</Label>
                <Picker
                  mode="date"
                  value={formData.pickup_time.split(' ')[0] || ''}
                  onChange={(event) => handlePickupDateSelect(event.detail.value)}
                >
                  <View className="rounded-2xl bg-gray-50 px-4 py-3">
                    <Text className="text-sm text-gray-900">
                      {formData.pickup_time.split(' ')[0] || '请选择日期'}
                    </Text>
                  </View>
                </Picker>
              </View>
              <View>
                <Label className="mb-2 block text-sm font-medium">装货时间</Label>
                <Picker
                  mode="time"
                  value={formData.pickup_time.split(' ')[1] || ''}
                  onChange={(event) => handlePickupTimeSelect(event.detail.value)}
                >
                  <View className="rounded-2xl bg-gray-50 px-4 py-3">
                    <Text className="text-sm text-gray-900">
                      {formData.pickup_time.split(' ')[1] || '请选择时间'}
                    </Text>
                  </View>
                </Picker>
              </View>
            </View>

            <View>
              <Label className="mb-2 block text-sm font-medium">备注</Label>
              <Textarea
                value={formData.remarks}
                placeholder="例如：到点即卸、需电话联系、园区限高等"
                onInput={(event) => setFormData((prev) => ({ ...prev, remarks: event.detail.value }))}
              />
            </View>

            <Card className="border-0 bg-orange-50 shadow-none">
              <CardContent className="space-y-1 p-3">
                <Text className="block text-xs text-orange-500">本次预估</Text>
                <Text className="block text-lg font-black text-orange-600">
                  {formatPrice(estimatedPrice)}
                </Text>
                <Text className="block text-xs text-gray-500">
                  车型 {selectedVehicleMeta.title} · 线路 {estimatedDistance == null ? '--' : `${estimatedDistance} km`}
                </Text>
              </CardContent>
            </Card>

            <Button className="w-full rounded-full bg-orange-500" disabled={loading} onClick={handleSubmit}>
              <Text className="text-sm font-bold text-white">{loading ? '提交中...' : '确认发起调度'}</Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>
    </AppPageShell>
  )
}
