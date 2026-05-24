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
import { Network } from '@/network'
import Taro from '@tarojs/taro'

interface Station {
  id: string
  name: string
  address: string
  phone: string
  customer_type?: 'owned' | 'external'
}

type BusinessMode = 'enterprise_terminal' | 'community_group_buy'

const EnterprisePublishPage: FC = () => {
  const [enterpriseId, setEnterpriseId] = useState('')
  const [stations, setStations] = useState<Station[]>([])
  const [selectedStations, setSelectedStations] = useState<string[]>([])

  const [businessMode, setBusinessMode] = useState<BusinessMode>('enterprise_terminal')
  const [cargoType, setCargoType] = useState('')
  const [cargoQuantity, setCargoQuantity] = useState('')
  const [startHourIndex, setStartHourIndex] = useState(8)
  const [endHourIndex, setEndHourIndex] = useState(10)
  const [vehicleSource, setVehicleSource] = useState<'own' | 'external'>('own')

  // 时间选择器数据
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))
  const businessModeOptions: Array<{
    value: BusinessMode
    label: string
    description: string
  }> = [
    {
      value: 'enterprise_terminal',
      label: '终端配送',
      description: '企业到门店、网点、客户终端',
    },
    {
      value: 'community_group_buy',
      label: '社区团购',
      description: '企业到社区团长、自提点',
    },
  ]
  const currentMode = businessModeOptions.find(option => option.value === businessMode)
  const deliveryPointLabel = businessMode === 'community_group_buy' ? '社区团长' : '终端点'

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
        title: `请选择至少一个${deliveryPointLabel}`,
        icon: 'none',
      })
      return
    }

    if (endHourIndex <= startHourIndex) {
      Taro.showToast({
        title: '结束时间必须晚于开始时间',
        icon: 'none',
      })
      return
    }

    try {
      const selectedStationObjs = stations.filter(s => selectedStations.includes(s.id))
      const deliveryPoints = selectedStationObjs.map(s => ({
        stationId: s.id,
        name: s.name,
        address: s.address,
        contact: s.name,
        phone: s.phone,
        pointType: businessMode === 'community_group_buy' ? 'community_leader' : 'terminal',
        businessMode,
        status: 'pending',
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
          businessMode,
          businessModeLabel: currentMode?.label,
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

  return (
    <View className="enterprise-publish min-h-screen bg-gray-50 pb-20">
      <View className="p-4">
        <Text className="text-2xl font-bold block mb-4">发布配送</Text>

        {/* 业务模式 */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">业务模式</CardTitle>
          </CardHeader>
          <CardContent>
            <View className="flex gap-2">
              {businessModeOptions.map(option => (
                <Button
                  key={option.value}
                  className="flex-1"
                  variant={businessMode === option.value ? 'default' : 'outline'}
                  onClick={() => {
                    setBusinessMode(option.value)
                    setSelectedStations([])
                  }}
                >
                  <View>
                    <Text className="block text-sm">{option.label}</Text>
                    <Text className="block text-xs opacity-80 mt-1">{option.description}</Text>
                  </View>
                </Button>
              ))}
            </View>
          </CardContent>
        </Card>

        {/* 货物信息 */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">货物信息</CardTitle>
          </CardHeader>
          <CardContent>
            <View className="mb-3">
              <Text className="text-sm text-gray-600 block mb-2">货物类型</Text>
              <Input
                placeholder="请输入货物类型（如：纯牛奶、酸奶）"
                value={cargoType}
                onInput={(e) => setCargoType(e.detail.value)}
              />
            </View>
            <View>
              <Text className="text-sm text-gray-600 block mb-2">数量（箱）</Text>
              <Input
                type="number"
                placeholder="请输入数量"
                value={cargoQuantity}
                onInput={(e) => setCargoQuantity(e.detail.value)}
              />
            </View>
          </CardContent>
        </Card>

        {/* 运力来源选择 */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">运力来源</CardTitle>
          </CardHeader>
          <CardContent>
            <View className="flex gap-2">
              <Button
                className="flex-1"
                variant={vehicleSource === 'own' ? 'default' : 'outline'}
                onClick={() => setVehicleSource('own')}
              >
                <Text>自有车辆</Text>
              </Button>
              <Button
                className="flex-1"
                variant={vehicleSource === 'external' ? 'default' : 'outline'}
                onClick={() => setVehicleSource('external')}
              >
                <Text>外部运力</Text>
              </Button>
            </View>
            {vehicleSource === 'external' && (
              <View className="mt-3 p-3 bg-yellow-50 rounded-lg">
                <Text className="text-xs text-yellow-800 block">
                  注意：选择外部运力后，需求将发布到接单大厅，由外部运力方接单配送。
                </Text>
              </View>
            )}
          </CardContent>
        </Card>

        {/* 配送点选择 */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">{deliveryPointLabel}选择</CardTitle>
          </CardHeader>
          <CardContent>
            {stations.length === 0 ? (
              <Text className="text-sm text-gray-500 text-center block">暂无可选{deliveryPointLabel}，请先添加点位</Text>
            ) : (
              <View className="space-y-2">
                {stations.map((station) => (
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
            )}
          </CardContent>
        </Card>

        {/* 配送时间 */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">配送时间</CardTitle>
          </CardHeader>
          <CardContent>
            <View className="mb-4">
              <Text className="text-sm text-gray-600 block mb-2">开始时间</Text>
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
              <Text className="text-sm text-gray-600 block mb-2">结束时间</Text>
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

        {/* 提交按钮 */}
        <View>
          <Button
            className="w-full"
            onClick={handleSubmit}
          >
            <Text>发布配送</Text>
          </Button>
        </View>
      </View>
    </View>
  )
}

export default EnterprisePublishPage
