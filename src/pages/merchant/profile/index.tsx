import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import { Bell, LogOut, MapPin, Route, Copy, Users, User } from 'lucide-react-taro'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'

interface UserInfo {
  id: string
  phone: string
  name: string
  role: string
  avatar?: string
  created_at: string
}

export default function MerchantProfile() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [creditScore, setCreditScore] = useState(100)

  function handleLogout() {
    Taro.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          Taro.clearStorageSync()
          Taro.redirectTo({
            url: '/pages/index/index'
          })
        }
      }
    })
  }

  const menuItems = [
    {
      id: 'address-books',
      title: '地址簿',
      icon: <MapPin size={20} color="#3b82f6" />,
      onClick: () => Taro.navigateTo({ url: '/pages/merchant/address-books/index' })
    },
    {
      id: 'favorite-routes',
      title: '常用路线',
      icon: <Route size={20} color="#3b82f6" />,
      onClick: () => Taro.navigateTo({ url: '/pages/merchant/favorite-routes/index' })
    },
    {
      id: 'templates',
      title: '常用模板',
      icon: <Copy size={20} color="#3b82f6" />,
      onClick: () => {
        Taro.navigateTo({
          url: '/pages/merchant/demands/templates',
        })
      }
    },
    {
      id: 'orders',
      title: '订单中心',
      icon: <Bell size={20} color="#3b82f6" />,
      onClick: () => Taro.navigateTo({ url: '/pages/merchant/orders/index' })
    },
    {
      id: 'messages',
      title: '消息通知',
      icon: <Bell size={20} color="#f59e0b" />,
      onClick: () => Taro.navigateTo({ url: '/pages/notifications/index' })
    },
    {
      id: 'role-switch',
      title: '角色管理',
      icon: <Users size={20} color="#8b5cf6" />,
      onClick: () => Taro.navigateTo({ url: '/pages/role-switch/index' })
    },
    {
      id: 'logout',
      title: '退出登录',
      icon: <LogOut size={20} color="#ef4444" />,
      onClick: handleLogout
    }
  ]

  useEffect(() => {
    loadUserInfo()
    loadUnreadCount()
  }, [])

  const loadUserInfo = async () => {
    try {
      const savedUserInfo = Taro.getStorageSync('userInfo')
      if (!savedUserInfo) {
        setUserInfo(null)
        Taro.showToast({
          title: '请先登录',
          icon: 'none'
        })
        return
      }
      setUserInfo(savedUserInfo)

      const res = await Network.request({
        url: '/api/auth/user-info',
        method: 'GET',
        data: { userId: savedUserInfo.id }
      })

      if (res.data.code === 200) {
        setUserInfo(res.data.data)
      }

      // 加载信用积分
      try {
        const creditRes = await Network.request({
          url: '/api/cancellations/credit-score',
          method: 'GET',
          data: { user_id: savedUserInfo.id }
        })

        if (creditRes.data.code === 200) {
          setCreditScore(creditRes.data.data.credit_score || 100)
        }
      } catch (error) {
        console.error('加载信用积分失败:', error)
      }
    } catch (error) {
      console.error('加载用户信息失败:', error)
    }
  }

  const loadUnreadCount = async () => {
    const savedUserInfo = Taro.getStorageSync('userInfo')
    if (!savedUserInfo || !savedUserInfo.id) return

    try {
      const res = await Network.request({
        url: '/api/notifications/unread-count',
        method: 'GET',
        data: { user_id: savedUserInfo.id }
      })

      if (res.data.code === 200) {
        setUnreadCount(res.data.data.unreadCount || 0)
      }
    } catch (error) {
      console.error('加载未读数量失败:', error)
    }
  }

  const handleGoToNotifications = () => {
    Taro.navigateTo({
      url: '/pages/notifications/index'
    })
  }

  const maskPhone = (phone: string) => {
    if (!phone) return ''
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
  }

  return (
    <AppPageShell
      title="商户中心"
      subtitle="RecoRouter 商户小程序"
      icon={User}
      contentClassName="space-y-3"
      bottom={<BottomNav type="merchant" active="profile" />}
    >
      {/* 头部用户信息 */}
      <Card className="bg-white rounded-lg shadow-sm">
        <CardContent className="p-4">
        <View className="flex items-center gap-4">
          <Avatar className="w-16 h-16 bg-blue-50">
            <AvatarFallback className="text-blue-500 text-xl font-bold">
              {userInfo?.name?.charAt(0) || '需'}
            </AvatarFallback>
          </Avatar>
          <View className="flex-1">
            <Text className="block text-xl font-bold text-gray-900 mb-1">
              {userInfo?.name || '需求方'}
            </Text>
            <Text className="block text-sm text-gray-500 mb-2">
              {maskPhone(userInfo?.phone || '')}
            </Text>
            <Badge className="bg-blue-500 px-2 py-1">
              <Text className="text-xs text-white">信用积分：{creditScore}分</Text>
            </Badge>
          </View>
        </View>
        </CardContent>
      </Card>

      {/* 内容区域 */}
        {/* 通知消息卡片 */}
        <Card
          className="bg-white rounded-lg shadow-sm mb-4"
          onClick={handleGoToNotifications}
        >
          <CardContent className="p-4">
            <View className="flex items-center justify-between">
              <View className="flex items-center gap-3">
                <View className="relative">
                  <Bell size={24} color="#3b82f6" />
                  {unreadCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center bg-red-500 border-2 border-white rounded-full">
                      <Text className="text-xs text-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Text>
                    </Badge>
                  )}
                </View>
                <View>
                  <Text className="block text-sm font-semibold text-gray-800">
                    通知消息
                  </Text>
                  <Text className="block text-xs text-gray-500 mt-1">
                    {unreadCount > 0
                      ? `您有 ${unreadCount} 条未读消息`
                      : '暂无未读消息'
                    }
                  </Text>
                </View>
              </View>
              <Text className="block text-gray-400 text-sm">›</Text>
            </View>
          </CardContent>
        </Card>

        {/* 功能菜单 */}
        <Card className="bg-white rounded-lg shadow-sm mb-4">
          <CardContent className="p-0">
            {menuItems.map((item, index) => (
              <View
                key={item.id}
                className={`flex items-center justify-between px-4 py-4 active:bg-gray-50 ${
                  index < menuItems.length - 1 ? 'border-b border-gray-100' : ''
                }`}
                onClick={item.onClick}
              >
                <View className="flex items-center gap-3">
                  {item.icon}
                  <Text className="block text-sm">{item.title}</Text>
                </View>
                <Text className="block text-gray-400 text-sm">›</Text>
              </View>
            ))}
          </CardContent>
        </Card>

        {/* 退出登录 */}
        {userInfo && (
          <Card className="bg-white rounded-lg shadow-sm mb-4">
            <CardContent className="p-0">
              <View
                className="flex items-center justify-between px-4 py-4 active:bg-gray-50"
                onClick={handleLogout}
              >
                <View className="flex items-center gap-3">
                  <LogOut size={20} color="#ef4444" />
                  <Text className="block text-sm text-red-500">退出登录</Text>
                </View>
                <Text className="block text-gray-400 text-sm">›</Text>
              </View>
            </CardContent>
          </Card>
        )}

        {/* 版本信息 */}
        <View className="text-center py-4">
          <Text className="block text-xs text-gray-400">
            无人车共享运营平台 v1.0.0
          </Text>
        </View>
    </AppPageShell>
  )
}
