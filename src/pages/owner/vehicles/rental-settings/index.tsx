import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Info } from 'lucide-react-taro'
import { Network } from '@/network'

interface RentalSettings {
  id: string
  is_available_for_rent: boolean
  rent_monthly_price: number
  rent_yearly_price: number
  rent_deposit: number
  contact_phone?: string
  contact_wechat?: string
  rental_notes?: string
}

export default function VehicleRentalSettings() {
  const router = useRouter()
  const { vehicleId } = router.params

  const [settings, setSettings] = useState<Partial<RentalSettings>>({
    is_available_for_rent: false,
    rent_monthly_price: 0,
    rent_yearly_price: 0,
    rent_deposit: 0,
    contact_phone: '',
    contact_wechat: '',
    rental_notes: ''
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    console.log('车辆租赁设置页面初始化，vehicleId:', vehicleId)
    if (vehicleId) {
      loadSettings()
    } else {
      Taro.showToast({
        title: '缺少车辆ID',
        icon: 'none'
      })
      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
    }
  }, [vehicleId])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: `/api/vehicles/${vehicleId}/rental-settings`
      })

      console.log('租赁设置响应:', res.data)

      if (res.data.code === 200) {
        const data = res.data.data
        setSettings({
          is_available_for_rent: data.is_available_for_rent || false,
          rent_monthly_price: data.rent_monthly_price || 0,
          rent_yearly_price: data.rent_yearly_price || 0,
          rent_deposit: data.rent_deposit || 0,
          contact_phone: data.contact_phone || '',
          contact_wechat: data.contact_wechat || '',
          rental_notes: data.rental_notes || ''
        })
      } else {
        Taro.showToast({
          title: res.data.message || '加载失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('加载租赁设置失败:', error)
      Taro.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    console.log('开始保存租赁设置，vehicleId:', vehicleId, 'settings:', settings)
    setSaving(true)
    try {
      const res = await Network.request({
        url: `/api/vehicles/${vehicleId}/rental-settings`,
        method: 'PUT',
        data: {
          is_available_for_rent: settings.is_available_for_rent,
          rent_monthly_price: Number(settings.rent_monthly_price),
          rent_yearly_price: Number(settings.rent_yearly_price),
          rent_deposit: Number(settings.rent_deposit),
          contact_phone: settings.contact_phone,
          contact_wechat: settings.contact_wechat,
          notes: settings.rental_notes
        }
      })

      console.log('保存租赁设置响应:', res.data)

      if (res.data.code === 200) {
        Taro.showToast({
          title: '保存成功',
          icon: 'success'
        })
        setTimeout(() => {
          Taro.navigateBack()
        }, 1500)
      } else {
        Taro.showToast({
          title: res.data.message || '保存失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('保存租赁设置失败:', error)
      Taro.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }))
  }

  if (loading) {
    return (
      <AppPageShell
        title="出租设置"
        subtitle="RecoRouter 运力端"
        bottom={<BottomNav type="owner" active="vehicles" />}
      >
        <Text className="block text-gray-500">加载中...</Text>
      </AppPageShell>
    )
  }

  return (
    <AppPageShell
      title="出租设置"
      subtitle="RecoRouter 运力端"
      contentClassName="space-y-4"
      bottom={<BottomNav type="owner" active="vehicles" />}
    >
        {/* 提示信息 */}
        <View className="p-3 bg-blue-50 rounded-lg">
          <View className="flex items-start">
            <Info size={16} color="#1890ff" className="mr-2 flex-shrink-0 mt-1" />
            <Text className="block text-sm text-blue-700">
              设置车辆为可租赁后，需求方可以在租车大厅看到您的车辆。
            </Text>
          </View>
        </View>

        {/* 租赁设置 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">租赁信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 可租赁状态 */}
            <View className="flex items-center justify-between">
              <Text className="block text-sm text-gray-700">可租赁状态</Text>
              <Switch
                checked={settings.is_available_for_rent}
                onCheckedChange={(checked) => handleInputChange('is_available_for_rent', checked)}
              />
            </View>

            {settings.is_available_for_rent && (
              <>
                <Separator />

                {/* 月租价格 */}
                <View>
                  <Label>月租价格（元/月）</Label>
                  <Input
                    type="number"
                    value={settings.rent_monthly_price?.toString() || ''}
                    onInput={(e: any) => handleInputChange('rent_monthly_price', e.detail.value)}
                    placeholder="请输入月租价格"
                    className="mt-2"
                  />
                </View>

                {/* 年租价格 */}
                <View>
                  <Label>年租价格（元/年）</Label>
                  <Input
                    type="number"
                    value={settings.rent_yearly_price?.toString() || ''}
                    onInput={(e: any) => handleInputChange('rent_yearly_price', e.detail.value)}
                    placeholder="请输入年租价格"
                    className="mt-2"
                  />
                </View>

                {/* 押金 */}
                <View>
                  <Label>押金金额（元）</Label>
                  <Input
                    type="number"
                    value={settings.rent_deposit?.toString() || ''}
                    onInput={(e: any) => handleInputChange('rent_deposit', e.detail.value)}
                    placeholder="请输入押金金额"
                    className="mt-2"
                  />
                </View>

                <Separator />

                {/* 联系方式 */}
                <View>
                  <Label>联系电话</Label>
                  <Input
                    value={settings.contact_phone || ''}
                    onInput={(e: any) => handleInputChange('contact_phone', e.detail.value)}
                    placeholder="请输入联系电话"
                    className="mt-2"
                  />
                </View>

                <View>
                  <Label>微信号</Label>
                  <Input
                    value={settings.contact_wechat || ''}
                    onInput={(e: any) => handleInputChange('contact_wechat', e.detail.value)}
                    placeholder="请输入微信号"
                    className="mt-2"
                  />
                </View>

                {/* 备注 */}
                <View>
                  <Label>备注</Label>
                  <Textarea
                    value={settings.rental_notes || ''}
                    onInput={(e: any) => handleInputChange('rental_notes', e.detail.value)}
                    placeholder="请输入备注信息（可选）"
                    className="mt-2"
                    maxlength={200}
                  />
                </View>

                <Separator />

                {/* 租赁条款 */}
                <View className="p-3 bg-gray-50 rounded-lg">
                  <Text className="block text-sm font-medium text-gray-700 mb-2">租赁条款（仅供参考）</Text>
                  <View className="space-y-1">
                    <Text className="block text-xs text-gray-600">• 车辆维修：由车主负责</Text>
                    <Text className="block text-xs text-gray-600">• 车辆保险：由车主负责</Text>
                    <Text className="block text-xs text-gray-600">• 接单收益：全部归租户，与车主无关</Text>
                    <Text className="block text-xs text-gray-600">• 租金支付：线下支付，平台不参与</Text>
                  </View>
                </View>
              </>
            )}
          </CardContent>
        </Card>

        {/* 保存按钮 */}
        <View className="flex gap-3 pb-2">
          <Button
            className="flex-1"
            variant="outline"
            onClick={() => Taro.navigateBack()}
          >
            取消
          </Button>
          <Button
            className="flex-1"
            onClick={handleSaveSettings}
            disabled={saving}
          >
            {saving ? '保存中...' : '保存设置'}
          </Button>
        </View>
    </AppPageShell>
  )
}
