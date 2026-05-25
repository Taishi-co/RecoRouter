import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import { Network } from '@/network'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { MapPin, Plus, Trash2, Building2, Star, House } from 'lucide-react-taro'

interface Address {
  id: string
  address_name: string
  address: string
  latitude: number
  longitude: number
  address_type: string
  is_default: boolean
}

export default function AddressBooks() {
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    address_name: '',
    address: '',
    latitude: '',
    longitude: '',
    address_type: 'other',
    is_default: false,
    showLocationInput: false
  })
  const [isMiniApp, setIsMiniApp] = useState(false)

  useEffect(() => {
    const env = Taro.getEnv()
    setIsMiniApp(env === Taro.ENV_TYPE.WEAPP || env === Taro.ENV_TYPE.TT)
    loadAddresses()
  }, [])

  const loadAddresses = async () => {
    try {
      const userInfo = Taro.getStorageSync('userInfo')

      const res = await Network.request({
        url: '/api/address-books',
        data: { user_id: userInfo.id }
      })

      console.log('[AddressBooks] 地址列表响应:', res.data)

      if (res.data.code === 200) {
        setAddresses(res.data.data || [])
      }
    } catch (error) {
      console.error('[AddressBooks] 加载地址列表失败:', error)
      Taro.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  }

  const handleAddAddress = async () => {
    if (!formData.address_name || !formData.address) {
      Taro.showToast({
        title: '请填写完整信息',
        icon: 'none'
      })
      return
    }

    if (!formData.latitude || !formData.longitude) {
      Taro.showToast({
        title: '请选择位置',
        icon: 'none'
      })
      return
    }

    setLoading(true)

    try {
      const userInfo = Taro.getStorageSync('userInfo')

      const res = await Network.request({
        url: '/api/address-books',
        method: 'POST',
        data: {
          user_id: userInfo.id,
          address_name: formData.address_name,
          address: formData.address,
          latitude: parseFloat(formData.latitude),
          longitude: parseFloat(formData.longitude),
          address_type: formData.address_type,
          is_default: formData.is_default
        }
      })

      console.log('[AddressBooks] 添加地址响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: '添加成功',
          icon: 'success'
        })

        setShowAddForm(false)
        setFormData({
          address_name: '',
          address: '',
          latitude: '',
          longitude: '',
          address_type: 'other',
          is_default: false,
          showLocationInput: false
        })

        loadAddresses()
      } else {
        Taro.showToast({
          title: res.data.message || '添加失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('[AddressBooks] 添加地址失败:', error)
      Taro.showToast({
        title: '添加失败',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleChooseLocation = async () => {
    try {
      if (!isMiniApp) {
        // H5 环境：提示用户手动输入经纬度
        setFormData({ ...formData, showLocationInput: true })
        return
      }

      // 小程序环境：先尝试获取用户实时位置
      let userLocation = {
        latitude: 39.6206,  // 唐山市纪念碑广场默认纬度
        longitude: 118.1802 // 唐山市纪念碑广场默认经度
      }

      try {
        const location = await Taro.getLocation({
          type: 'gcj02'
        })

        if (location && location.latitude && location.longitude) {
          userLocation = {
            latitude: location.latitude,
            longitude: location.longitude
          }
          console.log('[AddressBooks] 获取到用户实时位置:', userLocation)
        }
      } catch (locationError) {
        console.error('[AddressBooks] 获取用户位置失败，使用默认位置:', locationError)
        // 如果获取位置失败，使用默认的唐山市纪念碑广场坐标
        Taro.showToast({
          title: '定位失败，使用默认位置',
          icon: 'none'
        })
      }

      // 打开地图选择位置
      const selectedLocation = await Taro.chooseLocation({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude
      })

      if (selectedLocation) {
        setFormData({
          ...formData,
          address: selectedLocation.name || selectedLocation.address,
          latitude: selectedLocation.latitude.toString(),
          longitude: selectedLocation.longitude.toString()
        })
      }
    } catch (error) {
      console.error('[AddressBooks] 选择位置失败:', error)
      if (error.errMsg && error.errMsg.includes('cancel')) {
        return
      }
      Taro.showToast({
        title: '选择位置失败',
        icon: 'none'
      })
    }
  }

  const handleSetDefault = async (id: string) => {
    try {
      const res = await Network.request({
        url: `/api/address-books/${id}/set-default`,
        method: 'POST'
      })

      if (res.data.code === 200) {
        Taro.showToast({
          title: '设置成功',
          icon: 'success'
        })
        loadAddresses()
      }
    } catch (error) {
      console.error('[AddressBooks] 设置默认地址失败:', error)
      Taro.showToast({
        title: '设置失败',
        icon: 'none'
      })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const modalRes = await Taro.showModal({
        title: '确认删除',
        content: '确定要删除这个地址吗？'
      })

      if (modalRes.confirm) {
        const res = await Network.request({
          url: `/api/address-books/${id}`,
          method: 'DELETE'
        })

        if (res.data.code === 200) {
          Taro.showToast({
            title: '删除成功',
            icon: 'success'
          })
          loadAddresses()
        }
      }
    } catch (error) {
      console.error('[AddressBooks] 删除地址失败:', error)
    }
  }

  const getAddressTypeIcon = (type: string) => {
    switch (type) {
      case 'home':
        return <Building2 size={16} color="#3b82f6" />
      case 'work':
        return <Building2 size={16} color="#f59e0b" />
      default:
        return <MapPin size={16} color="#6b7280" />
    }
  }

  const getAddressTypeName = (type: string) => {
    switch (type) {
      case 'home':
        return '家'
      case 'work':
        return '公司'
      default:
        return '其他'
    }
  }

  return (
    <View className="min-h-screen bg-gray-50 pb-4">
      {/* 顶部标题栏 */}
      <View className="bg-white p-4 border-b">
        <Text className="text-lg font-semibold text-center">地址簿</Text>
      </View>

      {/* 添加地址按钮 */}
      {!showAddForm && (
        <View className="p-4">
          <Button
            className="w-full bg-blue-500 text-white"
            onClick={() => setShowAddForm(true)}
          >
            <Plus size={20} color="#ffffff" className="mr-2" />
            <Text>添加地址</Text>
          </Button>
        </View>
      )}

      {/* 添加地址表单 */}
      {showAddForm && (
        <Card className="m-4">
          <CardContent className="p-4 space-y-3">
            <View>
              <Text className="block text-sm font-medium mb-1">地址名称</Text>
              <View className="bg-gray-50 rounded px-3 py-2">
                <Input
                  className="w-full bg-transparent"
                  placeholder="如：公司、家"
                  value={formData.address_name}
                  onInput={(e) => setFormData({ ...formData, address_name: e.detail.value })}
                />
              </View>
            </View>

            <View>
              <Text className="block text-sm font-medium mb-1">详细地址</Text>
              <View className="flex gap-2">
                <View className="flex-1 bg-gray-50 rounded px-3 py-2">
                  <Input
                    className="w-full bg-transparent"
                    placeholder="请输入详细地址"
                    value={formData.address}
                    onInput={(e) => setFormData({ ...formData, address: e.detail.value })}
                  />
                </View>
                <Button
                  size="sm"
                  className="bg-blue-500 px-3"
                  onClick={handleChooseLocation}
                >
                  <Text className="text-xs">定位</Text>
                </Button>
              </View>
            </View>

            {formData.latitude && formData.longitude && (
              <Text className="block text-xs text-gray-500">
                位置：{formData.latitude}, {formData.longitude}
              </Text>
            )}

            {formData.showLocationInput && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-3">
                  <Text className="block text-sm font-medium text-blue-900 mb-2">手动输入坐标（H5环境）</Text>
                  <View className="flex gap-2 mb-2">
                    <View className="flex-1">
                      <Text className="block text-xs text-gray-600 mb-1">纬度</Text>
                      <View className="bg-white rounded px-3 py-2">
                        <Input
                          className="w-full bg-transparent"
                          placeholder="39.908822"
                          type="digit"
                          value={formData.latitude}
                          onInput={(e) => setFormData({ ...formData, latitude: e.detail.value })}
                        />
                      </View>
                    </View>
                    <View className="flex-1">
                      <Text className="block text-xs text-gray-600 mb-1">经度</Text>
                      <View className="bg-white rounded px-3 py-2">
                        <Input
                          className="w-full bg-transparent"
                          placeholder="116.397499"
                          type="digit"
                          value={formData.longitude}
                          onInput={(e) => setFormData({ ...formData, longitude: e.detail.value })}
                        />
                      </View>
                    </View>
                  </View>
                  <View className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-green-500"
                      onClick={() => setFormData({ ...formData, showLocationInput: false })}
                    >
                      <Text className="text-xs">确认</Text>
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      variant="outline"
                      onClick={() => setFormData({ ...formData, showLocationInput: false, latitude: '', longitude: '' })}
                    >
                      <Text className="text-xs">取消</Text>
                    </Button>
                  </View>
                </CardContent>
              </Card>
            )}

            <View>
              <Text className="block text-sm font-medium mb-1">地址类型</Text>
              <View className="flex gap-2">
                <Button
                  size="sm"
                  className={`flex-1 ${formData.address_type === 'home' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                  onClick={() => setFormData({ ...formData, address_type: 'home' })}
                >
                  <House size={16} color={formData.address_type === 'home' ? '#ffffff' : '#6b7280'} />
                </Button>
                <Button
                  size="sm"
                  className={`flex-1 ${formData.address_type === 'work' ? 'bg-amber-500 text-white' : 'bg-gray-200'}`}
                  onClick={() => setFormData({ ...formData, address_type: 'work' })}
                >
                  <Building2 size={16} color={formData.address_type === 'work' ? '#ffffff' : '#6b7280'} />
                </Button>
                <Button
                  size="sm"
                  className={`flex-1 ${formData.address_type === 'other' ? 'bg-gray-500 text-white' : 'bg-gray-200'}`}
                  onClick={() => setFormData({ ...formData, address_type: 'other' })}
                >
                  <MapPin size={16} color={formData.address_type === 'other' ? '#ffffff' : '#6b7280'} />
                </Button>
              </View>
            </View>

            <View className="flex items-center gap-2">
              <Button
                size="sm"
                className={`flex-1 ${formData.is_default ? 'bg-amber-500 text-white' : 'bg-gray-200'}`}
                onClick={() => setFormData({ ...formData, is_default: !formData.is_default })}
              >
                <Star size={16} color={formData.is_default ? '#ffffff' : '#6b7280'} />
              </Button>
              <Text className="text-sm text-gray-700">设为默认</Text>
            </View>

            <View className="flex gap-2 pt-2">
              <Button
                size="sm"
                className="flex-1"
                variant="outline"
                onClick={() => {
                  setShowAddForm(false)
                  setFormData({
                    address_name: '',
                    address: '',
                    latitude: '',
                    longitude: '',
                    address_type: 'other',
                    is_default: false,
                    showLocationInput: false
                  })
                }}
              >
                <Text>取消</Text>
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-green-500"
                onClick={handleAddAddress}
                disabled={loading}
              >
                <Text>确认添加</Text>
              </Button>
            </View>
          </CardContent>
        </Card>
      )}

      {/* 地址列表 */}
      <View className="px-4 space-y-3">
        {addresses.map((address) => (
          <Card key={address.id} className="border-2">
            <CardContent className="p-4">
              <View className="flex items-start justify-between mb-2">
                <View className="flex items-center gap-2">
                  {getAddressTypeIcon(address.address_type)}
                  <Text className="font-semibold">{address.address_name}</Text>
                  {address.is_default && (
                    <Star size={14} color="#f59e0b" />
                  )}
                </View>
                <View className="flex gap-1">
                  {!address.is_default && (
                    <Button
                      size="sm"
                      className="bg-amber-500 px-2"
                      onClick={() => handleSetDefault(address.id)}
                    >
                      <Text className="text-xs">设为默认</Text>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="bg-red-500 px-2"
                    onClick={() => handleDelete(address.id)}
                  >
                    <Trash2 size={14} color="#ffffff" />
                  </Button>
                </View>
              </View>

              <Text className="block text-sm text-gray-700 mb-1">{address.address}</Text>
              <Text className="block text-xs text-gray-500">
                坐标：{address.latitude.toFixed(6)}, {address.longitude.toFixed(6)}
              </Text>
              <Text className="block text-xs text-gray-400">
                类型：{getAddressTypeName(address.address_type)}
              </Text>
            </CardContent>
          </Card>
        ))}

        {addresses.length === 0 && !showAddForm && (
          <View className="flex flex-col items-center justify-center py-12">
            <MapPin size={48} color="#d1d5db" />
            <Text className="text-gray-400 mt-4">暂无地址</Text>
            <Text className="text-gray-400 text-sm mt-1">点击上方按钮添加地址</Text>
          </View>
        )}
      </View>
    </View>
  )
}
