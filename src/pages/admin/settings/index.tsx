import { View, Text } from '@tarojs/components'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Bell, DollarSign, Settings, ShieldCheck } from 'lucide-react-taro'

export default function AdminSettings() {
  return (
    <AppPageShell
      title="运营设置"
      subtitle="RecoRouter 运营端"
      right={
        <View className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
          <Settings size={20} color="#0062FF" strokeWidth={2.3} />
        </View>
      }
      bottom={<BottomNav type="admin" active="stats" />}
      scroll={false}
      contentClassName="space-y-3"
    >
      <Card className="bg-white rounded-lg shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            审核策略
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <View className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
            <View className="flex items-center gap-3">
              <View className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center">
                <ShieldCheck size={18} color="#10B981" />
              </View>
              <View>
                <Text className="block text-sm font-semibold text-gray-900">车辆资料人工复核</Text>
                <Text className="block text-xs text-gray-500 mt-1">证照、车牌、冷链能力需运营确认</Text>
              </View>
            </View>
            <Badge className="bg-green-500">
              <Text className="text-xs text-white">已启用</Text>
            </Badge>
          </View>
          <View className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
            <View className="flex items-center gap-3">
              <View className="w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center">
                <DollarSign size={18} color="#F59E0B" />
              </View>
              <View>
                <Text className="block text-sm font-semibold text-gray-900">平台服务费率</Text>
                <Text className="block text-xs text-gray-500 mt-1">标准订单按运费 10% 计提</Text>
              </View>
            </View>
            <Text className="text-sm font-bold text-orange-600">10%</Text>
          </View>
        </CardContent>
      </Card>

      <Card className="bg-white rounded-lg shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            通知配置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <View className="flex items-center gap-3 rounded-lg bg-blue-50 p-3">
            <View className="w-9 h-9 rounded-full bg-white flex items-center justify-center">
              <Bell size={18} color="#0062FF" />
            </View>
            <View className="flex-1">
              <Text className="block text-sm font-semibold text-gray-900">关键状态实时提醒</Text>
              <Text className="block text-xs text-gray-500 mt-1">接单、取消、佣金、异常审核同步推送</Text>
            </View>
          </View>
          <Button className="w-full rounded-full bg-primary" disabled>
            <Text className="text-sm font-bold text-white">保存设置</Text>
          </Button>
        </CardContent>
      </Card>
    </AppPageShell>
  )
}
