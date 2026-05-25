import { useState, useEffect } from 'react'
import { View, Text, Picker, Image } from '@tarojs/components'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Route, BookOpen, MapPin, Check } from 'lucide-react-taro'
import Taro, { useDidShow } from '@tarojs/taro'
import { Network } from '@/network'

interface FormData {
  cargo_name: string
  cargo_type: string
  weight: string
  volume: string
  pickup_time: string
  pickup_address: string
  pickup_location: { latitude: number; longitude: number } | null
  delivery_address: string
  delivery_location: { latitude: number; longitude: number } | null
  remarks: string
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

interface FavoriteRoute {
  id: string
  user_id: string
  route_name: string
  pickup_address_id: string | null
  delivery_address_id: string | null
  estimated_distance: number | null
  estimated_fare: number | null
  use_count: number
  pickup_address?: AddressBook
  delivery_address?: AddressBook
}

export default function PublishDemand() {
  const [loading, setLoading] = useState(false)
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    cargo_name: '',
    cargo_type: 'normal',
    weight: '',
    volume: '',
    pickup_time: '',
    pickup_address: '',
    pickup_location: null,
    delivery_address: '',
    delivery_location: null,
    remarks: '',
    cargo_photos: [] // 货品照片URL数组
  })

  // 地址簿和线路数据
  const [addressBooks, setAddressBooks] = useState<AddressBook[]>([])
  const [favoriteRoutes, setFavoriteRoutes] = useState<FavoriteRoute[]>([])
  const [showAddressPicker, setShowAddressPicker] = useState<'pickup' | 'delivery' | undefined>(undefined)
  const [showRoutePicker, setShowRoutePicker] = useState(false)
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
    if (formData.pickup_location && formData.delivery_location) {
      const distance = calculateDistance(
        formData.pickup_location.latitude,
        formData.pickup_location.longitude,
        formData.delivery_location.latitude,
        formData.delivery_location.longitude
      )
      setEstimatedDistance(distance)
      console.log('[PublishDemand] 计算距离:', distance, '公里')
    } else {
      setEstimatedDistance(null)
    }
  }, [formData.pickup_location, formData.delivery_location])

  // 检查是否从常用线路或常用模板跳转过来，自动填充信息
  useEffect(() => {
    try {
      const instance = Taro.getCurrentInstance()
      const routeParams = instance.router?.params

      // 处理常用线路参数
      if (routeParams?.route) {
        const routeData = JSON.parse(decodeURIComponent(routeParams.route))

        console.log('[PublishDemand] 从常用线路跳转:', routeData)

        // 自动填充取货地址和送货地址
        setFormData((prev) => ({
          ...prev,
          pickup_address: routeData.pickup_address?.address || '',
          pickup_location: routeData.pickup_address?.latitude && routeData.pickup_address?.longitude
            ? {
                latitude: routeData.pickup_address.latitude,
                longitude: routeData.pickup_address.longitude
              }
            : null,
          delivery_address: routeData.delivery_address?.address || '',
          delivery_location: routeData.delivery_address?.latitude && routeData.delivery_address?.longitude
            ? {
                latitude: routeData.delivery_address.latitude,
                longitude: routeData.delivery_address.longitude
              }
            : null,
        }))

        // 显示提示信息
        Taro.showToast({
          title: `已自动填充: ${routeData.route_name}`,
          icon: 'success',
          duration: 2000
        })
      }

      // 处理常用模板参数
      if (routeParams?.template_id) {
        console.log('[PublishDemand] 从常用模板跳转 - 原始参数:', routeParams)

        // 手动解码所有参数
        const decodedParams: any = {}
        Object.keys(routeParams).forEach(key => {
          if (routeParams[key]) {
            decodedParams[key] = decodeURIComponent(routeParams[key])
          }
        })

        console.log('[PublishDemand] 从常用模板跳转 - 解码后参数:', decodedParams)

        setFormData((prev) => ({
          ...prev,
          cargo_name: decodedParams.cargo_name || '',
          cargo_type: decodedParams.cargo_type || 'normal',
          weight: decodedParams.weight || '',
          volume: decodedParams.volume || '',
          pickup_address: decodedParams.pickup_address || '',
          pickup_location: decodedParams.pickup_lat && decodedParams.pickup_lng
            ? {
                latitude: parseFloat(decodedParams.pickup_lat),
                longitude: parseFloat(decodedParams.pickup_lng)
              }
            : null,
          delivery_address: decodedParams.delivery_address || '',
          delivery_location: decodedParams.delivery_lat && decodedParams.delivery_lng
            ? {
                latitude: parseFloat(decodedParams.delivery_lat),
                longitude: parseFloat(decodedParams.delivery_lng)
              }
            : null,
          remarks: decodedParams.remarks || ''
        }))

        // 显示提示信息
        Taro.showToast({
          title: '已加载模板信息',
          icon: 'success',
          duration: 2000
        })
      }
    } catch (error) {
      console.error('[PublishDemand] 解析参数失败:', error)
    }
  }, [])

  // 加载地址簿和常用线路
  useEffect(() => {
    loadAddressData()
  }, [])

  useDidShow(() => {
    loadAddressData()
  })

  const loadAddressData = async () => {
    try {
      const userInfo = Taro.getStorageSync('userInfo')

      if (!userInfo || !userInfo.id) {
        return
      }

      // 并行加载地址簿和常用线路
      const [addressRes, routeRes] = await Promise.all([
        Network.request({
          url: '/api/address-books',
          method: 'GET',
          data: { user_id: userInfo.id }
        }),
        Network.request({
          url: '/api/favorite-routes',
          method: 'GET',
          data: { user_id: userInfo.id }
        })
      ])

      if (addressRes.data.code === 200) {
        setAddressBooks(addressRes.data.data || [])
      }

      if (routeRes.data.code === 200) {
        setFavoriteRoutes(routeRes.data.data || [])
      }
    } catch (error) {
      console.error('[PublishDemand] 加载地址数据失败:', error)
    }
  }

  const handlePickupDateSelect = (e) => {
    const date = e.detail.value
    const currentDate = formData.pickup_time ? new Date(formData.pickup_time) : new Date()
    const time = currentDate.toTimeString().slice(0, 5)
    const newPickupTime = `${date} ${time}:00`
    setFormData({ ...formData, pickup_time: newPickupTime })
  }

  const handlePickupTimeSelect = (e) => {
    const time = e.detail.value
    const date = formData.pickup_time ? formData.pickup_time.split(' ')[0] : new Date().toISOString().slice(0, 10)
    const newPickupTime = `${date} ${time}:00`
    setFormData({ ...formData, pickup_time: newPickupTime })
  }

  // 选择地址簿地址
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

  // 选择常用线路
  const handleSelectRoute = (route: FavoriteRoute) => {
    const newFormData = { ...formData }

    if (route.pickup_address) {
      newFormData.pickup_address = route.pickup_address.address
      newFormData.pickup_location = {
        latitude: route.pickup_address.latitude,
        longitude: route.pickup_address.longitude
      }
    }

    if (route.delivery_address) {
      newFormData.delivery_address = route.delivery_address.address
      newFormData.delivery_location = {
        latitude: route.delivery_address.latitude,
        longitude: route.delivery_address.longitude
      }
    }

    setFormData(newFormData)
    setShowRoutePicker(false)

    // 增加使用次数
    incrementRouteUseCount(route.id)

    Taro.showToast({
      title: `已选择线路: ${route.route_name}`,
      icon: 'success'
    })
  }

  // 增加线路使用次数
  const incrementRouteUseCount = async (routeId: string) => {
    try {
      await Network.request({
        url: `/api/favorite-routes/${routeId}/increment-use-count`,
        method: 'POST'
      })
    } catch (error) {
      console.error('[PublishDemand] 增加线路使用次数失败:', error)
    }
  }

  // AI分析货品照片
  const handleAIAnalyze = async () => {
    if (formData.cargo_photos.length === 0) {
      Taro.showToast({
        title: '请先上传货品照片',
        icon: 'none'
      })
      return
    }

    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/home/analyze-cargo',
        method: 'POST',
        data: {
          photos: formData.cargo_photos
        }
      })

      console.log('AI分析响应:', res.data)

      if (res.data.code === 200 && res.data.data) {
        const analysis = res.data.data

        // 根据AI分析结果自动填充表单（强制更新，支持更换图片后重新分析）
        const updates: Partial<typeof formData> = {}
        if (analysis.cargo_name) updates.cargo_name = analysis.cargo_name
        if (analysis.cargo_type) updates.cargo_type = analysis.cargo_type
        if (analysis.weight) updates.weight = analysis.weight.toString()
        if (analysis.volume) updates.volume = analysis.volume.toString()

        if (Object.keys(updates).length > 0) {
          setFormData(prev => ({ ...prev, ...updates }))
        }

        Taro.showToast({
          title: 'AI分析完成，已更新货品信息',
          icon: 'success'
        })
      } else {
        Taro.showToast({
          title: res.data.message || 'AI分析失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('AI分析失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  // 选择货品照片（拍照或从相册选择）
  const handleChoosePhotos = async () => {
    if (uploadingPhotos) {
      return
    }

    let uploadStarted = false

    try {
      // 计算剩余可上传数量
      const remainingCount = 1 - formData.cargo_photos.length

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

      console.log('[PublishDemand] 选择图片:', res.tempFilePaths)

      if (res.tempFilePaths.length === 0) {
        return
      }

      uploadStarted = true
      setUploadingPhotos(true)
      Taro.showLoading({
        title: '上传中...'
      })

      // 上传所有选中的图片
      const uploadPromises = res.tempFilePaths.map(async (tempFilePath) => {
        try {
          const uploadRes = await Network.uploadFile({
            url: '/api/home/upload',
            filePath: tempFilePath,
            name: 'file'
          })

          console.log('[PublishDemand] 图片上传原始响应:', uploadRes)

          // 检查 HTTP 状态码
          if (uploadRes.statusCode !== 200) {
            throw new Error(`上传失败，状态码: ${uploadRes.statusCode}`)
          }

          // 解析响应数据
          let response: any
          try {
            response = JSON.parse(uploadRes.data as string)
          } catch (parseError) {
            console.error('[PublishDemand] JSON 解析失败:', parseError)
            throw new Error('响应数据格式错误')
          }

          console.log('[PublishDemand] 图片上传响应:', response)

          if (response.code === 200) {
            return response.data.url // 返回图片URL
          } else {
            throw new Error(response.message || '上传失败')
          }
        } catch (error) {
          console.error('[PublishDemand] 图片上传失败:', error)
          return null
        }
      })

      const uploadResults = await Promise.all(uploadPromises)
      const successfulUploads = uploadResults.filter((url): url is string => url !== null)

      if (successfulUploads.length > 0) {
        setFormData((prev) => ({
          ...prev,
          cargo_photos: [...prev.cargo_photos, ...successfulUploads]
        }))

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
    } catch (error) {
      console.error('[PublishDemand] 选择图片失败:', error)
      Taro.showToast({
        title: '选择图片失败',
        icon: 'none'
      })
    } finally {
      if (uploadStarted) {
        Taro.hideLoading()
        setUploadingPhotos(false)
      }
    }
  }

  // 删除货品照片
  const handleRemovePhoto = (index: number) => {
    const newPhotos = [...formData.cargo_photos]
    newPhotos.splice(index, 1)
    setFormData({
      ...formData,
      cargo_photos: newPhotos
    })
  }

  // 预览图片
  const handlePreviewPhoto = (index: number) => {
    Taro.previewImage({
      current: formData.cargo_photos[index],
      urls: formData.cargo_photos
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

    setLoading(true)

    try {
      const userInfo = Taro.getStorageSync('userInfo')

      const res = await Network.request({
        url: '/api/demands',
        method: 'POST',
        data: {
          merchant_id: userInfo.id,
          cargo_name: formData.cargo_name,
          cargo_type: formData.cargo_type,
          weight: formData.weight,
          volume: formData.volume,
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
          cargo_photos: formData.cargo_photos // 货品照片URL数组
        }
      })

      console.log('创建需求响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: '需求发布成功',
          icon: 'success'
        })

        // 触发需求列表刷新事件
        Taro.eventCenter.trigger('demandListRefresh')

        setTimeout(() => {
          Taro.navigateBack()
        }, 1500)
      } else {
        Taro.showToast({
          title: res.data.message || '发布失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('发布需求失败:', error)
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
              <Text className="text-xs">发布需求</Text>
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
              onClick={() => Taro.navigateTo({ url: '/pages/merchant/stats/index' })}
            >
              <Text className="text-xs">数据统计</Text>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => Taro.navigateTo({ url: '/pages/merchant/address-books/index' })}
            >
              <BookOpen size={16} color="#6b7280" />
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

      <Card className="bg-white rounded-lg shadow-sm m-4">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            发布需求
          </CardTitle>
        </CardHeader>
        <CardContent>
          <View className="space-y-4">
            {/* 货品照片 */}
            <View>
              <Label className="block text-sm font-medium mb-2">
                货品照片
                <Text className="text-gray-400 text-xs ml-2">（可选，最多1张）</Text>
              </Label>
              <View className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-primary"
                  onClick={handleChoosePhotos}
                  disabled={formData.cargo_photos.length >= 1 || uploadingPhotos}
                >
                  <Text className="text-xs">
                    {uploadingPhotos ? '上传中...' : formData.cargo_photos.length >= 1 ? '已满' : '📷 拍照'}
                  </Text>
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-indigo-500"
                  onClick={handleAIAnalyze}
                  disabled={formData.cargo_photos.length === 0 || loading || uploadingPhotos}
                >
                  <Text className="text-xs">🤖 AI分析</Text>
                </Button>
              </View>

              {/* 图片预览 */}
              {formData.cargo_photos.length > 0 && (
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

            <View>
              <Label className="block text-sm font-medium mb-2">
                <Text className="text-red-500">*</Text>取货时间
              </Label>
              <View className="flex gap-3">
                <Picker
                  mode="date"
                  value={formData.pickup_time ? formData.pickup_time.split(' ')[0] : ''}
                  onChange={handlePickupDateSelect}
                >
                  <View className="flex-1 bg-muted rounded-lg px-4 py-3 flex items-center justify-between">
                    <Text className={`text-sm ${formData.pickup_time ? 'text-gray-900' : 'text-gray-400'}`}>
                      {formData.pickup_time ? formData.pickup_time.split(' ')[0] : '选择日期'}
                    </Text>
                    <Text className="text-gray-400">📅</Text>
                  </View>
                </Picker>
                <Picker
                  mode="time"
                  value={formData.pickup_time ? formData.pickup_time.split(' ')[1].slice(0, 5) : ''}
                  onChange={handlePickupTimeSelect}
                >
                  <View className="flex-1 bg-muted rounded-lg px-4 py-3 flex items-center justify-between">
                    <Text className={`text-sm ${formData.pickup_time ? 'text-gray-900' : 'text-gray-400'}`}>
                      {formData.pickup_time ? formData.pickup_time.split(' ')[1].slice(0, 5) : '选择时间'}
                    </Text>
                    <Text className="text-gray-400">⏰</Text>
                  </View>
                </Picker>
              </View>
            </View>

            {/* 快捷选择区域 */}
            <View className="bg-accent rounded-lg p-3">
              <Text className="block text-sm font-medium text-primary mb-2">快捷选择</Text>
              <Button
                size="sm"
                className="w-full bg-primary"
                onClick={() => setShowRoutePicker(true)}
                disabled={favoriteRoutes.length === 0}
              >
                <Route size={14} color="#fff" />
                <Text className="text-xs ml-1">常用线路</Text>
              </Button>
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
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => Taro.navigateTo({ url: '/pages/merchant/address-books/index' })}
                >
                  <BookOpen size={14} color="#6b7280" />
                </Button>
              </View>

              {formData.pickup_location && (
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
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => Taro.navigateTo({ url: '/pages/merchant/address-books/index' })}
                >
                  <BookOpen size={14} color="#6b7280" />
                </Button>
              </View>

              {formData.delivery_location && (
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
              disabled={loading}
            >
              <Text className="text-white font-medium">
                {loading ? '发布中...' : '发布需求'}
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
                    <Check size={16} color="#0062ff" />
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
            <Button
              onClick={() => {
                setShowAddressPicker(undefined)
                Taro.navigateTo({ url: '/pages/merchant/address-books/index' })
              }}
            >
              <Text className="text-xs">添加地址</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 常用线路选择弹窗 */}
      <Dialog open={showRoutePicker} onOpenChange={(open) => !open && setShowRoutePicker(false)}>
        <DialogContent className="max-h-[60vh]">
          <DialogHeader>
            <DialogTitle>选择常用线路</DialogTitle>
          </DialogHeader>
          <View className="space-y-2">
            {favoriteRoutes.length === 0 ? (
              <View className="text-center py-8">
                <Text className="block text-gray-400 text-sm">暂无常用线路</Text>
              </View>
            ) : (
              favoriteRoutes.map((route) => (
                <View
                  key={route.id}
                  className="bg-muted rounded-lg p-3"
                  onClick={() => handleSelectRoute(route)}
                >
                  <View className="flex items-start gap-2 mb-2">
                    <Route size={16} color="#6b7280" />
                    <Text className="block text-sm font-medium text-gray-900 flex-1">
                      {route.route_name}
                    </Text>
                    {route.use_count > 0 && (
                      <Text className="text-xs text-gray-500">
                        使用 {route.use_count} 次
                      </Text>
                    )}
                  </View>
                  <View className="ml-6">
                    <Text className="block text-xs text-gray-600 mb-1">
                      取：{route.pickup_address?.address || '-'}
                    </Text>
                    <Text className="block text-xs text-gray-600">
                      送：{route.delivery_address?.address || '-'}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRoutePicker(false)}
            >
              <Text className="text-xs">取消</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  )
}
