import { useEffect, useState } from 'react'
import { View, Text, Picker } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Car, Calendar, DollarSign, Info, ArrowLeft } from 'lucide-react-taro'
import { Network } from '@/network'

interface VehicleOwner {
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
  battery_life: number
  has_cold_chain: boolean
  photos: string[]
  owners?: VehicleOwner  // 使用 owners 字段
  owner?: VehicleOwner   // 兼容字段
  is_available_for_rent: boolean
  rent_monthly_price: number
  rent_yearly_price: number
  rent_deposit: number
  contact_phone?: string
  contact_wechat?: string
}

interface CreateRentalRequest {
  vehicle_id: string
  owner_id: string
  rent_type: 'monthly' | 'yearly'
  rent_start_date: string
  rent_end_date: string
  contract_signed: boolean
  rent_paid: boolean
  deposit_paid: boolean
  deposit_amount: number
  notes: string
  renter_id: string
}

export default function VehicleRentalsDetail() {
  const router = useRouter()
  const { vehicleId } = router.params

  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [loading, setLoading] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [rentalType, setRentalType] = useState<'monthly' | 'yearly'>('monthly')
  const [rentStartDate, setRentStartDate] = useState('')
  const [rentEndDate, setRentEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [userInfo, setUserInfo] = useState<any>(null)
  const [hasApplied, setHasApplied] = useState(false)
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null)

  useEffect(() => {
    const user = Taro.getStorageSync('userInfo')
    setUserInfo(user)

    if (vehicleId) {
      loadVehicleDetail()
    }
  }, [vehicleId])

  useEffect(() => {
    if (vehicle && userInfo) {
      checkApplicationStatus()
    }
  }, [vehicle, userInfo])

  const loadVehicleDetail = async () => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: `/api/rentals/vehicle/${vehicleId}/info`
      })

      console.log('车辆详情响应:', res.data)

      if (res.data.code === 200) {
        setVehicle(res.data.data)
      } else {
        Taro.showToast({
          title: res.data.message || '加载失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('加载车辆详情失败:', error)
      Taro.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const checkApplicationStatus = async () => {
    if (!userInfo || !userInfo.id) return

    try {
      const res = await Network.request({
        url: '/api/rentals/my',
        data: { user_id: userInfo.id }
      })

      console.log('我的租赁记录响应:', res.data)

      if (res.data.code === 200) {
        const myRentals = res.data.data.as_renter || []
        const existingRental = myRentals.find(
          (r: any) => r.vehicle_id === vehicleId && ['pending', 'active'].includes(r.status)
        )

        if (existingRental) {
          setHasApplied(true)
          setApplicationStatus(existingRental.status)
        }
      }
    } catch (error) {
      console.error('检查申请状态失败:', error)
    }
  }

  const handleContactOwner = () => {
    if (!vehicle) return

    const owner = vehicle.owners || vehicle.owner
    if (!owner) {
      Taro.showToast({
        title: '车主信息不存在',
        icon: 'none'
      })
      return
    }

    const phone = vehicle.contact_phone || owner.phone
    const wechat = vehicle.contact_wechat

    if (wechat) {
      Taro.showModal({
        title: '联系车主',
        content: `电话：${phone}\n微信：${wechat}\n\n请通过电话或微信联系车主，商谈租赁细节。`,
        showCancel: false
      })
    } else {
      Taro.showModal({
        title: '联系车主',
        content: `电话：${phone}\n\n请通过电话联系车主，商谈租赁细节。`,
        showCancel: false
      })
    }
  }

  const handleConfirmRental = () => {
    setShowConfirmDialog(true)
  }

  const handleStartDateChange = (e: any) => {
    const date = new Date(e.detail.value)
    const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    setRentStartDate(formattedDate)

    // 根据租赁类型自动计算结束日期
    if (rentalType === 'monthly') {
      const endDate = new Date(date)
      endDate.setMonth(endDate.getMonth() + 1)
      const formattedEndDate = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
      setRentEndDate(formattedEndDate)
    } else if (rentalType === 'yearly') {
      const endDate = new Date(date)
      endDate.setFullYear(endDate.getFullYear() + 1)
      const formattedEndDate = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
      setRentEndDate(formattedEndDate)
    }
  }

  const handleEndDateChange = (e: any) => {
    const date = new Date(e.detail.value)
    const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    setRentEndDate(formattedDate)
  }

  const handleSubmitRental = async () => {
    if (!vehicle || !userInfo) return

    const owner = vehicle.owners || vehicle.owner
    if (!owner) {
      Taro.showToast({
        title: '车主信息不存在',
        icon: 'none'
      })
      return
    }

    // 验证日期
    if (!rentStartDate || !rentEndDate) {
      Taro.showToast({
        title: '请选择租赁日期',
        icon: 'none'
      })
      return
    }

    const startDate = new Date(rentStartDate)
    const endDate = new Date(rentEndDate)
    if (endDate <= startDate) {
      Taro.showToast({
        title: '结束日期必须晚于开始日期',
        icon: 'none'
      })
      return
    }

    setLoading(true)

    try {
      const body: CreateRentalRequest = {
        vehicle_id: vehicle.id,
        owner_id: owner.id,
        rent_type: rentalType,
        rent_start_date: startDate.toISOString(),
        rent_end_date: endDate.toISOString(),
        contract_signed: true,
        rent_paid: true,
        deposit_paid: true,
        deposit_amount: vehicle.rent_deposit,
        notes: notes || '已签订租赁合同，租金和押金已线下支付',
        renter_id: userInfo.id
      }

      console.log('创建租赁请求:', body)

      const res = await Network.request({
        url: '/api/rentals',
        method: 'POST',
        data: body
      })

      console.log('创建租赁响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: '租赁关系已创建，请等待车主确认',
          icon: 'success'
        })
        setTimeout(() => {
          Taro.navigateBack()
        }, 1500)
      } else {
        Taro.showToast({
          title: res.data.message || '创建失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('创建租赁失败:', error)
      Taro.showToast({
        title: '创建失败，请重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
      setShowConfirmDialog(false)
    }
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

  if (loading && !vehicle) {
    return (
      <View className="min-h-screen bg-background flex items-center justify-center">
        <Text className="block text-gray-500">加载中...</Text>
      </View>
    )
  }

  if (!vehicle) {
    return (
      <View className="min-h-screen bg-background flex items-center justify-center">
        <Text className="block text-gray-500">车辆不存在</Text>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background pb-4">
      {/* 头部 */}
      <View className="bg-white p-4 border-b border-border">
        <View className="flex items-center">
          <ArrowLeft
            size={20}
            color="#0062ff"
            className="mr-3 cursor-pointer"
            onClick={() => Taro.navigateBack()}
          />
          <Text className="text-lg font-bold text-gray-900">车辆详情</Text>
        </View>
      </View>

      {/* 提示信息 */}
      <View className="mx-4 mt-4 p-3 bg-accent rounded-lg">
        <View className="flex items-start">
          <Info size={16} color="#0062ff" className="mr-2 flex-shrink-0 mt-1" />
          <Text className="block text-sm text-primary">
            确认租赁前，请先与车主线下联系，商谈租赁细节并签订合同。
          </Text>
        </View>
      </View>

      <View className="mx-4 mt-4 space-y-4">
        {/* 车辆基本信息 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              {getVehicleTypeLabel(vehicle.vehicle_type)}（{vehicle.license_plate}）
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <View className="flex items-center text-sm text-gray-600">
              <Car size={14} className="mr-2" color="#6b7280" />
              <Text className="block">载重：{vehicle.load_capacity}kg</Text>
            </View>
            <View className="flex items-center text-sm text-gray-600">
              <Car size={14} className="mr-2" color="#6b7280" />
              <Text className="block">容积：{vehicle.volume}m³</Text>
            </View>
            <View className="flex items-center text-sm text-gray-600">
              <Car size={14} className="mr-2" color="#6b7280" />
              <Text className="block">续航：{vehicle.battery_life}km</Text>
            </View>
            {vehicle.has_cold_chain && (
              <View className="mt-2">
                <Badge className="bg-primary">冷链</Badge>
              </View>
            )}
          </CardContent>
        </Card>

        {/* 租赁信息 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">租赁信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <View className="flex items-center text-sm text-gray-700">
              <Calendar size={14} className="mr-2" color="#6b7280" />
              <Text className="block font-medium">月租：¥{vehicle.rent_monthly_price}/月</Text>
            </View>
            <View className="flex items-center text-sm text-gray-700">
              <Calendar size={14} className="mr-2" color="#6b7280" />
              <Text className="block font-medium">年租：¥{vehicle.rent_yearly_price}/年</Text>
            </View>
            <View className="flex items-center text-sm text-gray-700">
              <DollarSign size={14} className="mr-2" color="#6b7280" />
              <Text className="block font-medium">押金：¥{vehicle.rent_deposit}</Text>
            </View>
          </CardContent>
        </Card>

        {/* 车主信息 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">车主信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <View>
              <Text className="block text-sm text-gray-600">姓名</Text>
              <Text className="block text-sm font-medium text-gray-900 mt-1">{(vehicle.owners || vehicle.owner)?.name}</Text>
            </View>
            {vehicle.contact_wechat && (
              <View>
                <Text className="block text-sm text-gray-600">微信</Text>
                <Text className="block text-sm font-medium text-gray-900 mt-1">{vehicle.contact_wechat}</Text>
              </View>
            )}
            <View>
              <Text className="block text-sm text-gray-600">电话</Text>
              <Text className="block text-sm font-medium text-gray-900 mt-1">
                {vehicle.contact_phone || (vehicle.owners || vehicle.owner)?.phone}
              </Text>
            </View>
          </CardContent>
        </Card>

        {/* 操作按钮 */}
        <View className="flex gap-3">
          <Button
            className="flex-1"
            variant="outline"
            onClick={handleContactOwner}
          >
            联系车主
          </Button>
          <Button
            className="flex-1"
            onClick={handleConfirmRental}
            disabled={hasApplied}
          >
            {hasApplied
              ? applicationStatus === 'pending'
                ? '已申请'
                : '已租赁'
              : '确认租赁'}
          </Button>
        </View>
        {hasApplied && (
          <View className="mt-3 p-3 bg-amber-50 rounded-lg">
            <Text className="block text-sm text-orange-700">
              {applicationStatus === 'pending'
                ? '您已申请该车辆，请等待车主确认'
                : '您已租赁该车辆'}
            </Text>
          </View>
        )}
      </View>

      {/* 确认租赁对话框 */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认租赁关系</DialogTitle>
          </DialogHeader>
          <View className="space-y-4 py-4">
            <View>
              <Label>租赁类型</Label>
              <View className="flex gap-4 mt-2">
                <View
                  className={`flex-1 p-3 border rounded-lg ${
                    rentalType === 'monthly' ? 'border-primary bg-accent' : 'border-border'
                  }`}
                  onClick={() => setRentalType('monthly')}
                >
                  <Text
                    className={`block text-sm font-medium ${
                      rentalType === 'monthly' ? 'text-primary' : 'text-gray-700'
                    }`}
                  >
                    月租
                  </Text>
                  <Text className="block text-xs text-gray-500 mt-1">
                    ¥{vehicle.rent_monthly_price}/月
                  </Text>
                </View>
                <View
                  className={`flex-1 p-3 border rounded-lg ${
                    rentalType === 'yearly' ? 'border-primary bg-accent' : 'border-border'
                  }`}
                  onClick={() => setRentalType('yearly')}
                >
                  <Text
                    className={`block text-sm font-medium ${
                      rentalType === 'yearly' ? 'text-primary' : 'text-gray-700'
                    }`}
                  >
                    年租
                  </Text>
                  <Text className="block text-xs text-gray-500 mt-1">
                    ¥{vehicle.rent_yearly_price}/年
                  </Text>
                </View>
              </View>
            </View>
            <View>
              <Label>开始日期</Label>
              <Picker
                mode="date"
                value={rentStartDate}
                onChange={handleStartDateChange}
              >
                <View className="mt-2 bg-muted rounded-lg px-4 py-3 border border-border flex items-center justify-between">
                  <Text className="block text-sm text-gray-900">
                    {rentStartDate || '请选择开始日期'}
                  </Text>
                  <Calendar size={16} color="#6b7280" />
                </View>
              </Picker>
            </View>
            <View>
              <Label>结束日期</Label>
              <Picker
                mode="date"
                value={rentEndDate}
                onChange={handleEndDateChange}
              >
                <View className="mt-2 bg-muted rounded-lg px-4 py-3 border border-border flex items-center justify-between">
                  <Text className="block text-sm text-gray-900">
                    {rentEndDate || '请选择结束日期'}
                  </Text>
                  <Calendar size={16} color="#6b7280" />
                </View>
              </Picker>
            </View>
            <View>
              <Label>备注</Label>
              <Textarea
                value={notes}
                onInput={(e: any) => setNotes(e.detail.value)}
                placeholder="请输入备注信息"
                className="mt-2"
                maxlength={200}
              />
            </View>
            <View className="p-3 bg-muted rounded-lg">
              <Text className="block text-xs text-gray-600">
                确认租赁前，请确保已与车主线下联系，商谈租赁细节并签订合同。
              </Text>
            </View>
          </View>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              取消
            </Button>
            <Button onClick={handleSubmitRental} disabled={loading}>
              {loading ? '提交中...' : '确认'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  )
}
