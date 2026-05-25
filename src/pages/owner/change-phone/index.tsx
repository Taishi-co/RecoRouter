import { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Phone } from 'lucide-react-taro'
import { Network } from '@/network'

export default function ChangePhone() {
  const [code, setCode] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [loading, setLoading] = useState(false)

  const handleBack = () => {
    Taro.navigateBack()
  }

  const sendSmsCode = async (phone: string) => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      Taro.showToast({
        title: '手机号格式不正确',
        icon: 'none'
      })
      return false
    }

    try {
      const res = await Network.request({
        url: '/api/account-settings/send-sms-code',
        method: 'POST',
        data: {
          phone,
          type: 'bind_phone'
        }
      })

      console.log('[ChangePhone] 发送验证码响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: '验证码已发送',
          icon: 'success'
        })

        // 开发环境显示验证码
        if (res.data.data?.code) {
          Taro.showModal({
            title: '测试验证码',
            content: `验证码：${res.data.data.code}`,
            showCancel: false
          })
        }

        // 开始倒计时
        setCountdown(60)
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer)
              return 0
            }
            return prev - 1
          })
        }, 1000)

        return true
      }
    } catch (error) {
      console.error('[ChangePhone] 发送验证码失败:', error)
      Taro.showToast({
        title: '发送失败',
        icon: 'none'
      })
    }

    return false
  }

  const handleNextStep = async () => {
    if (!newPhone) {
      Taro.showToast({
        title: '请输入新手机号',
        icon: 'none'
      })
      return
    }

    if (!/^1[3-9]\d{9}$/.test(newPhone)) {
      Taro.showToast({
        title: '手机号格式不正确',
        icon: 'none'
      })
      return
    }

    if (!code) {
      Taro.showToast({
        title: '请输入验证码',
        icon: 'none'
      })
      return
    }

    setLoading(true)

    try {
      const userInfo = Taro.getStorageSync('userInfo')

      const res = await Network.request({
        url: '/api/account-settings/change-phone',
        method: 'POST',
        data: {
          user_id: userInfo.id,
          code,
          newPhone
        }
      })

      console.log('[ChangePhone] 修改手机号响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: '手机号修改成功',
          icon: 'success'
        })

        // 更新本地存储的用户信息
        const updatedUserInfo = { ...userInfo, phone: newPhone }
        Taro.setStorageSync('userInfo', updatedUserInfo)

        setTimeout(() => {
          Taro.navigateBack()
        }, 1500)
      }
    } catch (error) {
      console.error('[ChangePhone] 修改手机号失败:', error)
      Taro.showToast({
        title: '修改失败',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="min-h-screen bg-background">
      {/* 顶部导航栏 */}
      <View className="bg-white p-4 border-b flex items-center">
        <View onClick={handleBack} className="flex items-center gap-2">
          <ArrowLeft size={24} color="#6b7280" />
          <Text className="text-base font-medium">返回</Text>
        </View>
        <Text className="flex-1 text-center text-base font-semibold">修改手机号</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* 修改手机号表单 */}
      <Card className="m-4">
        <CardContent className="p-4 space-y-4">
          {/* 第一步说明 */}
          <View className="text-center py-4">
            <View className="flex justify-center mb-2">
              <Phone size={32} color="#0062ff" />
            </View>
            <Text className="text-base font-medium">绑定新手机号</Text>
            <Text className="text-xs text-gray-500 mt-1">
              为了保障您的账号安全，需要验证新手机号
            </Text>
          </View>

          {/* 新手机号输入 */}
          <View>
            <Text className="block text-sm font-medium mb-2">新手机号</Text>
            <View className="bg-muted rounded-xl px-4 py-3">
              <Input
                className="w-full bg-transparent"
                type="number"
                placeholder="请输入新手机号"
                value={newPhone}
                onInput={(e) => setNewPhone(e.detail.value)}
                maxlength={11}
              />
            </View>
          </View>

          {/* 验证码输入 */}
          <View>
            <Text className="block text-sm font-medium mb-2">验证码</Text>
            <View className="flex gap-2">
              <View className="flex-1 bg-muted rounded-xl px-4 py-3">
                <Input
                  className="w-full bg-transparent"
                  type="number"
                  placeholder="请输入验证码"
                  value={code}
                  onInput={(e) => setCode(e.detail.value)}
                  maxlength={6}
                />
              </View>
              <Button
                size="sm"
                className="px-4"
                variant={countdown > 0 ? 'outline' : 'default'}
                disabled={countdown > 0 || loading}
                onClick={() => sendSmsCode(newPhone)}
              >
                <Text>
                  {countdown > 0 ? `${countdown}秒` : '获取验证码'}
                </Text>
              </Button>
            </View>
          </View>
        </CardContent>
      </Card>

      {/* 确认修改按钮 */}
      <View className="m-4">
        <Button
          className="w-full bg-primary text-white"
          onClick={handleNextStep}
          disabled={loading}
        >
          <Text>{loading ? '修改中...' : '确认修改'}</Text>
        </Button>
      </View>
    </View>
  )
}
