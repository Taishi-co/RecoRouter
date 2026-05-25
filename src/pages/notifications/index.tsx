import { useEffect, useState } from 'react'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bell, CircleX, DollarSign, ShieldCheck, CircleCheck } from 'lucide-react-taro'
import { Network } from '@/network'

interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  content: string
  related_order_id?: string
  related_demand_id?: string
  is_read: boolean
  created_at: string
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  // 获取通知列表
  const loadNotifications = async (pageNum: number = 1, isRefresh: boolean = false) => {
    if (loading) return

    setLoading(true)
    const userInfo = Taro.getStorageSync('userInfo')
    if (!userInfo || !userInfo.id) {
      setLoading(false)
      return
    }

    try {
      const res = await Network.request({
        url: '/api/notifications',
        method: 'GET',
        data: {
          user_id: userInfo.id,
          page: pageNum,
          limit: 20
        }
      })

      console.log('通知列表响应:', res.data)

      if (res.data.code === 200) {
        const newNotifications = res.data.data || []

        if (isRefresh) {
          setNotifications(newNotifications)
        } else {
          setNotifications(prev => [...prev, ...newNotifications])
        }

        setHasMore(newNotifications.length >= 20)
      } else {
        Taro.showToast({
          title: res.data.message || '加载失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('加载通知失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  // 获取未读数量
  const loadUnreadCount = async () => {
    const userInfo = Taro.getStorageSync('userInfo')
    if (!userInfo || !userInfo.id) return

    try {
      const res = await Network.request({
        url: '/api/notifications/unread-count',
        method: 'GET',
        data: { user_id: userInfo.id }
      })

      if (res.data.code === 200) {
        setUnreadCount(res.data.data.unreadCount || 0)
      }
    } catch (error) {
      console.error('加载未读数量失败:', error)
    }
  }

  // 标记单条为已读
  const handleMarkAsRead = async (id: string) => {
    const userInfo = Taro.getStorageSync('userInfo')
    if (!userInfo || !userInfo.id) return

    try {
      const res = await Network.request({
        url: `/api/notifications/${id}/mark-read`,
        method: 'PUT',
        data: { user_id: userInfo.id }
      })

      if (res.data.code === 200) {
        // 更新本地状态
        setNotifications(prev =>
          prev.map(notif =>
            notif.id === id ? { ...notif, is_read: true } : notif
          )
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('标记已读失败:', error)
    }
  }

  // 批量标记为已读
  const handleMarkAllAsRead = async () => {
    const userInfo = Taro.getStorageSync('userInfo')
    if (!userInfo || !userInfo.id) return

    try {
      const res = await Network.request({
        url: '/api/notifications/mark-all-read',
        method: 'PUT',
        data: { user_id: userInfo.id }
      })

      if (res.data.code === 200) {
        setNotifications(prev =>
          prev.map(notif => ({ ...notif, is_read: true }))
        )
        setUnreadCount(0)
        Taro.showToast({
          title: '已全部标记为已读',
          icon: 'success'
        })
      }
    } catch (error) {
      console.error('批量标记已读失败:', error)
      Taro.showToast({
        title: '操作失败',
        icon: 'none'
      })
    }
  }

  // 点击通知跳转
  const handleNotificationClick = (notification: Notification) => {
    // 标记为已读
    if (!notification.is_read) {
      handleMarkAsRead(notification.id)
    }

    // 根据关联的订单或需求跳转
    const userInfo = Taro.getStorageSync('userInfo')
    if (!userInfo) return

    if (notification.related_order_id) {
      // 跳转到订单详情（根据用户角色）
      if (userInfo.role === 'owner') {
        Taro.navigateTo({
          url: `/pages/owner/orders/index`
        })
      } else if (userInfo.role === 'merchant') {
        Taro.navigateTo({
          url: `/pages/merchant/orders/index`
        })
      }
    } else if (notification.related_demand_id) {
      // 跳转到需求列表（需求方查看自己的需求）
      if (userInfo.role === 'merchant') {
        Taro.navigateTo({
          url: `/pages/merchant/demands/list`
        })
      }
    }
  }

  // 获取通知类型图标和颜色
  const getNotificationTypeStyle = (type: string) => {
    switch (type) {
      case 'order_accepted':
        return { icon: DollarSign, color: '#22c55e', bgColor: '#dcfce7' }
      case 'order_cancelled':
        return { icon: CircleX, color: '#ef4444', bgColor: '#fee2e2' }
      case 'fare_confirmed':
        return { icon: DollarSign, color: '#22c55e', bgColor: '#dcfce7' }
      case 'payment_received':
        return { icon: DollarSign, color: '#3b82f6', bgColor: '#dbeafe' }
      case 'commission_confirmed':
        return { icon: ShieldCheck, color: '#8b5cf6', bgColor: '#ede9fe' }
      case 'order_completed':
        return { icon: CircleCheck, color: '#10b981', bgColor: '#d1fae5' }
      default:
        return { icon: Bell, color: '#6b7280', bgColor: '#f3f4f6' }
    }
  }

  // 下拉刷新
  usePullDownRefresh(async () => {
    await Promise.all([
      loadNotifications(1, true),
      loadUnreadCount()
    ])
    Taro.stopPullDownRefresh()
  })

  // 上拉加载更多
  useReachBottom(() => {
    if (!loading && hasMore) {
      const nextPage = page + 1
      setPage(nextPage)
      loadNotifications(nextPage, false)
    }
  })

  // 初始化加载
  useEffect(() => {
    loadNotifications(1, true)
    loadUnreadCount()

    // 设置导航栏标题
    Taro.setNavigationBarTitle({
      title: '通知消息'
    })
  }, [])

  return (
    <View className="min-h-screen bg-gray-50">
      {/* 顶部操作栏 */}
      <View className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-100 sticky top-0 z-10">
        <View className="flex items-center">
          <Bell size={20} color="#3b82f6" />
          <Text className="block text-base font-semibold ml-2">
            通知消息
          </Text>
          {unreadCount > 0 && (
            <Badge className="ml-2 bg-red-500 text-white">
              <Text className="text-xs">{unreadCount}</Text>
            </Badge>
          )}
        </View>
        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="text-blue-500 border-blue-500"
            onClick={handleMarkAllAsRead}
          >
            <Text className="text-xs">全部已读</Text>
          </Button>
        )}
      </View>

      {/* 通知列表 */}
      <ScrollView scrollY className="flex-1">
        <View className="p-4 space-y-3">
          {notifications.map(notification => {
            const { icon: Icon, color, bgColor } = getNotificationTypeStyle(notification.type)
            const timeText = formatTime(notification.created_at)

            return (
              <Card
                key={notification.id}
                className="cursor-pointer"
                onClick={() => handleNotificationClick(notification)}
              >
                <CardContent className="p-4">
                  <View className="flex gap-3">
                    {/* 图标 */}
                    <View
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: bgColor }}
                    >
                      <Icon size={20} color={color} />
                    </View>

                    {/* 内容 */}
                    <View className="flex-1">
                      <View className="flex items-start justify-between mb-1">
                        <View className="flex items-center flex-1">
                          <Text className="text-sm font-semibold text-gray-800 flex-1">
                            {notification.title}
                          </Text>
                          {!notification.is_read && (
                            <View className="w-2 h-2 rounded-full bg-red-500 ml-2 flex-shrink-0" />
                          )}
                        </View>
                      </View>

                      <Text className="block text-xs text-gray-600 mb-2 leading-relaxed">
                        {notification.content}
                      </Text>

                      <Text className="block text-xs text-gray-400">
                        {timeText}
                      </Text>
                    </View>
                  </View>
                </CardContent>
              </Card>
            )
          })}

          {!loading && notifications.length === 0 && (
            <View className="flex flex-col items-center justify-center py-20">
              <Bell size={48} color="#9ca3af" />
              <Text className="block text-sm text-gray-500 mt-4">
                暂无通知消息
              </Text>
            </View>
          )}

          {loading && notifications.length > 0 && (
            <View className="text-center py-4">
              <Text className="text-xs text-gray-400">
                加载中...
              </Text>
            </View>
          )}

          {!hasMore && notifications.length > 0 && (
            <View className="text-center py-4">
              <Text className="text-xs text-gray-400">
                没有更多了
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

// 格式化时间
function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) {
    return '刚刚'
  } else if (minutes < 60) {
    return `${minutes}分钟前`
  } else if (hours < 24) {
    return `${hours}小时前`
  } else if (days < 7) {
    return `${days}天前`
  } else {
    return date.toLocaleDateString()
  }
}
