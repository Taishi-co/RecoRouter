import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import Taro from '@tarojs/taro'
import { Users } from 'lucide-react-taro'
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

const demoUsers: User[] = [
  {
    id: 'demo-user-owner',
    phone: '138****6621',
    role: 'owner',
    name: '张师傅',
    id_card: '4201**********21',
    merchant_type: null,
    address: '武汉市东西湖区',
    avatar: null,
    status: 'active',
    created_at: '2026-05-18T09:30:00+10:00',
  },
  {
    id: 'demo-user-merchant',
    phone: '156****7098',
    role: 'merchant',
    name: '上海某某贸易',
    id_card: null,
    merchant_type: '企业月结客户',
    address: '上海市宝山区钢贸园',
    avatar: null,
    status: 'active',
    created_at: '2026-05-20T11:20:00+10:00',
  },
  {
    id: 'demo-user-disabled',
    phone: '139****4488',
    role: 'owner',
    name: '王师傅',
    id_card: '3101**********88',
    merchant_type: null,
    address: '苏州市太仓市',
    avatar: null,
    status: 'disabled',
    created_at: '2026-05-22T16:45:00+10:00',
  },
]

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
      owner: 'bg-blue-500',
      merchant: 'bg-green-500',
      admin: 'bg-purple-500'
    }
    return colors[role] || 'bg-gray-500'
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
      active: 'bg-green-500',
      disabled: 'bg-red-500'
    }
    return colors[status] || 'bg-gray-500'
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

  const displayUsers = users.length > 0 ? users : demoUsers

  return (
    <AppPageShell
      title="用户管理"
      subtitle="RecoRouter 运营端"
      right={
        <View className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
          <Users size={20} color="#0062FF" strokeWidth={2.3} />
        </View>
      }
      bottom={<BottomNav type="admin" active="users" />}
      scroll={false}
      contentClassName="space-y-3"
    >
      <View>
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
                className={filterRole === '' ? 'bg-blue-500' : ''}
                onClick={() => setFilterRole('')}
              >
                <Text className="text-xs">全部</Text>
              </Button>
              <Button
                size="sm"
                variant={filterRole === 'owner' ? 'default' : 'outline'}
                className={filterRole === 'owner' ? 'bg-blue-500' : ''}
                onClick={() => setFilterRole('owner')}
              >
                <Text className="text-xs">车主</Text>
              </Button>
              <Button
                size="sm"
                variant={filterRole === 'merchant' ? 'default' : 'outline'}
                className={filterRole === 'merchant' ? 'bg-blue-500' : ''}
                onClick={() => setFilterRole('merchant')}
              >
                <Text className="text-xs">需求方</Text>
              </Button>
            </View>

            {loading ? (
              <View className="text-center py-8">
                <Text className="block text-gray-500 text-sm">加载中...</Text>
              </View>
            ) : displayUsers.length === 0 ? (
              <View className="text-center py-8">
                <Text className="block text-gray-500 text-sm">暂无用户</Text>
              </View>
            ) : (
              <View className="space-y-3">
                {displayUsers.map((user) => (
                  <View key={user.id} className="bg-gray-50 rounded-lg p-4">
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
                        className={user.status === 'active' ? 'text-red-500 border-red-500' : 'text-green-500 border-green-500'}
                        disabled={user.id.startsWith('demo-')}
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
                  className="flex-1 bg-gray-200"
                  onClick={handleCloseStatusDialog}
                  disabled={loading}
                >
                  <Text>取消</Text>
                </Button>
                <Button
                  className={`flex-1 ${selectedUser.status === 'active' ? 'bg-red-500' : 'bg-green-500'}`}
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
    </AppPageShell>
  )
}
