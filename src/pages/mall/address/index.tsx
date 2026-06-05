import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ChevronLeft, MapPin, Plus } from 'lucide-react-taro'
import {
  createMallAddress,
  listMallAddresses,
  listMallPickupPoints,
  type MallAddress,
  type MallPickupPoint,
} from '@/services/mall'
import { MallLocationStrip, MallPage, MallPrimaryButton } from '../mall-ui'

interface StoredUser {
  id?: string
}

export default function MallAddressPage() {
  const [addresses, setAddresses] = useState<MallAddress[]>([])
  const [pickupPoints, setPickupPoints] = useState<MallPickupPoint[]>([])
  const [loading, setLoading] = useState(false)
  const userId = (Taro.getStorageSync('userInfo') as StoredUser | undefined)?.id || ''

  useEffect(() => {
    loadAddresses()
  }, [])

  const loadAddresses = async () => {
    if (!userId) return
    setLoading(true)
    try {
      const [data, points] = await Promise.all([
        listMallAddresses(userId),
        listMallPickupPoints({ status: 'active' }),
      ])
      setAddresses(data)
      setPickupPoints(points)
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '地址加载失败',
        icon: 'none',
      })
    } finally {
      setLoading(false)
    }
  }

  const addPickupPoint = async (point?: MallPickupPoint) => {
    if (!userId) return
    const selectedPoint = point || pickupPoints[0]
    if (!selectedPoint) {
      Taro.showToast({ title: '暂无可用自提点', icon: 'none' })
      return
    }
    try {
      const address = await createMallAddress({
        userId,
        contactName: selectedPoint.contactName || selectedPoint.groupLeaderName || selectedPoint.name,
        contactPhone: selectedPoint.contactPhone || undefined,
        addressLabel: selectedPoint.name,
        addressText: selectedPoint.addressText,
        addressType: 'pickup_point',
        pickupPointId: selectedPoint.id,
        isDefault: addresses.length === 0,
      })
      setAddresses((current) => [address, ...current])
      Taro.showToast({ title: '已添加自提点', icon: 'success' })
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '新增失败',
        icon: 'none',
      })
    }
  }

  return (
    <MallPage active="mine">
      <View className="mall-back-row">
        <ChevronLeft size={24} color="#1F2D1F" onClick={() => Taro.navigateBack()} />
        <Text className="mall-breadcrumb">我的 / 自提点</Text>
      </View>
      <Text className="mall-page-title">自提点列表</Text>
      <Text className="mall-page-subtitle">常用自提点会用于购物车和确认订单。</Text>

      {pickupPoints[0] ? (
        <View className="mall-map-card" onClick={() => addPickupPoint(pickupPoints[0])}>
          <MapPin size={30} color="#63BF54" />
          <View>
            <Text className="mall-list-title">{pickupPoints[0].name}</Text>
            <Text className="mall-page-subtitle">{pickupPoints[0].addressText}</Text>
          </View>
        </View>
      ) : null}

      {addresses.map((address) => (
        <View key={address.id} style={{ marginTop: 12 }}>
          <MallLocationStrip
            active={address.isDefault || address.is_default}
            title={address.addressLabel || address.address_name || '路北区邻里驿站'}
            subtitle={address.addressText || address.address || '团长王姐 · 距离 320m，可冷藏代收'}
            onClick={() => Taro.navigateBack()}
          />
        </View>
      ))}
      {!addresses.length ? (
        <View className="mall-empty">
          <Text className="mall-empty-title">{loading ? '加载中...' : '暂无常用自提点'}</Text>
          <Text className="mall-empty-copy">请从真实自提点列表中添加。</Text>
        </View>
      ) : null}

      {pickupPoints.slice(addresses.length ? 0 : 1).map((point) => (
        <View key={point.id} style={{ marginTop: 12 }}>
          <MallLocationStrip
            title={point.name}
            subtitle={`${point.addressText}${point.groupLeaderName ? ` · ${point.groupLeaderName}` : ''}`}
            onClick={() => addPickupPoint(point)}
          />
        </View>
      ))}

      <View style={{ marginTop: 18 }}>
        <MallPrimaryButton onClick={() => addPickupPoint()}>
          <Plus size={18} color="#FFFFFF" />
          <Text style={{ marginLeft: 6 }}>新增常用自提点</Text>
        </MallPrimaryButton>
      </View>
    </MallPage>
  )
}
