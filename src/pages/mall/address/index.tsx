import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ChevronLeft, MapPin, Plus } from 'lucide-react-taro'
import { createMallAddress, listMallAddresses, type MallAddress } from '@/services/mall'
import { MallLocationStrip, MallPage, MallPrimaryButton } from '../mall-ui'

interface StoredUser {
  id?: string
}

export default function MallAddressPage() {
  const [addresses, setAddresses] = useState<MallAddress[]>([])
  const userId = (Taro.getStorageSync('userInfo') as StoredUser | undefined)?.id || ''

  useEffect(() => {
    loadAddresses()
  }, [])

  const loadAddresses = async () => {
    if (!userId) return
    try {
      const data = await listMallAddresses(userId)
      setAddresses(data.length > 0 ? data : fallbackAddresses(userId))
    } catch {
      setAddresses(fallbackAddresses(userId))
    }
  }

  const addDefault = async () => {
    if (!userId) return
    try {
      const address = await createMallAddress({
        userId,
        contactName: '王姐',
        addressLabel: '路北区邻里驿站',
        addressText: '路北区邻里驿站 · 今天 17:00 后可取',
        addressType: 'pickup_point',
        isDefault: addresses.length === 0,
      })
      setAddresses((current) => [address, ...current])
    } catch {
      setAddresses((current) => fallbackAddresses(userId).concat(current))
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

      <View className="mall-map-card">
        <MapPin size={30} color="#63BF54" />
        <View>
          <Text className="mall-list-title">路北区邻里驿站</Text>
          <Text className="mall-page-subtitle">今天 17:00 后可取，支持冷藏代收</Text>
        </View>
      </View>

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

      <View style={{ marginTop: 18 }}>
        <MallPrimaryButton onClick={addDefault}>
          <Plus size={18} color="#FFFFFF" />
          <Text style={{ marginLeft: 6 }}>新增常用自提点</Text>
        </MallPrimaryButton>
      </View>
    </MallPage>
  )
}

function fallbackAddresses(userId: string): MallAddress[] {
  return [
    {
      id: 'address-local-1',
      userId,
      contactName: '王姐',
      contactPhone: '138****6732',
      addressLabel: '路北区邻里驿站',
      addressText: '路北区邻里驿站 · 今天 17:00 后可取',
      addressType: 'pickup_point',
      isDefault: true,
    },
  ]
}
