import { useState, useEffect } from 'react'
import { View, Text, Picker } from '@tarojs/components'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Clock, Play, Pause, Zap, CalendarDays } from 'lucide-react-taro'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import Taro from '@tarojs/taro'
import { Network } from '@/network'

interface DemandSchedule {
  id: string
  user_id: string
  template_id: string
  template_name: string
  schedule_name: string
  schedule_type: 'half_day' | 'day' | 'week' | 'month' | 'interval'
  interval_days?: number
  base_date: string
  base_time: string
  end_time: string | null
  status: string
  next_publish_time: string | null
  last_published_at: string | null
  published_count: number
  created_at: string
  updated_at: string
}

interface DemandTemplate {
  id: string
  template_name: string
}

interface FormData {
  template_id: string
  schedule_name: string
  schedule_type: string
  interval_days: string
  start_time: string
  end_time: string
}

const demoSchedules: DemandSchedule[] = [
  {
    id: 'demo-schedule-1',
    user_id: 'demo',
    template_id: 'demo-template-1',
    template_name: '宝山钢贸园 → 萧山仓',
    schedule_name: '08:00 宝山装货 2车',
    schedule_type: 'day',
    base_date: '2026-05-26',
    base_time: '08:00:00',
    end_time: null,
    status: 'active',
    next_publish_time: '2026-05-27 08:00:00',
    last_published_at: '2026-05-26 08:00:00',
    published_count: 18,
    created_at: '2026-05-10T09:00:00+10:00',
    updated_at: '2026-05-25T09:00:00+10:00',
  },
  {
    id: 'demo-schedule-2',
    user_id: 'demo',
    template_id: 'demo-template-2',
    template_name: '张家港补货',
    schedule_name: '14:30 张家港补货 1车',
    schedule_type: 'week',
    base_date: '2026-05-25',
    base_time: '14:30:00',
    end_time: null,
    status: 'active',
    next_publish_time: '2026-05-27 14:30:00',
    last_published_at: '2026-05-20 14:30:00',
    published_count: 9,
    created_at: '2026-05-08T09:00:00+10:00',
    updated_at: '2026-05-24T09:00:00+10:00',
  },
  {
    id: 'demo-schedule-3',
    user_id: 'demo',
    template_id: 'demo-template-3',
    template_name: '夜间专线',
    schedule_name: '20:00 夜间专线 3车',
    schedule_type: 'interval',
    interval_days: 2,
    base_date: '2026-05-24',
    base_time: '20:00:00',
    end_time: null,
    status: 'paused',
    next_publish_time: '2026-05-28 20:00:00',
    last_published_at: '2026-05-24 20:00:00',
    published_count: 6,
    created_at: '2026-05-05T09:00:00+10:00',
    updated_at: '2026-05-23T09:00:00+10:00',
  },
]

