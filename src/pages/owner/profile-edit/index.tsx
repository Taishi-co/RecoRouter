import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, Picker } from '@tarojs/components'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Camera } from 'lucide-react-taro'
import { Network } from '@/network'

interface UserInfo {
  id: string
  nickname: string
  avatar_url: string
  gender: string
  birthday: string
}

export default function ProfileEdit() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [formData, setFormData] = useState({
    nickname: '',
    gender: 'secret',
    birthday: ''
  })
  const [loading, setLoading] = useState(false)

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

      console.log('[ProfileEdit] 用户信息响应:', res.data)

      if (res.data.code === 200) {
        const data = res.data.data
        setUserInfo(data)
        setFormData({
          nickname: data.nickname || '',
          gender: data.gender || 'secret',
          birthday: data.birthday || ''
        })
      }
    } catch (error) {
      console.error('[ProfileEdit] 加载用户信息失败:', error)
    }
  }

  const handleAvatarUpload = () => {
    Taro.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0]
        uploadAvatar(tempFilePath)
      }
    })
  }

  const uploadAvatar = async (filePath: string) => {
    try {
      Taro.showLoading({ title: '上传中...' })

      // 上传到服务器
      const uploadRes: any = await Network.uploadFile({
        url: '/api/upload',
        filePath,
        name: 'file'
      })

      console.log('[ProfileEdit] 上传响应:', uploadRes)

      if (uploadRes.data?.code === 200) {
        const avatarUrl = uploadRes.data.data?.url

        // 更新用户头像
        await updateProfile({ avatar_url: avatarUrl })
      }
    } catch (error) {
      console.error('[ProfileEdit] 上传头像失败:', error)
      Taro.showToast({
        title: '上传失败',
        icon: 'none'
      })
    } finally {
      Taro.hideLoading()
    }
  }

  const updateProfile = async (updateData: any) => {
    try {
      const storedUserInfo = Taro.getStorageSync('userInfo')

      const res = await Network.request({
        url: '/api/account-settings/profile',
        method: 'PUT',
        data: {
          user_id: storedUserInfo.id,
          ...updateData
        }
      })

      console.log('[ProfileEdit] 更新响应:', res.data)

      if (res.data.code === 200) {
        setUserInfo(res.data.data)

        Taro.showToast({
          title: '更新成功',
          icon: 'success'
        })
      }
    } catch (error) {
      console.error('[ProfileEdit] 更新失败:', error)
      Taro.showToast({
        title: '更新失败',
        icon: 'none'
      })
    }
  }

  const handleSave = async () => {
    if (!formData.nickname.trim()) {
      Taro.showToast({
        title: '请输入昵称',
        icon: 'none'
      })
      return
    }

    setLoading(true)

    try {
      await updateProfile({
        nickname: formData.nickname,
        gender: formData.gender,
        birthday: formData.birthday
      })

      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
    } catch (error) {
      console.error('[ProfileEdit] 保存失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGenderChange = (gender: string) => {
    setFormData({ ...formData, gender })
  }

  const handleBirthdayChange = (e: any) => {
    const date = new Date(e.detail.value)
    const formattedDate = date.toISOString().split('T')[0]
    setFormData({ ...formData, birthday: formattedDate })
  }

  return (
    <AppPageShell
      title="编辑资料"
      subtitle="RecoRouter 运力端"
      contentClassName="space-y-4"
      bottom={<BottomNav type="owner" active="profile" />}
    >
      {/* 头像设置 */}
      <Card>
        <CardContent className="p-4">
          <View className="flex items-center justify-between">
            <Text className="text-sm font-medium">头像</Text>
            <View className="flex items-center gap-3">
              <View
                className="w-20 h-20 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center"
                onClick={handleAvatarUpload}
              >
                {userInfo?.avatar_url ? (
                  <Image
                    src={userInfo.avatar_url}
                    className="w-20 h-20"
                    mode="aspectFill"
                  />
                ) : (
                  <Text className="text-gray-400">点击上传</Text>
                )}
              </View>
              <Camera size={20} color="#6b7280" />
            </View>
          </View>
        </CardContent>
      </Card>

      {/* 个人信息表单 */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* 昵称 */}
          <View>
            <Text className="block text-sm font-medium mb-2">昵称</Text>
            <View className="bg-gray-50 rounded-xl px-4 py-3">
              <Input
                className="w-full bg-transparent"
                placeholder="请输入昵称"
                value={formData.nickname}
                onInput={(e) => setFormData({ ...formData, nickname: e.detail.value })}
                maxlength={20}
              />
            </View>
          </View>

          {/* 性别 */}
          <View>
            <Text className="block text-sm font-medium mb-2">性别</Text>
            <View className="flex gap-2">
              <View
                className={`flex-1 py-3 text-center rounded-lg border ${
                  formData.gender === 'male' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white border-gray-300'
                }`}
                onClick={() => handleGenderChange('male')}
              >
                <Text className={formData.gender === 'male' ? 'text-white' : 'text-gray-700'}>男</Text>
              </View>
              <View
                className={`flex-1 py-3 text-center rounded-lg border ${
                  formData.gender === 'female' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white border-gray-300'
                }`}
                onClick={() => handleGenderChange('female')}
              >
                <Text className={formData.gender === 'female' ? 'text-white' : 'text-gray-700'}>女</Text>
              </View>
              <View
                className={`flex-1 py-3 text-center rounded-lg border ${
                  formData.gender === 'secret' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white border-gray-300'
                }`}
                onClick={() => handleGenderChange('secret')}
              >
                <Text className={formData.gender === 'secret' ? 'text-white' : 'text-gray-700'}>保密</Text>
              </View>
            </View>
          </View>

          {/* 出生日期 */}
          <View>
            <Text className="block text-sm font-medium mb-2">出生日期</Text>
            <Picker mode="date" value={formData.birthday} onChange={handleBirthdayChange}>
              <View className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
                <Text className={formData.birthday ? 'text-gray-900' : 'text-gray-400'}>
                  {formData.birthday || '请选择出生日期'}
                </Text>
                <Text className="text-gray-400">›</Text>
              </View>
            </Picker>
          </View>
        </CardContent>
      </Card>

      {/* 保存按钮 */}
      <View>
        <Button
          className="w-full bg-blue-500 text-white"
          onClick={handleSave}
          disabled={loading}
        >
          <Text>{loading ? '保存中...' : '保存资料'}</Text>
        </Button>
      </View>
    </AppPageShell>
  )
}
