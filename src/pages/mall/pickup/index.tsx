import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ChevronLeft, Clock, MapPin, UserRound } from 'lucide-react-taro'
import { listMallPickupPoints, type MallPickupPoint } from '@/services/mall'
import { MallBrandMark, MallLocationStrip, MallPage, MallPrimaryButton } from '../mall-ui'

export default function MallPickupPage() {
  const [points, setPoints] = useState<MallPickupPoint[]>([])
  const [selectedId, setSelectedId] = useState('')

  useEffect(() => {
    loadPoints()
  }, [])

  const loadPoints = async () => {
    try {
      const data = await listMallPickupPoints({ status: 'active' })
      setPoints(data.length > 0 ? data : fallbackPoints())
      setSelectedId((data[0] || fallbackPoints()[0]).id)
    } catch {
      const data = fallbackPoints()
      setPoints(data)
      setSelectedId(data[0].id)
    }
  }

  const selectedPoint = points.find((point) => point.id === selectedId)

  return (
    <MallPage active="home">
      <View className="mall-back-row">
        <ChevronLeft size={24} color="#1F2D1F" onClick={() => Taro.navigateBack()} />
        <View className="mall-back-brand">
          <MallBrandMark compact />
          <Text className="mall-breadcrumb">叁友甄选 / 自提点</Text>
        </View>
      </View>
      <Text className="mall-page-title">今日自提点</Text>
      <Text className="mall-page-subtitle">选择离你最近的邻里驿站，团长到货后通知取货。</Text>

      <View className="mall-map-card">
        <MapPin size={30} color="#63BF54" />
        <View>
          <Text className="mall-list-title">{selectedPoint?.name || '绿荫花园 3 号楼团长点'}</Text>
          <Text className="mall-page-subtitle">{selectedPoint?.addressText || '距你 320m · 可冷藏代收'}</Text>
        </View>
      </View>

      {points.map((point) => (
        <View key={point.id} style={{ marginTop: 12 }}>
          <MallLocationStrip
            active={point.id === selectedId}
            title={point.name}
            subtitle={`${point.businessHours || '明日 16:00-19:00'} · ${point.groupLeaderName || point.contactName || '团长王姐'}`}
            onClick={() => setSelectedId(point.id)}
          />
        </View>
      ))}

      <View className="mall-chip-row">
        <View className="mall-chip">
          <Clock size={18} color="#63BF54" />
          <Text className="mall-chip-title">到点提醒</Text>
          <Text className="mall-chip-copy">明日 17:00</Text>
        </View>
        <View className="mall-chip">
          <UserRound size={18} color="#63BF54" />
          <Text className="mall-chip-title">团长代收</Text>
          <Text className="mall-chip-copy">冷藏优先</Text>
        </View>
        <View className="mall-chip">
          <MapPin size={18} color="#63BF54" />
          <Text className="mall-chip-title">距离最近</Text>
          <Text className="mall-chip-copy">320m</Text>
        </View>
      </View>

      <View style={{ marginTop: 18 }}>
        <MallPrimaryButton onClick={() => Taro.navigateBack()}>
          <Text>确认自提点</Text>
        </MallPrimaryButton>
      </View>
    </MallPage>
  )
}

function fallbackPoints(): MallPickupPoint[] {
  return [
    {
      id: 'pickup-1',
      name: '绿荫花园 3 号楼团长点',
      addressText: '绿荫花园西门 · 距离 320m',
      contactName: '王姐',
      businessHours: '明日 16:00-19:00',
      groupLeaderName: '团长王姐',
      status: 'active',
      isDefault: true,
    },
    {
      id: 'pickup-2',
      name: '路北区邻里驿站',
      addressText: '社区东门便利店旁 · 距离 1.2km',
      contactName: '李姐',
      businessHours: '明日 17:00-20:00',
      groupLeaderName: '李团长',
      status: 'active',
    },
  ]
}