export default function DemandSchedules() {
  const [schedules, setSchedules] = useState<DemandSchedule[]>([])
  const [templates, setTemplates] = useState<DemandTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<DemandSchedule | null>(null)
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishingScheduleId, setPublishingScheduleId] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormData>({
    template_id: '',
    schedule_name: '',
    schedule_type: 'day',
    interval_days: '1',
    start_time: '',
    end_time: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletingSchedule, setDeletingSchedule] = useState<DemandSchedule | null>(null)
  const visibleSchedules = schedules.length > 0 ? schedules : demoSchedules
  const isUsingDemoSchedules = schedules.length === 0

  useEffect(() => {
    loadSchedules()
    loadTemplates()
  }, [])

  const loadSchedules = async () => {
    setLoading(true)
    try {
      const userInfo = Taro.getStorageSync('userInfo')
      if (!userInfo || !userInfo.id) {
        Taro.showToast({
          title: '请先登录',
          icon: 'none'
        })
        return
      }

      const res = await Network.request({
        url: `/api/demand-schedules?user_id=${encodeURIComponent(userInfo.id)}`,
        method: 'GET'
      })

      console.log('定时计划响应:', res.data)

      if (res.data.code === 200) {
        setSchedules(res.data.data || [])
      }
    } catch (err) {
      console.error('加载定时计划失败:', err)
      Taro.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const loadTemplates = async () => {
    try {
      const userInfo = Taro.getStorageSync('userInfo')
      if (!userInfo || !userInfo.id) return

      const res = await Network.request({
        url: `/api/demand-templates?user_id=${encodeURIComponent(userInfo.id)}`,
        method: 'GET'
      })

      console.log('[DemandSchedules] 加载模板响应:', res.data)

      if (res.data.code === 200) {
        setTemplates(res.data.data || [])
      }
    } catch (err) {
      console.error('加载常用模板失败:', err)
    }
  }

  const handleCreateSchedule = () => {
    setEditingSchedule(null)
    setFormData({
      template_id: '',
      schedule_name: '',
      schedule_type: 'day',
      interval_days: '1',
      start_time: '',
      end_time: ''
    })
    setShowDialog(true)
  }

  const handleEditSchedule = (schedule: DemandSchedule) => {
    setEditingSchedule(schedule)

    // 处理 end_time 格式：ISO 格式 -> "YYYY-MM-DD HH:mm:ss"
    let formattedEndTime = ''
    if (schedule.end_time) {
      try {
        const date = new Date(schedule.end_time)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        const seconds = String(date.getSeconds()).padStart(2, '0')
        formattedEndTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
      } catch (err) {
        console.error('格式化结束时间失败:', err)
        formattedEndTime = schedule.end_time as string
      }
    }

    setFormData({
      template_id: schedule.template_id,
      schedule_name: schedule.schedule_name || '',
      schedule_type: schedule.schedule_type,
      interval_days: schedule.interval_days?.toString() || '1',
      start_time: `${schedule.base_date} ${schedule.base_time}`,
      end_time: formattedEndTime
    })
    setShowDialog(true)
  }

  const handleDeleteSchedule = (schedule: DemandSchedule) => {
    setDeletingSchedule(schedule)
    setShowDeleteDialog(true)
  }

  const confirmDeleteSchedule = async () => {
    if (!deletingSchedule) return

    try {
      const res = await Network.request({
        url: `/api/demand-schedules/${deletingSchedule.id}`,
        method: 'DELETE'
      })

      console.log('删除计划响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: '删除成功',
          icon: 'success'
        })
        loadSchedules()
      } else {
        Taro.showToast({
          title: res.data.message || '删除失败',
          icon: 'none'
        })
      }
    } catch (err) {
      console.error('删除计划失败:', err)
      Taro.showToast({
        title: '删除失败',
        icon: 'none'
      })
    } finally {
      setShowDeleteDialog(false)
      setDeletingSchedule(null)
    }
  }

  const handlePublishNow = async (schedule: DemandSchedule) => {
    // 确认提示
    const confirm = await Taro.showModal({
      title: '立即发布',
      content: '确定要立即发布该定时计划吗？这将基于模板创建一条新的需求。',
      confirmText: '确定',
      cancelText: '取消'
    })

    if (!confirm.confirm) return

    setIsPublishing(true)
    setPublishingScheduleId(schedule.id)

    try {
      const userInfo = Taro.getStorageSync('userInfo')
      if (!userInfo || !userInfo.id) {
        Taro.showToast({
          title: '请先登录',
          icon: 'none'
        })
        return
      }

      const res = await Network.request({
        url: `/api/demand-schedules/${schedule.id}/publish-now`,
        method: 'POST',
        data: { user_id: userInfo.id }
      })

      console.log('立即发布响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: '需求发布成功',
          icon: 'success',
          duration: 2000
        })
        loadSchedules() // 刷新列表
      } else {
        Taro.showToast({
          title: res.data.message || '发布失败',
          icon: 'none'
        })
      }
    } catch (err) {
      console.error('立即发布失败:', err)
      Taro.showToast({
        title: '发布失败',
        icon: 'none'
      })
    } finally {
      setIsPublishing(false)
      setPublishingScheduleId(null)
    }
  }

  const handleToggleActive = async (schedule: DemandSchedule) => {
    try {
      const url = schedule.status === 'active'
        ? `/api/demand-schedules/${schedule.id}/pause`
        : `/api/demand-schedules/${schedule.id}/resume`

      const res = await Network.request({
        url: url,
        method: 'POST'
      })

      console.log('切换计划状态响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: schedule.status === 'active' ? '已暂停' : '已启动',
          icon: 'success'
        })
        loadSchedules()
      } else {
        Taro.showToast({
          title: res.data.message || '操作失败',
          icon: 'none'
        })
      }
    } catch (err) {
      console.error('切换计划状态失败:', err)
      Taro.showToast({
        title: '操作失败',
        icon: 'none'
      })
    }
  }

  const handleSubmit = async () => {
    if (!formData.template_id || !formData.start_time) {
      Taro.showToast({
        title: '请填写完整信息',
        icon: 'none'
      })
      return
    }

    setSubmitting(true)

    try {
      const userInfo = Taro.getStorageSync('userInfo')
      if (!userInfo || !userInfo.id) {
        Taro.showToast({
          title: '请先登录',
          icon: 'none'
        })
        return
      }

      // 将 start_time 拆分成 base_date 和 base_time
      const startTimeParts = formData.start_time.split(' ')
      const base_date = startTimeParts[0] // 日期部分：2026-04-26
      const base_time = startTimeParts[1] // 时间部分：10:00:00

      const submitData: any = {
        user_id: userInfo.id,
        template_id: formData.template_id,
        schedule_name: formData.schedule_name || `定时计划-${new Date().toLocaleDateString()}`,
        schedule_type: formData.schedule_type,
        base_date: base_date,
        base_time: base_time,
        end_time: formData.end_time || null
      }

      if (formData.schedule_type === 'interval') {
        submitData.interval_days = parseInt(formData.interval_days)
      }

      const res = editingSchedule
        ? await Network.request({
            url: `/api/demand-schedules/${editingSchedule.id}`,
            method: 'PUT',
            data: submitData
          })
        : await Network.request({
            url: '/api/demand-schedules',
            method: 'POST',
            data: submitData
          })

      console.log('保存计划响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: editingSchedule ? '更新成功' : '创建成功',
          icon: 'success'
        })
        setShowDialog(false)
        loadSchedules()
      } else {
        Taro.showToast({
          title: res.data.message || '保存失败',
          icon: 'none'
        })
      }
    } catch (err) {
      console.error('保存计划失败:', err)
      Taro.showToast({
        title: '保存失败',
        icon: 'none'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const getScheduleTypeText = (type: string, intervalDays?: number) => {
    const typeMap: Record<string, string> = {
      half_day: '每半天',
      day: '每天',
      week: '每周',
      month: '每月',
      interval: `每${intervalDays}天`
    }
    return typeMap[type] || type
  }

  return (
    <AppPageShell
      title="排班日历"
      subtitle="RecoRouter 商户小程序"
      icon={CalendarDays}
      contentClassName="space-y-3"
      bottom={<BottomNav type="merchant" active="publish" />}
    >
      {/* 计划列表 */}
      {loading ? (
        <View className="flex items-center justify-center py-8">
          <Text className="block text-gray-500 text-sm">加载中...</Text>
        </View>
      ) : visibleSchedules.length === 0 ? (
        <View className="flex flex-col items-center justify-center py-16 px-4">
          <Clock size={64} color="#d1d5db" />
          <Text className="block text-gray-500 text-sm mt-4 text-center">
            暂无定时计划
          </Text>
          <Text className="block text-gray-400 text-xs mt-2 text-center">
            点击底部按钮创建您的第一个定时发布计划
          </Text>
        </View>
      ) : (
        <View className="space-y-3">
          {visibleSchedules.map((schedule) => (
            <Card key={schedule.id} className="bg-white rounded-lg shadow-sm">
              <CardContent className="p-4">
                <View className="flex items-start gap-3">
                  <View className="flex-1">
                    <View className="flex items-center gap-2 mb-2">
                      <Text className="block text-base font-semibold text-gray-900">
                        {schedule.schedule_name}
                      </Text>
                      {schedule.status === 'active' ? (
                        <Text className="text-xs text-green-500">运行中</Text>
                      ) : (
                        <Text className="text-xs text-gray-500">已暂停</Text>
                      )}
                    </View>

                    <View className="space-y-1">
                      <Text className="block text-sm text-gray-600">
                        重复：{getScheduleTypeText(schedule.schedule_type, schedule.interval_days)}
                      </Text>
                      <Text className="block text-sm text-gray-600">
                        开始时间：{schedule.base_date} {schedule.base_time}
                      </Text>
                      {schedule.end_time && (
                        <Text className="block text-sm text-gray-600">
                          结束时间：{schedule.end_time}
                        </Text>
                      )}
                      {schedule.next_publish_time && (
                        <Text className="block text-sm text-blue-600">
                          下次发布：{schedule.next_publish_time}
                        </Text>
                      )}
                      <Text className="block text-xs text-gray-400 mt-2">
                        已发布次数：{schedule.published_count} 次
                      </Text>
                    </View>
                  </View>

                  <View className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleActive(schedule)}
                      disabled={isUsingDemoSchedules}
                    >
                      {schedule.status === 'active' ? (
                        <Pause size={14} color="#6b7280" />
                      ) : (
                        <Play size={14} color="#6b7280" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditSchedule(schedule)}
                      disabled={isUsingDemoSchedules}
                    >
                      <Pencil size={14} color="#6b7280" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePublishNow(schedule)}
                      disabled={isUsingDemoSchedules || (isPublishing && publishingScheduleId === schedule.id)}
                    >
                      <Zap size={14} color="#f59e0b" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-500 text-red-500"
                      onClick={() => handleDeleteSchedule(schedule)}
                      disabled={isUsingDemoSchedules}
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

      <Button
        className="w-full bg-blue-500"
        onClick={handleCreateSchedule}
      >
        <Plus size={16} color="#FFFFFF" />
        <Text className="ml-1 text-white">新增固定班次</Text>
      </Button>

      {/* 创建/编辑计划对话框 */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSchedule ? '编辑计划' : '新建计划'}
            </DialogTitle>
          </DialogHeader>

          <View className="space-y-4">
            <View>
              <Text className="block text-sm font-medium mb-1">计划名称 *</Text>
              <View className="bg-gray-50 rounded-lg px-4 py-3">
                <Input
                  className="w-full bg-transparent"
                  placeholder="如：每日定时发布"
                  value={formData.schedule_name}
                  onInput={(e) => setFormData({ ...formData, schedule_name: e.detail.value })}
                />
              </View>
            </View>

            <View>
              <Text className="block text-sm font-medium mb-1">选择模板 *</Text>
              {templates.length === 0 ? (
                <Text className="block text-sm text-gray-500">
                  暂无可用模板，请先创建常用模板
                </Text>
              ) : (
                <Picker
                  mode="selector"
                  range={templates.map(t => t.template_name)}
                  value={templates.findIndex(t => t.id === formData.template_id)}
                  onChange={(e) => {
                    const template = templates[e.detail.value]
                    setFormData({ ...formData, template_id: template.id })
                  }}
                >
                  <View className="bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-between">
                    <Text className={`text-sm ${formData.template_id ? 'text-gray-900' : 'text-gray-400'}`}>
                      {templates.find(t => t.id === formData.template_id)?.template_name || '请选择模板'}
                    </Text>
                    <Text className="text-gray-400">▼</Text>
                  </View>
                </Picker>
              )}
            </View>

            <View>
              <Text className="block text-sm font-medium mb-1">重复类型 *</Text>
              <Picker
                mode="selector"
                range={['每半天', '每天', '每周', '每月', '每隔几天']}
                value={['half_day', 'day', 'week', 'month', 'interval'].indexOf(formData.schedule_type)}
                onChange={(e) => {
                  const types = ['half_day', 'day', 'week', 'month', 'interval']
                  setFormData({ ...formData, schedule_type: types[e.detail.value] })
                }}
              >
                <View className="bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-between">
                  <Text className="text-sm text-gray-900">
                    {['每半天', '每天', '每周', '每月', '每隔几天'][['half_day', 'day', 'week', 'month', 'interval'].indexOf(formData.schedule_type)]}
                  </Text>
                  <Text className="text-gray-400">▼</Text>
                </View>
              </Picker>
            </View>

            {formData.schedule_type === 'interval' && (
              <View>
                <Text className="block text-sm font-medium mb-1">间隔天数 *</Text>
                <Input
                  type="number"
                  value={formData.interval_days}
                  placeholder="请输入间隔天数"
                  onInput={(e) => setFormData({ ...formData, interval_days: e.detail.value })}
                />
              </View>
            )}

            <View>
              <Text className="block text-sm font-medium mb-1">开始时间 *</Text>
              <Picker
                mode="date"
                value={formData.start_time}
                onChange={(e) => {
                  const time = formData.start_time && formData.start_time.includes(' ') ? formData.start_time.split(' ')[1] : '00:00:00'
                  setFormData({ ...formData, start_time: `${e.detail.value} ${time}` })
                }}
              >
                <View className="bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-between">
                  <Text className={`text-sm ${formData.start_time ? 'text-gray-900' : 'text-gray-400'}`}>
                    {formData.start_time && formData.start_time.includes(' ') ? formData.start_time.split(' ')[0] : '请选择日期'}
                  </Text>
                  <Text className="text-gray-400">📅</Text>
                </View>
              </Picker>
              <Picker
                mode="time"
                value={formData.start_time && formData.start_time.includes(' ') ? formData.start_time.split(' ')[1].slice(0, 5) : '00:00'}
                onChange={(e) => {
                  const date = formData.start_time && formData.start_time.includes(' ') ? formData.start_time.split(' ')[0] : new Date().toISOString().slice(0, 10)
                  setFormData({ ...formData, start_time: `${date} ${e.detail.value}:00` })
                }}
              >
                <View className="bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-between">
                  <Text className={`text-sm ${formData.start_time ? 'text-gray-900' : 'text-gray-400'}`}>
                    {formData.start_time && formData.start_time.includes(' ') ? formData.start_time.split(' ')[1].slice(0, 5) : '请选择时间'}
                  </Text>
                  <Text className="text-gray-400">⏰</Text>
                </View>
              </Picker>
            </View>

            <View>
              <Text className="block text-sm font-medium mb-1">结束时间（选填）</Text>
              <Picker
                mode="date"
                value={formData.end_time && formData.end_time.includes(' ') ? formData.end_time.split(' ')[0] : ''}
                onChange={(e) => {
                  if (!formData.end_time) {
                    setFormData({ ...formData, end_time: `${e.detail.value} 00:00:00` })
                  } else {
                    const time = formData.end_time.includes(' ') ? formData.end_time.split(' ')[1] : '00:00:00'
                    setFormData({ ...formData, end_time: `${e.detail.value} ${time}` })
                  }
                }}
              >
                <View className="bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-between">
                  <Text className={`text-sm ${formData.end_time ? 'text-gray-900' : 'text-gray-400'}`}>
                    {formData.end_time && formData.end_time.includes(' ') ? formData.end_time.split(' ')[0] : '请选择日期'}
                  </Text>
                  <Text className="text-gray-400">📅</Text>
                </View>
              </Picker>
            </View>
          </View>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
            >
              <Text className="text-xs">取消</Text>
            </Button>
            <Button
              className="bg-blue-500"
              onClick={handleSubmit}
              disabled={submitting}
            >
              <Text className="text-xs text-white">
                {submitting ? '保存中...' : '保存'}
              </Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <View className="py-4">
            <Text className="block text-sm text-gray-700 text-center">
              确定要删除定时计划&quot;{deletingSchedule?.template_name}&quot;吗？
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
              onClick={confirmDeleteSchedule}
            >
              <Text className="text-xs text-white">删除</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppPageShell>
  )
}
