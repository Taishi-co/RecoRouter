import { useState, useEffect } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { View, Text, Picker, Image } from '@tarojs/components'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { MapPin, TriangleAlert } from 'lucide-react-taro'
import { Network } from '@/network'

interface Demand {
  id: string
  cargo_name: string
  cargo_type: string
  weight: string
  volume: string
  pickup_time: string
  pickup_address: string
  pickup_location: { latitude: number; longitude: number }
  delivery_address: string
  delivery_location: { latitude: number; longitude: number }
  remarks: string
  estimated_distance: number | null
  estimated_fare: number | null
  cargo_photos: string[] // 货品照片URL数组
}

interface AddressBook {
  id: string
  user_id: string
  address_name: string
  address: string
  latitude: number
  longitude: number
  address_type: string
  is_default: boolean
}

export default function EditDemand() {
  const router = useRouter()
  const demandId = router.params.id

  console.log('编辑页面初始化, demandId:', demandId)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState<Partial<Demand>>({})
  const [addressBooks, setAddressBooks] = useState<AddressBook[]>([])
  const [showAddressPicker, setShowAddressPicker] = useState<'pickup' | 'delivery' | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [estimatedDistance, setEstimatedDistance] = useState<number | null>(null)

  // 计算两点之间的距离（公里）
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371 // 地球半径（公里）
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return Math.round(R * c * 100) / 100 // 保留两位小数
  }

  // 当地址变化时计算距离
  useEffect(() => {
    if (formData.pickup_location && formData.delivery_location &&
        typeof formData.pickup_location === 'object' &&
        typeof formData.delivery_location === 'object') {
      const distance = calculateDistance(
        formData.pickup_location.latitude,
        formData.pickup_location.longitude,
        formData.delivery_location.latitude,
        formData.delivery_location.longitude
      )
      setEstimatedDistance(distance)
      console.log('[EditDemand] 计算距离:', distance, '公里')
    } else {
      setEstimatedDistance(null)
    }
  }, [formData.pickup_location, formData.delivery_location])

  useEffect(() => {
    console.log('useEffect 触发, demandId:', demandId)
    if (demandId) {
      loadDemandDetail()
      loadAddressBooks()
    } else {
      setError('需求ID不能为空')
      setLoading(false)
    }
  }, [demandId])

  const loadDemandDetail = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await Network.request({
        url: `/api/demands/${demandId}`
      })

      console.log('需求详情响应:', res.data)

      if (res.data.code === 200 && res.data.data) {
        const demand = res.data.data

        // 安全解析 pickup_location
        let pickupLocation: any = null
        try {
          pickupLocation = typeof demand.pickup_location === 'string'
            ? JSON.parse(demand.pickup_location)
            : demand.pickup_location
        } catch (e) {
          console.error('解析 pickup_location 失败:', e)
          pickupLocation = { latitude: 0, longitude: 0 }
        }

        // 安全解析 delivery_location
        let deliveryLocation: any = null
        try {
          deliveryLocation = typeof demand.delivery_location === 'string'
            ? JSON.parse(demand.delivery_location)
            : demand.delivery_location
        } catch (e) {
          console.error('解析 delivery_location 失败:', e)
          deliveryLocation = { latitude: 0, longitude: 0 }
        }

        setFormData({
          id: demand.id,
          cargo_name: demand.cargo_name || '',
          cargo_type: demand.cargo_type || 'normal',
          weight: demand.weight?.toString() || '',
          volume: demand.volume?.toString() || '',
          pickup_time: demand.pickup_time || '',
          pickup_address: demand.pickup_address || '',
          pickup_location: pickupLocation,
          delivery_address: demand.delivery_address || '',
          delivery_location: deliveryLocation,
          remarks: demand.remarks || '',
          estimated_distance: demand.estimated_distance,
          estimated_fare: demand.estimated_fare,
          cargo_photos: demand.cargo_photos || [] // 货品照片URL数组
        })
      } else {
        setError(res.data.message || '需求不存在')
      }
    } catch (err) {
      console.error('加载需求详情失败:', err)
      setError('加载需求详情失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const loadAddressBooks = async () => {
    try {
      const userInfo = Taro.getStorageSync('userInfo')
      if (!userInfo || !userInfo.id) {
        return
      }

      const res = await Network.request({
        url: '/api/address-books',
        method: 'GET',
        data: { user_id: userInfo.id }
      })

      if (res.data.code === 200) {
        setAddressBooks(res.data.data || [])
      }
    } catch (err) {
      console.error('[EditDemand] 加载地址数据失败:', err)
    }
  }

  // 选择货品照片（拍照或从相册选择）
  const handleChoosePhotos = async () => {
    try {
      // 计算剩余可上传数量
      const remainingCount = 1 - (formData.cargo_photos?.length || 0)

      if (remainingCount === 0) {
        Taro.showToast({
          title: '最多只能上传1张照片',
          icon: 'none'
        })
        return
      }

      const res = await Taro.chooseImage({
        count: remainingCount, // 最多选择剩余数量
        sizeType: ['compressed'], // 压缩图片
        sourceType: ['album', 'camera'] // 相册和相机
      })

      console.log('[EditDemand] 选择图片:', res.tempFilePaths)

      // 上传所有选中的图片
      const uploadPromises = res.tempFilePaths.map(async (tempFilePath) => {
        try {
          const uploadRes = await Network.uploadFile({
            url: '/api/home/upload',
            filePath: tempFilePath,
            name: 'file'
          })

          console.log('[EditDemand] 图片上传原始响应:', uploadRes)

          // 检查 HTTP 状态码
          if (uploadRes.statusCode !== 200) {
            throw new Error(`上传失败，状态码: ${uploadRes.statusCode}`)
          }

          // 解析响应数据
          let response: any
          try {
            response = JSON.parse(uploadRes.data as string)
          } catch (parseError) {
            console.error('[EditDemand] JSON 解析失败:', parseError)
            throw new Error('响应数据格式错误')
          }

          console.log('[EditDemand] 图片上传响应:', response)

          if (response.code === 200) {
            return response.data.url // 返回图片URL
          } else {
            throw new Error(response.message || '上传失败')
          }
        } catch (uploadError) {
          console.error('[EditDemand] 图片上传失败:', uploadError)
          return null
        }
      })

      const uploadResults = await Promise.all(uploadPromises)
      const successfulUploads = uploadResults.filter((url): url is string => url !== null)

      if (successfulUploads.length > 0) {
        setFormData({
          ...formData,
          cargo_photos: [...(formData.cargo_photos || []), ...successfulUploads]
        })

        Taro.showToast({
          title: `成功上传 ${successfulUploads.length} 张图片`,
          icon: 'success'
        })
      } else {
        Taro.showToast({
          title: '图片上传失败',
          icon: 'none'
        })
      }
    } catch (chooseError) {
      console.error('[EditDemand] 选择图片失败:', chooseError)
      Taro.showToast({
        title: '选择图片失败',
        icon: 'none'
      })
    }
  }

  // 删除货品照片
  const handleRemovePhoto = (index: number) => {
    const newPhotos = [...(formData.cargo_photos || [])]
    newPhotos.splice(index, 1)
    setFormData({
      ...formData,
      cargo_photos: newPhotos
    })
  }

  // 预览图片
  const handlePreviewPhoto = (index: number) => {
    Taro.previewImage({
      current: formData.cargo_photos?.[index] || '',
      urls: formData.cargo_photos || []
    })
  }

  const handlePickupDateSelect = (e) => {
    const date = e.detail.value
    const currentDate = (formData.pickup_time && formData.pickup_time.includes(' ')) ? new Date(formData.pickup_time) : new Date()
    const time = currentDate.toTimeString().slice(0, 5)
    const newPickupTime = `${date} ${time}:00`
    setFormData({ ...formData, pickup_time: newPickupTime })
  }

  const handlePickupTimeSelect = (e) => {
    const time = e.detail.value
    const date = (formData.pickup_time && formData.pickup_time.includes(' ')) ? formData.pickup_time.split(' ')[0] : new Date().toISOString().slice(0, 10)
    const newPickupTime = `${date} ${time}:00`
    setFormData({ ...formData, pickup_time: newPickupTime })
  }

  const handleSelectAddress = (address: AddressBook) => {
    const newFormData = { ...formData }

    if (showAddressPicker === 'pickup') {
      newFormData.pickup_address = address.address
      newFormData.pickup_location = {
        latitude: address.latitude,
        longitude: address.longitude
      }
    } else {
      newFormData.delivery_address = address.address
      newFormData.delivery_location = {
        latitude: address.latitude,
        longitude: address.longitude
      }
    }

    setFormData(newFormData)
    setShowAddressPicker(undefined)

    Taro.showToast({
      title: '地址选择成功',
      icon: 'success'
    })
  }

  const handleSubmit = async () => {
    if (!formData.cargo_name || !formData.weight || !formData.volume ||
        !formData.pickup_time || !formData.pickup_address || !formData.delivery_address) {
      Taro.showToast({
        title: '请填写完整信息',
        icon: 'none'
      })
      return
    }

    if (!formData.pickup_location) {
      Taro.showToast({
        title: '请选择取货位置',
        icon: 'none'
      })
      return
    }

    if (!formData.delivery_location) {
      Taro.showToast({
        title: '请选择送货位置',
        icon: 'none'
      })
      return
    }

    setSubmitting(true)

    try {
      const submitData = {
        cargo_name: formData.cargo_name,
        cargo_type: formData.cargo_type,
        weight: parseFloat(formData.weight || '0'),
        volume: parseFloat(formData.volume || '0'),
        pickup_time: formData.pickup_time,
        pickup_address: formData.pickup_address,
        pickup_location: JSON.stringify(formData.pickup_location),
        delivery_address: formData.delivery_address,
        delivery_location: JSON.stringify(formData.delivery_location),
        remarks: formData.remarks,
        pickup_lat: formData.pickup_location.latitude,
        pickup_lng: formData.pickup_location.longitude,
        delivery_lat: formData.delivery_location.latitude,
        delivery_lng: formData.delivery_location.longitude,
        estimated_distance: formData.estimated_distance,
        estimated_fare: formData.estimated_fare,
        cargo_photos: formData.cargo_photos || [] // 货品照片URL数组
      }

      const res = await Network.request({
        url: `/api/demands/${demandId}`,
        method: 'PUT',
        data: submitData
      })

      console.log('更新需求响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: '需求更新成功',
          icon: 'success'
        })

        // 触发需求列表刷新事件
        Taro.eventCenter.trigger('demandListRefresh')

        setTimeout(() => {
          Taro.navigateBack()
        }, 1500)
      } else {
        Taro.showToast({
          title: res.data.message || '更新失败',
          icon: 'none'
        })
      }
    } catch (err) {
      console.error('更新需求失败:', err)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    } finally {
      setSubmitting(false)
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
              variant="outline"
              onClick={() => Taro.navigateBack()}
            >
              <Text className="text-xs">返回</Text>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => Taro.navigateTo({ url: '/pages/merchant/demands/list' })}
            >
              <Text className="text-xs">我的需求</Text>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => Taro.navigateTo({ url: '/pages/merchant/orders/index' })}
            >
              <Text className="text-xs">订单管理</Text>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => Taro.navigateTo({ url: '/pages/merchant/profile/index' })}
            >
              <Text className="text-xs">我的</Text>
            </Button>
          </View>
        </View>
      </View>

      {/* 加载状态 */}
      {loading && (
        <View className="flex flex-col items-center justify-center p-8">
          <Text className="block text-gray-600 text-center">加载中...</Text>
        </View>
      )}

      {/* 错误状态 */}
      {!loading && error && (
        <View className="flex flex-col items-center justify-center p-8">
          <TriangleAlert size={48} color="#ef4444" className="mb-4" />
          <Text className="block text-red-600 text-center mb-4">{error}</Text>
          <Button onClick={loadDemandDetail}>
            <Text className="text-sm">重新加载</Text>
          </Button>
        </View>
      )}

      {/* 正常显示 */}
      {!loading && !error && (
        <>
          <Card className="bg-white rounded-lg shadow-sm m-4">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                编辑需求
              </CardTitle>
            </CardHeader>
            <CardContent>
              <View className="space-y-4">
            <View>
              <Label className="block text-sm font-medium mb-2">
                <Text className="text-red-500">*</Text>货品名称
              </Label>
              <View className="bg-muted rounded-lg px-4 py-3">
                <Input
                  className="w-full bg-transparent"
                  placeholder="如：新鲜蔬菜"
                  value={formData.cargo_name}
                  onInput={(e) => setFormData({ ...formData, cargo_name: e.detail.value })}
                />
              </View>
            </View>

            <View>
              <Label className="block text-sm font-medium mb-2">
                <Text className="text-red-500">*</Text>货品类型
              </Label>
              <View className="flex gap-3">
                {[
                  { value: 'normal', label: '普通' },
                  { value: 'fresh', label: '生鲜' },
                  { value: 'fragile', label: '易碎' }
                ].map((type) => (
                  <View
                    key={type.value}
                    onClick={() => setFormData({ ...formData, cargo_type: type.value })}
                  >
                    <View className={`px-4 py-2 rounded-lg border ${
                      formData.cargo_type === type.value
                        ? 'border-primary bg-accent'
                        : 'border-border bg-white'
                    }`}
                    >
                      <Text className={`text-sm ${
                        formData.cargo_type === type.value
                          ? 'text-primary font-medium'
                          : 'text-gray-700'
                      }`}
                      >
                        {type.label}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View className="flex gap-3">
              <View className="flex-1">
                <Label className="block text-sm font-medium mb-2">
                  <Text className="text-red-500">*</Text>重量（公斤）
                </Label>
                <View className="bg-muted rounded-lg px-4 py-3">
                  <Input
                    className="w-full bg-transparent"
                    placeholder="如：30"
                    type="number"
                    value={formData.weight}
                    onInput={(e) => setFormData({ ...formData, weight: e.detail.value })}
                  />
                </View>
              </View>
              <View className="flex-1">
                <Label className="block text-sm font-medium mb-2">
                  <Text className="text-red-500">*</Text>体积（立方米）
                </Label>
                <View className="bg-muted rounded-lg px-4 py-3">
                  <Input
                    className="w-full bg-transparent"
                    placeholder="如：0.3"
                    type="digit"
                    value={formData.volume}
                    onInput={(e) => setFormData({ ...formData, volume: e.detail.value })}
                  />
                </View>
              </View>
            </View>

            {/* 货品照片 */}
            <View>
              <Label className="block text-sm font-medium mb-2">
                货品照片
                <Text className="text-gray-400 text-xs ml-2">（可选，最多1张）</Text>
              </Label>
              <Button
                size="sm"
                className="w-full bg-primary"
                onClick={handleChoosePhotos}
                disabled={(formData.cargo_photos?.length || 0) >= 1}
              >
                <Text className="text-xs">
                  {(formData.cargo_photos?.length || 0) >= 1 ? '已满' : '📷 拍照或选择图片'}
                </Text>
              </Button>

              {/* 图片预览 */}
              {formData.cargo_photos && formData.cargo_photos.length > 0 && (
                <View className="grid grid-cols-3 gap-2 mt-3">
                  {formData.cargo_photos.map((photo, index) => (
                    <View key={index} className="relative">
                      <Image
                        src={photo}
                        mode="aspectFill"
                        className="w-full h-24 rounded-lg bg-muted"
                        onClick={() => handlePreviewPhoto(index)}
                      />
                      <View
                        className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemovePhoto(index)
                        }}
                      >
                        <Text className="text-xs">×</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View>
              <Label className="block text-sm font-medium mb-2">
                <Text className="text-red-500">*</Text>取货时间
              </Label>
              <View className="flex gap-3">
                <Picker
                  mode="date"
                  value={formData.pickup_time && formData.pickup_time.includes(' ') ? formData.pickup_time.split(' ')[0] : ''}
                  onChange={handlePickupDateSelect}
                >
                  <View className="flex-1 bg-muted rounded-lg px-4 py-3 flex items-center justify-between">
                    <Text className={`text-sm ${formData.pickup_time ? 'text-gray-900' : 'text-gray-400'}`}>
                      {formData.pickup_time && formData.pickup_time.includes(' ') ? formData.pickup_time.split(' ')[0] : '选择日期'}
                    </Text>
                    <Text className="text-gray-400">📅</Text>
                  </View>
                </Picker>
                <Picker
                  mode="time"
                  value={formData.pickup_time && formData.pickup_time.includes(' ') ? formData.pickup_time.split(' ')[1].slice(0, 5) : ''}
                  onChange={handlePickupTimeSelect}
                >
                  <View className="flex-1 bg-muted rounded-lg px-4 py-3 flex items-center justify-between">
                    <Text className={`text-sm ${formData.pickup_time ? 'text-gray-900' : 'text-gray-400'}`}>
                      {formData.pickup_time && formData.pickup_time.includes(' ') ? formData.pickup_time.split(' ')[1].slice(0, 5) : '选择时间'}
                    </Text>
                    <Text className="text-gray-400">⏰</Text>
                  </View>
                </Picker>
              </View>
            </View>

            <View>
              <Label className="block text-sm font-medium mb-2">
                <Text className="text-red-500">*</Text>取货地址
              </Label>
              <View className="flex gap-2">
                <View className="flex-1 bg-muted rounded-lg px-4 py-3">
                  <Input
                    className="w-full bg-transparent"
                    placeholder="请选择取货地址"
                    value={formData.pickup_address}
                    disabled
                  />
                </View>
                <Button
                  size="sm"
                  className="bg-primary px-4"
                  onClick={() => setShowAddressPicker('pickup')}
                  disabled={addressBooks.length === 0}
                >
                  <MapPin size={14} color="#fff" />
                  <Text className="text-xs ml-1">选择</Text>
                </Button>
              </View>

              {formData.pickup_location && formData.pickup_location.latitude && formData.pickup_location.longitude && (
                <Text className="block text-xs text-gray-400 mt-1">
                  已选择：{formData.pickup_location.latitude.toFixed(6)}, {formData.pickup_location.longitude.toFixed(6)}
                </Text>
              )}
            </View>

            <View>
              <Label className="block text-sm font-medium mb-2">
                <Text className="text-red-500">*</Text>送货地址
              </Label>
              <View className="flex gap-2">
                <View className="flex-1 bg-muted rounded-lg px-4 py-3">
                  <Input
                    className="w-full bg-transparent"
                    placeholder="请选择送货地址"
                    value={formData.delivery_address}
                    disabled
                  />
                </View>
                <Button
                  size="sm"
                  className="bg-primary px-4"
                  onClick={() => setShowAddressPicker('delivery')}
                  disabled={addressBooks.length === 0}
                >
                  <MapPin size={14} color="#fff" />
                  <Text className="text-xs ml-1">选择</Text>
                </Button>
              </View>

              {formData.delivery_location && formData.delivery_location.latitude && formData.delivery_location.longitude && (
                <Text className="block text-xs text-gray-400 mt-1">
                  已选择：{formData.delivery_location.latitude.toFixed(6)}, {formData.delivery_location.longitude.toFixed(6)}
                </Text>
              )}
            </View>

            {/* 距离估算 */}
            {estimatedDistance !== null && (
              <View className="bg-emerald-50 rounded-lg p-3">
                <Text className="block text-sm font-medium text-green-900">
                  距离估算：{estimatedDistance} 公里
                </Text>
              </View>
            )}

            <View>
              <Label className="block text-sm font-medium mb-2">
                备注（选填）
              </Label>
              <View className="bg-muted rounded-lg px-4 py-3">
                <Input
                  className="w-full bg-transparent"
                  placeholder="如：请提前10分钟联系"
                  value={formData.remarks}
                  onInput={(e) => setFormData({ ...formData, remarks: e.detail.value })}
                />
              </View>
            </View>

            <Button
              className="w-full bg-primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              <Text className="text-white font-medium">
                {submitting ? '更新中...' : '更新需求'}
              </Text>
            </Button>
          </View>
        </CardContent>
      </Card>

      {/* 地址簿选择弹窗 */}
      <Dialog open={showAddressPicker !== undefined} onOpenChange={(open) => !open && setShowAddressPicker(undefined)}>
        <DialogContent className="max-h-[60vh]">
          <DialogHeader>
            <DialogTitle>
              {showAddressPicker === 'pickup' ? '选择取货地址' : '选择送货地址'}
            </DialogTitle>
          </DialogHeader>
          <View className="space-y-2">
            {addressBooks.length === 0 ? (
              <View className="text-center py-8">
                <Text className="block text-gray-400 text-sm">暂无地址，请先添加地址</Text>
              </View>
            ) : (
              addressBooks.map((address) => (
                <View
                  key={address.id}
                  className="bg-muted rounded-lg p-3"
                  onClick={() => handleSelectAddress(address)}
                >
                  <View className="flex items-start gap-2">
                    <MapPin size={16} color="#6b7280" />
                    <View className="flex-1">
                      <Text className="block text-sm font-medium text-gray-900 mb-1">
                        {address.address_name}
                      </Text>
                      <Text className="block text-xs text-gray-600">
                        {address.address}
                      </Text>
                      {address.is_default && (
                        <View className="inline-block mt-1">
                          <Text className="text-xs text-primary">默认</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddressPicker(undefined)}
            >
              <Text className="text-xs">取消</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
      )}
    </View>
  )
}
