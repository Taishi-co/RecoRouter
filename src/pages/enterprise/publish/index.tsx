import { View, Text, Picker } from '@tarojs/components'
import { useState, useEffect } from 'react'
import type { FC } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Network } from '@/network'
import Taro from '@tarojs/taro'
import { Clock3, MapPin, Send, Sparkles } from 'lucide-react-taro'

interface Station {
  id: string
  name: string
  address: string
  phone: string
}

const demoStations: Station[] = [
  { id: 'demo-station-1', name: '光谷中心站', address: '武汉市洪山区高新大道 789 号', phone: '13800000001' },
  { id: 'demo-station-2', name: '汉口冷链仓', address: '武汉市江汉区发展大道 188 号', phone: '13800000002' },
  { id: 'demo-station-3', name: '东西湖前置仓', address: '武汉市东西湖区金银湖路 66 号', phone: '13800000003' },
]

const EnterprisePublishPage: FC = () => {
  const [enterpriseId, setEnterpriseId] = useState('')
  const [stations, setStations] = useState<Station[]>([])
  const [selectedStations, setSelectedStations] = useState<string[]>([])

  const [cargoType, setCargoType] = useState('')
  const [cargoQuantity, setCargoQuantity] = useState('')
  const [startHourIndex, setStartHourIndex] = useState(8)
  const [endHourIndex, setEndHourIndex] = useState(10)
  const [vehicleSource, setVehicleSource] = useState<'own' | 'external'>('own')

  // 时间选择器数据
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))

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

      const enterpriseRes = await Network.request({
        url: `/api/enterprise/admin/${userInfo.id}`,
      })

      if (enterpriseRes.data.code === 200) {
        const entId = enterpriseRes.data.data.id
        setEnterpriseId(entId)
        loadStations(entId)
      }
    } catch (error) {
      console.error('加载企业信息失败:', error)
    }
  }

  const loadStations = async (entId: string) => {
    try {
      const res = await Network.request({
        url: '/api/station',
        data: { enterpriseId: entId },
      })

      if (res.data.code === 200) {
        // 后端返回格式为 { list: [], total: 0, page, pageSize }
        const data = res.data.data || {}
        setStations(data.list || [])
      }
    } catch (error) {
      console.error('加载奶站列表失败:', error)
    }
  }

  const toggleStation = (stationId: string) => {
    setSelectedStations(prev => {
      if (prev.includes(stationId)) {
        return prev.filter(id => id !== stationId)
      } else {
        return [...prev, stationId]
      }
    })
  }

  const handleSubmit = async () => {
    if (!cargoType || !cargoQuantity) {
      Taro.showToast({
        title: '请填写完整信息',
        icon: 'none',
      })
      return
    }

    if (selectedStations.length === 0) {
      Taro.showToast({
        title: '请选择至少一个配送点',
        icon: 'none',
      })
      return
    }

    try {
      const stationSource = stations.length > 0 ? stations : demoStations
      const selectedStationObjs = stationSource.filter(s => selectedStations.includes(s.id))
      const deliveryPoints = selectedStationObjs.map(s => ({
        stationId: s.id,
        name: s.name,
        address: s.address,
        contact: s.name,
        phone: s.phone,
      }))

      const requestData = {
        enterpriseId: enterpriseId,
        pickupPointType: 'warehouse',
        pickupPointInfo: {
          name: '仓库',
          address: '唐山市路南区配送中心',
          latitude: 39.9,
          longitude: 116.4,
        },
        deliveryPoints: deliveryPoints,
        cargoInfo: {
          type: cargoType,
          quantity: parseInt(cargoQuantity),
          unit: '箱',
        },
        timeWindow: {
          start: `${hours[startHourIndex]}:00`,
          end: `${hours[endHourIndex]}:00`,
        },
        vehicleSource: vehicleSource,
      }

      console.log('发布配送请求数据:', JSON.stringify(requestData, null, 2))

      const res = await Network.request({
        url: '/api/demand',
        method: 'POST',
        data: requestData,
      })

      console.log('发布配送响应:', JSON.stringify(res.data, null, 2))

      if (res.data.code === 200) {
        Taro.showToast({
          title: '发布成功',
          icon: 'success',
        })
        setTimeout(() => {
          Taro.navigateBack()
        }, 1500)
      } else {
        Taro.showToast({
          title: res.data.message || '发布失败',
          icon: 'none',
        })
      }
    } catch (error) {
      console.error('发布失败:', error)
      Taro.showToast({
        title: '发布失败',
        icon: 'none',
      })
    }
  }

  const displayStations = stations.length > 0 ? stations : demoStations

  return (
    <AppPageShell
      title="发布货源"
      subtitle="三步完成企业发布"
      icon={Send}
      bottom={<BottomNav type="enterprise" active="orders" />}
      className="enterprise-publish"
      contentClassName="space-y-3 pb-6"
    >
        <Card className="shadow-sm border-gray-100">
          <CardHeader>
            <CardTitle className="text-base">发布表单</CardTitle>
          </CardHeader>
          <CardContent>
            <View className="mb-3">
              <View className="flex items-center gap-2 mb-2">
                <MapPin size={16} color="#0062FF" strokeWidth={2.2} />
                <Text className="text-sm text-gray-600">装货地</Text>
              </View>
              <View className="w-full px-4 py-3 bg-gray-50 rounded-lg">
                <Text className="text-sm font-bold text-gray-900">唐山市路南区配送中心</Text>
              </View>
            </View>
            <View className="mb-3">
              <Text className="text-sm text-gray-600 block mb-2">货物规格</Text>
              <Input
                placeholder="请输入货物类型（如：纯牛奶、酸奶）"
                value={cargoType}
                onInput={(e) => setCargoType(e.detail.value)}
              />
            </View>
            <View className="mb-3">
              <Text className="text-sm text-gray-600 block mb-2">数量（箱）</Text>
              <Input
                type="number"
                placeholder="请输入数量"
                value={cargoQuantity}
                onInput={(e) => setCargoQuantity(e.detail.value)}
              />
            </View>
            <View className="mb-3">
              <Text className="text-sm text-gray-600 block mb-2">卸货地</Text>
              <View className="space-y-2">
                {displayStations.map((station) => (
                  <View
                    key={station.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <View className="flex-1">
                      <Text className="text-sm font-medium block">{station.name}</Text>
                      <Text className="text-xs text-gray-500 block">{station.address}</Text>
                    </View>
                    <Button
                      size="sm"
                      variant={selectedStations.includes(station.id) ? 'default' : 'outline'}
                      onClick={() => toggleStation(station.id)}
                    >
                      <Text className="text-xs">
                        {selectedStations.includes(station.id) ? '已选择' : '选择'}
                      </Text>
                    </Button>
                  </View>
                ))}
              </View>
            </View>
            <View className="mb-4">
              <View className="flex items-center gap-2 mb-2">
                <Clock3 size={16} color="#0062FF" strokeWidth={2.2} />
                <Text className="text-sm text-gray-600">装车时间</Text>
              </View>
              <Picker
                mode="selector"
                range={hours}
                value={startHourIndex}
                onChange={(e) => setStartHourIndex(Number(e.detail.value))}
              >
                <View className="w-full px-4 py-3 bg-gray-50 rounded-lg">
                  <Text className="text-sm text-gray-900">
                    {hours[startHourIndex]}:00
                  </Text>
                </View>
              </Picker>
            </View>
            <View>
              <Text className="text-sm text-gray-600 block mb-2">到达时限</Text>
              <Picker
                mode="selector"
                range={hours}
                value={endHourIndex}
                onChange={(e) => setEndHourIndex(Number(e.detail.value))}
              >
                <View className="w-full px-4 py-3 bg-gray-50 rounded-lg">
                  <Text className="text-sm text-gray-900">
                    {hours[endHourIndex]}:00
                  </Text>
                </View>
              </Picker>
            </View>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-gray-100">
          <CardContent className="p-4">
            <View className="flex items-center justify-between mb-3">
              <View>
                <Text className="block text-base font-black text-gray-900">AI 运价建议</Text>
                <Text className="block text-xs font-semibold text-gray-500 mt-1">根据车型、距离、时效自动估算</Text>
              </View>
              <View className="w-9 h-9 rounded-2xl bg-blue-50 flex items-center justify-center">
                <Sparkles size={18} color="#0062FF" strokeWidth={2.2} />
              </View>
            </View>
            <View className="grid grid-cols-2 gap-3 mb-3">
              <View className="bg-blue-50 rounded-2xl p-3">
                <Text className="text-lg font-black text-blue-600 block">¥860</Text>
                <Text className="text-xs text-gray-500 block mt-1">推荐运价</Text>
              </View>
              <View className="bg-green-50 rounded-2xl p-3">
                <Text className="text-lg font-black text-green-600 block">42min</Text>
                <Text className="text-xs text-gray-500 block mt-1">预计响应</Text>
              </View>
            </View>
            <View className="flex gap-2">
              <Button
                className="flex-1 rounded-full"
                variant={vehicleSource === 'own' ? 'default' : 'outline'}
                onClick={() => setVehicleSource('own')}
              >
                <Text className={vehicleSource === 'own' ? 'text-white' : 'text-gray-900'}>自有车辆</Text>
              </Button>
              <Button
                className="flex-1 rounded-full"
                variant={vehicleSource === 'external' ? 'default' : 'outline'}
                onClick={() => setVehicleSource('external')}
              >
                <Text className={vehicleSource === 'external' ? 'text-white' : 'text-gray-900'}>外部运力</Text>
              </Button>
            </View>
          </CardContent>
        </Card>

        <Button
          className="w-full h-12 rounded-full"
          onClick={handleSubmit}
        >
          <Send size={16} color="#FFFFFF" strokeWidth={2.2} />
          <Text className="text-white text-sm font-bold ml-2">发布并匹配运力</Text>
        </Button>
    </AppPageShell>
  )
}

export default EnterprisePublishPage
