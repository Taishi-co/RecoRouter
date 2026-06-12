import { useEffect } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ChevronLeft } from 'lucide-react-taro'
import { MallBrandMark, MallPage, MallPrimaryButton } from '../mall-ui'

export default function MallGroupLeaderPage() {
  useEffect(() => {
    Taro.redirectTo({ url: '/pages/mall/profile/index' })
  }, [])

  return (
    <MallPage active="mine">
      <View className="mall-back-row">
        <ChevronLeft size={24} color="#1F2D1F" onClick={() => Taro.navigateBack()} />
        <View className="mall-back-brand">
          <MallBrandMark compact />
          <Text className="mall-breadcrumb">叁友甄选 / 我的</Text>
        </View>
      </View>
      <Text className="mall-page-title">我的</Text>
      <Text className="mall-page-subtitle">当前商城订单仅支持送货到家。</Text>
      <View style={{ marginTop: 18 }}>
        <MallPrimaryButton onClick={() => Taro.redirectTo({ url: '/pages/mall/profile/index' })}>
          <Text>返回我的</Text>
        </MallPrimaryButton>
      </View>
    </MallPage>
  )
}
