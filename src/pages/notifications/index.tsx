import { useEffect, useState } from 'react'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Bell, CircleX, DollarSign, ShieldCheck, CircleCheck } from 'lucide-react-taro'
import { Network } from '@/network'
import { MallPage } from '../mall/mall-ui'

const PAGE_SIZE = 20

interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  content: string
  related_order_id?: string
  relatedOrderId?: string
  related_demand_id?: string
  relatedDemandId?: string
  related_type?: string
  relatedType?: string
  related_id?: string
  relatedId?: string
  is_read: boolean
  isRead?: boolean
  created_at: string
  createdAt?: string
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [authMissing, setAuthMissing] = useState(false)

  // 获取通知列表
  const loadNotifications = async (pageNum: number = 1, isRefresh: boolean = false) => {
    if (loading) return

    setLoading(true)
    const userInfo = Taro.getStorageSync('userInfo')
    if (!userInfo || !userInfo.id) {
      setAuthMissing(true)
      setNotifications([])
      setUnreadCount(0)
      setHasMore(false)
      setLoading(false)
      return
    }
    setAuthMissing(false)

    try {
      const res = await Network.request({
        url: '/api/notifications',
        method: 'GET',
        data: {
          user_id: userInfo.id,
          page: pageNum,
          limit: PAGE_SIZE
        }
      })

      console.log('通知列表响应:', res.data)

      if (res.data.code === 200) {
        const newNotifications = (res.data.data || []) as Notification[]

        if (isRefresh) {
          setNotifications(newNotifications)
        } else {
          setNotifications(prev => [...prev, ...newNotifications])
        }

        setPage(pageNum)
        setHasMore(newNotifications.length >= PAGE_SIZE)
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
    if (!userInfo || !userInfo.id) {
      setAuthMissing(true)
      setUnreadCount(0)
      return
    }
    setAuthMissing(false)

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
            notif.id === id ? { ...notif, is_read: true, isRead: true } : notif
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
          prev.map(notif => ({ ...notif, is_read: true, isRead: true }))
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
    if (!isNotificationRead(notification)) {
      handleMarkAsRead(notification.id)
    }

    // 根据关联的订单或需求跳转
    const userInfo = Taro.getStorageSync('userInfo')
    if (!userInfo) return

    if (isMallNotification(notification)) {
      const relatedType = relatedTypeOf(notification)
      const relatedId = relatedIdOf(notification)
      const relatedOrderId = relatedOrderIdOf(notification)
      if (relatedType === 'support_session' && relatedId) {
        const orderQuery = relatedOrderId ? `&orderId=${relatedOrderId}` : ''
        Taro.navigateTo({ url: `/pages/mall/support/index?sessionId=${relatedId}${orderQuery}` })
        return
      }
      if (relatedType === 'mall_after_sale' && relatedOrderId) {
        Taro.navigateTo({ url: `/pages/mall/after-sale/index?orderId=${relatedOrderId}` })
        return
      }
      if (relatedOrderId) {
        Taro.navigateTo({ url: `/pages/mall/order-detail/index?id=${relatedOrderId}` })
        return
      }
    }

    const relatedOrderId = relatedOrderIdOf(notification)
    const relatedDemandId = notification.relatedDemandId || notification.related_demand_id
    if (relatedOrderId) {
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
    } else if (relatedDemandId) {
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
      case 'mall_order_paid':
      case 'mall_order_dispatching':
      case 'mall_order_completed':
      case 'mall_support_message':
      case 'mall_after_sale_processed':
        return { icon: Bell, color: '#2F7E43', bgColor: '#EAF8E7' }
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
      loadNotifications(nextPage, false)
    }
  })

  // 初始化加载
  useEffect(() => {
    loadNotifications(1, true)
    loadUnreadCount()

    // 设置导航栏标题
    Taro.setNavigationBarTitle({
      title: '通知中心'
    })
  }, [])

  const displayNotifications = notifications
  const displayUnreadCount = unreadCount
  const currentRole = Taro.getStorageSync('userInfo')?.role
  const isMallSource = Taro.getCurrentInstance().router?.params?.source === 'mall'
  const bottomNav =
    currentRole === 'merchant'
      ? <BottomNav type="merchant" active="messages" />
      : <BottomNav type="common" active="messages" />

  if (isMallSource) {
    return (
      <MallPage active="mine" hideNotificationBanner>
        <View className="mall-back-row">
          <View>
            <Text className="mall-breadcrumb">叁友甄选</Text>
            <Text className="mall-page-title">消息提醒</Text>
          </View>
          {displayUnreadCount > 0 ? (
            <View className="mall-small-button" onClick={handleMarkAllAsRead}>
              <Text>全部已读</Text>
            </View>
          ) : null}
        </View>
        <View className="mall-card">
          {loading && notifications.length === 0 ? (
            <Text className="mall-empty-copy">加载中...</Text>
          ) : null}
          {displayNotifications.map((notification) => {
            const timeText = formatTime(createdAtOf(notification))
            const isRead = isNotificationRead(notification)
            return (
              <View
                key={notification.id}
                className={isRead ? 'mall-link-card' : 'mall-link-card mall-notification-unread'}
                onClick={() => handleNotificationClick(notification)}
              >
                <View className="mall-link-icon">
                  <Bell size={18} color="#2F7E43" />
                </View>
                <View className="mall-link-copy">
                  <Text className="mall-link-title">{notification.title}</Text>
                  <Text className="mall-link-subtitle">{notification.content}</Text>
                  <Text className="mall-breadcrumb">{timeText}</Text>
                </View>
                {!isRead ? <Text className="mall-status-pill">未读</Text> : null}
              </View>
            )
          })}
          {!loading && !displayNotifications.length ? (
            <View className="mall-empty">
              <Bell size={40} color="#9CA89A" />
              <Text className="mall-empty-title">{authMissing ? '请先登录' : '暂无消息提醒'}</Text>
              <Text className="mall-empty-copy">订单、售后、客服和活动消息会在这里展示。</Text>
            </View>
          ) : null}
        </View>
      </MallPage>
    )
  }

  return (
    <AppPageShell
      title="通知中心"
      subtitle="RecoRouter 通知消息"
      bottom={bottomNav}
      scroll={false}
      contentClassName="space-y-3"
      right={displayUnreadCount > 0 ? (
        <View className="flex items-center gap-2">
          <Badge className="bg-red-500">
            <Text className="text-white text-xs">{displayUnreadCount}</Text>
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="h-9 rounded-full border-blue-100 bg-blue-50 px-3 shadow-none"
            disabled={authMissing || unreadCount === 0}
            onClick={handleMarkAllAsRead}
          >
            <Text className="text-xs font-bold text-blue-600">全部已读</Text>
          </Button>
        </View>
      ) : undefined}
    >
      {/* 通知列表 */}
      <View className="space-y-3">
          {loading && notifications.length === 0 && (
            <View className="text-center py-12">
              <Text className="text-sm text-gray-500">
                加载中...
              </Text>
            </View>
          )}

          {displayNotifications.map(notification => {
            const { icon: Icon, color, bgColor } = getNotificationTypeStyle(notification.type)
            const timeText = formatTime(createdAtOf(notification))
            const isRead = isNotificationRead(notification)

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
                          {!isRead && (
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

          {!loading && authMissing && (
            <View className="flex flex-col items-center justify-center py-20">
              <Bell size={48} color="#9ca3af" />
              <Text className="block text-sm text-gray-500 mt-4">
                请先登录查看通知消息
              </Text>
              <Button
                className="mt-4 rounded-full bg-primary px-6 shadow-none"
                onClick={() => Taro.redirectTo({ url: '/pages/index/index' })}
              >
                <Text className="text-sm font-bold text-white">去登录/注册</Text>
              </Button>
            </View>
          )}

          {!loading && !authMissing && displayNotifications.length === 0 && (
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
    </AppPageShell>
  )
}

function isMallNotification(notification: Notification) {
  const relatedType = relatedTypeOf(notification)
  return notification.type?.startsWith('mall_')
    || relatedType === 'mall_order'
    || relatedType === 'mall_after_sale'
    || relatedType === 'support_session'
}

function relatedTypeOf(notification: Notification) {
  return notification.relatedType || notification.related_type || ''
}

function relatedIdOf(notification: Notification) {
  return notification.relatedId || notification.related_id || ''
}

function relatedOrderIdOf(notification: Notification) {
  return notification.relatedOrderId || notification.related_order_id || ''
}

function createdAtOf(notification: Notification) {
  return notification.createdAt || notification.created_at || ''
}

function isNotificationRead(notification: Notification) {
  return Boolean(notification.isRead ?? notification.is_read)
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
