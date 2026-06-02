import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import Taro from '@tarojs/taro'
import { Bell, DollarSign, LogOut, ShieldCheck, User } from 'lucide-react-taro'
import { IS_H5_ENV } from '@/presets/env'
import { ensureWebAdminSession } from '@/presets/web-admin-session'

interface AdminUserInfo {
  id?: string
  phone?: string
  name?: string
  role?: string
}

export default function AdminSettings() {
  const [userInfo, setUserInfo] = useState<AdminUserInfo | null>(null)

  useEffect(() => {
    const storedUserInfo = Taro.getStorageSync('userInfo') as AdminUserInfo | undefined
    if (!storedUserInfo || storedUserInfo.role !== 'admin') {
      Taro.showToast({
        title: '无权限访问',
        icon: 'none'
      })
      setTimeout(() => {
        Taro.redirectTo({ url: '/pages/index/index' })
      }, 1500)
      return
    }

    setUserInfo(storedUserInfo)
  }, [])

  const handleLogout = () => {
    Taro.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          Taro.clearStorageSync()
          if (IS_H5_ENV) {
            const webAdminUser = ensureWebAdminSession()
            setUserInfo(webAdminUser)
            Taro.redirectTo({ url: '/pages/admin/mall/index' })
            return
          }
          Taro.redirectTo({
            url: '/pages/index/index'
          })
        }
      }
    })
  }

  const maskPhone = (phone?: string) => {
    if (!phone) return '未绑定手机号'
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
  }

  return (
    <AppPageShell
      title="我的"
      subtitle="RecoRouter 运营端账号"
      right={
        <View className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
          <User size={20} color="#0062FF" strokeWidth={2.3} />
        </View>
      }
      bottom={<BottomNav type="admin" active="profile" />}
      contentClassName="space-y-3"
    >
      <Card className="bg-primary rounded-lg shadow-sm">
        <CardContent className="p-4">
          <View className="flex items-center gap-4">
            <Avatar className="w-16 h-16 bg-white">
              <AvatarFallback className="text-primary text-xl font-bold">
                <Text>{userInfo?.name?.charAt(0) || '管'}</Text>
              </AvatarFallback>
            </Avatar>
            <View className="flex-1 min-w-0">
              <Text className="block text-xl font-bold text-white mb-1">
                {userInfo?.name || '管理员'}
              </Text>
              <Text className="block text-sm text-blue-50">
                {maskPhone(userInfo?.phone)}
              </Text>
              <View className="mt-2">
                <Badge className="bg-white">
                  <Text className="text-xs text-primary">平台运营</Text>
                </Badge>
              </View>
            </View>
          </View>
        </CardContent>
      </Card>

      <Card className="bg-white rounded-lg shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            审核策略
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <View className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
            <View className="flex items-center gap-3">
              <View className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center">
                <ShieldCheck size={18} color="#10B981" />
              </View>
              <View>
                <Text className="block text-sm font-semibold text-gray-900">车辆资料人工复核</Text>
                <Text className="block text-xs text-gray-500 mt-1">证照、车牌、冷链能力需运营确认</Text>
              </View>
            </View>
            <Badge className="bg-green-500">
              <Text className="text-xs text-white">已启用</Text>
            </Badge>
          </View>
          <View className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
            <View className="flex items-center gap-3">
              <View className="w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center">
                <DollarSign size={18} color="#F59E0B" />
              </View>
              <View>
                <Text className="block text-sm font-semibold text-gray-900">平台服务费率</Text>
                <Text className="block text-xs text-gray-500 mt-1">标准订单按运费 10% 计提</Text>
              </View>
            </View>
            <Text className="text-sm font-bold text-orange-600">10%</Text>
          </View>
        </CardContent>
      </Card>

      <Card className="bg-white rounded-lg shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            通知配置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <View className="flex items-center gap-3 rounded-lg bg-blue-50 p-3">
            <View className="w-9 h-9 rounded-full bg-white flex items-center justify-center">
              <Bell size={18} color="#0062FF" />
            </View>
            <View className="flex-1">
              <Text className="block text-sm font-semibold text-gray-900">关键状态实时提醒</Text>
              <Text className="block text-xs text-gray-500 mt-1">接单、取消、佣金、异常审核同步推送</Text>
            </View>
          </View>
          <Button className="w-full rounded-full bg-primary" disabled>
            <Text className="text-sm font-bold text-white">保存设置</Text>
          </Button>
        </CardContent>
      </Card>

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
    </AppPageShell>
  )
}
