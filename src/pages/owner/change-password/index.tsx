import { useState } from 'react'
import Taro from '@tarojs/taro'
// eslint-disable-next-line no-restricted-syntax
import { View, Text, Input as TaroInput } from '@tarojs/components'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Lock, Eye, EyeOff } from 'lucide-react-taro'
import { Network } from '@/network'

export default function ChangePassword() {
  const [formData, setFormData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [showPassword, setShowPassword] = useState({
    old: false,
    new: false,
    confirm: false
  })
  const [loading, setLoading] = useState(false)

  const handleBack = () => {
    Taro.navigateBack()
  }

  const getPasswordStrength = (password: string) => {
    if (!password) return { level: 0, text: '' }
    if (password.length < 6) return { level: 1, text: '弱' }
    if (password.length < 10) return { level: 2, text: '中' }
    return { level: 3, text: '强' }
  }

  const strength = getPasswordStrength(formData.newPassword)

  const handleChangePassword = async () => {
    if (!formData.oldPassword) {
      Taro.showToast({
        title: '请输入原密码',
        icon: 'none'
      })
      return
    }

    if (!formData.newPassword) {
      Taro.showToast({
        title: '请输入新密码',
        icon: 'none'
      })
      return
    }

    if (formData.newPassword.length < 6) {
      Taro.showToast({
        title: '新密码至少6位',
        icon: 'none'
      })
      return
    }

    if (formData.newPassword.length > 20) {
      Taro.showToast({
        title: '新密码最多20位',
        icon: 'none'
      })
      return
    }

    if (formData.newPassword !== formData.confirmPassword) {
      Taro.showToast({
        title: '两次密码输入不一致',
        icon: 'none'
      })
      return
    }

    if (formData.oldPassword === formData.newPassword) {
      Taro.showToast({
        title: '新密码不能与原密码相同',
        icon: 'none'
      })
      return
    }

    setLoading(true)

    try {
      const userInfo = Taro.getStorageSync('userInfo')

      const res = await Network.request({
        url: '/api/account-settings/change-password',
        method: 'POST',
        data: {
          user_id: userInfo.id,
          oldPassword: formData.oldPassword,
          newPassword: formData.newPassword
        }
      })

      console.log('[ChangePassword] 修改密码响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: '密码修改成功，请重新登录',
          icon: 'success',
          duration: 2000
        })

        // 清除本地存储
        setTimeout(() => {
          Taro.removeStorageSync('userInfo')
          Taro.removeStorageSync('token')
          Taro.reLaunch({ url: '/pages/index/index' })
        }, 2000)
      }
    } catch (error) {
      console.error('[ChangePassword] 修改密码失败:', error)
      Taro.showToast({
        title: '修改失败',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <View className="bg-white p-4 border-b flex items-center">
        <View onClick={handleBack} className="flex items-center gap-2">
          <ArrowLeft size={24} color="#6b7280" />
          <Text className="text-base font-medium">返回</Text>
        </View>
        <Text className="flex-1 text-center text-base font-semibold">修改密码</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* 修改密码表单 */}
      <Card className="m-4">
        <CardContent className="p-4 space-y-4">
          {/* 原密码 */}
          <View>
            <Text className="block text-sm font-medium mb-2">原密码</Text>
            <View className="bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-2">
              <TaroInput
                className="flex-1 bg-transparent"
                password={!showPassword.old}
                placeholder="请输入原密码"
                value={formData.oldPassword}
                onInput={(e) => setFormData({ ...formData, oldPassword: e.detail.value })}
                maxlength={20}
              />
              <Lock size={18} color="#6b7280" />
            </View>
          </View>

          {/* 新密码 */}
          <View>
            <Text className="block text-sm font-medium mb-2">新密码</Text>
            <View className="bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-2">
              <TaroInput
                className="flex-1 bg-transparent"
                password={!showPassword.new}
                placeholder="请输入新密码（6-20位）"
                value={formData.newPassword}
                onInput={(e) => setFormData({ ...formData, newPassword: e.detail.value })}
                maxlength={20}
              />
              <View onClick={() => setShowPassword({ ...showPassword, new: !showPassword.new })}>
                {showPassword.new ? <Eye size={18} color="#6b7280" /> : <EyeOff size={18} color="#6b7280" />}
              </View>
            </View>

            {/* 密码强度提示 */}
            {formData.newPassword && (
              <View className="flex items-center gap-2 mt-2">
                <View
                  className={`h-1 flex-1 rounded ${
                    strength.level >= 1 ? 'bg-red-500' : 'bg-gray-200'
                  }`}
                />
                <View
                  className={`h-1 flex-1 rounded ${
                    strength.level >= 2 ? 'bg-yellow-500' : 'bg-gray-200'
                  }`}
                />
                <View
                  className={`h-1 flex-1 rounded ${
                    strength.level >= 3 ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
                <Text className="text-xs text-gray-500 ml-2">
                  {strength.text}
                </Text>
              </View>
            )}
          </View>

          {/* 确认新密码 */}
          <View>
            <Text className="block text-sm font-medium mb-2">确认新密码</Text>
            <View className="bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-2">
              <TaroInput
                className="flex-1 bg-transparent"
                password={!showPassword.confirm}
                placeholder="请再次输入新密码"
                value={formData.confirmPassword}
                onInput={(e) => setFormData({ ...formData, confirmPassword: e.detail.value })}
                maxlength={20}
              />
              <View onClick={() => setShowPassword({ ...showPassword, confirm: !showPassword.confirm })}>
                {showPassword.confirm ? <Eye size={18} color="#6b7280" /> : <EyeOff size={18} color="#6b7280" />}
              </View>
            </View>
          </View>
        </CardContent>
      </Card>

      {/* 确认修改按钮 */}
      <View className="m-4">
        <Button
          className="w-full bg-blue-500 text-white"
          onClick={handleChangePassword}
          disabled={loading}
        >
          <Text>{loading ? '修改中...' : '确认修改'}</Text>
        </Button>
      </View>
    </View>
  )
}
