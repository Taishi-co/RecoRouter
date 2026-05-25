import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Car, Calendar, DollarSign, User, Clock, Check, X } from 'lucide-react-taro'
import { Network } from '@/network'

interface UserInfo {
  id: string
  name: string
  phone: string
  avatar_url?: string
}

interface Vehicle {
  id: string
  license_plate: string
  vehicle_type: string
  load_capacity: number
  volume: number
}

interface RentalRequest {
  id: string
  vehicle_id: string
  owner_id: string
  renter_id: string
  rent_type: 'monthly' | 'yearly'
  rent_start_date: string
  rent_end_date: string
  deposit_amount: number
  contract_signed: boolean
  rent_paid: boolean
  deposit_paid: boolean
  status: string
  notes?: string
  created_at: string
  vehicles: Vehicle
  renters: UserInfo
}

export default function PendingRentals() {
  const [requests, setRequests] = useState<RentalRequest[]>([])
  const [loading, setLoading] = useState(false)

  useDidShow(() => {
    loadPendingRentals()
  })

  useEffect(() => {
    loadPendingRentals()
  }, [])

  const loadPendingRentals = async () => {
    setLoading(true)
    try {
      console.log('加载车主待确认租赁申请...')

      // 直接从 storage 获取 userInfo，避免异步 state 更新问题
      const currentUser = Taro.getStorageSync('userInfo')
      if (!currentUser) {
        console.error('用户信息不存在')
        Taro.showToast({
          title: '请先登录',
          icon: 'none'
        })
        setLoading(false)
        return
      }

      console.log('当前用户 ID:', currentUser.id)

      const res = await Network.request({
        url: '/api/rentals/pending-for-owner',
        method: 'GET',
        data: {
          owner_id: currentUser.id
        }
      })

      console.log('待确认租赁申请响应:', res.data)

      if (res.data && res.data.code === 200) {
        const data = res.data.data || []
        console.log('待确认租赁申请列表:', data)
        setRequests(data)

        if (data.length === 0) {
          Taro.showToast({
            title: '暂无待确认申请',
            icon: 'none'
          })
        } else {
          Taro.showToast({
            title: `加载成功，共 ${data.length} 条待确认申请`,
            icon: 'success'
          })
        }
      } else {
        console.error('加载待确认申请失败:', res.data)
        Taro.showToast({
          title: res.data?.message || '加载失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('加载待确认申请失败:', error)
      Taro.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async (request: RentalRequest) => {
    // 直接从 storage 获取 userInfo，避免异步 state 更新问题
    const currentUser = Taro.getStorageSync('userInfo')
    if (!currentUser) {
      Taro.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    Taro.showModal({
      title: '确认租赁',
      content: `确认接受租户 ${request.renters.name} 的租赁申请？\n\n车辆：${request.vehicles.license_plate}\n租期：${formatDate(request.rent_start_date)} 至 ${formatDate(request.rent_end_date)}`,
      success: async (modalRes) => {
        if (modalRes.confirm) {
          try {
            const res = await Network.request({
              url: `/api/rentals/${request.id}/confirm-owner`,
              method: 'POST',
              data: {
                owner_id: currentUser.id,
                confirm: true
              }
            })

            console.log('确认租赁响应:', res.data)

            if (res.data && res.data.code === 200) {
              Taro.showToast({
                title: '已接受租赁申请',
                icon: 'success'
              })
              loadPendingRentals()
            } else {
              Taro.showToast({
                title: res.data?.message || '操作失败',
                icon: 'none'
              })
            }
          } catch (error) {
            console.error('确认租赁失败:', error)
            Taro.showToast({
              title: '操作失败，请重试',
              icon: 'none'
            })
          }
        }
      }
    })
  }

  const handleReject = async (request: RentalRequest) => {
    // 直接从 storage 获取 userInfo，避免异步 state 更新问题
    const currentUser = Taro.getStorageSync('userInfo')
    if (!currentUser) {
      Taro.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    Taro.showModal({
      title: '拒绝租赁',
      content: `确认拒绝租户 ${request.renters.name} 的租赁申请？\n\n拒绝后，该申请将被终止。`,
      success: async (modalRes) => {
        if (modalRes.confirm) {
          try {
            const body: any = {
              owner_id: currentUser.id,
              confirm: false,
              notes: '车主拒绝租赁'
            }

            const apiRes = await Network.request({
              url: `/api/rentals/${request.id}/confirm-owner`,
              method: 'POST',
              data: body
            })

            console.log('拒绝租赁响应:', apiRes.data)

            if (apiRes.data && apiRes.data.code === 200) {
              Taro.showToast({
                title: '已拒绝租赁申请',
                icon: 'success'
              })
              loadPendingRentals()
            } else {
              Taro.showToast({
                title: apiRes.data?.message || '操作失败',
                icon: 'none'
              })
            }
          } catch (error) {
            console.error('拒绝租赁失败:', error)
            Taro.showToast({
              title: '操作失败，请重试',
              icon: 'none'
            })
          }
        }
      }
    })
  }

  const getVehicleTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      'small_truck': '小货车',
      'medium_truck': '中型货车',
      'large_truck': '大型货车',
      'van': '面包车',
      'pickup': '皮卡'
    }
    return typeMap[type] || type
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  return (
    <View className="min-h-screen bg-gray-50 pb-4">
      {/* 头部 */}
      <View className="bg-white p-4 border-b border-gray-200">
        <Text className="text-xl font-bold text-gray-900 block">待确认租赁申请</Text>
        <Text className="block text-sm text-gray-500 mt-1">查看并处理租户的租赁申请</Text>
      </View>

      {/* 待确认列表 */}
      <View className="mx-4 mt-4 space-y-4">
        {loading ? (
          <View className="text-center py-8">
            <Text className="block text-gray-500">加载中...</Text>
          </View>
        ) : requests.length === 0 ? (
          <View className="text-center py-8">
            <Clock size={48} color="#d1d5db" className="mx-auto mb-3" />
            <Text className="block text-gray-500">暂无待确认申请</Text>
          </View>
        ) : (
          requests.map((request) => (
            <Card key={request.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <View className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">
                    租赁申请 - {request.vehicles.license_plate}
                  </CardTitle>
                  <Badge className="bg-yellow-500">待确认</Badge>
                </View>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* 车辆信息 */}
                <View className="space-y-2">
                  <View className="flex items-center text-sm text-gray-600">
                    <Car size={14} className="mr-2" color="#6b7280" />
                    <Text className="block">
                      {getVehicleTypeLabel(request.vehicles.vehicle_type)} - 载重{request.vehicles.load_capacity}kg
                    </Text>
                  </View>
                </View>

                <Separator />

                {/* 租户信息 */}
                <View>
                  <Text className="block text-sm font-medium text-gray-700 mb-2">租户信息</Text>
                  <View className="flex items-center text-sm text-gray-600">
                    <User size={14} className="mr-2" color="#6b7280" />
                    <Text className="block">{request.renters.name} - {request.renters.phone}</Text>
                  </View>
                </View>

                <Separator />

                {/* 租赁信息 */}
                <View className="bg-blue-50 p-3 rounded-lg">
                  <View className="flex items-center text-sm text-gray-700 mb-2">
                    <Calendar size={14} className="mr-2" color="#6b7280" />
                    <Text className="block font-medium">租赁信息</Text>
                  </View>
                  <View className="space-y-1">
                    <View className="flex items-center text-sm text-gray-600">
                      <Text className="block">类型：{request.rent_type === 'monthly' ? '月租' : '年租'}</Text>
                    </View>
                    <View className="flex items-center text-sm text-gray-600">
                      <Text className="block">
                        期限：{formatDate(request.rent_start_date)} 至 {formatDate(request.rent_end_date)}
                      </Text>
                    </View>
                    <View className="flex items-center text-sm text-gray-600">
                      <DollarSign size={14} className="mr-1" color="#6b7280" />
                      <Text className="block">押金：¥{request.deposit_amount}</Text>
                    </View>
                  </View>
                </View>

                {/* 备注 */}
                {request.notes && (
                  <View className="text-sm text-gray-600">
                    <Text className="block">备注：{request.notes}</Text>
                  </View>
                )}

                {/* 操作按钮 */}
                <View className="flex gap-3 pt-2">
                  <View className="flex-1">
                    <View
                      className="bg-red-50 text-red-600 rounded-lg py-2 px-4 text-center"
                      onClick={() => handleReject(request)}
                    >
                      <View className="flex items-center justify-center">
                        <X size={16} color="#ef4444" className="mr-1" />
                        <Text className="text-sm font-medium">拒绝</Text>
                      </View>
                    </View>
                  </View>
                  <View className="flex-1">
                    <View
                      className="bg-green-50 text-green-600 rounded-lg py-2 px-4 text-center"
                      onClick={() => handleConfirm(request)}
                    >
                      <View className="flex items-center justify-center">
                        <Check size={16} color="#10b981" className="mr-1" />
                        <Text className="text-sm font-medium">接受</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </CardContent>
            </Card>
          ))
        )}
      </View>
    </View>
  )
}
