import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Truck, Package, Check, Plus, User } from 'lucide-react-taro'
import { Network } from '@/network'

interface UserRole {
  id: string
  user_id: string
  role: 'owner' | 'merchant'
  is_active: boolean
  status: string
  created_at: string
}

interface UserInfo {
  id: string
  phone: string
  name: string
  role: string
  token?: string
  avatar_url?: string
  switchTime?: string
}

const persistSwitchedUserInfo = (nextUserInfo: UserInfo, currentUser: UserInfo) => {
  const token = nextUserInfo.token || currentUser.token || Taro.getStorageSync('token') || currentUser.id
  const normalizedUserInfo = {
    ...currentUser,
    ...nextUserInfo,
    token: token
  }

  Taro.setStorageSync('userInfo', normalizedUserInfo)
  Taro.setStorageSync('token', token)

  return normalizedUserInfo
}

export default function RoleSwitch() {
  const [roles, setRoles] = useState<UserRole[]>([])
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(false)

  const loadUserInfo = () => {
    const user = Taro.getStorageSync('userInfo')
    if (user) {
      setUserInfo(user)
    }
    return user
  }

  const loadUserRoles = async () => {
    // 直接从存储中读取用户信息，避免依赖 userInfo 状态的异步更新
    const currentUser = Taro.getStorageSync('userInfo')

    if (!currentUser) {
      console.log('用户信息不存在，无法加载角色')
      return
    }

    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/user-roles/my-roles',
        method: 'GET',
        data: {
          userId: currentUser.id
        }
      })

      console.log('用户角色列表:', res.data)

      if (res.data && res.data.code === 200) {
        const rolesList = res.data.data || []
        console.log('设置角色列表，数量:', rolesList.length)
        setRoles(rolesList)

        if (rolesList.length === 0) {
          console.log('角色列表为空')
        }
      } else {
        console.error('加载角色失败，响应码:', res.data?.code)
      }
    } catch (error) {
      console.error('加载用户角色失败:', error)
      Taro.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUserInfo()
    loadUserRoles()
  }, [])

  const handleSwitchRole = async (roleId: string) => {
    // 直接从 storage 获取用户信息，避免依赖 state 的异步更新
    const currentUser = Taro.getStorageSync('userInfo')

    if (!currentUser) {
      Taro.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    try {
      console.log('开始切换角色 - roleId:', roleId, 'currentUser:', currentUser)

      const res = await Network.request({
        url: '/api/user-roles/switch',
        method: 'POST',
        data: {
          userId: currentUser.id,
          roleId
        }
      })

      console.log('切换角色响应:', res.data)

      if (res.data && res.data.code === 200) {
        // ✅ 强制更新 storage 中的完整用户信息
        const updatedUserInfo = persistSwitchedUserInfo(res.data.data, currentUser)

        // ✅ 记录角色切换时间（用于调试）
        Taro.setStorageSync('lastRoleSwitchTime', new Date().toISOString())

        console.log('✓ userInfo 已更新:', updatedUserInfo)
        console.log('✓ 角色切换时间:', updatedUserInfo.switchTime)

        // 更新 state
        setUserInfo(updatedUserInfo)

        // 重新加载角色列表
        await loadUserRoles()

        Taro.showToast({
          title: '角色切换成功',
          icon: 'success'
        })

        // 延迟跳转到首页
        setTimeout(() => {
          Taro.reLaunch({
            url: '/pages/index/index'
          })
        }, 1500)
      } else {
        Taro.showToast({
          title: res.data?.message || '切换失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('切换角色失败:', error)
      Taro.showToast({
        title: '切换失败，请重试',
        icon: 'none'
      })
    }
  }

  const handleCreateRole = async (role: 'owner' | 'merchant') => {
    if (!userInfo) return

    Taro.showModal({
      title: role === 'owner' ? '创建运力方角色' : '创建需求方角色',
      content: role === 'owner'
        ? '创建运力方角色后，您可以注册车辆、接单运输。确认创建吗？'
        : '创建需求方角色后，您可以发布需求、租赁车辆。确认创建吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const createRes = await Network.request({
              url: '/api/user-roles/create',
              method: 'POST',
              data: {
                userId: userInfo.id,
                role
              }
            })

            console.log('创建角色响应:', createRes.data)

            if (createRes.data && createRes.data.code === 200) {
              Taro.showToast({
                title: '角色创建成功',
                icon: 'success'
              })

              // 重新加载角色列表
              await loadUserRoles()
            } else {
              Taro.showToast({
                title: createRes.data?.message || '创建失败',
                icon: 'none'
              })
            }
          } catch (error) {
            console.error('创建角色失败:', error)
            Taro.showToast({
              title: '创建失败，请重试',
              icon: 'none'
            })
          }
        }
      }
    })
  }

  const getRoleLabel = (role: string) => {
    return role === 'owner' ? '运力方（车主）' : '需求方（租户）'
  }

  const getRoleIcon = (role: string) => {
    return role === 'owner' ? <Truck size={24} color="#3b82f6" /> : <Package size={24} color="#10b981" />
  }

  const getRoleBadgeClass = (role: string) => {
    if (role === 'owner') return 'bg-blue-500'
    if (role === 'merchant') return 'bg-green-500'
    if (role === 'admin') return 'bg-purple-500'
    return 'bg-gray-500'
  }

  const hasOwnerRole = roles.some(r => r.role === 'owner')
  const hasMerchantRole = roles.some(r => r.role === 'merchant')

  return (
    <AppPageShell
      title="角色管理"
      subtitle="RecoRouter 角色管理"
      right={
        <View className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
          <User size={20} color="#0062FF" strokeWidth={2.3} />
        </View>
      }
      bottom={<BottomNav type="common" active="profile" />}
      scroll={false}
      contentClassName="space-y-4"
    >
      {/* 用户信息 */}
      {userInfo && (
        <Card className="p-4">
          <View className="flex items-center">
            <View className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center mr-3">
              <Text className="text-white text-lg font-bold">
                {userInfo.name?.charAt(0) || '用'}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="block text-base font-semibold text-gray-900">
                {userInfo.name || '用户'}
              </Text>
              <Text className="block text-sm text-gray-500">
                {userInfo.phone}
              </Text>
            </View>
            <Badge className={getRoleBadgeClass(userInfo.role)}>
              <Text className="text-white text-xs">{getRoleLabel(userInfo.role)}</Text>
            </Badge>
          </View>
        </Card>
      )}

      {/* 角色列表 */}
      <View>
        <Text className="block text-base font-semibold text-gray-900 mb-3">我的角色</Text>

        {loading ? (
          <View className="text-center py-8">
            <Text className="block text-gray-500">加载中...</Text>
          </View>
        ) : roles.length === 0 ? (
          <Card className="p-6 text-center">
            <Text className="block text-gray-500">暂无角色</Text>
          </Card>
        ) : (
          <View className="space-y-3">
            {roles.map((roleItem) => (
              <Card
                key={roleItem.id}
                className={`p-4 ${roleItem.is_active ? 'border-2 border-blue-500' : ''}`}
              >
                <View className="flex items-center justify-between">
                  <View className="flex items-center">
                    <View className="mr-3">
                      {getRoleIcon(roleItem.role)}
                    </View>
                    <View>
                      <Text className="block text-base font-semibold text-gray-900">
                        {getRoleLabel(roleItem.role)}
                      </Text>
                      <Text className="block text-sm text-gray-500">
                        {roleItem.is_active ? '当前使用' : '未激活'}
                      </Text>
                    </View>
                  </View>
                  {roleItem.is_active ? (
                    <Badge className="bg-green-500">
                      <View className="flex items-center">
                        <Check size={12} color="#ffffff" className="mr-1" />
                        <Text className="text-white text-xs">已激活</Text>
                      </View>
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleSwitchRole(roleItem.id)}
                    >
                      <Text className="text-sm">切换</Text>
                    </Button>
                  )}
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>

      {/* 添加角色 */}
      <View>
        <Text className="block text-base font-semibold text-gray-900 mb-3">添加角色</Text>

        <View className="space-y-3">
          {!hasOwnerRole && (
            <Card
              className="p-4 cursor-pointer active:bg-gray-50"
              onClick={() => handleCreateRole('owner')}
            >
              <View className="flex items-center justify-between">
                <View className="flex items-center">
                  <View className="mr-3">
                    <Truck size={24} color="#3b82f6" />
                  </View>
                  <View>
                    <Text className="block text-base font-semibold text-gray-900">
                      运力方（车主）
                    </Text>
                    <Text className="block text-sm text-gray-500">
                      注册车辆，接单运输
                    </Text>
                  </View>
                </View>
                <Plus size={20} color="#6b7280" />
              </View>
            </Card>
          )}

          {!hasMerchantRole && (
            <Card
              className="p-4 cursor-pointer active:bg-gray-50"
              onClick={() => handleCreateRole('merchant')}
            >
              <View className="flex items-center justify-between">
                <View className="flex items-center">
                  <View className="mr-3">
                    <Package size={24} color="#10b981" />
                  </View>
                  <View>
                    <Text className="block text-base font-semibold text-gray-900">
                      需求方（租户）
                    </Text>
                    <Text className="block text-sm text-gray-500">
                      发布需求，租赁车辆
                    </Text>
                  </View>
                </View>
                <Plus size={20} color="#6b7280" />
              </View>
            </Card>
          )}

          {hasOwnerRole && hasMerchantRole && (
            <Card className="p-6 text-center">
              <Text className="block text-gray-500">您已拥有所有角色</Text>
            </Card>
          )}
        </View>
      </View>

      {/* 说明 */}
      <View>
        <Card className="p-4 bg-blue-50">
          <Text className="block text-sm text-blue-700">
            说明：一个账号可以同时拥有多个角色。切换角色后，页面和功能会根据当前角色展示不同的内容。
          </Text>
        </Card>
      </View>
    </AppPageShell>
  )
}
