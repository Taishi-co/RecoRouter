import { View, Text } from '@tarojs/components'
import { useEffect, useState } from 'react'
import type { FC } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Network } from '@/network'
import Taro from '@tarojs/taro'
import { Building2, ChartNoAxesCombined, ClipboardList, MapPinned, Route, Send, Warehouse } from 'lucide-react-taro'
import './index.css'

interface DemandStats {
  pending: number
  in_transit: number
  completed: number
  cancelled: number
  total: number
}

const emptyEnterpriseStats: DemandStats = {
  pending: 0,
  in_transit: 0,
  completed: 0,
  cancelled: 0,
  total: 0,
}

const EnterpriseHomePage: FC = () => {
  const [stats, setStats] = useState<DemandStats | null>(emptyEnterpriseStats)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const userInfo = Taro.getStorageSync('userInfo')
      if (!userInfo) {
        setStats(emptyEnterpriseStats)
        return
      }

      // 获取企业ID
      const enterpriseRes = await Network.request({
        url: `/api/enterprise/admin/${userInfo.id}`,
      })

      if (enterpriseRes.data.code === 200) {
        const entId = enterpriseRes.data.data.id

        // 加载统计数据
        const statsRes = await Network.request({
          url: '/api/demand/stats/enterprise',
          data: { enterprise_id: entId },
        })

        if (statsRes.data.code === 200) {
          setStats(statsRes.data.data)
        } else {
          setStats(emptyEnterpriseStats)
        }
      } else {
        setStats(emptyEnterpriseStats)
      }
    } catch (error) {
      console.error('加载仪表盘数据失败:', error)
      setStats(emptyEnterpriseStats)
    } finally {
      setLoading(false)
    }
  }

  const navigateToDispatch = () => {
    Taro.navigateTo({ url: '/pages/enterprise/dispatch/index' })
  }

  const navigateToPublish = () => {
    Taro.navigateTo({ url: '/pages/enterprise/publish/index' })
  }

  const navigateToStations = () => {
    console.log('点击奶站管理 - 开始跳转')

    // 直接使用 Taro.navigateTo
    Taro.navigateTo({
      url: '/pages/enterprise/stations/index',
      success: () => {
        console.log('跳转成功')
      },
      fail: (err) => {
        console.error('跳转失败:', err)
        Taro.showToast({
          title: '跳转失败',
          icon: 'none',
        })
      }
    })
  }

  const navigateToStats = () => {
    console.log('点击数据统计 - 开始跳转')
    Taro.navigateTo({
      url: '/pages/enterprise/stats/index',
      success: () => {
        console.log('跳转成功')
      },
      fail: (err) => {
        console.error('跳转失败:', err)
        Taro.showToast({
          title: '跳转失败',
          icon: 'none',
        })
      }
    })
  }

  const navigateToOrderHall = () => {
    console.log('点击接单大厅 - 开始跳转')
    Taro.navigateTo({
      url: '/pages/enterprise/order-hall/index',
      success: () => {
        console.log('跳转成功')
      },
      fail: (err) => {
        console.error('跳转失败:', err)
        Taro.showToast({
          title: '跳转失败',
          icon: 'none',
        })
      }
    })
  }

  return (
    <AppPageShell
      title="企业运营台"
      subtitle="武汉 · 今日履约 86%"
      icon={Building2}
      bottom={<BottomNav type="enterprise" active="home" />}
      className="enterprise-home"
      contentClassName="space-y-3 pb-6"
    >
      {loading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Text className="text-gray-500 text-sm">加载中...</Text>
          </CardContent>
        </Card>
      ) : (
        <View className="flex gap-2" style={{ display: 'flex', gap: '8px' }}>
          <Card className="flex-1 min-w-0 shadow-sm border-gray-100" style={{ flex: '1 1 0', minWidth: 0, overflow: 'hidden' }}>
            <CardContent className="p-3">
              <Text className="text-lg font-black text-gray-900 block">{stats?.total || 0}</Text>
              <Text className="text-xs font-semibold text-gray-500 block mt-1">今日订单</Text>
            </CardContent>
          </Card>
          <Card className="flex-1 min-w-0 shadow-sm border-gray-100" style={{ flex: '1 1 0', minWidth: 0, overflow: 'hidden' }}>
            <CardContent className="p-3">
              <Text className="text-lg font-black text-orange-600 block">{stats?.pending || 0}</Text>
              <Text className="text-xs font-semibold text-gray-500 block mt-1">待调度</Text>
            </CardContent>
          </Card>
          <Card className="flex-1 min-w-0 shadow-sm border-gray-100" style={{ flex: '1 1 0', minWidth: 0, overflow: 'hidden' }}>
            <CardContent className="p-3">
              <Text className="text-lg font-black text-blue-600 block">{stats?.in_transit || 0}</Text>
              <Text className="text-xs font-semibold text-gray-500 block mt-1">在线车辆</Text>
            </CardContent>
          </Card>
        </View>
      )}

      <Card className="shadow-sm border-gray-100 overflow-hidden">
        <CardContent className="p-4">
          <View className="flex items-center justify-between mb-3">
            <View>
              <Text className="block text-base font-black text-gray-900">实时运力热区</Text>
              <Text className="block text-xs font-semibold text-gray-500 mt-1">唐山配送中心 · 冷链车辆覆盖</Text>
            </View>
            <View className="w-9 h-9 rounded-2xl bg-blue-50 flex items-center justify-center">
              <MapPinned size={18} color="#0062FF" strokeWidth={2.2} />
            </View>
          </View>
          <View className="h-36 rounded-2xl bg-blue-50 border border-blue-100 relative overflow-hidden">
            <View className="absolute left-4 top-5 w-12 h-12 rounded-full bg-blue-200" />
            <View className="absolute right-8 top-8 w-16 h-16 rounded-full bg-orange-200" />
            <View className="absolute left-20 bottom-5 w-20 h-10 rounded-full bg-green-200" />
            <View className="absolute left-8 right-8 top-16 h-1 bg-white rounded-full" />
            <View className="absolute left-14 top-12 w-3 h-3 rounded-full bg-primary" />
            <View className="absolute right-16 top-24 w-3 h-3 rounded-full bg-orange-500" />
          </View>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-gray-100">
        <CardContent className="p-4">
          <Text className="block text-base font-black text-gray-900 mb-3">待处理</Text>
          <View className="space-y-3">
            <View className="flex items-center gap-3" onClick={navigateToDispatch}>
              <View className="w-9 h-9 rounded-2xl bg-orange-50 flex items-center justify-center">
                <Route size={17} color="#EA580C" strokeWidth={2.2} />
              </View>
              <View className="flex-1">
                <Text className="block text-sm font-bold text-gray-900">{stats?.pending || 0} 个待调度订单</Text>
                <Text className="block text-xs font-semibold text-gray-500 mt-1">按线路、车辆、时效分配</Text>
              </View>
              <Text className="text-xs font-bold text-blue-600">处理</Text>
            </View>
            <View className="flex items-center gap-3" onClick={navigateToOrderHall}>
              <View className="w-9 h-9 rounded-2xl bg-blue-50 flex items-center justify-center">
                <ClipboardList size={17} color="#0062FF" strokeWidth={2.2} />
              </View>
              <View className="flex-1">
                <Text className="block text-sm font-bold text-gray-900">外部货源实时刷新</Text>
                <Text className="block text-xs font-semibold text-gray-500 mt-1">查看可接订单与返程货源</Text>
              </View>
              <Text className="text-xs font-bold text-blue-600">进入</Text>
            </View>
            <View className="flex items-center gap-3" onClick={navigateToStats}>
              <View className="w-9 h-9 rounded-2xl bg-green-50 flex items-center justify-center">
                <ChartNoAxesCombined size={17} color="#16A34A" strokeWidth={2.2} />
              </View>
              <View className="flex-1">
                <Text className="block text-sm font-bold text-gray-900">{stats?.completed || 0} 个订单已送达</Text>
                <Text className="block text-xs font-semibold text-gray-500 mt-1">查看履约、成本、效率趋势</Text>
              </View>
              <Text className="text-xs font-bold text-blue-600">统计</Text>
            </View>
          </View>
        </CardContent>
      </Card>

      <View className="grid grid-cols-2 gap-3">
        <Button className="h-12 rounded-full" onClick={navigateToPublish}>
          <Send size={16} color="#FFFFFF" strokeWidth={2.2} />
          <Text className="text-white text-sm font-bold ml-2">发布货源</Text>
        </Button>
        <Button className="h-12 rounded-full bg-white border border-gray-200" variant="outline" onClick={navigateToStations}>
          <Warehouse size={16} color="#0062FF" strokeWidth={2.2} />
          <Text className="text-gray-900 text-sm font-bold ml-2">站点管理</Text>
        </Button>
      </View>
    </AppPageShell>
  )
}

export default EnterpriseHomePage
