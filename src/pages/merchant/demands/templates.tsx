import { useState, useEffect } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Trash2, ArrowRight, FileText } from 'lucide-react-taro'
import { Network } from '@/network'

interface DemandTemplate {
  id: string
  user_id: string
  template_name: string
  cargo_name: string
  cargo_type: string
  weight: number
  volume: number
  pickup_address: string
  pickup_lat: number
  pickup_lng: number
  delivery_address: string
  delivery_lat: number
  delivery_lng: number
  remarks?: string
  is_default: boolean
  use_count: number
  created_at: string
  updated_at: string
}

export default function DemandTemplates() {
  const [templates, setTemplates] = useState<DemandTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletingTemplate, setDeletingTemplate] = useState<DemandTemplate | null>(null)

  useEffect(() => {
    loadTemplates()
  }, [])

  useDidShow(() => {
    console.log('[DemandTemplates] 页面显示，刷新模板列表')
    loadTemplates()
  })

  // 监听模板列表刷新事件
  useEffect(() => {
    const handler = () => {
      console.log('[DemandTemplates] 接收到刷新事件')
      loadTemplates()
    }

    Taro.eventCenter.on('templateListRefresh', handler)

    return () => {
      Taro.eventCenter.off('templateListRefresh', handler)
    }
  }, [])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const userInfo = Taro.getStorageSync('userInfo')
      console.log('[DemandTemplates] 用户信息:', userInfo)
      console.log('[DemandTemplates] 查询模板使用 user_id:', userInfo.id)

      if (!userInfo || !userInfo.id) {
        console.error('[DemandTemplates] 用户信息不存在')
        Taro.showToast({
          title: '请先登录',
          icon: 'none'
        })
        return
      }

      // 手动构建带查询参数的 URL
      const url = `/api/demand-templates?user_id=${encodeURIComponent(userInfo.id)}`
      console.log('[DemandTemplates] 请求 URL:', url)

      const res = await Network.request({
        url: url,
        method: 'GET'
      })

      console.log('[DemandTemplates] 常用模板响应:', res.data)
      console.log('[DemandTemplates] 返回的模板数量:', res.data.data?.length || 0)
      console.log('[DemandTemplates] 返回的模板列表:', JSON.stringify(res.data.data, null, 2))

      if (res.data.code === 200) {
        console.log('[DemandTemplates] 加载到模板数量:', res.data.data?.length || 0)
        setTemplates(res.data.data || [])
      } else {
        console.error('[DemandTemplates] 响应错误:', res.data.message)
      }
    } catch (err) {
      console.error('[DemandTemplates] 加载常用模板失败:', err)
      Taro.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTemplate = (template: DemandTemplate) => {
    setDeletingTemplate(template)
    setShowDeleteDialog(true)
  }

  const confirmDeleteTemplate = async () => {
    if (!deletingTemplate) return

    try {
      const res = await Network.request({
        url: `/api/demand-templates/${deletingTemplate.id}`,
        method: 'DELETE'
      })

      console.log('删除模板响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: '删除成功',
          icon: 'success'
        })
        loadTemplates()
      } else {
        Taro.showToast({
          title: res.data.message || '删除失败',
          icon: 'none'
        })
      }
    } catch (err) {
      console.error('删除模板失败:', err)
      Taro.showToast({
        title: '删除失败',
        icon: 'none'
      })
    } finally {
      setShowDeleteDialog(false)
      setDeletingTemplate(null)
    }
  }

  const handleUseTemplate = (template: DemandTemplate) => {
    const params = {
      template_id: template.id,
      cargo_name: template.cargo_name,
      cargo_type: template.cargo_type,
      weight: template.weight.toString(),
      volume: template.volume.toString(),
      pickup_address: template.pickup_address,
      pickup_lat: template.pickup_lat,
      pickup_lng: template.pickup_lng,
      delivery_address: template.delivery_address,
      delivery_lat: template.delivery_lat,
      delivery_lng: template.delivery_lng,
      remarks: template.remarks || ''
    }

    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&')

    Taro.navigateTo({
      url: `/pages/merchant/demands/publish?${queryString}`
    })
  }

  const getCargoTypeText = (type: string) => {
    const typeMap: Record<string, string> = {
      normal: '普通货物',
      fresh: '生鲜货物',
      fragile: '易碎品'
    }
    return typeMap[type] || type
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

      {/* 标题栏 */}
      <View className="bg-white px-4 py-3 mb-2">
        <View className="flex items-center justify-between">
          <Text className="block text-lg font-semibold text-gray-900">
            常用模板
          </Text>
          <Text className="block text-xs text-gray-500">
            共 {templates.length} 个模板
          </Text>
        </View>
      </View>

      {/* 模板列表 */}
      {loading ? (
        <View className="flex items-center justify-center py-8">
          <Text className="block text-gray-500 text-sm">加载中...</Text>
        </View>
      ) : templates.length === 0 ? (
        <View className="flex flex-col items-center justify-center py-16 px-4">
          <FileText size={64} color="#d1d5db" />
          <Text className="block text-gray-500 text-sm mt-4 text-center">
            暂无常用模板
          </Text>
          <Text className="block text-gray-400 text-xs mt-2 text-center">
            在需求列表中点击&ldquo;保存&rdquo;按钮，将需求保存为模板
          </Text>
        </View>
      ) : (
        <View className="px-4 space-y-3 pb-4">
          {templates.map((template) => (
            <Card key={template.id} className="bg-white rounded-lg shadow-sm">
              <CardContent className="p-4">
                <View className="flex items-start gap-3">
                  <View className="flex-1">
                    <View className="flex items-center gap-2 mb-2">
                      <Text className="block text-base font-semibold text-gray-900">
                        {template.template_name}
                      </Text>
                      {template.is_default && (
                        <Text className="text-xs text-primary">默认</Text>
                      )}
                    </View>

                    <View className="space-y-1">
                      <Text className="block text-sm text-gray-600">
                        货品：{template.cargo_name}（{getCargoTypeText(template.cargo_type)}）
                      </Text>
                      <Text className="block text-sm text-gray-600">
                        重量：{template.weight} kg / 体积：{template.volume} m³
                      </Text>
                      <Text className="block text-sm text-gray-600">
                        起：{template.pickup_address}
                      </Text>
                      <Text className="block text-sm text-gray-600">
                        送：{template.delivery_address}
                      </Text>
                      {template.remarks && (
                        <Text className="block text-sm text-gray-500">
                          备注：{template.remarks}
                        </Text>
                      )}
                      <Text className="block text-xs text-gray-400 mt-2">
                        使用次数：{template.use_count} 次
                      </Text>
                    </View>
                  </View>

                  <View className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      className="bg-emerald-500"
                      onClick={() => handleUseTemplate(template)}
                    >
                      <ArrowRight size={14} color="#ffffff" />
                      <Text className="ml-1 text-xs text-white">使用</Text>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-500 text-red-500"
                      onClick={() => handleDeleteTemplate(template)}
                    >
                      <Trash2 size={14} color="#ef4444" />
                    </Button>
                  </View>
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      )}

      {/* 删除确认对话框 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <View className="py-4">
            <Text className="block text-sm text-gray-700 text-center">
              确定要删除模板&quot;{deletingTemplate?.template_name}&quot;吗？
            </Text>
          </View>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              <Text className="text-xs">取消</Text>
            </Button>
            <Button
              className="bg-red-500"
              onClick={confirmDeleteTemplate}
            >
              <Text className="text-xs text-white">删除</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  )
}
