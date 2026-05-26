import { View, Text } from '@tarojs/components'
import { useEffect, useState } from 'react'
import type { FC } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Network } from '@/network'
import Taro from '@tarojs/taro'
import { MapPin, Plus, Search, Trash2, Warehouse } from 'lucide-react-taro'
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
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [enterpriseId, setEnterpriseId] = useState('')
  
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
        setStations([])
        setLoading(false)
        return
      }

      const enterpriseRes = await Network.request({
        url: `/api/enterprise/admin/${userInfo.id}`,
      })

      if (enterpriseRes.data.code === 200) {
        const entId = enterpriseRes.data.data.id
        setEnterpriseId(entId)
        loadStations(entId)
      } else {
        setStations([])
        setLoading(false)
      }
    } catch (error) {
      console.error('加载企业信息失败:', error)
      setStations([])
      setLoading(false)
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

      if (res.data.code === 200) {
        const list = res.data.data?.list || []
        setStations(list)
      } else {
        console.error('返回码不是200:', res.data.code, res.data.message)
        setStations([])
      }
    } catch (error) {
      console.error('加载奶站列表失败:', error)
      setStations([])
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

        if (delRes.data.code === 200) {
          Taro.showToast({
            title: '删除成功',
            icon: 'success',
          })
          loadStations(enterpriseId)
        } else {
          Taro.showToast({
            title: delRes.data.message || '删除失败',
            icon: 'none',
          })
        }
      }
    } catch (error) {
      console.error('删除失败:', error)
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

      if (res.data.code === 200) {
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
          title: res.data.message || '添加失败',
          icon: 'none',
        })
      }
    } catch (error) {
      console.error('添加失败:', error)
      Taro.showToast({
        title: '添加失败',
        icon: 'none',
      })
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
    } catch (error) {
      console.error('选择位置失败:', error)
      Taro.showToast({
        title: '选择位置失败',
        icon: 'none',
      })
    }
  }

  return (
    <AppPageShell
      title="奶站管理"
      subtitle="站点、地址与客户类型"
      icon={Warehouse}
      bottom={<BottomNav type="enterprise" active="home" />}
      className="enterprise-stations"
      contentClassName="space-y-3 pb-6"
    >
        {/* 搜索框和新增按钮 */}
        <View className="flex gap-2">
          <Input
            placeholder="搜索奶站名称或地址"
            value={keyword}
            onInput={(e) => setKeyword(e.detail.value)}
          />
          <Button className="h-10 rounded-full px-4" onClick={handleSearch}>
            <Search size={15} color="#FFFFFF" />
          </Button>
        </View>

        {/* 新增按钮 */}
        <View>
          <Button 
            className="w-full h-12 rounded-full" 
            onClick={() => setShowAddDialog(true)}
          >
            <Plus size={16} color="#FFFFFF" />
            <Text>新增奶站</Text>
          </Button>
        </View>

        {/* 奶站列表 */}
        {loading ? (
          <Card className="shadow-sm border-gray-100">
            <CardContent className="p-8 text-center">
              <Text className="text-gray-500 text-sm">加载中...</Text>
            </CardContent>
          </Card>
        ) : stations.length === 0 ? (
          <Card className="shadow-sm border-gray-100">
            <CardContent className="p-8 text-center">
              <Text className="text-gray-500 text-sm">暂无奶站数据</Text>
            </CardContent>
          </Card>
        ) : (
          <View className="space-y-3">
            {stations.map((station) => (
              <Card key={station.id} className="shadow-sm border-gray-100">
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
                        <View className="flex items-center gap-1">
                          <MapPin size={12} color="#0062FF" />
                          <Text className="text-xs text-blue-500 block">
                            {station.location.lat.toFixed(6)}, {station.location.lng.toFixed(6)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(station.id, station.name)}
                      >
                        <Trash2 size={13} color="#FFFFFF" />
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
          <View className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
                  <Button className="flex-1" onClick={handleAddStation}>
                    <Text>确认添加</Text>
                  </Button>
                </View>
              </View>
            </View>
          </View>
        )}
    </AppPageShell>
  )
}

export default EnterpriseStationsPage
