import { useEffect, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import Taro from '@tarojs/taro'
import { Truck } from 'lucide-react-taro'
import { Network } from '@/network'

interface VehicleOwner {
  id: string
  phone: string
  role: string
  name?: string
}

interface Vehicle {
  id: string
  owner_id: string
  vehicle_type: string
  license_plate: string
  load_capacity: number
  volume: number
  battery_life: number
  has_cold_chain: boolean
  operation_area: any
  available_hours: any
  status: string
  photos: string | null
  remarks: string | null
  created_at: string
  owner?: VehicleOwner
}

const demoVehicles: Vehicle[] = [
  {
    id: 'demo-vehicle-pending',
    owner_id: 'demo-owner-1',
    vehicle_type: '9.6m 厢式货车',
    license_plate: '鄂A·7K21',
    load_capacity: 9600,
    volume: 52,
    battery_life: 420,
    has_cold_chain: false,
    operation_area: null,
    available_hours: null,
    status: 'pending',
    photos: null,
    remarks: null,
    created_at: '2026-05-26T08:30:00+10:00',
    owner: {
      id: 'demo-owner-1',
      phone: '138****6621',
      role: 'owner',
      name: '张师傅',
    },
  },
  {
    id: 'demo-vehicle-active',
    owner_id: 'demo-owner-2',
    vehicle_type: '冷藏车 8.6m',
    license_plate: '沪A·R8821',
    load_capacity: 12000,
    volume: 46,
    battery_life: 380,
    has_cold_chain: true,
    operation_area: null,
    available_hours: null,
    status: 'active',
    photos: null,
    remarks: null,
    created_at: '2026-05-24T14:10:00+10:00',
    owner: {
      id: 'demo-owner-2',
      phone: '156****7098',
      role: 'owner',
      name: '李师傅',
    },
  },
]

export default function AdminVehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState('pending')
  const [showReviewDialog, setShowReviewDialog] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [reviewReason, setReviewReason] = useState('')

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
    loadVehicles()
  }, [])

  useEffect(() => {
    loadVehicles()
  }, [filterStatus])

  const loadVehicles = async () => {
    setLoading(true)

    try {
      const res = await Network.request({
        url: '/api/vehicles',
        method: 'GET'
      })

      console.log('车辆列表响应:', res.data)

      if (res.data.code === 200) {
        const vehicleList = res.data.data || []
        const filteredVehicles = filterStatus
          ? vehicleList.filter((v: Vehicle) => v.status === filterStatus)
          : vehicleList

        console.log('过滤后的车辆列表:', filteredVehicles)
        console.log('第一个车辆的车主信息:', filteredVehicles[0]?.owner)

        setVehicles(filteredVehicles)
      } else {
        Taro.showToast({
          title: res.data.message || '加载失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('加载车辆列表失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusText = (status: string) => {
    const statuses: Record<string, string> = {
      pending: '待审核',
      active: '已通过',
      rejected: '已拒绝',
      inactive: '已禁用'
    }
    return statuses[status] || status
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-orange-500',
      active: 'bg-green-500',
      rejected: 'bg-red-500',
      inactive: 'bg-gray-500'
    }
    return colors[status] || 'bg-gray-500'
  }

  const parsePhotoUrls = (photosJson: string | null): string[] => {
    if (!photosJson) return []
    try {
      return JSON.parse(photosJson)
    } catch {
      return []
    }
  }

  const handleReview = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle)
    setShowReviewDialog(true)
    setReviewReason('')
  }

  const handleApprove = async () => {
    if (!selectedVehicle) return

    setLoading(true)

    try {
      const res = await Network.request({
        url: `/api/vehicles/${selectedVehicle.id}/review`,
        method: 'POST',
        data: {
          action: 'approve'
        }
      })

      console.log('审核通过响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: '审核通过',
          icon: 'success'
        })

        setShowReviewDialog(false)
        setSelectedVehicle(null)

        loadVehicles()
      } else {
        Taro.showToast({
          title: res.data.message || '操作失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('审核失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    if (!selectedVehicle) return

    if (!reviewReason.trim()) {
      Taro.showToast({
        title: '请输入拒绝原因',
        icon: 'none'
      })
      return
    }

    setLoading(true)

    try {
      const res = await Network.request({
        url: `/api/vehicles/${selectedVehicle.id}/review`,
        method: 'POST',
        data: {
          action: 'reject',
          reason: reviewReason
        }
      })

      console.log('审核拒绝响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: '已拒绝',
          icon: 'success'
        })

        setShowReviewDialog(false)
        setSelectedVehicle(null)
        setReviewReason('')

        loadVehicles()
      } else {
        Taro.showToast({
          title: res.data.message || '操作失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('审核失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredDemoVehicles = filterStatus
    ? demoVehicles.filter((vehicle) => vehicle.status === filterStatus)
    : demoVehicles
  const displayVehicles = vehicles.length > 0 ? vehicles : filteredDemoVehicles

  return (
    <AppPageShell
      title="车辆审核"
      subtitle="RecoRouter 运营端"
      right={
        <View className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
          <Truck size={20} color="#0062FF" strokeWidth={2.3} />
        </View>
      }
      bottom={<BottomNav type="admin" active="vehicles" />}
      scroll={false}
      contentClassName="space-y-3"
    >
      <View>
        <Card className="bg-white rounded-lg shadow-sm">
          <CardHeader>
            <View className="flex justify-between items-center">
              <CardTitle className="text-lg font-semibold">
                车辆审核
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={loadVehicles}
                disabled={loading}
              >
                <Text className="text-xs">刷新</Text>
              </Button>
            </View>
          </CardHeader>
          <CardContent>
            {/* 状态筛选 */}
            <View className="flex gap-2 mb-4">
              <Button
                size="sm"
                variant={filterStatus === 'pending' ? 'default' : 'outline'}
                className={filterStatus === 'pending' ? 'bg-orange-500' : ''}
                onClick={() => setFilterStatus('pending')}
              >
                <Text className="text-xs">待审核</Text>
              </Button>
              <Button
                size="sm"
                variant={filterStatus === 'active' ? 'default' : 'outline'}
                className={filterStatus === 'active' ? 'bg-green-500' : ''}
                onClick={() => setFilterStatus('active')}
              >
                <Text className="text-xs">已通过</Text>
              </Button>
              <Button
                size="sm"
                variant={filterStatus === 'rejected' ? 'default' : 'outline'}
                className={filterStatus === 'rejected' ? 'bg-red-500' : ''}
                onClick={() => setFilterStatus('rejected')}
              >
                <Text className="text-xs">已拒绝</Text>
              </Button>
              <Button
                size="sm"
                variant={filterStatus === '' ? 'default' : 'outline'}
                className={filterStatus === '' ? 'bg-gray-500' : ''}
                onClick={() => setFilterStatus('')}
              >
                <Text className="text-xs">全部</Text>
              </Button>
            </View>

            {loading ? (
              <View className="text-center py-8">
                <Text className="block text-gray-500 text-sm">加载中...</Text>
              </View>
            ) : displayVehicles.length === 0 ? (
              <View className="text-center py-8">
                <Text className="block text-gray-500 text-sm mb-4">
                  暂无车辆数据
                </Text>
                <Button
                  className="bg-blue-500"
                  onClick={loadVehicles}
                >
                  <Text>刷新</Text>
                </Button>
              </View>
            ) : (
              <View className="space-y-3">
                {displayVehicles.map((vehicle) => (
                  <View key={vehicle.id} className="bg-gray-50 rounded-lg p-4">
                    <View className="flex justify-between items-start mb-3">
                      <View className="flex-1">
                        <Text className="block font-medium text-base mb-1">
                          {vehicle.vehicle_type}
                        </Text>
                        <View className="flex items-center gap-2 mb-2">
                          <Badge className={getStatusColor(vehicle.status)}>
                            <Text className="text-white text-xs">
                              {getStatusText(vehicle.status)}
                            </Text>
                          </Badge>
                          {vehicle.has_cold_chain && (
                            <Badge className="bg-cyan-500">
                              <Text className="text-white text-xs">冷链</Text>
                            </Badge>
                          )}
                        </View>
                      </View>
                      <View className="flex gap-2">
                        {vehicle.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              className="bg-green-500"
                              disabled={vehicle.id.startsWith('demo-')}
                              onClick={() => handleReview(vehicle)}
                            >
                              <Text className="text-xs">审核</Text>
                            </Button>
                          </>
                        )}
                      </View>
                    </View>

                    <View className="space-y-1 text-sm text-gray-600">
                      <View>
                        <Text className="block text-gray-500 text-xs">车主</Text>
                        <Text className="block">
                          {vehicle.owner?.name || vehicle.owner?.phone || '未知'}
                        </Text>
                      </View>
                      <View>
                        <Text className="block text-gray-500 text-xs">车牌号</Text>
                        <Text className="block">{vehicle.license_plate || '未填写'}</Text>
                      </View>
                      <View>
                        <Text className="block text-gray-500 text-xs">载重</Text>
                        <Text className="block">{vehicle.load_capacity} kg</Text>
                      </View>
                      <View>
                        <Text className="block text-gray-500 text-xs">容积</Text>
                        <Text className="block">{vehicle.volume} m³</Text>
                      </View>
                      <View>
                        <Text className="block text-gray-500 text-xs">续航</Text>
                        <Text className="block">{vehicle.battery_life} km</Text>
                      </View>
                      <View>
                        <Text className="block text-gray-500 text-xs">注册时间</Text>
                        <Text className="block">
                          {new Date(vehicle.created_at).toLocaleString('zh-CN')}
                        </Text>
                      </View>
                      {vehicle.photos && parsePhotoUrls(vehicle.photos).length > 0 && (
                        <View>
                          <Text className="block text-gray-500 text-xs mb-2">车辆照片</Text>
                          <View className="flex gap-2 flex-wrap">
                            {parsePhotoUrls(vehicle.photos).map((photoUrl, idx) => (
                              <Image
                                key={idx}
                                src={photoUrl}
                                mode="aspectFill"
                                className="w-20 h-20 rounded-lg bg-gray-200"
                                onClick={() => Taro.previewImage({
                                  current: idx,
                                  urls: parsePhotoUrls(vehicle.photos)
                                })}
                              />
                            ))}
                          </View>
                        </View>
                      )}
                      {vehicle.remarks && (
                        <View>
                          <Text className="block text-gray-500 text-xs">拒绝原因</Text>
                          <Text className="block text-red-500">{vehicle.remarks}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </CardContent>
        </Card>
      </View>

      {/* 审核对话框 */}
      {showReviewDialog && selectedVehicle && (
        <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
          <DialogContent>
            <View className="p-4">
              <Text className="block font-medium text-base mb-4 text-center">
                审核车辆
              </Text>

              <View className="space-y-3 mb-4">
                <View>
                  <Text className="block text-gray-500 text-xs mb-1">车型</Text>
                  <Text className="block">{selectedVehicle.vehicle_type}</Text>
                </View>
                <View>
                  <Text className="block text-gray-500 text-xs mb-1">车牌号</Text>
                  <Text className="block">{selectedVehicle.license_plate || '未填写'}</Text>
                </View>
                <View>
                  <Text className="block text-gray-500 text-xs mb-1">车主</Text>
                  <Text className="block">
                    {selectedVehicle.owner?.name || selectedVehicle.owner?.phone || '未知'}
                  </Text>
                </View>
                <View>
                  <Text className="block text-gray-500 text-xs mb-1">载重</Text>
                  <Text className="block">{selectedVehicle.load_capacity} kg</Text>
                </View>
                <View>
                  <Text className="block text-gray-500 text-xs mb-1">容积</Text>
                  <Text className="block">{selectedVehicle.volume} m³</Text>
                </View>
                <View>
                  <Text className="block text-gray-500 text-xs mb-1">冷链能力</Text>
                  <Text className="block">
                    {selectedVehicle.has_cold_chain ? '支持冷链运输' : '不支持冷链运输'}
                  </Text>
                </View>
                {selectedVehicle.photos && (
                  <View>
                    <Text className="block text-gray-500 text-xs mb-1">车辆照片</Text>
                    <Text className="block text-blue-500">
                      已上传 {JSON.parse(selectedVehicle.photos).length} 张照片
                    </Text>
                  </View>
                )}
              </View>

              <View className="mb-4">
                <Text className="block text-gray-500 text-xs mb-2">拒绝原因（必填）</Text>
                <Textarea
                  placeholder="请输入拒绝原因"
                  value={reviewReason}
                  onInput={(e: any) => setReviewReason(e.detail.value)}
                  maxlength={200}
                />
              </View>

              <View className="flex gap-3">
                <View className="flex-1">
                  <Button
                    className="w-full bg-green-500"
                    onClick={handleApprove}
                    disabled={loading}
                  >
                    <Text>通过</Text>
                  </Button>
                </View>
                <View className="flex-1">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleReject}
                    disabled={loading}
                  >
                    <Text>拒绝</Text>
                  </Button>
                </View>
              </View>
            </View>
          </DialogContent>
        </Dialog>
      )}
    </AppPageShell>
  )
}
