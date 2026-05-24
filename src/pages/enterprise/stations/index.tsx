import { View, Text } from '@tarojs/components'
import { useEffect, useState } from 'react'
import type { FC } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getApiData, getApiMessage, isApiSuccess } from '@/lib/api-response'
import { Network } from '@/network'
import Taro from '@tarojs/taro'
import './index.css'

interface Station {
  id: string
  name: string
  address: string
  phone?: string
  location?: { lat: number; lng: number }
  status: string
  customer_type?: 'owned' | 'external'
  created_at: string
}

const EnterpriseStationsPage: FC = () => {
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [enterpriseId, setEnterpriseId] = useState('')
  const [errorText, setErrorText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  
  // 新增奶站弹窗状态
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newStationName, setNewStationName] = useState('')
  const [newStationAddress, setNewStationAddress] = useState('')
  const [newStationPhone, setNewStationPhone] = useState('')
  const [newStationLocation, setNewStationLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [newCustomerType, setNewCustomerType] = useState<'owned' | 'external'>('owned')

  useEffect(() => {
    loadEnterpriseInfo()
  }, [])

  const loadEnterpriseInfo = async () => {
    try {
      const userInfo = Taro.getStorageSync('userInfo')

      if (!userInfo) {
        Taro.redirectTo({ url: '/pages/index/index' })
        return
      }

      const enterpriseRes = await Network.request({
        url: `/api/enterprise/admin/${userInfo.id}`,
      })

      if (isApiSuccess(enterpriseRes)) {
        const entId = getApiData<{ id: string } | null>(enterpriseRes, null)?.id
        if (!entId) {
          setErrorText('企业信息缺失')
          return
        }
        setEnterpriseId(entId)
        loadStations(entId)
      } else {
        setErrorText(getApiMessage(enterpriseRes, '加载企业信息失败'))
      }
    } catch {
      setErrorText('加载企业信息失败')
    }
  }

  const loadStations = async (entId: string) => {
    try {
      setLoading(true)
      
      // 构建请求参数，只传递有值的参数
      const params: any = {
        enterpriseId: entId,
      }
      if (keyword && keyword.trim()) {
        params.keyword = keyword.trim()
      }

      const res = await Network.request({
        url: '/api/station',
        data: params,
      })

      if (isApiSuccess(res)) {
        const data = getApiData<{ list?: Station[] }>(res, {})
        setStations(data.list || [])
        setErrorText('')
      } else {
        setErrorText(getApiMessage(res, '加载点位失败'))
      }
    } catch {
      setErrorText('加载点位失败')
      Taro.showToast({
        title: '加载失败',
        icon: 'none',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    if (enterpriseId) {
      loadStations(enterpriseId)
    }
  }

  const handleDelete = async (stationId: string, stationName: string) => {
    try {
      const res = await Taro.showModal({
        title: '确认删除',
        content: `确定要删除"${stationName}"吗？`,
      })

      if (res.confirm) {
        const delRes = await Network.request({
          url: `/api/station/${stationId}`,
          method: 'DELETE',
        })

        if (isApiSuccess(delRes)) {
          Taro.showToast({
            title: '删除成功',
            icon: 'success',
          })
          loadStations(enterpriseId)
        } else {
          Taro.showToast({
            title: getApiMessage(delRes, '删除失败'),
            icon: 'none',
          })
        }
      }
    } catch {
      Taro.showToast({
        title: '删除失败',
        icon: 'none',
      })
    }
  }

  const handleAddStation = async () => {
    if (!newStationName || !newStationAddress || !newStationPhone) {
      Taro.showToast({
        title: '请填写完整信息',
        icon: 'none',
      })
      return
    }

    if (!newStationLocation) {
      Taro.showToast({
        title: '请选择位置',
        icon: 'none',
      })
      return
    }

    try {
      setSubmitting(true)
      const res = await Network.request({
        url: '/api/station',
        method: 'POST',
        data: {
          enterpriseId: enterpriseId,
          name: newStationName,
          address: newStationAddress,
          phone: newStationPhone,
          location: newStationLocation,
          customer_type: newCustomerType,
          status: 'active',
        },
      })

      if (isApiSuccess(res)) {
        Taro.showToast({
          title: '添加成功',
          icon: 'success',
        })
        setShowAddDialog(false)
        // 清空表单
        setNewStationName('')
        setNewStationAddress('')
        setNewStationPhone('')
        setNewStationLocation(null)
        setNewCustomerType('owned')
        // 刷新列表
        loadStations(enterpriseId)
      } else {
        Taro.showToast({
          title: getApiMessage(res, '添加失败'),
          icon: 'none',
        })
      }
    } catch {
      Taro.showToast({
        title: '添加失败',
        icon: 'none',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleChooseLocation = async () => {
    try {
      const env = Taro.getEnv()
      const isMiniApp = env === Taro.ENV_TYPE.WEAPP || env === Taro.ENV_TYPE.TT

      if (!isMiniApp) {
        Taro.showToast({
          title: '地图功能仅在小程序中可用',
          icon: 'none',
        })
        return
      }

      const res = await Taro.chooseLocation({
        latitude: 39.63,
        longitude: 118.18,
      })

      if (res.errMsg === 'chooseLocation:ok') {
        setNewStationAddress(res.address || res.name)
        setNewStationLocation({
          lat: res.latitude,
          lng: res.longitude,
        })
        Taro.showToast({
          title: '位置已选择',
          icon: 'success',
        })
      }
    } catch {
      Taro.showToast({
        title: '选择位置失败',
        icon: 'none',
      })
    }
  }

  return (
    <View className="enterprise-stations min-h-screen bg-gray-50 pb-20">
      <View className="p-4">
        <Text className="text-2xl font-bold block mb-4">奶站管理</Text>

        {errorText && (
          <Card className="mb-4 border-red-200 bg-red-50">
            <CardContent className="p-3">
              <Text className="block text-sm text-red-600">{errorText}</Text>
            </CardContent>
          </Card>
        )}

        {/* 搜索框和新增按钮 */}
        <View className="flex gap-2 mb-4">
          <Input
            placeholder="搜索奶站名称或地址"
            value={keyword}
            onInput={(e) => setKeyword(e.detail.value)}
          />
          <Button onClick={handleSearch}>搜索</Button>
        </View>

        {/* 新增按钮 */}
        <View className="mb-4">
          <Button 
            className="w-full" 
            onClick={() => setShowAddDialog(true)}
          >
            <Text>新增奶站</Text>
          </Button>
        </View>

        {/* 奶站列表 */}
        {loading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Text className="text-gray-500 text-sm">加载中...</Text>
            </CardContent>
          </Card>
        ) : stations.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Text className="text-gray-500 text-sm">暂无奶站数据</Text>
            </CardContent>
          </Card>
        ) : (
          <View className="space-y-3">
            {stations.map((station) => (
              <Card key={station.id}>
                <CardContent className="p-4">
                  <View className="flex justify-between items-start">
                    <View className="flex-1">
                      <Text className="text-base font-medium text-gray-900 block mb-1">
                        {station.name}
                      </Text>
                      <Text className="text-sm text-gray-600 block mb-1">
                        {station.address}
                      </Text>
                      <Text className="text-sm text-gray-500 block mb-1">
                        电话: {station.phone || '未设置'}
                      </Text>
                      <Text className="text-sm text-gray-500 block mb-1">
                        类型: {station.customer_type === 'owned' ? '自营奶站' : '商超/代理'}
                      </Text>
                      {station.location && (
                        <Text className="text-xs text-blue-500 block">
                          位置: {station.location.lat.toFixed(6)}, {station.location.lng.toFixed(6)}
                        </Text>
                      )}
                    </View>
                    <View className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(station.id, station.name)}
                      >
                        <Text className="text-xs">删除</Text>
                      </Button>
                    </View>
                  </View>
                </CardContent>
              </Card>
            ))}
          </View>
        )}

        {/* 新增奶站弹窗 */}
        {showAddDialog && (
          <View
            className="bg-black bg-opacity-50 z-50"
            style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <View className="bg-white rounded-lg p-6 w-11/12 max-w-md max-h-[80vh] overflow-y-auto">
              <Text className="text-xl font-bold block mb-4">新增奶站</Text>

              <View className="space-y-4">
                <View>
                  <Text className="text-sm text-gray-600 block mb-2">奶站名称</Text>
                  <Input
                    placeholder="请输入奶站名称"
                    value={newStationName}
                    onInput={(e) => setNewStationName(e.detail.value)}
                  />
                </View>

                <View>
                  <Text className="text-sm text-gray-600 block mb-2">联系电话</Text>
                  <Input
                    placeholder="请输入联系电话"
                    value={newStationPhone}
                    onInput={(e) => setNewStationPhone(e.detail.value)}
                  />
                </View>

                <View>
                  <Text className="text-sm text-gray-600 block mb-2">客户类型</Text>
                  <View className="flex gap-2">
                    <Button
                      size="sm"
                      variant={newCustomerType === 'owned' ? 'default' : 'outline'}
                      onClick={() => setNewCustomerType('owned')}
                    >
                      <Text className="text-xs">自营奶站</Text>
                    </Button>
                    <Button
                      size="sm"
                      variant={newCustomerType === 'external' ? 'default' : 'outline'}
                      onClick={() => setNewCustomerType('external')}
                    >
                      <Text className="text-xs">商超/代理</Text>
                    </Button>
                  </View>
                </View>

                <View>
                  <Text className="text-sm text-gray-600 block mb-2">奶站地址</Text>
                  <View className="flex gap-2">
                    <View className="flex-1">
                      <Input
                        placeholder="请选择或输入地址"
                        value={newStationAddress}
                        onInput={(e) => setNewStationAddress(e.detail.value)}
                      />
                    </View>
                    <Button onClick={handleChooseLocation}>
                      <Text className="text-xs">选择位置</Text>
                    </Button>
                  </View>
                  {newStationLocation && (
                    <Text className="text-xs text-blue-600 mt-1 block">
                      已选择位置: {newStationLocation.lat.toFixed(6)}, {newStationLocation.lng.toFixed(6)}
                    </Text>
                  )}
                </View>

                <View className="flex gap-3 mt-6">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowAddDialog(false)
                      setNewStationName('')
                      setNewStationAddress('')
                      setNewStationPhone('')
                      setNewStationLocation(null)
                    }}
                  >
                    <Text>取消</Text>
                  </Button>
                  <Button className="flex-1" onClick={handleAddStation} disabled={submitting}>
                    <Text>{submitting ? '添加中...' : '确认添加'}</Text>
                  </Button>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  )
}

export default EnterpriseStationsPage
