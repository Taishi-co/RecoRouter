import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, User, Phone, Lock, LogOut } from 'lucide-react-taro'
import { Network } from '@/network'

interface UserInfo {
  id: string
  username: string
  phone: string
  nickname: string
  avatar_url: string
  gender: string
  birthday: string
  role: string
}

export default function AccountSettings() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUserInfo()
  }, [])

  const loadUserInfo = async () => {
    try {
      const storedUserInfo = Taro.getStorageSync('userInfo')
      const res = await Network.request({
        url: '/api/account-settings/profile',
        method: 'GET',
        data: { user_id: storedUserInfo.id }
      })

      console.log('[AccountSettings] 用户信息响应:', res.data)

      if (res.data.code === 200) {
        setUserInfo(res.data.data)
      }
    } catch (error) {
      console.error('[AccountSettings] 加载用户信息失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    Taro.navigateBack()
  }

  const handleNavigate = (url: string) => {
    Taro.navigateTo({ url })
  }

  const handleLogout = async () => {
    try {
      const modalRes = await Taro.showModal({
        title: '确认退出',
        content: '确定要退出登录吗？'
      })

      if (modalRes.confirm) {
        const storedUserInfo = Taro.getStorageSync('userInfo')

        const res = await Network.request({
          url: '/api/account-settings/logout',
          method: 'POST',
          data: { user_id: storedUserInfo.id }
        })

        if (res.data.code === 200) {
          // 清除本地存储
          Taro.removeStorageSync('userInfo')
          Taro.removeStorageSync('token')

          // 跳转到登录页
          Taro.reLaunch({ url: '/pages/index/index' })
        }
      }
    } catch (error) {
      console.error('[AccountSettings] 退出登录失败:', error)
    }
  }

  const maskPhone = (phone: string) => {
    if (!phone) return ''
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
  }

  const getGenderText = (gender: string) => {
    const map: Record<string, string> = {
      male: '男',
      female: '女',
      secret: '保密'
    }
    return map[gender] || '保密'
  }

  if (loading) {
    return (
      <View className="min-h-screen bg-background flex items-center justify-center">
        <Text className="text-gray-500">加载中...</Text>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background">
      {/* 顶部导航栏 */}
      <View className="bg-white p-4 border-b flex items-center">
        <View onClick={handleBack} className="flex items-center gap-2">
          <ArrowLeft size={24} color="#6b7280" />
          <Text className="text-base font-medium">返回</Text>
        </View>
        <Text className="flex-1 text-center text-base font-semibold">账号设置</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* 用户信息卡片 */}
      <Card className="m-4">
        <CardContent className="p-4">
          <View className="flex items-center gap-4">
            <View className="w-16 h-16 rounded-full bg-accent flex items-center justify-center">
              {userInfo?.avatar_url ? (
                <Image
                  src={userInfo.avatar_url}
                  className="w-16 h-16 rounded-full"
                />
              ) : (
                <User size={32} color="#0062ff" />
              )}
            </View>
            <View className="flex-1">
              <Text className="block text-lg font-semibold">
                {userInfo?.nickname || userInfo?.username || '未设置昵称'}
              </Text>
              <Text className="block text-sm text-gray-500 mt-1">
                {getGenderText(userInfo?.gender || 'secret')}
                {userInfo?.birthday && ` • ${userInfo.birthday}`}
              </Text>
            </View>
          </View>
        </CardContent>
      </Card>

      {/* 设置选项 */}
      <Card className="m-4">
        <CardContent className="p-0">
          {/* 手机号管理 */}
          <View
            className="flex items-center justify-between px-4 py-4 border-b border-border active:bg-muted"
            onClick={() => handleNavigate('/pages/owner/change-phone/index')}
          >
            <View className="flex items-center gap-3">
              <Phone size={20} color="#0062ff" />
              <View>
                <Text className="block text-sm">手机号管理</Text>
                <Text className="block text-xs text-gray-400 mt-1">
                  {maskPhone(userInfo?.phone || '')}
                </Text>
              </View>
            </View>
            <Text className="text-gray-400 text-sm">›</Text>
          </View>

          {/* 密码修改 */}
          <View
            className="flex items-center justify-between px-4 py-4 border-b border-border active:bg-muted"
            onClick={() => handleNavigate('/pages/owner/change-password/index')}
          >
            <View className="flex items-center gap-3">
              <Lock size={20} color="#0062ff" />
              <Text className="block text-sm">密码修改</Text>
            </View>
            <Text className="text-gray-400 text-sm">›</Text>
          </View>

          {/* 个人信息 */}
          <View
            className="flex items-center justify-between px-4 py-4 active:bg-muted"
            onClick={() => handleNavigate('/pages/owner/profile-edit/index')}
          >
            <View className="flex items-center gap-3">
              <User size={20} color="#0062ff" />
              <Text className="block text-sm">个人信息</Text>
            </View>
            <Text className="text-gray-400 text-sm">›</Text>
          </View>
        </CardContent>
      </Card>

      {/* 退出登录 */}
      <View className="m-4">
        <Button
          className="w-full bg-red-500 text-white"
          onClick={handleLogout}
        >
          <LogOut size={20} color="#ffffff" className="mr-2" />
          <Text>退出登录</Text>
        </Button>
      </View>
    </View>
  )
}
