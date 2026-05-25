import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Car, Calendar, DollarSign, User, FileText, Clock, Check, X } from 'lucide-react-taro'
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
}

interface RentalRecord {
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
  confirmed_by_owner: boolean
  confirmed_at?: string
  vehicles: Vehicle
  renters?: UserInfo
  owners?: UserInfo
}

export default function RentalsHistory() {
  const [loading, setLoading] = useState(false)
  const [asRenter, setAsRenter] = useState<RentalRecord[]>([])
  const [asOwner, setAsOwner] = useState<RentalRecord[]>([])
  const [activeTab, setActiveTab] = useState<'renter' | 'owner'>('renter')
  const [userInfo, setUserInfo] = useState<any>(null)

  const loadUserInfo = () => {
    const user = Taro.getStorageSync('userInfo')
    if (user) {
      setUserInfo(user)
    }
  }

  useDidShow(() => {
    loadUserInfo()
    loadRentalsHistory()
  })

  useEffect(() => {
    loadUserInfo()
    loadRentalsHistory()
  }, [])

  const loadRentalsHistory = async () => {
    if (!userInfo) {
      console.log('⚠️ userInfo 为空，跳过加载')
      return
    }

    console.log('✓ 开始加载租赁记录 - userId:', userInfo.id, 'userRole:', userInfo.role)
    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/rentals/my',
        method: 'GET',
        data: {
          user_id: userInfo.id
        }
      })

      console.log('✓ 租赁记录响应:', res.data)

      if (res.data && res.data.code === 200) {
        // 过滤掉已拒绝（terminated）的记录
        const filteredRenter = (res.data.data.as_renter || []).filter((r: RentalRecord) => r.status !== 'terminated')
        const filteredOwner = (res.data.data.as_owner || []).filter((r: RentalRecord) => r.status !== 'terminated')

        console.log('✓ 过滤后租户记录数:', filteredRenter.length)
        console.log('✓ 过滤后车主记录数:', filteredOwner.length)

        setAsRenter(filteredRenter)
        setAsOwner(filteredOwner)

        const totalCount = filteredRenter.length + filteredOwner.length
        if (totalCount === 0) {
          Taro.showToast({
            title: '暂无租赁记录',
            icon: 'none'
          })
        }
      } else {
        console.error('✗ 加载租赁记录失败:', res.data)
        Taro.showToast({
          title: res.data?.message || '加载失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('✗ 加载租赁记录失败:', error)
      Taro.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; icon: any }> = {
      'pending': { label: '待确认', color: 'bg-yellow-500', icon: Clock },
      'active': { label: '进行中', color: 'bg-green-500', icon: Check },
      'terminated': { label: '已拒绝', color: 'bg-red-500', icon: X },
      'expired': { label: '已到期', color: 'bg-gray-500', icon: Clock }
    }
    return statusMap[status] || { label: status, color: 'bg-gray-500', icon: Clock }
  }

  const renderRentalCard = (record: RentalRecord, isRenter: boolean) => {
    const statusInfo = getStatusInfo(record.status)
    const StatusIcon = statusInfo.icon
    const otherParty = isRenter ? record.owners : record.renters

    return (
      <Card key={record.id} className="overflow-hidden">
        <CardHeader className="pb-3">
          <View className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">
              {record.vehicles.license_plate}
            </CardTitle>
            <Badge className={statusInfo.color}>
              <View className="flex items-center">
                <StatusIcon size={12} className="mr-1" />
                <Text className="text-white text-xs">{statusInfo.label}</Text>
              </View>
            </Badge>
          </View>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* 车辆信息 */}
          <View className="space-y-2">
            <View className="flex items-center text-sm text-gray-600">
              <Car size={14} className="mr-2" color="#6b7280" />
              <Text className="block">
                {getVehicleTypeLabel(record.vehicles.vehicle_type)} - 载重{record.vehicles.load_capacity}kg
              </Text>
            </View>
          </View>

          <Separator />

          {/* 另一方信息 */}
          {otherParty && (
            <View>
              <Text className="block text-sm font-medium text-gray-700 mb-2">
                {isRenter ? '车主信息' : '租户信息'}
              </Text>
              <View className="flex items-center text-sm text-gray-600">
                <User size={14} className="mr-2" color="#6b7280" />
                <Text className="block">{otherParty.name} - {otherParty.phone}</Text>
              </View>
            </View>
          )}

          <Separator />

          {/* 租赁信息 */}
          <View className="bg-blue-50 p-3 rounded-lg">
            <View className="flex items-center text-sm text-gray-700 mb-2">
              <Calendar size={14} className="mr-2" color="#6b7280" />
              <Text className="block font-medium">租赁信息</Text>
            </View>
            <View className="space-y-1">
              <View className="flex items-center text-sm text-gray-600">
                <Text className="block">类型：{record.rent_type === 'monthly' ? '月租' : '年租'}</Text>
              </View>
              <View className="flex items-center text-sm text-gray-600">
                <Text className="block">
                  期限：{formatDate(record.rent_start_date)} 至 {formatDate(record.rent_end_date)}
                </Text>
              </View>
              <View className="flex items-center text-sm text-gray-600">
                <DollarSign size={14} className="mr-1" color="#6b7280" />
                <Text className="block">押金：¥{record.deposit_amount}</Text>
              </View>
            </View>
          </View>

          {/* 支付状态 */}
          <View className="flex gap-2">
            <Badge className={record.contract_signed ? 'bg-green-500' : 'bg-gray-500'}>
              <Text className="text-white text-xs">
                {record.contract_signed ? '已签约' : '未签约'}
              </Text>
            </Badge>
            <Badge className={record.rent_paid ? 'bg-green-500' : 'bg-gray-500'}>
              <Text className="text-white text-xs">
                {record.rent_paid ? '已付租金' : '未付租金'}
              </Text>
            </Badge>
            <Badge className={record.deposit_paid ? 'bg-green-500' : 'bg-gray-500'}>
              <Text className="text-white text-xs">
                {record.deposit_paid ? '已付押金' : '未付押金'}
              </Text>
            </Badge>
          </View>

          {/* 备注 */}
          {record.notes && (
            <View className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
              <View className="flex items-start">
                <FileText size={14} className="mr-2 flex-shrink-0 mt-1" color="#6b7280" />
                <Text className="block">备注：{record.notes}</Text>
              </View>
            </View>
          )}

          {/* 时间信息 */}
          <Text className="block text-xs text-gray-400">
            创建时间：{formatDate(record.created_at)}
          </Text>
        </CardContent>
      </Card>
    )
  }

  return (
    <View className="min-h-screen bg-gray-50 pb-4">
      {/* 头部 */}
      <View className="bg-white p-4 border-b border-gray-200">
        <Text className="text-xl font-bold text-gray-900 block">我的租赁记录</Text>
        <Text className="block text-sm text-gray-500 mt-1">查看租赁历史和状态</Text>
        {/* 当前用户信息提示 */}
        {userInfo && (
          <View className="mt-2 p-2 bg-blue-50 rounded-lg">
            <Text className="block text-xs text-blue-700">
              当前用户：{userInfo.name} ({userInfo.phone})
            </Text>
          </View>
        )}
      </View>

      {/* 标签页 */}
      <View className="mx-4 mt-4">
        <Tabs defaultValue="renter" value={activeTab} onValueChange={(v) => setActiveTab(v as 'renter' | 'owner')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="renter">
              <Text className="text-sm">我租的车 ({asRenter.length})</Text>
            </TabsTrigger>
            <TabsTrigger value="owner">
              <Text className="text-sm">租出去的车 ({asOwner.length})</Text>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="renter" className="mt-4">
            {loading ? (
              <View className="text-center py-8">
                <Text className="block text-gray-500">加载中...</Text>
              </View>
            ) : asRenter.length === 0 ? (
              <View className="text-center py-8">
                <Car size={48} color="#d1d5db" className="mx-auto mb-3" />
                <Text className="block text-gray-500">暂无租赁记录</Text>
              </View>
            ) : (
              <View className="space-y-4">
                {asRenter.map((record) => renderRentalCard(record, true))}
              </View>
            )}
          </TabsContent>

          <TabsContent value="owner" className="mt-4">
            {loading ? (
              <View className="text-center py-8">
                <Text className="block text-gray-500">加载中...</Text>
              </View>
            ) : asOwner.length === 0 ? (
              <View className="text-center py-8">
                <Car size={48} color="#d1d5db" className="mx-auto mb-3" />
                <Text className="block text-gray-500">暂无租赁记录</Text>
              </View>
            ) : (
              <View className="space-y-4">
                {asOwner.map((record) => renderRentalCard(record, false))}
              </View>
            )}
          </TabsContent>
        </Tabs>
      </View>
    </View>
  )
}
