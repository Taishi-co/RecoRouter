import { useEffect } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ChevronLeft } from 'lucide-react-taro'
import { MallBrandMark, MallPage, MallPrimaryButton } from '../mall-ui'

export default function MallPickupPage() {
  useEffect(() => {
    Taro.redirectTo({ url: '/pages/mall/address/index' })
  }, [])

  return (
    <MallPage active="home">
      <View className="mall-back-row">
        <ChevronLeft size={24} color="#1F2D1F" onClick={() => Taro.navigateBack()} />
        <View className="mall-back-brand">
          <MallBrandMark compact />
          <Text className="mall-breadcrumb">叁友甄选 / 送货地址</Text>
        </View>
      </View>
      <Text className="mall-page-title">送货地址</Text>
      <Text className="mall-page-subtitle">当前商城订单仅支持送货到家，请维护收货地址。</Text>
      <View style={{ marginTop: 18 }}>
        <MallPrimaryButton onClick={() => Taro.redirectTo({ url: '/pages/mall/address/index' })}>
          <Text>管理送货地址</Text>
        </MallPrimaryButton>
      </View>
    </MallPage>
  )
}
