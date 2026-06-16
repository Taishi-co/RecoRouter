import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import { Network } from '@/network'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, Route, MapPin, Navigation, FilePen, Star } from 'lucide-react-taro'
import { AppPageShell } from '@/components/layout/app-page-shell'

interface Address {
  id: string
  address_name: string
  address: string
  latitude: number
  longitude: number
}

interface FavoriteRoute {
  id: string
  route_name: string
  pickup_address: Address | null
  delivery_address: Address | null
  estimated_distance: number | null
  estimated_fare: number | null
  use_count: number
  created_at: string
}

export default function FavoriteRoutes() {
  const [routes, setRoutes] = useState<FavoriteRoute[]>([])
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    route_name: '',
    pickup_address_id: '',
    delivery_address_id: '',
    estimated_distance: '',
    estimated_fare: ''
  })
  const visibleRoutes = routes

  useEffect(() => {
    loadRoutes()
    loadAddresses()
  }, [])

  const loadRoutes = async () => {
    try {
      const userInfo = Taro.getStorageSync('userInfo')

      const res = await Network.request({
        url: '/api/favorite-routes',
        data: { user_id: userInfo.id }
      })

      console.log('[FavoriteRoutes] 线路列表响应:', res.data)

      if (res.data.code === 200) {
        setRoutes(res.data.data || [])
      }
    } catch (error) {
      console.error('[FavoriteRoutes] 加载线路列表失败:', error)
      Taro.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  }

  const loadAddresses = async () => {
    try {
      const userInfo = Taro.getStorageSync('userInfo')

      const res = await Network.request({
        url: '/api/address-books',
        data: { user_id: userInfo.id }
      })

      console.log('[FavoriteRoutes] 地址列表响应:', res.data)

      if (res.data.code === 200) {
        setAddresses(res.data.data || [])
      }
    } catch (error) {
      console.error('[FavoriteRoutes] 加载地址列表失败:', error)
    }
  }

  // 自动计算距离和运费
  useEffect(() => {
    const calculateDistance = async () => {
      if (!formData.pickup_address_id || !formData.delivery_address_id) {
        return
      }

      const pickupAddress = addresses.find(a => a.id === formData.pickup_address_id)
      const deliveryAddress = addresses.find(a => a.id === formData.delivery_address_id)

      if (!pickupAddress?.latitude || !pickupAddress?.longitude ||
          !deliveryAddress?.latitude || !deliveryAddress?.longitude) {
        console.log('[FavoriteRoutes] 地址坐标不完整，无法计算距离')
        return
      }

      try {
        console.log('[FavoriteRoutes] 开始计算距离:', {
          pickup: { lat: pickupAddress.latitude, lng: pickupAddress.longitude },
          delivery: { lat: deliveryAddress.latitude, lng: deliveryAddress.longitude }
        })

        const res = await Network.request({
          url: '/api/demands/calculate-distance',
          method: 'POST',
          data: {
            pickup_address: pickupAddress.address,
            pickup_lat: pickupAddress.latitude,
            pickup_lng: pickupAddress.longitude,
            delivery_address: deliveryAddress.address,
            delivery_lat: deliveryAddress.latitude,
            delivery_lng: deliveryAddress.longitude
          }
        })

        console.log('[FavoriteRoutes] 距离计算响应:', res.data)

        if (res.data.code === 200 && res.data.data) {
          const { distance, estimated_fare } = res.data.data
          setFormData(prev => ({
            ...prev,
            estimated_distance: distance?.toFixed(1) || '',
            estimated_fare: estimated_fare?.toFixed(2) || ''
          }))

          Taro.showToast({
            title: `距离 ${distance?.toFixed(1)} 公里，运费 ¥${estimated_fare?.toFixed(2)}`,
            icon: 'none',
            duration: 2000
          })
        }
      } catch (error) {
        console.error('[FavoriteRoutes] 计算距离失败:', error)
        // 计算失败时不影响用户继续操作
      }
    }

    calculateDistance()
  }, [formData.pickup_address_id, formData.delivery_address_id, addresses])

  const handleAddRoute = async () => {
    if (!formData.route_name || !formData.pickup_address_id || !formData.delivery_address_id) {
      Taro.showToast({
        title: '请填写完整信息',
        icon: 'none'
      })
      return
    }

    if (formData.pickup_address_id === formData.delivery_address_id) {
      Taro.showToast({
        title: '取货地址和收货地址不能相同',
        icon: 'none'
      })
      return
    }

    setLoading(true)

    try {
      const userInfo = Taro.getStorageSync('userInfo')

      let res
      if (editingRouteId) {
        // 编辑模式
        res = await Network.request({
          url: `/api/favorite-routes/${editingRouteId}`,
          method: 'PUT',
          data: {
            route_name: formData.route_name,
            pickup_address_id: formData.pickup_address_id,
            delivery_address_id: formData.delivery_address_id,
            estimated_distance: formData.estimated_distance && !Number.isNaN(parseFloat(formData.estimated_distance)) ? parseFloat(formData.estimated_distance) : null,
            estimated_fare: formData.estimated_fare && !Number.isNaN(parseFloat(formData.estimated_fare)) ? parseFloat(formData.estimated_fare) : null
          }
        })
      } else {
        // 新增模式
        res = await Network.request({
          url: '/api/favorite-routes',
          method: 'POST',
          data: {
            user_id: userInfo.id,
            route_name: formData.route_name,
            pickup_address_id: formData.pickup_address_id,
            delivery_address_id: formData.delivery_address_id,
            estimated_distance: formData.estimated_distance && !Number.isNaN(parseFloat(formData.estimated_distance)) ? parseFloat(formData.estimated_distance) : null,
            estimated_fare: formData.estimated_fare && !Number.isNaN(parseFloat(formData.estimated_fare)) ? parseFloat(formData.estimated_fare) : null
          }
        })
      }

      console.log('[FavoriteRoutes] 保存线路响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: editingRouteId ? '修改成功' : '添加成功',
          icon: 'success'
        })

        setShowAddForm(false)
        setEditingRouteId(null)
        setFormData({
          route_name: '',
          pickup_address_id: '',
          delivery_address_id: '',
          estimated_distance: '',
          estimated_fare: ''
        })

        loadRoutes()
      } else {
        Taro.showToast({
          title: res.data.message || (editingRouteId ? '修改失败' : '添加失败'),
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('[FavoriteRoutes] 保存线路失败:', error)
      Taro.showToast({
        title: editingRouteId ? '修改失败' : '添加失败',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const modalRes = await Taro.showModal({
        title: '确认删除',
        content: '确定要删除这条线路吗？'
      })

      if (modalRes.confirm) {
        const res = await Network.request({
          url: `/api/favorite-routes/${id}`,
          method: 'DELETE'
        })

        if (res.data.code === 200) {
          Taro.showToast({
            title: '删除成功',
            icon: 'success'
          })
          loadRoutes()
        }
      }
    } catch (error) {
      console.error('[FavoriteRoutes] 删除线路失败:', error)
    }
  }

  const handleEdit = (route: FavoriteRoute) => {
    setFormData({
      route_name: route.route_name,
      pickup_address_id: route.pickup_address?.id || '',
      delivery_address_id: route.delivery_address?.id || '',
      estimated_distance: route.estimated_distance?.toString() || '',
      estimated_fare: route.estimated_fare?.toString() || ''
    })
    setEditingRouteId(route.id)
    setShowAddForm(true)
  }

  const handleCancelEdit = () => {
    setShowAddForm(false)
    setEditingRouteId(null)
    setFormData({
      route_name: '',
      pickup_address_id: '',
      delivery_address_id: '',
      estimated_distance: '',
      estimated_fare: ''
    })
  }

  const handleUseRoute = async (route: FavoriteRoute) => {
    try {
      // 获取当前用户信息
      const userInfo = Taro.getStorageSync('userInfo')
      const userRole = userInfo.role

      // 增加使用次数
      await Network.request({
        url: `/api/favorite-routes/${route.id}/increment-use-count`,
        method: 'POST'
      })

      // 根据用户角色判断跳转逻辑
      if (userRole === 'merchant') {
        // 需求方：跳转到发布需求页面，并传递线路信息
        Taro.navigateTo({
          url: `/pages/merchant/demands/publish?route=${encodeURIComponent(JSON.stringify(route))}`
        })
      } else if (userRole === 'owner') {
        // 运力方：跳转到地图线路显示页面
        Taro.navigateTo({
          url: `/pages/merchant/route-map/index?route=${encodeURIComponent(JSON.stringify(route))}`
        })
      } else {
        Taro.showToast({
          title: '未知用户类型',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('[FavoriteRoutes] 使用线路失败:', error)
      Taro.showToast({
        title: '操作失败',
        icon: 'none'
      })
    }
  }

  return (
    <AppPageShell
      title="收藏路线"
      subtitle="RecoRouter 商户小程序"
      icon={Star}
      contentClassName="space-y-3"
      showBack
    >
      {/* 添加/编辑线路表单 */}
      {showAddForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <View className="flex items-center justify-between mb-2">
              <Text className="text-base font-semibold">{editingRouteId ? '编辑线路' : '添加线路'}</Text>
            </View>

            <View>
              <Text className="block text-sm font-medium mb-1">线路名称</Text>
              <View className="bg-gray-50 rounded px-3 py-2">
                <Input
                  className="w-full bg-transparent"
                  placeholder="如：上班路线"
                  value={formData.route_name}
                  onInput={(e) => setFormData({ ...formData, route_name: e.detail.value })}
                />
              </View>
            </View>

            <View>
              <Text className="block text-sm font-medium mb-1">取货地址</Text>
              <View className="bg-gray-50 rounded px-3 py-2">
                <Text className="block text-sm text-gray-700">
                  {addresses.find(a => a.id === formData.pickup_address_id)?.address_name || '请选择取货地址'}
                </Text>
              </View>
              <View className="mt-2 flex flex-wrap gap-2">
                {addresses.map(addr => (
                  <Button
                    key={addr.id}
                    size="sm"
                    className={`text-xs ${formData.pickup_address_id === addr.id ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                    onClick={() => setFormData({ ...formData, pickup_address_id: addr.id })}
                  >
                    <Text>{addr.address_name}</Text>
                  </Button>
                ))}
              </View>
            </View>

            <View>
              <Text className="block text-sm font-medium mb-1">收货地址</Text>
              <View className="bg-gray-50 rounded px-3 py-2">
                <Text className="block text-sm text-gray-700">
                  {addresses.find(a => a.id === formData.delivery_address_id)?.address_name || '请选择收货地址'}
                </Text>
              </View>
              <View className="mt-2 flex flex-wrap gap-2">
                {addresses.map(addr => (
                  <Button
                    key={addr.id}
                    size="sm"
                    className={`text-xs ${formData.delivery_address_id === addr.id ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
                    onClick={() => setFormData({ ...formData, delivery_address_id: addr.id })}
                  >
                    <Text>{addr.address_name}</Text>
                  </Button>
                ))}
              </View>
            </View>

            <View className="flex gap-2">
              <View className="flex-1">
                <Text className="block text-sm font-medium mb-1">预估距离（公里）</Text>
                <View className="bg-gray-50 rounded px-3 py-2">
                  <Input
                    className="w-full bg-transparent"
                    placeholder="可选"
                    type="digit"
                    value={formData.estimated_distance}
                    onInput={(e) => setFormData({ ...formData, estimated_distance: e.detail.value })}
                  />
                </View>
              </View>
              <View className="flex-1">
                <Text className="block text-sm font-medium mb-1">预估运费（元）</Text>
                <View className="bg-gray-50 rounded px-3 py-2">
                  <Input
                    className="w-full bg-transparent"
                    placeholder="可选"
                    type="digit"
                    value={formData.estimated_fare}
                    onInput={(e) => setFormData({ ...formData, estimated_fare: e.detail.value })}
                  />
                </View>
              </View>
            </View>

            <View className="flex gap-2 pt-2">
              <Button
                size="sm"
                className="flex-1"
                variant="outline"
                onClick={handleCancelEdit}
              >
                <Text>取消</Text>
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-green-500"
                onClick={handleAddRoute}
                disabled={loading}
              >
                <Text>{editingRouteId ? '保存修改' : '确认添加'}</Text>
              </Button>
            </View>
          </CardContent>
        </Card>
      )}

      {/* 线路列表 */}
      <View className="space-y-3">
        {visibleRoutes.map((route) => (
          <Card key={route.id} className="border-2">
            <CardContent className="p-4">
              <View className="flex items-start justify-between mb-3">
                <View className="flex items-center gap-2">
                  <Route size={20} color="#3b82f6" />
                  <Text className="font-semibold text-lg">{route.route_name}</Text>
                </View>
                <View className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="bg-blue-500"
                    onClick={() => handleUseRoute(route)}
                  >
                    <Navigation size={16} color="#ffffff" />
                  </Button>
                  <Button
                    size="sm"
                    className="bg-amber-500"
                    onClick={() => handleEdit(route)}
                  >
                    <FilePen size={16} color="#ffffff" />
                  </Button>
                  <Button
                    size="sm"
                    className="bg-red-500"
                    onClick={() => handleDelete(route.id)}
                  >
                    <Trash2 size={16} color="#ffffff" />
                  </Button>
                </View>
              </View>

              <View className="space-y-2 mb-3">
                <View className="flex items-start gap-2">
                  <MapPin size={16} color="#3b82f6" />
                  <View className="flex-1">
                    <Text className="block text-sm font-medium text-gray-900">
                      {route.pickup_address?.address_name || '取货地址'}
                    </Text>
                    <Text className="block text-xs text-gray-500">
                      {route.pickup_address?.address}
                    </Text>
                  </View>
                </View>

                <View className="flex items-start gap-2">
                  <MapPin size={16} color="#10b981" />
                  <View className="flex-1">
                    <Text className="block text-sm font-medium text-gray-900">
                      {route.delivery_address?.address_name || '收货地址'}
                    </Text>
                    <Text className="block text-xs text-gray-500">
                      {route.delivery_address?.address}
                    </Text>
                  </View>
                </View>
              </View>

              {/* 显示距离、运费和使用次数 */}
              <View className="flex gap-4 pt-2 border-t">
                {route.estimated_distance !== undefined && route.estimated_distance !== null && (
                  <Text className="text-sm text-gray-600">
                    📏 {Number(route.estimated_distance).toFixed(1)}公里
                  </Text>
                )}
                {route.estimated_fare !== undefined && route.estimated_fare !== null && (
                  <Text className="text-sm text-gray-600">
                    💰 ¥{Number(route.estimated_fare).toFixed(2)}
                  </Text>
                )}
                {route.use_count > 0 && (
                  <Text className="text-sm text-gray-600">
                    使用 {route.use_count} 次
                  </Text>
                )}
                {(route.estimated_distance === undefined || route.estimated_distance === null) &&
                 (route.estimated_fare === undefined || route.estimated_fare === null) &&
                 route.use_count === 0 && (
                  <Text className="text-sm text-gray-400">
                    暂无运距信息
                  </Text>
                )}
              </View>
            </CardContent>
          </Card>
        ))}

        {visibleRoutes.length === 0 && !showAddForm && (
          <View className="flex flex-col items-center justify-center py-12">
            <Route size={48} color="#d1d5db" />
            <Text className="text-gray-400 mt-4">暂无线路</Text>
            <Text className="text-gray-400 text-sm mt-1">点击底部按钮添加收藏路线</Text>
          </View>
        )}
      </View>

      {!showAddForm && (
        <Button
          className="w-full bg-blue-500 text-white"
          onClick={() => setShowAddForm(true)}
        >
          <Plus size={20} color="#FFFFFF" className="mr-2" />
          <Text className="text-white">新增收藏路线</Text>
        </Button>
      )}
    </AppPageShell>
  )
}
