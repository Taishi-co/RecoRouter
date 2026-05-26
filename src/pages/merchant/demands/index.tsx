import { useEffect } from 'react'
import { Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ClipboardList } from 'lucide-react-taro'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'

export default function MerchantDemands() {
  useEffect(() => {
    Taro.redirectTo({ url: '/pages/merchant/demands/list' })
  }, [])

  return (
    <AppPageShell
      title="需求管理"
      subtitle="正在打开我的需求"
      icon={ClipboardList}
      bottom={<BottomNav type="merchant" active="demands" />}
      contentClassName="pb-6"
    >
      <Text className="text-sm font-semibold text-gray-500">正在加载...</Text>
    </AppPageShell>
  )
}
