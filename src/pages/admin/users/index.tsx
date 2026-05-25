import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import Taro from '@tarojs/taro'
import { Network } from '@/network'

interface User {
  id: string
  phone: string
  role: string
  name: string
  id_card: string | null
  merchant_type: string | null
  address: string | null
  avatar: string | null
  status: string
  created_at: string
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [filterRole, setFilterRole] = useState('')
  const [showStatusDialog, setShowStatusDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  useEffect(() => {
    const userInfo = Taro.getStorageSync('userInfo')
    if (!userInfo || userInfo.role !== 'admin') {
      Taro.showToast({
        title: '无权限访问',
        icon: 'none'
      })
      setTimeout(() => {
        Taro.redirectTo({ url: '/pages/index/index' })
      }, 1500)
      return
    }
    loadUsers()
  }, [filterRole])

  const loadUsers = async () => {
    setLoading(true)

    try {
      let url = '/api/admin/users'
      if (filterRole) {
        url += `?role=${filterRole}`
      }

      const res = await Network.request({
        url,
        method: 'GET'
      })

      console.log('用户列表响应:', res.data)

      if (res.data.code === 200) {
        setUsers(res.data.data || [])
      } else {
        Taro.showToast({
          title: res.data.message || '加载失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('加载用户列表失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const getRoleText = (role: string) => {
    const roles: Record<string, string> = {
      owner: '车主',
      merchant: '需求方',
      admin: '运营'
    }
    return roles[role] || role
  }

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      owner: 'bg-primary',
      merchant: 'bg-emerald-500',
      admin: 'bg-indigo-500'
    }
    return colors[role] || 'bg-slate-500'
  }

  const getStatusText = (status: string) => {
    const statuses: Record<string, string> = {
      active: '正常',
      disabled: '已禁用'
    }
    return statuses[status] || status
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-emerald-500',
      disabled: 'bg-red-500'
    }
    return colors[status] || 'bg-slate-500'
  }

  const handleChangeStatus = (user: User) => {
    setSelectedUser(user)
    setShowStatusDialog(true)
  }

  const handleCloseStatusDialog = () => {
    setShowStatusDialog(false)
    setSelectedUser(null)
  }

  const handleConfirmStatusChange = async () => {
    if (!selectedUser) return

    const newStatus = selectedUser.status === 'active' ? 'disabled' : 'active'

    setLoading(true)

    try {
      const res = await Network.request({
        url: `/api/admin/users/${selectedUser.id}/status`,
        method: 'PUT',
        data: { status: newStatus }
      })

      console.log('更新状态响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: newStatus === 'active' ? '已启用' : '已禁用',
          icon: 'success'
        })

        setShowStatusDialog(false)
        setSelectedUser(null)

        // 重新加载用户列表
        loadUsers()
      } else {
        Taro.showToast({
          title: res.data.message || '更新失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('更新状态失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="min-h-screen bg-background">
      {/* 导航菜单 */}
      <View className="bg-white shadow-sm">
        <View className="px-4 py-3">
          <View className="flex gap-2">
            <Button
              size="sm"
              className="bg-primary"
            >
              <Text className="text-xs">用户管理</Text>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => Taro.navigateTo({ url: '/pages/admin/vehicles/index' })}
            >
              <Text className="text-xs">车辆审核</Text>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => Taro.navigateTo({ url: '/pages/admin/orders/index' })}
            >
              <Text className="text-xs">订单管理</Text>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => Taro.navigateTo({ url: '/pages/admin/commission/index' })}
            >
              <Text className="text-xs">佣金审核</Text>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => Taro.navigateTo({ url: '/pages/admin/stats/index' })}
            >
              <Text className="text-xs">数据统计</Text>
            </Button>
          </View>
        </View>
      </View>

      <View className="px-4 py-4">
        <Card className="bg-white rounded-lg shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              用户管理
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* 筛选条件 */}
            <View className="flex gap-2 mb-4">
              <Button
                size="sm"
                variant={filterRole === '' ? 'default' : 'outline'}
                className={filterRole === '' ? 'bg-primary' : ''}
                onClick={() => setFilterRole('')}
              >
                <Text className="text-xs">全部</Text>
              </Button>
              <Button
                size="sm"
                variant={filterRole === 'owner' ? 'default' : 'outline'}
                className={filterRole === 'owner' ? 'bg-primary' : ''}
                onClick={() => setFilterRole('owner')}
              >
                <Text className="text-xs">车主</Text>
              </Button>
              <Button
                size="sm"
                variant={filterRole === 'merchant' ? 'default' : 'outline'}
                className={filterRole === 'merchant' ? 'bg-primary' : ''}
                onClick={() => setFilterRole('merchant')}
              >
                <Text className="text-xs">需求方</Text>
              </Button>
            </View>

            {loading ? (
              <View className="text-center py-8">
                <Text className="block text-gray-500 text-sm">加载中...</Text>
              </View>
            ) : users.length === 0 ? (
              <View className="text-center py-8">
                <Text className="block text-gray-500 text-sm">暂无用户</Text>
              </View>
            ) : (
              <View className="space-y-3">
                {users.map((user) => (
                  <View key={user.id} className="bg-muted rounded-lg p-4">
                    <View className="flex justify-between items-start mb-3">
                      <View className="flex-1">
                        <Text className="block font-medium text-base mb-1">
                          {user.name}
                        </Text>
                        <View className="flex items-center gap-2 mb-2">
                          <Badge className={getRoleColor(user.role)}>
                            <Text className="text-white text-xs">
                              {getRoleText(user.role)}
                            </Text>
                          </Badge>
                          <Badge className={getStatusColor(user.status)}>
                            <Text className="text-white text-xs">
                              {getStatusText(user.status)}
                            </Text>
                          </Badge>
                        </View>
                      </View>
                      <Button
                        size="sm"
                        variant="outline"
                        className={user.status === 'active' ? 'text-red-500 border-red-500' : 'text-emerald-500 border-emerald-500'}
                        onClick={() => handleChangeStatus(user)}
                      >
                        <Text className="text-xs">
                          {user.status === 'active' ? '禁用' : '启用'}
                        </Text>
                      </Button>
                    </View>
                    <View className="space-y-1">
                      <View className="flex items-start">
                        <Text className="text-xs text-gray-500 w-16 flex-shrink-0">手机号:</Text>
                        <Text className="text-xs text-gray-700 flex-1">
                          {user.phone}
                        </Text>
                      </View>
                      {user.id_card && (
                        <View className="flex items-start">
                          <Text className="text-xs text-gray-500 w-16 flex-shrink-0">身份证:</Text>
                          <Text className="text-xs text-gray-700 flex-1">
                            {user.id_card}
                          </Text>
                        </View>
                      )}
                      {user.merchant_type && (
                        <View className="flex items-start">
                          <Text className="text-xs text-gray-500 w-16 flex-shrink-0">类型:</Text>
                          <Text className="text-xs text-gray-700 flex-1">
                            {user.merchant_type}
                          </Text>
                        </View>
                      )}
                      {user.address && (
                        <View className="flex items-start">
                          <Text className="text-xs text-gray-500 w-16 flex-shrink-0">地址:</Text>
                          <Text className="text-xs text-gray-700 flex-1">
                            {user.address}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-xs text-gray-400 mt-2">
                      注册时间: {new Date(user.created_at).toLocaleString()}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </CardContent>
        </Card>
      </View>

      {/* 状态变更确认弹窗 */}
      {showStatusDialog && selectedUser && (
        <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
          <DialogContent className="sm:max-w-md">
            <View className="p-6">
              <Text className="block text-lg font-semibold mb-2">
                确认操作
              </Text>
              <Text className="block text-sm text-gray-500 mb-4">
                确认要{selectedUser.status === 'active' ? '禁用' : '启用'}用户 {selectedUser.name} 吗？
              </Text>
              <View className="flex gap-3">
                <Button
                  className="flex-1 bg-muted"
                  onClick={handleCloseStatusDialog}
                  disabled={loading}
                >
                  <Text>取消</Text>
                </Button>
                <Button
                  className={`flex-1 ${selectedUser.status === 'active' ? 'bg-red-500' : 'bg-emerald-500'}`}
                  onClick={handleConfirmStatusChange}
                  disabled={loading}
                >
                  <Text>{loading ? '处理中...' : '确认'}</Text>
                </Button>
              </View>
            </View>
          </DialogContent>
        </Dialog>
      )}
    </View>
  )
}
