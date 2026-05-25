import { useEffect, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Network } from '@/network'

interface Vehicle {
  id: string
  vehicle_type: string
  license_plate: string
  load_capacity: number
  volume: number
  battery_life: number
  has_cold_chain: boolean
  status: string
  is_available: boolean
  photos: string | null
  remarks: string | null
  created_at: string
  // 定价字段
  base_price?: number
  base_distance?: number
  price_per_km?: number
  // 租赁字段
  is_available_for_rent: boolean
  current_renter_id: string | null
  rent_start_date: string | null
  rent_end_date: string | null
  // 车辆归属类型
  ownership_type: 'owned' | 'rented'
  // 出车状态控制权限
  can_toggle_availability: boolean
  availability_control_reason: string | null
}

export default function OwnerVehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [formData, setFormData] = useState({
    vehicle_type: '',
    license_plate: '',
    load_capacity: '',
    volume: '',
    battery_life: '',
    has_cold_chain: 'false',
    // 定价字段
    base_price: '20',
    base_distance: '3',
    price_per_km: '2'
  })
  const [photoUrls, setPhotoUrls] = useState<string[]>([])

  useEffect(() => {
    const userInfo = Taro.getStorageSync('userInfo')
    if (!userInfo || userInfo.role !== 'owner') {
      Taro.showToast({
        title: '请先登录',
        icon: 'none'
      })
      setTimeout(() => {
        Taro.redirectTo({ url: '/pages/index/index' })
      }, 1500)
      return
    }
    loadVehicles()
  }, [])

  // 页面显示时刷新数据（包括从子页面返回时）
  useDidShow(() => {
    const userInfo = Taro.getStorageSync('userInfo')
    if (userInfo && userInfo.role === 'owner') {
      console.log('页面显示，刷新车辆列表')
      loadVehicles()
    }
  })

  const loadVehicles = async () => {
    const userInfo = Taro.getStorageSync('userInfo')
    try {
      const res = await Network.request({
        url: '/api/vehicles',
        data: { 
          owner_id: userInfo.id,
          user_id: userInfo.id
        }
      })

      console.log('车辆列表响应:', res.data)

      if (res.data.code === 200) {
        setVehicles(res.data.data)
      }
    } catch (error) {
      console.error('加载车辆列表失败:', error)
    }
  }

  const handleAddVehicle = () => {
    setShowAddForm(true)
  }

  const handleCancelAdd = () => {
    setShowAddForm(false)
    setFormData({
      vehicle_type: '',
      license_plate: '',
      load_capacity: '',
      volume: '',
      battery_life: '',
      has_cold_chain: 'false',
      base_price: '20',
      base_distance: '3',
      price_per_km: '2'
    })
    setPhotoUrls([])
  }

  const handleEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle)
    setFormData({
      vehicle_type: vehicle.vehicle_type,
      license_plate: vehicle.license_plate,
      load_capacity: vehicle.load_capacity.toString(),
      volume: vehicle.volume.toString(),
      battery_life: vehicle.battery_life.toString(),
      has_cold_chain: vehicle.has_cold_chain ? 'true' : 'false',
      base_price: (vehicle.base_price || 20).toString(),
      base_distance: (vehicle.base_distance || 3).toString(),
      price_per_km: (vehicle.price_per_km || 2).toString()
    })
    setPhotoUrls(parsePhotoUrls(vehicle.photos))
    setShowEditForm(true)
  }

  const handleCancelEdit = () => {
    setShowEditForm(false)
    setEditingVehicle(null)
    setFormData({
      vehicle_type: '',
      license_plate: '',
      load_capacity: '',
      volume: '',
      battery_life: '',
      has_cold_chain: 'false',
      base_price: '20',
      base_distance: '3',
      price_per_km: '2'
    })
    setPhotoUrls([])
  }

  const handleChoosePhoto = async () => {
    try {
      const res = await Taro.chooseImage({
        count: 3,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      })

      console.log('选择照片成功:', res.tempFilePaths)

      // 上传每张照片
      setUploadingPhoto(true)

      const uploadPromises = res.tempFilePaths.map(async (filePath) => {
        try {
          console.log('[上传照片] 开始上传:', filePath)

          const uploadRes = await Network.uploadFile({
            url: '/api/vehicles/upload-photo',
            filePath: filePath,
            name: 'photo'
          })

          console.log('[上传照片] 原始响应:', uploadRes)
          console.log('[上传照片] statusCode:', uploadRes.statusCode)
          console.log('[上传照片] data:', uploadRes.data)
          console.log('[上传照片] data type:', typeof uploadRes.data)

          // 检查 HTTP 状态码
          if (uploadRes.statusCode !== 200) {
            console.error('[上传照片] HTTP 状态码错误:', uploadRes.statusCode)
            throw new Error(`上传失败，状态码: ${uploadRes.statusCode}`)
          }

          // 解析响应数据
          let response: any
          try {
            response = JSON.parse(uploadRes.data)
          } catch (parseError) {
            console.error('[上传照片] JSON 解析失败:', parseError)
            throw new Error('响应数据格式错误')
          }

          console.log('[上传照片] 解析后响应:', response)

          if (response.code === 200) {
            console.log('[上传照片] 成功，URL:', response.data.url)
            return response.data.url
          } else {
            console.error('[上传照片] 业务错误:', response.message)
            throw new Error(response.message || '上传失败')
          }
        } catch (error) {
          console.error('[上传照片] 异常:', error)
          throw error
        }
      })

      const urls = await Promise.all(uploadPromises)
      setPhotoUrls([...photoUrls, ...urls])

      Taro.showToast({
        title: '照片上传成功',
        icon: 'success'
      })
    } catch (error) {
      console.error('选择照片失败:', error)
      Taro.showToast({
        title: '操作失败',
        icon: 'none'
      })
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleDeletePhoto = (index: number) => {
    const newPhotoUrls = [...photoUrls]
    newPhotoUrls.splice(index, 1)
    setPhotoUrls(newPhotoUrls)
  }

  const parsePhotoUrls = (photosJson: string | null): string[] => {
    if (!photosJson) return []
    try {
      return JSON.parse(photosJson)
    } catch {
      return []
    }
  }

  const handleUpdateVehicle = async () => {
    if (!editingVehicle) return

    if (!formData.vehicle_type || !formData.license_plate || !formData.load_capacity || !formData.volume || !formData.battery_life) {
      Taro.showToast({
        title: '请填写完整信息',
        icon: 'none'
      })
      return
    }

    setLoading(true)

    try {
      const res = await Network.request({
        url: `/api/vehicles/${editingVehicle.id}`,
        method: 'PUT',
        data: {
          vehicle_type: formData.vehicle_type,
          license_plate: formData.license_plate,
          load_capacity: formData.load_capacity,
          volume: formData.volume,
          battery_life: formData.battery_life,
          has_cold_chain: formData.has_cold_chain,
          photoUrls: photoUrls,
          // 定价字段（转换为数字）
          base_price: parseFloat(formData.base_price) || 20,
          base_distance: parseFloat(formData.base_distance) || 3,
          price_per_km: parseFloat(formData.price_per_km) || 2
        }
      })

      console.log('更新车辆响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: '车辆信息已更新',
          icon: 'success'
        })

        setShowEditForm(false)
        setEditingVehicle(null)
        setFormData({
          vehicle_type: '',
          license_plate: '',
          load_capacity: '',
          volume: '',
          battery_life: '',
          has_cold_chain: 'false',
          base_price: '20',
          base_distance: '3',
          price_per_km: '2'
        })
        setPhotoUrls([])

        loadVehicles()
      } else {
        Taro.showToast({
          title: res.data.message || '更新失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('更新车辆失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleResubmit = async (vehicleId: string) => {
    Taro.showModal({
      title: '确认重新提交',
      content: '确认重新提交审核？',
      success: async (res) => {
        if (res.confirm) {
          setLoading(true)
          try {
            const dataRes = await Network.request({
              url: `/api/vehicles/${vehicleId}/resubmit`,
              method: 'POST'
            })

            console.log('重新提交响应:', dataRes.data)

            if (dataRes.data.code === 200) {
              Taro.showToast({
                title: '已重新提交，等待审核',
                icon: 'success'
              })
              loadVehicles()
            } else {
              Taro.showToast({
                title: dataRes.data.message || '重新提交失败',
                icon: 'none'
              })
            }
          } catch (error) {
            console.error('重新提交失败:', error)
            Taro.showToast({
              title: '网络错误，请重试',
              icon: 'none'
            })
          } finally {
            setLoading(false)
          }
        }
      }
    })
  }

  const handleSubmit = async () => {
    if (!formData.vehicle_type || !formData.license_plate || !formData.load_capacity || !formData.volume || !formData.battery_life) {
      Taro.showToast({
        title: '请填写完整信息',
        icon: 'none'
      })
      return
    }

    setLoading(true)

    try {
      const userInfo = Taro.getStorageSync('userInfo')

      const res = await Network.request({
        url: '/api/vehicles',
        method: 'POST',
        data: {
          owner_id: userInfo.id,
          vehicle_type: formData.vehicle_type,
          license_plate: formData.license_plate,
          load_capacity: formData.load_capacity,
          volume: formData.volume,
          battery_life: formData.battery_life,
          has_cold_chain: formData.has_cold_chain,
          photoUrls: photoUrls,
          // 定价字段（转换为数字）
          base_price: parseFloat(formData.base_price) || 20,
          base_distance: parseFloat(formData.base_distance) || 3,
          price_per_km: parseFloat(formData.price_per_km) || 2
        }
      })

      console.log('创建车辆响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: '车辆注册成功，等待审核',
          icon: 'success'
        })

        setShowAddForm(false)
        setFormData({
          vehicle_type: '',
          license_plate: '',
          load_capacity: '',
          volume: '',
          battery_life: '',
          has_cold_chain: 'false',
          base_price: '20',
          base_distance: '3',
          price_per_km: '2'
        })
        setPhotoUrls([])

        // 重新加载车辆列表
        loadVehicles()
      } else {
        Taro.showToast({
          title: res.data.message || '注册失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('注册车辆失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleToggleAvailability = async (vehicleId: string, newAvailability: boolean) => {
    try {
      const userInfo = Taro.getStorageSync('userInfo')
      const res = await Network.request({
        url: `/api/vehicles/${vehicleId}/availability?id=${vehicleId}`,
        method: 'PUT',
        data: { 
          is_available: newAvailability,
          user_id: userInfo.id
        }
      })

      console.log('切换运营状态响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: newAvailability ? '车辆已出车' : '车辆已不出车',
          icon: 'success'
        })
        loadVehicles()
      } else {
        Taro.showToast({
          title: res.data.message || '操作失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('切换运营状态失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500'
      case 'inactive':
        return 'bg-gray-500'
      case 'pending':
        return 'bg-yellow-500'
      case 'rejected':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return '可用'
      case 'inactive':
        return '不可用'
      case 'pending':
        return '待审核'
      case 'rejected':
        return '已拒绝'
      default:
        return '未知'
    }
  }

  return (
    <View className="min-h-screen bg-gray-100">
      {/* 导航菜单 */}
      <View className="bg-white shadow-sm">
        <View className="px-4 py-3">
          <View className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => Taro.navigateTo({ url: '/pages/owner/demands/index' })}
            >
              <Text className="text-xs">接单大厅</Text>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => Taro.navigateTo({ url: '/pages/owner/orders/index' })}
            >
              <Text className="text-xs">订单管理</Text>
            </Button>
            <Button
              size="sm"
              className="bg-blue-500"
            >
              <Text className="text-xs">车辆管理</Text>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => Taro.navigateTo({ url: '/pages/owner/profile/index' })}
            >
              <Text className="text-xs">我的</Text>
            </Button>
          </View>
        </View>
      </View>

      <View className="px-4 py-4">
        {/* 车辆列表 */}
        <Card className="bg-white rounded-lg shadow-sm mb-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">
              我的车辆
            </CardTitle>
            <View className="flex gap-2">
              <Button
                size="sm"
                className="bg-green-500"
                onClick={() => Taro.navigateTo({ url: '/pages/owner/vehicle-map/index' })}
              >
                <Text>地图</Text>
              </Button>
              <Button
                size="sm"
                className="bg-blue-500"
                onClick={handleAddVehicle}
              >
                <Text>注册车辆</Text>
              </Button>
            </View>
          </CardHeader>
          <CardContent>
            {vehicles.length === 0 ? (
              <View className="text-center py-8">
                <Text className="block text-gray-500 text-sm mb-4">
                  您还没有注册车辆
                </Text>
                <Button
                  className="bg-blue-500"
                  onClick={handleAddVehicle}
                >
                  <Text>注册车辆</Text>
                </Button>
              </View>
            ) : (
              <View className="space-y-3">
                {vehicles.map((vehicle) => {
                  const vehiclePhotos = parsePhotoUrls(vehicle.photos)
                  return (
                    <Collapsible key={vehicle.id}>
                      <View className="bg-gray-50 rounded-lg overflow-hidden">
                        {/* 收起状态：核心信息 */}
                        <CollapsibleTrigger>
                          <View className="p-4">
                            <View className="flex justify-between items-center">
                              <View className="flex-1">
                                <View className="flex items-center gap-2 mb-2">
                                  <Text className="font-medium text-base">
                                    {vehicle.vehicle_type}
                                  </Text>
                                  {/* 核心状态标签 */}
                                  <View className="flex items-center gap-1 flex-wrap">
                                    <Badge className={vehicle.ownership_type === 'owned' ? 'bg-blue-600' : 'bg-purple-600'}>
                                      <Text className="text-white text-xs">
                                        {vehicle.ownership_type === 'owned' ? '自有' : '租赁'}
                                      </Text>
                                    </Badge>
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
                                    {vehicle.status === 'active' && (
                                      <Badge className={vehicle.is_available ? 'bg-green-500' : 'bg-gray-500'}>
                                        <Text className="text-white text-xs">
                                          {vehicle.is_available ? '出车中' : '已出车'}
                                        </Text>
                                      </Badge>
                                    )}
                                  </View>
                                </View>
                                <Text className="text-xs text-gray-600">
                                  车牌: {vehicle.license_plate || '未填写'}
                                </Text>
                              </View>

                              {/* 右侧操作区 */}
                              <View className="flex items-center gap-2 flex-shrink-0">
                                {vehicle.status === 'active' && (
                                  <Switch
                                    checked={vehicle.is_available}
                                    onCheckedChange={(checked) => handleToggleAvailability(vehicle.id, checked)}
                                    disabled={!vehicle.can_toggle_availability}
                                  />
                                )}
                                <Text className="text-gray-400 text-sm">▼</Text>
                              </View>
                            </View>

                            {/* 操作按钮 */}
                            {vehicle.status === 'active' && (
                              <View className="flex items-center gap-2 mt-3">
                                {vehicle.ownership_type === 'owned' && !vehicle.current_renter_id && (
                                  <Button
                                    size="sm"
                                    className="bg-blue-500"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      console.log('✓✓✓ 设置租赁按钮点击！vehicleId:', vehicle.id)
                                      const url = `/pages/owner/vehicles/rental-settings/index?vehicleId=${vehicle.id}`
                                      console.log('准备跳转URL:', url)
                                      Taro.navigateTo({
                                        url,
                                        success: () => {
                                          console.log('✓✓✓ 跳转成功！')
                                        },
                                        fail: (err) => {
                                          console.error('✗✗✗ 跳转失败:', err)
                                          const errMsg = err.errMsg || JSON.stringify(err)
                                          Taro.showToast({
                                            title: `跳转失败: ${errMsg}`,
                                            icon: 'none',
                                            duration: 3000
                                          })
                                        }
                                      })
                                    }}
                                  >
                                    <Text className="text-xs">设置租赁</Text>
                                  </Button>
                                )}
                                {!vehicle.can_toggle_availability && vehicle.availability_control_reason && (
                                  <Text className="text-xs text-gray-400">
                                    {vehicle.availability_control_reason}
                                  </Text>
                                )}
                              </View>
                            )}
                            {vehicle.status === 'rejected' && (
                              <View className="flex items-center gap-2 mt-3">
                                <Button
                                  size="sm"
                                  className="bg-blue-500"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleEditVehicle(vehicle)
                                  }}
                                >
                                  <Text className="text-xs">编辑</Text>
                                </Button>
                                <Button
                                  size="sm"
                                  className="bg-green-500"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleResubmit(vehicle.id)
                                  }}
                                >
                                  <Text className="text-xs">重新提交</Text>
                                </Button>
                              </View>
                            )}
                          </View>
                        </CollapsibleTrigger>

                        {/* 展开状态：完整详情 */}
                        <CollapsibleContent>
                          <View className="px-4 pb-4 border-t border-gray-200 pt-3">
                            {/* 规格参数 */}
                            <View className="mb-3 p-3 bg-white rounded-lg">
                              <Text className="text-xs font-medium text-gray-700 mb-2 block">
                                🚚 规格参数
                              </Text>
                              <View className="flex items-center gap-3 flex-wrap">
                                <Text className="text-xs text-gray-600">
                                  载重: {vehicle.load_capacity}kg
                                </Text>
                                <Text className="text-xs text-gray-600">
                                  体积: {vehicle.volume}m³
                                </Text>
                                <Text className="text-xs text-gray-600">
                                  续航: {vehicle.battery_life}km
                                </Text>
                              </View>
                            </View>

                            {/* 定价信息 */}
                            {(vehicle.base_price || vehicle.base_distance || vehicle.price_per_km) && (
                              <View className="mb-3 p-3 bg-white rounded-lg">
                                <Text className="text-xs font-medium text-gray-700 mb-2 block">
                                  💰 定价信息
                                </Text>
                                <Text className="text-xs text-blue-600">
                                  起步¥{vehicle.base_price || 20}（{vehicle.base_distance || 3}公里）+ ¥{vehicle.price_per_km || 2}/公里
                                </Text>
                              </View>
                            )}

                            {/* 租赁状态 */}
                            {vehicle.ownership_type === 'owned' && (
                              <View className="mb-3 p-3 bg-white rounded-lg">
                                <Text className="text-xs font-medium text-gray-700 mb-2 block">
                                  📋 租赁状态
                                </Text>
                                {vehicle.is_available_for_rent && !vehicle.current_renter_id && (
                                  <Text className="text-xs text-green-600">
                                    ✓ 可租赁
                                  </Text>
                                )}
                                {vehicle.current_renter_id && (
                                  <Text className="text-xs text-orange-600">
                                    ⚠️ 已出租
                                  </Text>
                                )}
                                {!vehicle.is_available_for_rent && !vehicle.current_renter_id && (
                                  <Text className="text-xs text-gray-500">
                                    未开启租赁
                                  </Text>
                                )}
                              </View>
                            )}

                            {/* 租赁到期信息 */}
                            {vehicle.current_renter_id && vehicle.rent_end_date && (
                              <View className="mb-3 p-3 bg-orange-50 rounded-lg">
                                <Text className="text-xs text-orange-600">
                                  ⚠️ 车辆已租出，到期时间：{vehicle.rent_end_date.split('T')[0]}
                                </Text>
                              </View>
                            )}

                            {/* 车辆照片 */}
                            {vehiclePhotos.length > 0 && (
                              <View className="mb-3 p-3 bg-white rounded-lg">
                                <Text className="text-xs font-medium text-gray-700 mb-2 block">
                                  📷 车辆照片
                                </Text>
                                <View className="flex gap-2 flex-wrap">
                                  {vehiclePhotos.map((photoUrl, idx) => (
                                    <Image
                                      key={idx}
                                      src={photoUrl}
                                      mode="aspectFill"
                                      className="w-20 h-20 rounded-lg bg-gray-200"
                                      onClick={() => Taro.previewImage({
                                        current: idx,
                                        urls: vehiclePhotos
                                      })}
                                    />
                                  ))}
                                </View>
                              </View>
                            )}

                            {/* 拒绝原因 */}
                            {vehicle.remarks && (
                              <View className="mb-3 p-3 bg-red-50 rounded-lg">
                                <Text className="text-xs text-red-600 font-medium mb-1 block">
                                  ❌ 拒绝原因
                                </Text>
                                <Text className="text-xs text-red-500">
                                  {vehicle.remarks}
                                </Text>
                              </View>
                            )}

                            {/* 注册时间 */}
                            <Text className="text-xs text-gray-400">
                              注册时间: {new Date(vehicle.created_at).toLocaleString()}
                            </Text>
                          </View>
                        </CollapsibleContent>
                      </View>
                    </Collapsible>
                  )
                })}
              </View>
            )}
          </CardContent>
        </Card>

        {/* 添加车辆表单 */}
        {showAddForm && (
          <Card className="bg-white rounded-lg shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                注册车辆
              </CardTitle>
            </CardHeader>
            <CardContent>
              <View className="space-y-4">
                <View>
                  <Label className="block text-sm font-medium mb-2">
                    <Text className="text-red-500">*</Text>车型
                  </Label>
                  <View className="bg-gray-50 rounded-lg px-4 py-3">
                    <Input
                      className="w-full bg-transparent"
                      placeholder="如：小型无人配送车"
                      value={formData.vehicle_type}
                      onInput={(e) => setFormData({ ...formData, vehicle_type: e.detail.value })}
                    />
                  </View>
                </View>

                <View>
                  <Label className="block text-sm font-medium mb-2">
                    <Text className="text-red-500">*</Text>车牌号
                  </Label>
                  <View className="bg-gray-50 rounded-lg px-4 py-3">
                    <Input
                      className="w-full bg-transparent"
                      placeholder="如：京A12345"
                      value={formData.license_plate}
                      onInput={(e) => setFormData({ ...formData, license_plate: e.detail.value })}
                    />
                  </View>
                </View>

                <View>
                  <Label className="block text-sm font-medium mb-2">
                    <Text className="text-red-500">*</Text>载重（公斤）
                  </Label>
                  <View className="bg-gray-50 rounded-lg px-4 py-3">
                    <Input
                      className="w-full bg-transparent"
                      placeholder="如：50"
                      type="number"
                      value={formData.load_capacity}
                      onInput={(e) => setFormData({ ...formData, load_capacity: e.detail.value })}
                    />
                  </View>
                </View>

                <View>
                  <Label className="block text-sm font-medium mb-2">
                    <Text className="text-red-500">*</Text>体积（立方米）
                  </Label>
                  <View className="bg-gray-50 rounded-lg px-4 py-3">
                    <Input
                      className="w-full bg-transparent"
                      placeholder="如：0.5"
                      type="digit"
                      value={formData.volume}
                      onInput={(e) => setFormData({ ...formData, volume: e.detail.value })}
                    />
                  </View>
                </View>

                <View>
                  <Label className="block text-sm font-medium mb-2">
                    <Text className="text-red-500">*</Text>续航（公里）
                  </Label>
                  <View className="bg-gray-50 rounded-lg px-4 py-3">
                    <Input
                      className="w-full bg-transparent"
                      placeholder="如：100"
                      type="number"
                      value={formData.battery_life}
                      onInput={(e) => setFormData({ ...formData, battery_life: e.detail.value })}
                    />
                  </View>
                </View>

                <View>
                  <Label className="block text-sm font-medium mb-2">
                    是否有冷链能力
                  </Label>
                  <View className="flex items-center gap-3">
                    <Switch
                      checked={formData.has_cold_chain === 'true'}
                      onCheckedChange={(checked: boolean) => setFormData({ ...formData, has_cold_chain: checked ? 'true' : 'false' })}
                    />
                    <Text className="text-sm text-gray-600">
                      {formData.has_cold_chain === 'true' ? '支持冷链运输' : '不支持冷链运输'}
                    </Text>
                  </View>
                </View>

                {/* 定价设置 */}
                <View className="border-t pt-4">
                  <Label className="block text-base font-semibold mb-3">
                    💰 定价设置
                  </Label>
                  <View className="bg-blue-50 p-3 rounded-lg mb-3">
                    <Text className="block text-xs text-blue-600">
                      运费计算公式：起步价 + (总距离 - 起步公里数) × 每公里运价
                    </Text>
                  </View>

                  <View>
                    <Label className="block text-sm font-medium mb-2">
                      起步价（元）
                    </Label>
                    <View className="bg-gray-50 rounded-lg px-4 py-3">
                      <Input
                        className="w-full bg-transparent"
                        placeholder="默认 20 元"
                        type="digit"
                        value={formData.base_price}
                        onInput={(e) => setFormData({ ...formData, base_price: e.detail.value })}
                      />
                    </View>
                    <Text className="text-xs text-gray-500 mt-1">范围：10-500 元</Text>
                  </View>

                  <View>
                    <Label className="block text-sm font-medium mb-2">
                      起步公里数（公里）
                    </Label>
                    <View className="bg-gray-50 rounded-lg px-4 py-3">
                      <Input
                        className="w-full bg-transparent"
                        placeholder="默认 3 公里"
                        type="digit"
                        value={formData.base_distance}
                        onInput={(e) => setFormData({ ...formData, base_distance: e.detail.value })}
                      />
                    </View>
                    <Text className="text-xs text-gray-500 mt-1">范围：1-10 公里</Text>
                  </View>

                  <View>
                    <Label className="block text-sm font-medium mb-2">
                      每公里运价（元）
                    </Label>
                    <View className="bg-gray-50 rounded-lg px-4 py-3">
                      <Input
                        className="w-full bg-transparent"
                        placeholder="默认 2 元/公里"
                        type="digit"
                        value={formData.price_per_km}
                        onInput={(e) => setFormData({ ...formData, price_per_km: e.detail.value })}
                      />
                    </View>
                    <Text className="text-xs text-gray-500 mt-1">范围：0.5-20 元/公里</Text>
                  </View>

                  {/* 运费计算预览 */}
                  <View className="bg-green-50 p-3 rounded-lg mt-3">
                    <Text className="block text-sm font-medium text-green-700 mb-2">
                      📊 运费计算预览
                    </Text>
                    <Text className="block text-xs text-green-600">
                      示例：距离 10 公里 → 运费 = {formData.base_price || 20} + (10 - {formData.base_distance || 3}) × {formData.price_per_km || 2} =
                      {((parseFloat(formData.base_price) || 20) + (10 - (parseFloat(formData.base_distance) || 3)) * (parseFloat(formData.price_per_km) || 2)).toFixed(2)} 元
                    </Text>
                  </View>
                </View>

                {/* 照片上传 */}
                <View>
                  <Label className="block text-sm font-medium mb-2">
                    车辆照片（最多3张）
                  </Label>
                  {photoUrls.length > 0 ? (
                    <View className="flex gap-2 flex-wrap mb-2">
                      {photoUrls.map((url, index) => (
                        <View key={index} className="relative">
                          <Image
                            src={url}
                            mode="aspectFill"
                            className="w-20 h-20 rounded-lg bg-gray-200"
                            onClick={() => Taro.previewImage({
                              current: index,
                              urls: photoUrls
                            })}
                          />
                          <View
                            className="absolute top-0 right-0 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                            onClick={() => handleDeletePhoto(index)}
                          >
                            <Text className="text-white text-xs">×</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text className="text-xs text-gray-400 mb-2 block">
                      请上传车辆照片，以便平台审核
                    </Text>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleChoosePhoto}
                    disabled={uploadingPhoto || photoUrls.length >= 3}
                  >
                    <Text>
                      {uploadingPhoto ? '上传中...' : photoUrls.length >= 3 ? '已达上限' : '添加照片'}
                    </Text>
                  </Button>
                </View>

                <View className="flex gap-3 pt-2">
                  <Button
                    className="flex-1 bg-gray-200"
                    onClick={handleCancelAdd}
                  >
                    <Text>取消</Text>
                  </Button>
                  <Button
                    className="flex-1 bg-blue-500"
                    onClick={handleSubmit}
                    disabled={loading}
                  >
                    <Text>{loading ? '提交中...' : '提交'}</Text>
                  </Button>
                </View>
              </View>
            </CardContent>
          </Card>
        )}

        {/* 编辑车辆表单 */}
        {showEditForm && editingVehicle && (
          <Card className="bg-white rounded-lg shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                编辑车辆信息
              </CardTitle>
            </CardHeader>
            <CardContent>
              <View className="space-y-4">
                <View>
                  <Label className="block text-sm font-medium mb-2">
                    <Text className="text-red-500">*</Text>车型
                  </Label>
                  <View className="bg-gray-50 rounded-lg px-4 py-3">
                    <Input
                      className="w-full bg-transparent"
                      placeholder="如：小型无人配送车"
                      value={formData.vehicle_type}
                      onInput={(e) => setFormData({ ...formData, vehicle_type: e.detail.value })}
                    />
                  </View>
                </View>

                <View>
                  <Label className="block text-sm font-medium mb-2">
                    <Text className="text-red-500">*</Text>车牌号
                  </Label>
                  <View className="bg-gray-50 rounded-lg px-4 py-3">
                    <Input
                      className="w-full bg-transparent"
                      placeholder="如：京A12345"
                      value={formData.license_plate}
                      onInput={(e) => setFormData({ ...formData, license_plate: e.detail.value })}
                    />
                  </View>
                </View>

                <View>
                  <Label className="block text-sm font-medium mb-2">
                    <Text className="text-red-500">*</Text>载重（公斤）
                  </Label>
                  <View className="bg-gray-50 rounded-lg px-4 py-3">
                    <Input
                      className="w-full bg-transparent"
                      placeholder="如：50"
                      type="number"
                      value={formData.load_capacity}
                      onInput={(e) => setFormData({ ...formData, load_capacity: e.detail.value })}
                    />
                  </View>
                </View>

                <View>
                  <Label className="block text-sm font-medium mb-2">
                    <Text className="text-red-500">*</Text>体积（立方米）
                  </Label>
                  <View className="bg-gray-50 rounded-lg px-4 py-3">
                    <Input
                      className="w-full bg-transparent"
                      placeholder="如：0.5"
                      type="digit"
                      value={formData.volume}
                      onInput={(e) => setFormData({ ...formData, volume: e.detail.value })}
                    />
                  </View>
                </View>

                <View>
                  <Label className="block text-sm font-medium mb-2">
                    <Text className="text-red-500">*</Text>续航（公里）
                  </Label>
                  <View className="bg-gray-50 rounded-lg px-4 py-3">
                    <Input
                      className="w-full bg-transparent"
                      placeholder="如：100"
                      type="number"
                      value={formData.battery_life}
                      onInput={(e) => setFormData({ ...formData, battery_life: e.detail.value })}
                    />
                  </View>
                </View>

                <View>
                  <Label className="block text-sm font-medium mb-2">
                    是否有冷链能力
                  </Label>
                  <View className="flex items-center gap-3">
                    <Switch
                      checked={formData.has_cold_chain === 'true'}
                      onCheckedChange={(checked: boolean) => setFormData({ ...formData, has_cold_chain: checked ? 'true' : 'false' })}
                    />
                    <Text className="text-sm text-gray-600">
                      {formData.has_cold_chain === 'true' ? '支持冷链运输' : '不支持冷链运输'}
                    </Text>
                  </View>
                </View>

                {/* 定价设置 */}
                <View className="border-t pt-4">
                  <Label className="block text-base font-semibold mb-3">
                    💰 定价设置
                  </Label>
                  <View className="bg-blue-50 p-3 rounded-lg mb-3">
                    <Text className="block text-xs text-blue-600">
                      运费计算公式：起步价 + (总距离 - 起步公里数) × 每公里运价
                    </Text>
                  </View>

                  <View>
                    <Label className="block text-sm font-medium mb-2">
                      起步价（元）
                    </Label>
                    <View className="bg-gray-50 rounded-lg px-4 py-3">
                      <Input
                        className="w-full bg-transparent"
                        placeholder="默认 20 元"
                        type="digit"
                        value={formData.base_price}
                        onInput={(e) => setFormData({ ...formData, base_price: e.detail.value })}
                      />
                    </View>
                    <Text className="text-xs text-gray-500 mt-1">范围：10-500 元</Text>
                  </View>

                  <View>
                    <Label className="block text-sm font-medium mb-2">
                      起步公里数（公里）
                    </Label>
                    <View className="bg-gray-50 rounded-lg px-4 py-3">
                      <Input
                        className="w-full bg-transparent"
                        placeholder="默认 3 公里"
                        type="digit"
                        value={formData.base_distance}
                        onInput={(e) => setFormData({ ...formData, base_distance: e.detail.value })}
                      />
                    </View>
                    <Text className="text-xs text-gray-500 mt-1">范围：1-10 公里</Text>
                  </View>

                  <View>
                    <Label className="block text-sm font-medium mb-2">
                      每公里运价（元）
                    </Label>
                    <View className="bg-gray-50 rounded-lg px-4 py-3">
                      <Input
                        className="w-full bg-transparent"
                        placeholder="默认 2 元/公里"
                        type="digit"
                        value={formData.price_per_km}
                        onInput={(e) => setFormData({ ...formData, price_per_km: e.detail.value })}
                      />
                    </View>
                    <Text className="text-xs text-gray-500 mt-1">范围：0.5-20 元/公里</Text>
                  </View>

                  {/* 运费计算预览 */}
                  <View className="bg-green-50 p-3 rounded-lg mt-3">
                    <Text className="block text-sm font-medium text-green-700 mb-2">
                      📊 运费计算预览
                    </Text>
                    <Text className="block text-xs text-green-600">
                      示例：距离 10 公里 → 运费 = {formData.base_price || 20} + (10 - {formData.base_distance || 3}) × {formData.price_per_km || 2} =
                      {((parseFloat(formData.base_price) || 20) + (10 - (parseFloat(formData.base_distance) || 3)) * (parseFloat(formData.price_per_km) || 2)).toFixed(2)} 元
                    </Text>
                  </View>
                </View>

                {/* 照片上传 */}
                <View>
                  <Label className="block text-sm font-medium mb-2">
                    车辆照片（最多3张）
                  </Label>
                  {photoUrls.length > 0 ? (
                    <View className="flex gap-2 flex-wrap mb-2">
                      {photoUrls.map((url, index) => (
                        <View key={index} className="relative">
                          <Image
                            src={url}
                            mode="aspectFill"
                            className="w-20 h-20 rounded-lg bg-gray-200"
                            onClick={() => Taro.previewImage({
                              current: index,
                              urls: photoUrls
                            })}
                          />
                          <View
                            className="absolute top-0 right-0 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                            onClick={() => handleDeletePhoto(index)}
                          >
                            <Text className="text-white text-xs">×</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text className="text-xs text-gray-400 mb-2 block">
                      请上传车辆照片，以便平台审核
                    </Text>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleChoosePhoto}
                    disabled={uploadingPhoto || photoUrls.length >= 3}
                  >
                    <Text>
                      {uploadingPhoto ? '上传中...' : photoUrls.length >= 3 ? '已达上限' : '添加照片'}
                    </Text>
                  </Button>
                </View>

                <View className="flex gap-3 pt-2">
                  <Button
                    className="flex-1 bg-gray-200"
                    onClick={handleCancelEdit}
                  >
                    <Text>取消</Text>
                  </Button>
                  <Button
                    className="flex-1 bg-blue-500"
                    onClick={handleUpdateVehicle}
                    disabled={loading}
                  >
                    <Text>{loading ? '更新中...' : '保存修改'}</Text>
                  </Button>
                </View>
              </View>
            </CardContent>
          </Card>
        )}
      </View>
    </View>
  )
}
