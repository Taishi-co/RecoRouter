import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import { Bell, LogOut, FileText, Package, ChartArea, MapPin, Route, Copy, Clock, Car, Users } from 'lucide-react-taro'

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

  const menuItems = [
    {
      id: 'publish',
      title: '发布需求',
      icon: <FileText size={20} color="#0062ff" />,
      onClick: () => Taro.navigateTo({ url: '/pages/merchant/demands/publish' })
    },
    {
      id: 'rentals',
      title: '租车大厅',
      icon: <Car size={20} color="#10b981" />,
      onClick: () => {
        console.log('点击租车大厅')
        Taro.navigateTo({
          url: '/pages/merchant/rentals/index',
          success: () => {
            console.log('导航到租车大厅成功')
          },
          fail: (err) => {
            console.error('导航到租车大厅失败:', err)
            Taro.showToast({
              title: '跳转失败，请重试',
              icon: 'none'
            })
          }
        })
      }
    },
    {
      id: 'rentals-history',
      title: '我的租赁',
      icon: <FileText size={20} color="#f59e0b" />,
      onClick: () => Taro.navigateTo({ url: '/pages/rentals-history/index' })
    },
    {
      id: 'demands',
      title: '我的需求',
      icon: <Package size={20} color="#0062ff" />,
      onClick: () => Taro.navigateTo({ url: '/pages/merchant/demands/list' })
    },
    {
      id: 'orders',
      title: '订单管理',
      icon: <Package size={20} color="#0062ff" />,
      onClick: () => Taro.navigateTo({ url: '/pages/merchant/orders/index' })
    },
    {
      id: 'templates',
      title: '常用模板',
      icon: <Copy size={20} color="#0062ff" />,
      onClick: () => {
        console.log('点击常用模板')
        Taro.navigateTo({
          url: '/pages/merchant/demands/templates',
          success: () => {
            console.log('导航到常用模板成功')
          },
          fail: (err) => {
            console.error('导航到常用模板失败:', err)
          }
        })
      }
    },
    {
      id: 'schedules',
      title: '定时计划',
      icon: <Clock size={20} color="#0062ff" />,
      onClick: () => {
        console.log('点击定时计划')
        Taro.navigateTo({
          url: '/pages/merchant/demands/schedules',
          success: () => {
            console.log('导航到定时计划成功')
          },
          fail: (err) => {
            console.error('导航到定时计划失败:', err)
          }
        })
      }
    },
    {
      id: 'address-books',
      title: '地址簿',
      icon: <MapPin size={20} color="#0062ff" />,
      onClick: () => Taro.navigateTo({ url: '/pages/merchant/address-books/index' })
    },
    {
      id: 'favorite-routes',
      title: '常用线路',
      icon: <Route size={20} color="#0062ff" />,
      onClick: () => Taro.navigateTo({ url: '/pages/merchant/favorite-routes/index' })
    },
    {
      id: 'stats',
      title: '数据统计',
      icon: <ChartArea size={20} color="#0062ff" />,
      onClick: () => Taro.navigateTo({ url: '/pages/merchant/stats/index' })
    },
    {
      id: 'role-switch',
      title: '角色管理',
      icon: <Users size={20} color="#8b5cf6" />,
      onClick: () => Taro.navigateTo({ url: '/pages/role-switch/index' })
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
        Taro.showToast({
          title: '请先登录',
          icon: 'none'
        })
        return
      }

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

  const handleLogout = () => {
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

  const maskPhone = (phone: string) => {
    if (!phone) return ''
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
  }

  return (
    <View className="min-h-screen bg-background">
      {/* 头部用户信息 */}
      <View className="bg-emerald-500 pt-12 pb-8 px-4">
        <View className="flex items-center gap-4">
          <Avatar className="w-16 h-16 bg-white">
            <AvatarFallback className="text-emerald-500 text-xl font-bold">
              {userInfo?.name?.charAt(0) || '需'}
            </AvatarFallback>
          </Avatar>
          <View className="flex-1">
            <Text className="block text-xl font-bold text-white mb-1">
              {userInfo?.name || '需求方'}
            </Text>
            <Text className="block text-sm text-green-100 mb-2">
              {maskPhone(userInfo?.phone || '')}
            </Text>
            <Badge className="bg-white bg-opacity-20 text-white px-2 py-1">
              <Text className="text-xs">信用积分：{creditScore}分</Text>
            </Badge>
          </View>
        </View>
      </View>

      {/* 内容区域 */}
      <View className="px-4 -mt-4">
        {/* 通知消息卡片 */}
        <Card
          className="bg-white rounded-lg shadow-sm mb-4"
          onClick={handleGoToNotifications}
        >
          <CardContent className="p-4">
            <View className="flex items-center justify-between">
              <View className="flex items-center gap-3">
                <View className="relative">
                  <Bell size={24} color="#0062ff" />
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
                className={`flex items-center justify-between px-4 py-4 active:bg-muted ${
                  index < menuItems.length - 1 ? 'border-b border-border' : ''
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
        <Card className="bg-white rounded-lg shadow-sm mb-4">
          <CardContent className="p-0">
            <View
              className="flex items-center justify-between px-4 py-4 active:bg-muted"
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

        {/* 版本信息 */}
        <View className="text-center py-4">
          <Text className="block text-xs text-gray-400">
            无人车共享运营平台 v1.0.0
          </Text>
        </View>
      </View>
    </View>
  )
}
