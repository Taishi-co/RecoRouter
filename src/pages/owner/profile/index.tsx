import { useEffect, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import { Camera, Settings, MessageCircle, LogOut, CreditCard, Bell, MapPin, Route, DollarSign, Clock, Users, FileText } from 'lucide-react-taro'

interface UserInfo {
  id: string
  phone: string
  name: string
  role: string
  avatar?: string
  wechat_payment_qr?: string
  created_at: string
}

export default function OwnerProfile() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [uploading, setUploading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [creditScore, setCreditScore] = useState(100)

  useEffect(() => {
    loadUserInfo()
    loadUnreadCount()
  }, [])

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
      } else {
        Taro.showToast({
          title: res.data.message || '加载失败',
          icon: 'none'
        })
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
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    }
  }

  const handleChooseImage = () => {
    Taro.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0]
        handleUploadPaymentQr(tempFilePath)
      },
      fail: (err) => {
        console.error('选择图片失败:', err)
        Taro.showToast({
          title: '选择图片失败',
          icon: 'none'
        })
      }
    })
  }

  const handleUploadPaymentQr = async (filePath: string) => {
    const savedUserInfo = Taro.getStorageSync('userInfo')
    if (!savedUserInfo) {
      Taro.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    setUploading(true)

    try {
      const res = await Network.uploadFile({
        url: '/api/auth/update-payment-qr',
        filePath,
        name: 'file',
        formData: {
          userId: savedUserInfo.id
        }
      })

      if (res.statusCode === 200) {
        const data = JSON.parse(res.data)
        if (data.code === 200) {
          Taro.showToast({
            title: '收款码上传成功',
            icon: 'success'
          })

          // 重新加载用户信息
          setTimeout(() => {
            loadUserInfo()
          }, 500)
        } else {
          Taro.showToast({
            title: data.message || '上传失败',
            icon: 'none'
          })
        }
      } else {
        Taro.showToast({
          title: '上传失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('上传收款码失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    } finally {
      setUploading(false)
    }
  }

  const handlePreviewPaymentQr = () => {
    if (!userInfo?.wechat_payment_qr) return

    Taro.previewImage({
      urls: [userInfo.wechat_payment_qr],
      current: userInfo.wechat_payment_qr
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
    <View className="min-h-screen bg-gray-100">
      {/* 头部用户信息 */}
      <View className="bg-blue-500 pt-12 pb-8 px-4">
        <View className="flex items-center gap-4">
          <Avatar className="w-16 h-16 bg-white">
            <AvatarFallback className="text-blue-500 text-xl font-bold">
              {userInfo?.name?.charAt(0) || '车'}
            </AvatarFallback>
          </Avatar>
          <View className="flex-1">
            <Text className="block text-xl font-bold text-white mb-1">
              {userInfo?.name || '车主'}
            </Text>
            <Text className="block text-sm text-blue-100 mb-2">
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
        {/* 收款码卡片 */}
        <Card className="bg-white rounded-lg shadow-sm mb-4">
          <CardHeader>
            <View className="flex items-center justify-between">
              <View className="flex items-center gap-2">
                <CreditCard size={20} color="#3b82f6" />
                <CardTitle className="text-base font-semibold">微信收款码</CardTitle>
              </View>
              <Button
                size="sm"
                variant="outline"
                onClick={handleChooseImage}
                disabled={uploading}
              >
                {uploading ? '上传中...' : userInfo?.wechat_payment_qr ? '更换' : '上传'}
              </Button>
            </View>
          </CardHeader>
          <CardContent>
            {userInfo?.wechat_payment_qr ? (
              <View className="flex flex-col items-center">
                <View
                  className="w-48 h-48 bg-gray-100 rounded-lg overflow-hidden mb-3"
                  onClick={handlePreviewPaymentQr}
                >
                  <Image
                    src={userInfo.wechat_payment_qr}
                    className="w-full h-full"
                    mode="aspectFit"
                    lazyLoad
                  />
                </View>
                <Text className="block text-xs text-gray-500">
                  点击图片查看大图
                </Text>
              </View>
            ) : (
              <View className="flex flex-col items-center py-8">
                <View className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                  <Camera size={48} color="#9ca3af" />
                </View>
                <Text className="block text-sm text-gray-500">
                  暂无收款码，请上传
                </Text>
              </View>
            )}
          </CardContent>
        </Card>

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

        {/* 功能列表 */}
        <Card className="bg-white rounded-lg shadow-sm mb-4">
          <CardContent className="p-0">
            <View
              className="flex items-center justify-between px-4 py-4 border-b border-gray-100 active:bg-gray-50"
              onClick={() => Taro.navigateTo({ url: '/pages/merchant/address-books/index' })}
            >
              <View className="flex items-center gap-3">
                <MapPin size={20} color="#3b82f6" />
                <Text className="block text-sm">地址簿</Text>
              </View>
              <Text className="block text-gray-400 text-sm">›</Text>
            </View>
            <View
              className="flex items-center justify-between px-4 py-4 border-b border-gray-100 active:bg-gray-50"
              onClick={() => Taro.navigateTo({ url: '/pages/merchant/favorite-routes/index' })}
            >
              <View className="flex items-center gap-3">
                <Route size={20} color="#3b82f6" />
                <Text className="block text-sm">常用线路</Text>
              </View>
              <Text className="block text-gray-400 text-sm">›</Text>
            </View>
            <View
              className="flex items-center justify-between px-4 py-4 border-b border-gray-100 active:bg-gray-50"
              onClick={() => Taro.navigateTo({ url: '/pages/owner/profile/revenue-stats/index' })}
            >
              <View className="flex items-center gap-3">
                <DollarSign size={20} color="#10b981" />
                <Text className="block text-sm">收益统计</Text>
              </View>
              <Text className="block text-gray-400 text-sm">›</Text>
            </View>
            <View
              className="flex items-center justify-between px-4 py-4 border-b border-gray-100 active:bg-gray-50"
              onClick={() => Taro.navigateTo({ url: '/pages/owner/rentals/pending/index' })}
            >
              <View className="flex items-center gap-3">
                <Clock size={20} color="#f59e0b" />
                <Text className="block text-sm">待确认租赁</Text>
              </View>
              <Text className="block text-gray-400 text-sm">›</Text>
            </View>
            <View
              className="flex items-center justify-between px-4 py-4 border-b border-gray-100 active:bg-gray-50"
              onClick={() => Taro.navigateTo({ url: '/pages/rentals-history/index' })}
            >
              <View className="flex items-center gap-3">
                <FileText size={20} color="#10b981" />
                <Text className="block text-sm">我的租赁</Text>
              </View>
              <Text className="block text-gray-400 text-sm">›</Text>
            </View>
            <View
              className="flex items-center justify-between px-4 py-4 border-b border-gray-100 active:bg-gray-50"
              onClick={() => Taro.navigateTo({ url: '/pages/role-switch/index' })}
            >
              <View className="flex items-center gap-3">
                <Users size={20} color="#8b5cf6" />
                <Text className="block text-sm">角色管理</Text>
              </View>
              <Text className="block text-gray-400 text-sm">›</Text>
            </View>
            <View
              className="flex items-center justify-between px-4 py-4 border-b border-gray-100 active:bg-gray-50"
              onClick={() => Taro.navigateTo({ url: '/pages/owner/account-settings/index' })}
            >
              <View className="flex items-center gap-3">
                <Settings size={20} color="#3b82f6" />
                <Text className="block text-sm">账号设置</Text>
              </View>
              <Text className="block text-gray-400 text-sm">›</Text>
            </View>
            <View
              className="flex items-center justify-between px-4 py-4 border-b border-gray-100 active:bg-gray-50"
              onClick={() => {
                Taro.showToast({
                  title: '功能开发中',
                  icon: 'none'
                })
              }}
            >
              <View className="flex items-center gap-3">
                <MessageCircle size={20} color="#3b82f6" />
                <Text className="block text-sm">帮助与反馈</Text>
              </View>
              <Text className="block text-gray-400 text-sm">›</Text>
            </View>
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
