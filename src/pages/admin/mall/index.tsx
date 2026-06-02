import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Megaphone, PackagePlus, Settings, ShoppingCart } from 'lucide-react-taro'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  adminCreateCampaign,
  adminCreateMallProduct,
  adminDispatchMallOrder,
  adminGetSettings,
  adminListCampaigns,
  adminListMallOrders,
  adminListMallProducts,
  adminRefundMallOrder,
  adminUpdateMallOrderStatus,
  adminUpdateMallProduct,
  adminUpdateSettings,
  type MallCampaign,
  type MallOrder,
  type MallProduct,
  type MallSettings,
  yuan,
} from '@/services/mall'

type PanelKey = 'products' | 'orders' | 'marketing' | 'settings'

interface StoredUser {
  role?: string
}

export default function AdminMallWorkbench() {
  const [panel, setPanel] = useState<PanelKey>('products')
  const [products, setProducts] = useState<MallProduct[]>([])
  const [orders, setOrders] = useState<MallOrder[]>([])
  const [campaigns, setCampaigns] = useState<MallCampaign[]>([])
  const [settings, setSettings] = useState<MallSettings | null>(null)
  const [productName, setProductName] = useState('测试鲜奶')
  const [sku, setSku] = useState('TEST-MILK-001')
  const [campaignName, setCampaignName] = useState('满99免配送')

  useEffect(() => {
    const user = Taro.getStorageSync('userInfo') as StoredUser | undefined
    if (!user || user.role !== 'admin') {
      Taro.showToast({ title: '无权限访问', icon: 'none' })
      Taro.redirectTo({ url: '/pages/index/index' })
      return
    }
    loadAll()
  }, [])

  const loadAll = async () => {
    try {
      const [nextProducts, nextOrders, nextCampaigns, nextSettings] = await Promise.all([
        adminListMallProducts(),
        adminListMallOrders(),
        adminListCampaigns(),
        adminGetSettings(),
      ])
      setProducts(nextProducts)
      setOrders(nextOrders)
      setCampaigns(nextCampaigns)
      setSettings(nextSettings)
    } catch (error) {
      showError(error, '加载失败')
    }
  }

  const createProduct = async () => {
    try {
      await adminCreateMallProduct({
        name: productName,
        sku,
        categoryCode: 'milk',
        subtitle: '低温鲜奶',
        description: 'Web 管理端新增商品',
        priceCents: 1880,
        stock: 12,
        status: 'on_sale',
        tags: ['冷链', '鲜奶'],
        deliveryMinutes: 18,
        coldChainRequired: true,
      })
      Taro.showToast({ title: '商品已新增', icon: 'success' })
      loadAll()
    } catch (error) {
      showError(error, '新增失败')
    }
  }

  const toggleProduct = async (product: MallProduct) => {
    try {
      await adminUpdateMallProduct(product.id, {
        status: product.status === 'on_sale' ? 'off_sale' : 'on_sale',
        stock: product.stock <= 0 ? 30 : product.stock,
      })
      Taro.showToast({ title: '商品已更新', icon: 'success' })
      loadAll()
    } catch (error) {
      showError(error, '更新失败')
    }
  }

  const dispatchOrder = async (order: MallOrder) => {
    try {
      await adminDispatchMallOrder(order.id, order.vehicleCode || 'Car R-08')
      Taro.showToast({ title: '已派车', icon: 'success' })
      loadAll()
    } catch (error) {
      showError(error, '派车失败')
    }
  }

  const advanceOrder = async (order: MallOrder) => {
    const next = order.status === 'dispatching' ? 'delivering' : 'completed'
    try {
      await adminUpdateMallOrderStatus(order.id, next, next === 'completed' ? '用户已签收' : '无人车正在前往社区驿站')
      Taro.showToast({ title: '订单已更新', icon: 'success' })
      loadAll()
    } catch (error) {
      showError(error, '更新失败')
    }
  }

  const refundOrder = async (order: MallOrder) => {
    try {
      await adminRefundMallOrder(order.id, {
        amountCents: order.payableCents,
        reason: '管理端售后退款',
        handlingMethod: '极速退款',
      })
      Taro.showToast({ title: '退款已发起', icon: 'success' })
      loadAll()
    } catch (error) {
      showError(error, '退款失败')
    }
  }

  const createCampaign = async () => {
    try {
      await adminCreateCampaign({
        name: campaignName,
        campaignType: 'delivery_discount',
        budgetCents: 500000,
        rules: { thresholdCents: 9900, discountCents: 600 },
        status: 'active',
      })
      Taro.showToast({ title: '活动已创建', icon: 'success' })
      loadAll()
    } catch (error) {
      showError(error, '创建失败')
    }
  }

  const saveSettings = async () => {
    try {
      await adminUpdateSettings({
        freeDeliveryThresholdCents: 9900,
        defaultDeliveryFeeCents: 600,
        deliveryPromiseMinutes: 18,
        coldChainEnabled: true,
        refundReviewMinutes: 10,
        riskThresholds: { delayMinutes: 15, lowStock: 15 },
      })
      Taro.showToast({ title: '设置已保存', icon: 'success' })
      loadAll()
    } catch (error) {
      showError(error, '保存失败')
    }
  }

  return (
    <AppPageShell
      title="商城运营"
      subtitle="商品 / 商城订单 / 营销 / 运营设置"
      icon={ShoppingCart}
      bottom={<BottomNav type="admin" active="mall" />}
      contentClassName="space-y-4"
    >
      <View className="grid grid-cols-2 gap-2">
        <Metric label="上架商品" value={`${products.filter((item) => item.status === 'on_sale').length}`} />
        <Metric label="低库存" value={`${products.filter((item) => item.stock <= 15).length}`} tone="warn" />
        <Metric label="待派车" value={`${orders.filter((item) => item.status === 'paid').length}`} tone="warn" />
        <Metric label="活动" value={`${campaigns.filter((item) => item.status === 'active').length}`} />
      </View>

      <View className="flex flex-row gap-2 overflow-x-auto">
        {[
          ['products', '商品板块'],
          ['orders', '商城订单'],
          ['marketing', '营销活动'],
          ['settings', '运营设置'],
        ].map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={panel === key ? 'default' : 'outline'}
            className="shrink-0 rounded-full"
            onClick={() => setPanel(key as PanelKey)}
          >
            <Text className="text-xs font-black">{label}</Text>
          </Button>
        ))}
      </View>

      {panel === 'products' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <View className="flex items-center gap-2">
                <PackagePlus size={18} color="#0062FF" />
                <Text className="text-base font-black text-gray-900">商品管理</Text>
              </View>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={productName} placeholder="商品名称" onInput={(event) => setProductName(String(event.detail.value || ''))} />
            <Input value={sku} placeholder="SKU" onInput={(event) => setSku(String(event.detail.value || ''))} />
            <Button className="w-full rounded-full" onClick={createProduct}>
              <Text className="text-sm font-black text-white">新增商品</Text>
            </Button>
            {products.map((product) => (
              <AdminRow key={product.id} title={`${product.name} · ${product.sku}`} subtitle={`${product.categoryCode} · 库存 ${product.stock} · ${yuan(product.priceCents)}`}>
                <Badge className={product.status === 'on_sale' ? 'bg-emerald-500' : 'bg-gray-500'}>
                  <Text className="text-xs text-white">{product.status === 'on_sale' ? '上架中' : '已下架'}</Text>
                </Badge>
                <Button size="sm" variant="outline" onClick={() => toggleProduct(product)}>
                  <Text className="text-xs font-black text-primary">{product.status === 'on_sale' ? '下架' : '恢复'}</Text>
                </Button>
              </AdminRow>
            ))}
          </CardContent>
        </Card>
      )}

      {panel === 'orders' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <Text className="text-base font-black text-gray-900">商城订单管理</Text>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {orders.map((order) => (
              <AdminRow key={order.id} title={`${order.orderNo} · ${yuan(order.payableCents)}`} subtitle={`${order.addressText} · ${statusText(order.status)}`}>
                <Button size="sm" variant="outline" onClick={() => dispatchOrder(order)}>
                  <Text className="text-xs font-black text-primary">派车</Text>
                </Button>
                <Button size="sm" onClick={() => advanceOrder(order)}>
                  <Text className="text-xs font-black text-white">推进</Text>
                </Button>
                <Button size="sm" variant="outline" onClick={() => refundOrder(order)}>
                  <Text className="text-xs font-black text-primary">退款</Text>
                </Button>
              </AdminRow>
            ))}
          </CardContent>
        </Card>
      )}

      {panel === 'marketing' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <View className="flex items-center gap-2">
                <Megaphone size={18} color="#0062FF" />
                <Text className="text-base font-black text-gray-900">营销活动 / 预算投放</Text>
              </View>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={campaignName} placeholder="活动名称" onInput={(event) => setCampaignName(String(event.detail.value || ''))} />
            <Button className="w-full rounded-full" onClick={createCampaign}>
              <Text className="text-sm font-black text-white">创建活动</Text>
            </Button>
            {campaigns.map((campaign) => (
              <AdminRow key={campaign.id} title={campaign.name} subtitle={`${campaign.campaignType} · 预算 ${yuan(campaign.budgetCents)} · 已用 ${yuan(campaign.spentCents)}`}>
                <Badge className={campaign.status === 'active' ? 'bg-emerald-500' : 'bg-gray-500'}>
                  <Text className="text-xs text-white">{campaign.status}</Text>
                </Badge>
              </AdminRow>
            ))}
          </CardContent>
        </Card>
      )}

      {panel === 'settings' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <View className="flex items-center gap-2">
                <Settings size={18} color="#0062FF" />
                <Text className="text-base font-black text-gray-900">运营设置 / 权限规则</Text>
              </View>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <AdminRow title="免配送门槛" subtitle={settings ? yuan(settings.freeDeliveryThresholdCents) : '¥99.00'} />
            <AdminRow title="配送承诺" subtitle={`${settings?.deliveryPromiseMinutes || 18} 分钟 · 冷链 ${settings?.coldChainEnabled ? '开启' : '关闭'}`} />
            <AdminRow title="退款审核 SLA" subtitle={`${settings?.refundReviewMinutes || 10} 分钟内审核`} />
            <Button className="w-full rounded-full" onClick={saveSettings}>
              <Text className="text-sm font-black text-white">保存设置</Text>
            </Button>
          </CardContent>
        </Card>
      )}
    </AppPageShell>
  )
}

