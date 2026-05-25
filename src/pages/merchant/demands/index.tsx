import { useEffect } from 'react'
import Taro from '@tarojs/taro'

export default function MerchantDemands() {
  useEffect(() => {
    Taro.redirectTo({ url: '/pages/merchant/demands/list' })
  }, [])

  return null
}
