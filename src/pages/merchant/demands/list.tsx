import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Plus, Pencil, Save, FileText } from 'lucide-react-taro'
import { Network } from '@/network'
// import { useNotificationPolling } from '@/hooks/useNotificationPolling'

interface Demand {
  id: string
  cargo_name: string
  cargo_type: string
  weight: number
  volume: number
  pickup_time: string
  pickup_address: string
  delivery_address: string
  remarks: string | null
  status: string
  created_at: string
  template_id?: string | null
  is_from_schedule?: boolean
}

export default function DemandsList() {
  const [demands, setDemands] = useState<Demand[]>([])
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)
  const [selectedDemand, setSelectedDemand] = useState<Demand | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [loading, setLoading] = useState(false)

  // 启用通知轮询（暂时注释，避免白屏问题）
  // useNotificationPolling(30000) // 每30秒检查一次新通知

  // 页面显示时刷新列表
  useDidShow(() => {
    loadDemands()
  })

  useEffect(() => {
    const userInfo = Taro.getStorageSync('userInfo')
    if (!userInfo || userInfo.role !== 'merchant') {
      Taro.showToast({
        title: '请先登录',
        icon: 'none'
      })
      setTimeout(() => {
        Taro.redirectTo({ url: '/pages/index/index' })
      }, 1500)
      return
    }

    // 监听页面显示事件，刷新列表
    Taro.eventCenter.on('demandListRefresh', loadDemands)

    loadDemands()

    return () => {
      Taro.eventCenter.off('demandListRefresh', loadDemands)
    }
  }, [])

  const loadDemands = async () => {
    const userInfo = Taro.getStorageSync('userInfo')
    try {
      const res = await Network.request({
        url: '/api/demands',
        data: { merchant_id: userInfo.id }
      })

      console.log('需求列表响应:', res.data)

      if (res.data.code === 200) {
        setDemands(res.data.data)
      }
    } catch (error) {
      console.error('加载需求列表失败:', error)
    }
  }

  const handleCancelDemand = (demand: Demand) => {
    // 待接单状态的需求可以取消，不需要填写原因
    if (demand.status === 'pending') {
      Taro.showModal({
        title: '确认取消',
        content: '确定要取消这个需求吗？',
        success: async (res) => {
          if (res.confirm) {
            setLoading(true)
            try {
              const resCancel = await Network.request({
                url: `/api/demands/${demand.id}/cancel?id=${demand.id}`,
                method: 'POST',
                data: {} // 待接单状态不需要填写取消原因
              })

              console.log('取消需求响应:', resCancel.data)

              if (resCancel.data.code === 200) {
                Taro.showToast({
                  title: '需求已删除',
                  icon: 'success'
                })
                loadDemands()
              } else {
                Taro.showToast({
                  title: resCancel.data.message || '取消失败',
                  icon: 'none'
                })
              }
            } catch (error) {
              console.error('取消需求失败:', error)
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
    } else {
      // 其他状态需要填写取消原因
      setSelectedDemand(demand)
      setShowCancelDialog(true)
      setCancelReason('')
    }
  }

  const handleEditDemand = (demand: Demand) => {
    console.log('点击编辑按钮, demand:', demand)
    console.log('即将跳转到编辑页面:', `/pages/merchant/demands/edit?id=${demand.id}`)
    Taro.navigateTo({
      url: `/pages/merchant/demands/edit?id=${demand.id}`,
      success: () => {
        console.log('导航到编辑页面成功')
      },
      fail: (err) => {
        console.error('导航到编辑页面失败:', err)
      }
    })
  }

  const handleCloseCancelDialog = () => {
    setShowCancelDialog(false)
    setSelectedDemand(null)
    setCancelReason('')
  }

  const handleConfirmCancel = async () => {
    if (!cancelReason.trim()) {
      Taro.showToast({
        title: '请输入取消原因',
        icon: 'none'
      })
      return
    }

    if (!selectedDemand) return

    setLoading(true)

    try {
      const res = await Network.request({
        url: `/api/demands/${selectedDemand.id}/cancel?id=${selectedDemand.id}`,
        method: 'POST',
        data: { reason: cancelReason }
      })

      console.log('取消需求响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: '需求已取消',
          icon: 'success'
        })

        setShowCancelDialog(false)
        setSelectedDemand(null)
        setCancelReason('')

        loadDemands()
      } else {
        Taro.showToast({
          title: res.data.message || '取消失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('取消需求失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveAsTemplate = (demand: Demand) => {
    setSelectedDemand(demand)
    setShowTemplateDialog(true)
    setTemplateName('')
  }

  const handleCloseTemplateDialog = () => {
    setShowTemplateDialog(false)
    setSelectedDemand(null)
    setTemplateName('')
  }

  const handleConfirmSaveTemplate = async () => {
    const userInfo = Taro.getStorageSync('userInfo')

    if (!templateName.trim()) {
      Taro.showToast({
        title: '请输入模板名称',
        icon: 'none'
      })
      return
    }

    if (!selectedDemand) return

    setLoading(true)

    try {
      console.log('[DemandList] 保存模板请求: demandId=', selectedDemand.id, ', templateName=', templateName)
      const res = await Network.request({
        url: `/api/demands/${selectedDemand.id}/save-as-template`,
        method: 'POST',
        data: { template_name: templateName }
      })

      console.log('[DemandList] 保存模板响应:', res.data)
      console.log('[DemandList] 响应数据详情:', JSON.stringify(res.data.data, null, 2))

      if (res.data.code === 200) {
        console.log('[DemandList] 模板保存成功:', res.data.data)
        console.log('[DemandList] 当前用户ID:', userInfo.id)
        console.log('[DemandList] 触发模板列表刷新事件')
        Taro.showToast({
          title: '模板保存成功',
          icon: 'success'
        })

        // 触发模板列表刷新事件
        Taro.eventCenter.trigger('templateListRefresh')

        setShowTemplateDialog(false)
        setSelectedDemand(null)
        setTemplateName('')
      } else {
        Taro.showToast({
          title: res.data.message || '保存失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('保存模板失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const getCargoTypeText = (type: string) => {
    switch (type) {
      case 'normal':
        return '普通'
      case 'fresh':
        return '生鲜'
      case 'fragile':
        return '易碎'
      default:
        return '未知'
    }
  }

  const getCargoTypeColor = (type: string) => {
    switch (type) {
      case 'normal':
        return 'bg-blue-500'
      case 'fresh':
        return 'bg-green-500'
      case 'fragile':
        return 'bg-orange-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-blue-500'
      case 'accepted':
        return 'bg-green-500'
      case 'in_transit':
        return 'bg-orange-500'
      case 'completed':
        return 'bg-gray-400'
      case 'cancelled':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '待接单'
      case 'accepted':
        return '已接单'
      case 'in_transit':
        return '运输中'
      case 'completed':
        return '已完成'
      case 'cancelled':
        return '已取消'
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
              onClick={() => Taro.navigateTo({ url: '/pages/merchant/demands/publish' })}
            >
              <Text className="text-xs">发布需求</Text>
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
              onClick={() => Taro.navigateTo({ url: '/pages/merchant/profile/index' })}
            >
              <Text className="text-xs">我的</Text>
            </Button>
          </View>
        </View>
      </View>

      <View className="px-4 py-4">
        <Card className="bg-white rounded-lg shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">
              我的需求
            </CardTitle>
            <Button
              size="sm"
              className="bg-blue-500"
              onClick={() => Taro.navigateTo({ url: '/pages/merchant/demands/publish' })}
            >
              <Plus size={16} color="#fff" />
              <Text className="ml-1">发布需求</Text>
            </Button>
          </CardHeader>
          <CardContent>
            {demands.length === 0 ? (
              <View className="text-center py-8">
                <Text className="block text-gray-500 text-sm mb-4">
                  您还没有发布需求
                </Text>
                <Button
                  className="bg-blue-500"
                  onClick={() => Taro.navigateTo({ url: '/pages/merchant/demands/publish' })}
                >
                  <Plus size={16} color="#fff" />
                  <Text className="ml-1">发布需求</Text>
                </Button>
              </View>
            ) : (
              <View className="space-y-3">
                {demands.map((demand) => (
                  <View key={demand.id} className="bg-gray-50 rounded-lg p-4">
                    <View className="flex justify-between items-start mb-3">
                      <View className="flex-1">
                        <View className="flex items-center gap-2 mb-1">
                          <Text className="block font-medium text-base">
                            {demand.cargo_name}
                          </Text>
                          {demand.is_from_schedule && (
                            <Badge className="bg-purple-500">
                              <Text className="text-white text-xs">定时</Text>
                            </Badge>
                          )}
                        </View>
                        <View className="flex items-center gap-2">
                          <Badge className={getCargoTypeColor(demand.cargo_type)}>
                            <Text className="text-white text-xs">
                              {getCargoTypeText(demand.cargo_type)}
                            </Text>
                          </Badge>
                          <Badge className={getStatusColor(demand.status)}>
                            <Text className="text-white text-xs">
                              {getStatusText(demand.status)}
                            </Text>
                          </Badge>
                        </View>
                      </View>

                      {/* 待接单状态的操作按钮 */}
                      {demand.status === 'pending' && (
                        <View className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-blue-500 text-blue-500"
                            onClick={() => handleEditDemand(demand)}
                          >
                            <Pencil size={14} color="#1890ff" />
                            <Text className="ml-1 text-xs">编辑</Text>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSaveAsTemplate(demand)}
                          >
                            <Save size={14} color="#6b7280" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-500 text-red-500"
                            onClick={() => handleCancelDemand(demand)}
                          >
                            <Text className="text-xs">取消</Text>
                          </Button>
                        </View>
                      )}
                    </View>

                    <View className="space-y-2 mb-3">
                      <View className="flex items-start">
                        <Text className="text-xs text-gray-500 w-16 flex-shrink-0">取货:</Text>
                        <Text className="text-xs text-gray-700 flex-1">
                          {demand.pickup_address}
                        </Text>
                      </View>
                      <View className="flex items-start">
                        <Text className="text-xs text-gray-500 w-16 flex-shrink-0">送货:</Text>
                        <Text className="text-xs text-gray-700 flex-1">
                          {demand.delivery_address}
                        </Text>
                      </View>
                      <View className="flex items-start">
                        <Text className="text-xs text-gray-500 w-16 flex-shrink-0">时间:</Text>
                        <Text className="text-xs text-gray-700 flex-1">
                          {new Date(demand.pickup_time).toLocaleString()}
                        </Text>
                      </View>
                      <View className="flex items-start">
                        <Text className="text-xs text-gray-500 w-16 flex-shrink-0">规格:</Text>
                        <Text className="text-xs text-gray-700 flex-1">
                          {demand.weight}kg / {demand.volume}m³
                        </Text>
                      </View>
                      {demand.remarks && (
                        <View className="flex items-start">
                          <Text className="text-xs text-gray-500 w-16 flex-shrink-0">备注:</Text>
                          <Text className="text-xs text-gray-700 flex-1">
                            {demand.remarks}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-xs text-gray-400">
                      发布时间: {new Date(demand.created_at).toLocaleString()}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </CardContent>
        </Card>
      </View>

      {/* 取消需求弹窗 */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <View className="space-y-4">
            <View>
              <Text className="block text-base font-medium mb-2">
                取消需求
              </Text>
              <Text className="block text-sm text-gray-600 mb-2">
                确定要取消需求 &quot;{selectedDemand?.cargo_name}&quot; 吗？
              </Text>
            </View>

            <View>
              <Label className="block text-sm font-medium mb-2">
                <Text className="text-red-500">*</Text>取消原因
              </Label>
              <View className="bg-gray-50 rounded-lg px-4 py-3">
                <Textarea
                  className="w-full"
                  placeholder="请输入取消原因"
                  value={cancelReason}
                  onInput={(e) => setCancelReason(e.detail.value)}
                  maxlength={200}
                />
              </View>
            </View>

            <View className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleCloseCancelDialog}
              >
                <Text>取消</Text>
              </Button>
              <Button
                className="flex-1 bg-red-500"
                onClick={handleConfirmCancel}
                disabled={loading}
              >
                <Text>{loading ? '处理中...' : '确认取消'}</Text>
              </Button>
            </View>
          </View>
        </DialogContent>
      </Dialog>

      {/* 保存为模板弹窗 */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent>
          <View className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                <View className="flex items-center gap-2">
                  <FileText size={18} color="#6b7280" />
                  <Text>保存为常用模板</Text>
                </View>
              </DialogTitle>
            </DialogHeader>

            <View>
              <Label className="block text-sm font-medium mb-2">
                <Text className="text-red-500">*</Text>模板名称
              </Label>
              <View className="bg-gray-50 rounded-lg px-4 py-3">
                <Input
                  className="w-full bg-transparent"
                  placeholder="请输入模板名称（如：日常配送）"
                  value={templateName}
                  onInput={(e) => setTemplateName(e.detail.value)}
                  maxlength={50}
                />
              </View>
            </View>

            <View className="bg-gray-50 rounded-lg p-3">
              <Text className="block text-xs text-gray-600 mb-2">
                需求信息：
              </Text>
              <Text className="block text-xs text-gray-700 mb-1">
                {selectedDemand?.cargo_name}
              </Text>
              <Text className="block text-xs text-gray-700">
                {selectedDemand?.pickup_address} → {selectedDemand?.delivery_address}
              </Text>
              <Text className="block text-xs text-gray-500 mt-2">
                注：取货时间将不会被保存到模板中
              </Text>
            </View>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleCloseTemplateDialog}
              >
                <Text>取消</Text>
              </Button>
              <Button
                className="bg-blue-500"
                onClick={handleConfirmSaveTemplate}
                disabled={loading}
              >
                <Text>{loading ? '保存中...' : '保存'}</Text>
              </Button>
            </DialogFooter>
          </View>
        </DialogContent>
      </Dialog>
    </View>
  )
}