const Metric = ({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) => (
  <Card className={tone === 'warn' ? 'bg-orange-50' : 'bg-blue-50'}>
    <CardContent className="p-4">
      <Text className="block text-xs font-bold text-gray-500">{label}</Text>
      <Text className={tone === 'warn' ? 'mt-1 block text-2xl font-black text-orange-500' : 'mt-1 block text-2xl font-black text-blue-600'}>
        {value}
      </Text>
    </CardContent>
  </Card>
)

const AdminRow = ({ title, subtitle, children }: { title: string; subtitle: string; children?: ReactNode }) => (
  <View className="rounded-xl border border-gray-200 bg-white p-3">
    <View className="flex items-start justify-between gap-3">
      <View className="min-w-0 flex-1">
        <Text className="block text-sm font-black text-gray-900">{title}</Text>
        <Text className="mt-1 block text-xs font-bold text-gray-500">{subtitle}</Text>
      </View>
      {children && <View className="flex shrink-0 items-center gap-2">{children}</View>}
    </View>
  </View>
)

function statusText(status: string) {
  const map: Record<string, string> = {
    pending_payment: '待支付',
    paid: '待派车',
    dispatching: '已派车',
    delivering: '配送中',
    completed: '已完成',
    cancelled: '已取消',
  }
  return map[status] || status
}

function showError(error: unknown, fallback: string) {
  Taro.showToast({
    title: error instanceof Error ? error.message : fallback,
    icon: 'none',
  })
}
