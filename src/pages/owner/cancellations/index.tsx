import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import { useNotificationPolling } from '@/hooks/useNotificationPolling'

interface CancellationRequest {
  id: string
  order_id: string
  requestor_id: string
  responder_id: string
  reason: string
  status: string
  response_reason: string
  responded_at: string
  created_at: string
  orders: {
    id: string
    demand_id: string
    fare_price: number
    merchant_confirmed: boolean
  }
  demands: {
    id: string
    cargo_name: string
    pickup_address: string
    delivery_address: string
  }
}

export default function OwnerCancellations() {
  const [requests, setRequests] = useState<CancellationRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<CancellationRequest | null>(null)
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [responseReason, setResponseReason] = useState('')

  // 启用通知轮询
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  useNotificationPolling(30000)

  useEffect(() => {
    loadRequests()
  }, [])

  const loadRequests = async () => {
    const userInfo = Taro.getStorageSync('userInfo')
    if (!userInfo || !userInfo.id) {
      Taro.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/cancellations/pending',
        method: 'GET',
        data: { owner_id: userInfo.id }
      })

      console.log('取消申请列表响应:', res.data)

      if (res.data.code === 200) {
        setRequests(res.data.data || [])
      } else {
        Taro.showToast({
          title: res.data.message || '加载失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('加载取消申请失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = (request: CancellationRequest) => {
    setSelectedRequest(request)
    setShowApproveDialog(true)
    setResponseReason('')
  }

  const handleReject = (request: CancellationRequest) => {
    setSelectedRequest(request)
    setShowRejectDialog(true)
    setResponseReason('')
  }

  const handleCloseApproveDialog = () => {
    setShowApproveDialog(false)
    setSelectedRequest(null)
    setResponseReason('')
  }

  const handleCloseRejectDialog = () => {
    setShowRejectDialog(false)
    setSelectedRequest(null)
    setResponseReason('')
  }

  const handleConfirmApprove = async () => {
    if (!selectedRequest) return

    const userInfo = Taro.getStorageSync('userInfo')
    if (!userInfo || !userInfo.id) return

    try {
      const res = await Network.request({
        url: `/api/cancellations/${selectedRequest.id}/handle`,
        method: 'PUT',
        data: {
          action: 'approve',
          response_reason: responseReason || '同意取消',
          owner_id: userInfo.id
        }
      })

      console.log('同意取消响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: res.data.message,
          icon: 'success'
        })

        setShowApproveDialog(false)
        setSelectedRequest(null)
        setResponseReason('')

        loadRequests()
      } else {
        Taro.showToast({
          title: res.data.message || '操作失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('同意取消失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    }
  }

  const handleConfirmReject = async () => {
    if (!selectedRequest) return

    const userInfo = Taro.getStorageSync('userInfo')
    if (!userInfo || !userInfo.id) return

    try {
      const res = await Network.request({
        url: `/api/cancellations/${selectedRequest.id}/handle`,
        method: 'PUT',
        data: {
          action: 'reject',
          response_reason: responseReason || '拒绝取消',
          owner_id: userInfo.id
        }
      })

      console.log('拒绝取消响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: res.data.message,
          icon: 'success'
        })

        setShowRejectDialog(false)
        setSelectedRequest(null)
        setResponseReason('')

        loadRequests()
      } else {
        Taro.showToast({
          title: res.data.message || '操作失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('拒绝取消失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)

    if (hours < 1) {
      return '刚刚'
    } else if (hours < 24) {
      return `${hours}小时前`
    } else if (days < 7) {
      return `${days}天前`
    } else {
      return date.toLocaleDateString()
    }
  }

  return (
    <View className="min-h-screen bg-gray-100">
      <Card className="m-4 bg-white rounded-lg shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            待处理的取消申请
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <View className="text-center py-8">
              <Text className="block text-gray-500 text-sm">加载中...</Text>
            </View>
          ) : requests.length === 0 ? (
            <View className="text-center py-8">
              <Text className="block text-gray-500 text-sm">
                暂无待处理的取消申请
              </Text>
            </View>
          ) : (
            <View className="space-y-4">
              {requests.map((request) => (
                <View key={request.id} className="border border-gray-200 rounded-lg p-4">
                  <View className="flex justify-between items-start mb-3">
                    <View className="flex-1">
                      <View className="flex items-center mb-1">
                        <Badge className="bg-orange-100 text-orange-600">
                          <Text className="text-xs">取消申请</Text>
                        </Badge>
                        <Text className="text-xs text-gray-400 ml-2">
                          {formatTime(request.created_at)}
                        </Text>
                      </View>
                      <Text className="block text-sm font-medium text-gray-800 mt-1">
                        {request.demands.cargo_name}
                      </Text>
                    </View>
                    <Text className="text-lg font-bold text-orange-500">
                      ¥{request.orders.fare_price?.toFixed(2) || '0.00'}
                    </Text>
                  </View>

                  <View className="bg-gray-50 rounded-lg px-3 py-2 mb-3">
                    <Text className="block text-xs text-gray-500 mb-1">
                      取消原因：
                    </Text>
                    <Text className="block text-sm text-gray-700">
                      {request.reason}
                    </Text>
                  </View>

                  <View className="space-y-2 mb-3">
                    <View className="flex items-start">
                      <Text className="text-xs text-gray-500 w-16 flex-shrink-0">取货地：</Text>
                      <Text className="text-xs text-gray-700 flex-1">
                        {request.demands.pickup_address}
                      </Text>
                    </View>
                    <View className="flex items-start">
                      <Text className="text-xs text-gray-500 w-16 flex-shrink-0">送货地：</Text>
                      <Text className="text-xs text-gray-700 flex-1">
                        {request.demands.delivery_address}
                      </Text>
                    </View>
                  </View>

                  <View className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-red-500 text-red-500"
                      onClick={() => handleReject(request)}
                    >
                      <Text className="text-xs">拒绝</Text>
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-orange-500"
                      onClick={() => handleApprove(request)}
                    >
                      <Text className="text-xs">同意取消</Text>
                    </Button>
                  </View>
                </View>
              ))}
            </View>
          )}
        </CardContent>
      </Card>

      {/* 同意取消弹窗 */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <View className="space-y-4">
            <View>
              <Text className="block text-base font-medium mb-2">
                确认同意取消
              </Text>
              <Text className="block text-sm text-gray-600 mb-2">
                同意后将扣除需求方10分信用积分
              </Text>
            </View>

            <View>
              <Label className="block text-sm font-medium mb-2">
                处理说明（可选）
              </Label>
              <View className="bg-gray-50 rounded-lg px-4 py-3">
                <Textarea
                  className="w-full"
                  placeholder="请输入处理说明"
                  value={responseReason}
                  onInput={(e) => setResponseReason(e.detail.value)}
                  maxlength={200}
                />
              </View>
            </View>

            <View className="flex gap-3 pt-2">
              <Button
                className="flex-1 bg-gray-200"
                onClick={handleCloseApproveDialog}
              >
                <Text>取消</Text>
              </Button>
              <Button
                className="flex-1 bg-orange-500"
                onClick={handleConfirmApprove}
              >
                <Text>确认同意</Text>
              </Button>
            </View>
          </View>
        </DialogContent>
      </Dialog>

      {/* 拒绝取消弹窗 */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <View className="space-y-4">
            <View>
              <Text className="block text-base font-medium mb-2">
                确认拒绝取消
              </Text>
              <Text className="block text-sm text-gray-600 mb-2">
                订单将继续执行
              </Text>
            </View>

            <View>
              <Label className="block text-sm font-medium mb-2">
                <Text className="text-red-500">*</Text>拒绝原因
              </Label>
              <View className="bg-gray-50 rounded-lg px-4 py-3">
                <Textarea
                  className="w-full"
                  placeholder="请输入拒绝原因"
                  value={responseReason}
                  onInput={(e) => setResponseReason(e.detail.value)}
                  maxlength={200}
                />
              </View>
            </View>

            <View className="flex gap-3 pt-2">
              <Button
                className="flex-1 bg-gray-200"
                onClick={handleCloseRejectDialog}
              >
                <Text>取消</Text>
              </Button>
              <Button
                className="flex-1 bg-red-500"
                onClick={handleConfirmReject}
              >
                <Text>确认拒绝</Text>
              </Button>
            </View>
          </View>
        </DialogContent>
      </Dialog>
    </View>
  )
}
