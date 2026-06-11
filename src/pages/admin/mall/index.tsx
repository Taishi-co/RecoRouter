import type { ComponentType, ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import {
  ChartNoAxesCombined,
  CircleCheck,
  ClipboardList,
  MapPin,
  PackagePlus,
  RefreshCw,
  Send,
  ShoppingCart,
  Trophy,
  TriangleAlert,
  Truck,
  Wallet,
} from 'lucide-react-taro'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Input } from '@/components/ui/input'
import {
  adminCreateMallProduct,
  adminCreateMallProductListingRequest,
  adminCreateMallWithdrawal,
  adminDispatchMallOrder,
  adminGenerateMallDeliverySheet,
  adminGetMallOpsOverview,
  adminGetMallSalesStats,
  adminListMallDeliverySheets,
  adminListMallFinanceBills,
  adminListMallOrders,
  adminListMallPickupPoints,
  adminListMallProductListingRequests,
  adminListMallProducts,
  adminListMallSettlementRecords,
  adminRefundMallOrder,
  adminReviewMallProductListingRequest,
  adminUpdateMallDeliverySheetStatus,
  adminUpdateMallOrderStatus,
  adminUpdateMallProduct,
  type MallOrder,
  type MallPickupPoint,
  type MallProduct,
  yuan,
} from '@/services/mall'

type PanelKey = 'products' | 'orders' | 'delivery' | 'finance' | 'stats'
type RecordItem = Record<string, any>
type IconType = ComponentType<any>

interface StoredUser {
  role?: string
  data?: {
    role?: string
  }
}

interface ProductForm {
  name: string
  sku: string
  categoryCode: string
  imageUrl: string
  spec: string
  saleMethod: string
  supplyPriceYuan: string
  priceYuan: string
  originalPriceYuan: string
  stock: string
  stockAlertThreshold: string
  lengthCm: string
  widthCm: string
  heightCm: string
  volumeLiters: string
  weightKg: string
}

const theme = {
  page: '#FAF8F3',
  surface: '#FFFFFF',
  primary: '#2F7D32',
  primaryDark: '#1D2F21',
  primarySoft: '#EDF7E7',
  accent: '#FF9F43',
  accentSoft: '#FFF3E3',
  border: '#DDE7D6',
  ink: '#243021',
  muted: '#6C7568',
  danger: '#D84A3A',
  dangerSoft: '#FFF0EA',
}

const emptyProductForm: ProductForm = {
  name: '',
  sku: '',
  categoryCode: 'vegetable',
  imageUrl: '',
  spec: '500g/份',
  saleMethod: '按份',
  supplyPriceYuan: '8.80',
  priceYuan: '12.90',
  originalPriceYuan: '15.90',
  stock: '50',
  stockAlertThreshold: '10',
  lengthCm: '20',
  widthCm: '15',
  heightCm: '8',
  volumeLiters: '2.4',
  weightKg: '0.5',
}

const panelTabs: Array<{ key: PanelKey; label: string; icon: IconType }> = [
  { key: 'products', label: '商品', icon: PackagePlus },
  { key: 'orders', label: '订单', icon: ClipboardList },
  { key: 'delivery', label: '配送', icon: Truck },
  { key: 'finance', label: '财务', icon: Wallet },
  { key: 'stats', label: '数据', icon: ChartNoAxesCombined },
]

export default function AdminMallWorkbench() {
  const [panel, setPanel] = useState<PanelKey>('products')
  const [loading, setLoading] = useState(false)
  const [overview, setOverview] = useState<RecordItem | null>(null)
  const [products, setProducts] = useState<MallProduct[]>([])
  const [orders, setOrders] = useState<MallOrder[]>([])
  const [pickupPoints, setPickupPoints] = useState<MallPickupPoint[]>([])
  const [listingRequests, setListingRequests] = useState<RecordItem[]>([])
  const [deliverySheets, setDeliverySheets] = useState<RecordItem[]>([])
  const [financeBills, setFinanceBills] = useState<RecordItem[]>([])
  const [settlements, setSettlements] = useState<RecordItem[]>([])
  const [salesStats, setSalesStats] = useState<RecordItem | null>(null)
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm)
  const [inventoryTargetStock, setInventoryTargetStock] = useState('80')
  const [inventoryAlertThreshold, setInventoryAlertThreshold] = useState('12')
  const [vehicleCode, setVehicleCode] = useState('Car R-08')
  const [selectedPickupPointId, setSelectedPickupPointId] = useState('')
  const [withdrawalAmountYuan, setWithdrawalAmountYuan] = useState('1000')

  useEffect(() => {
    const user = Taro.getStorageSync('userInfo') as StoredUser | undefined
    const role = user?.role || user?.data?.role
    if (role !== 'admin') {
      Taro.showToast({ title: '无权限访问', icon: 'none' })
      Taro.redirectTo({ url: '/pages/index/index' })
      return
    }
    loadAll()
  }, [])

  const todayOrders = useMemo(() => {
    const today = todayKey()
    return orders.filter((order) => dateKey(order.createdAt) === today)
  }, [orders])

  const abnormalOrders = useMemo(
    () => orders.filter((order) => isAbnormalOrder(order)),
    [orders],
  )

  const lowStockProducts = useMemo(
    () => products.filter((product) => product.stock <= (product.stockAlertThreshold ?? 10)),
    [products],
  )

  const hotProducts = useMemo(() => {
    const statProducts = toList<RecordItem>(valueOf(salesStats, ['topProducts', 'hotProducts', 'productRankings']))
    if (statProducts.length > 0) return statProducts

    return [...products]
      .sort((left, right) => (right.soldCount || 0) - (left.soldCount || 0))
      .slice(0, 5)
      .map((product) => ({
        id: product.id,
        name: product.name,
        quantity: product.soldCount,
        revenueCents: product.soldCount * product.priceCents,
      }))
  }, [products, salesStats])

  const loadAll = async () => {
    setLoading(true)
    const results = await Promise.allSettled([
      adminGetMallOpsOverview(),
      adminListMallProducts(),
      adminListMallOrders(),
      adminListMallPickupPoints(),
      adminListMallProductListingRequests(),
      adminListMallDeliverySheets(),
      adminListMallFinanceBills(),
      adminListMallSettlementRecords(),
      adminGetMallSalesStats(),
    ])

    if (results[0].status === 'fulfilled') setOverview(asRecord(results[0].value))
    if (results[1].status === 'fulfilled') setProducts(toList<MallProduct>(results[1].value))
    if (results[2].status === 'fulfilled') setOrders(toList<MallOrder>(results[2].value))
    if (results[3].status === 'fulfilled') setPickupPoints(toList<MallPickupPoint>(results[3].value))
    if (results[4].status === 'fulfilled') setListingRequests(toList<RecordItem>(results[4].value))
    if (results[5].status === 'fulfilled') setDeliverySheets(toList<RecordItem>(results[5].value))
    if (results[6].status === 'fulfilled') setFinanceBills(toList<RecordItem>(results[6].value))
    if (results[7].status === 'fulfilled') setSettlements(toList<RecordItem>(results[7].value))
    if (results[8].status === 'fulfilled') setSalesStats(asRecord(results[8].value))

    const failed = results.find((result) => result.status === 'rejected')
    if (failed?.status === 'rejected') {
      showError(failed.reason, '运营数据加载失败')
    }
    setLoading(false)
  }

  const createProduct = async () => {
    if (!productForm.name.trim() || !productForm.sku.trim() || !productForm.spec.trim() || !productForm.saleMethod.trim()) {
      Taro.showToast({ title: '请填写商品名称、SKU、规格和售卖方式', icon: 'none' })
      return
    }

    try {
      await adminCreateMallProduct({
        name: productForm.name.trim(),
        sku: productForm.sku.trim(),
        categoryCode: productForm.categoryCode.trim() || 'general',
        imageUrl: productForm.imageUrl.trim(),
        subtitle: productForm.spec.trim(),
        specification: productForm.spec.trim(),
        saleMethod: productForm.saleMethod.trim(),
        description: `规格 ${productForm.lengthCm}x${productForm.widthCm}x${productForm.heightCm}cm，重量 ${productForm.weightKg}kg`,
        priceCents: parseCents(productForm.priceYuan),
        originalPriceCents: parseCents(productForm.originalPriceYuan),
        supplyPriceCents: parseCents(productForm.supplyPriceYuan),
        stock: parseInteger(productForm.stock, 0),
        stockAlertThreshold: parseInteger(productForm.stockAlertThreshold, 10),
        status: 'off_sale',
        tags: ['运营端新增', productForm.spec.trim()].filter(Boolean),
        deliveryMinutes: 18,
        coldChainRequired: true,
        lengthCm: parseDecimal(productForm.lengthCm),
        widthCm: parseDecimal(productForm.widthCm),
        heightCm: parseDecimal(productForm.heightCm),
        volumeLiters: parseDecimal(productForm.volumeLiters),
        weightKg: parseDecimal(productForm.weightKg),
      } as Partial<MallProduct> & RecordItem & { categoryCode: string; priceCents: number })
      Taro.showToast({ title: '商品已新增', icon: 'success' })
      setProductForm(emptyProductForm)
      await loadAll()
    } catch (error) {
      showError(error, '新增商品失败')
    }
  }

  const toggleProduct = async (product: MallProduct) => {
    const nextStatus = product.status === 'on_sale' ? 'off_sale' : 'on_sale'
    try {
      await adminUpdateMallProduct(product.id, { status: nextStatus })
      Taro.showToast({ title: nextStatus === 'on_sale' ? '已上架' : '已下架', icon: 'success' })
      await loadAll()
    } catch (error) {
      showError(error, '上下架失败')
    }
  }

  const updateInventory = async (product: MallProduct) => {
    try {
      await adminUpdateMallProduct(product.id, {
        stock: parseInteger(inventoryTargetStock, product.stock),
        stockAlertThreshold: parseInteger(inventoryAlertThreshold, product.stockAlertThreshold ?? 10),
      })
      Taro.showToast({ title: '库存预警已更新', icon: 'success' })
      await loadAll()
    } catch (error) {
      showError(error, '库存更新失败')
    }
  }

  const submitListingRequest = async (product: MallProduct) => {
    const requestedStatus = product.status === 'on_sale' ? 'off_sale' : 'on_sale'
    try {
      await adminCreateMallProductListingRequest({
        productId: product.id,
        requestType: requestedStatus === 'on_sale' ? 'listing' : 'delisting',
        requestedStatus,
        reason: `平台运营提交${requestedStatus === 'on_sale' ? '上架' : '下架'}申请`,
      })
      Taro.showToast({ title: '上下架申请已提交', icon: 'success' })
      await loadAll()
    } catch (error) {
      showError(error, '提交申请失败')
    }
  }

  const reviewListingRequest = async (request: RecordItem, approved: boolean) => {
    const id = textOf(request, ['id'])
    if (!id) return

    try {
      await adminReviewMallProductListingRequest(id, {
        status: approved ? 'approved' : 'rejected',
        reviewStatus: approved ? 'approved' : 'rejected',
        reviewNote: approved ? '平台运营审核通过' : '平台运营驳回申请',
      })
      Taro.showToast({ title: approved ? '申请已通过' : '申请已驳回', icon: 'success' })
      await loadAll()
    } catch (error) {
      showError(error, '审核失败')
    }
  }

  const dispatchOrder = async (order: MallOrder) => {
    try {
      await adminDispatchMallOrder(order.id, vehicleCode.trim() || 'Car R-08')
      Taro.showToast({ title: '已派车', icon: 'success' })
      await loadAll()
    } catch (error) {
      showError(error, '派车失败')
    }
  }

  const advanceOrder = async (order: MallOrder) => {
    const next = nextOrderStatus(order.status)
    try {
      await adminUpdateMallOrderStatus(order.id, next, orderStatusDescription(next))
      Taro.showToast({ title: '订单已推进', icon: 'success' })
      await loadAll()
    } catch (error) {
      showError(error, '订单更新失败')
    }
  }

  const refundOrder = async (order: MallOrder) => {
    try {
      await adminRefundMallOrder(order.id, {
        amountCents: order.payableCents,
        reason: '商城运营端售后处理',
        handlingMethod: '原路退回',
      })
      Taro.showToast({ title: '退款已发起', icon: 'success' })
      await loadAll()
    } catch (error) {
      showError(error, '退款失败')
    }
  }

  const generateDeliverySheet = async () => {
    try {
      await adminGenerateMallDeliverySheet({
        sheetDate: todayKey(),
        pickupPointId: selectedPickupPointId || undefined,
      })
      Taro.showToast({ title: '配送单已生成', icon: 'success' })
      await loadAll()
    } catch (error) {
      showError(error, '生成配送单失败')
    }
  }

  const updateDeliveryStatus = async (sheet: RecordItem, status: string) => {
    const id = textOf(sheet, ['id'])
    if (!id) return

    try {
      await adminUpdateMallDeliverySheetStatus(id, { status })
      Taro.showToast({ title: status === 'delivered' ? '已送达' : '已发货', icon: 'success' })
      await loadAll()
    } catch (error) {
      showError(error, '配送状态更新失败')
    }
  }

  const createWithdrawal = async () => {
    const amountCents = parseCents(withdrawalAmountYuan)
    if (amountCents <= 0) {
      Taro.showToast({ title: '请输入提现金额', icon: 'none' })
      return
    }

    try {
      await adminCreateMallWithdrawal({
        amountCents,
        requesterRole: 'admin',
        note: '平台运营小程序提交',
      })
      Taro.showToast({ title: '提现申请已提交', icon: 'success' })
      await loadAll()
    } catch (error) {
      showError(error, '提现申请失败')
    }
  }

  return (
    <AppPageShell
      title="商城运营端"
      subtitle="A 端平台运营专用 · 不开放注册"
      icon={ShoppingCart}
      right={<HeaderIcon icon={ShoppingCart} />}
      bottom={<BottomNav type="admin" active="mall" tone="mall" />}
      className="bg-[#FAF8F3] text-gray-900"
      headerClassName="border-b border-[#DDE7D6] bg-[#FAF8F3]"
      contentClassName="gap-3"
    >
      <View
        className="rounded-2xl p-4"
        style={{ background: theme.primaryDark, boxShadow: '0 10px 26px rgba(29, 47, 33, 0.12)' }}
      >
        <View className="flex items-center justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text className="block text-lg font-black text-white">叁友甄选运营工作台</Text>
            <Text className="mt-1 block text-xs font-semibold" style={{ color: '#DDE7D6' }}>
              商品、订单、配送、财务、数据统一处理
            </Text>
          </View>
          <ActionButton icon={RefreshCw} label={loading ? '刷新中' : '刷新'} size="sm" tone="light" disabled={loading} onClick={loadAll} />
        </View>
      </View>

      <View className="grid grid-cols-2 gap-2">
        <Metric label="商品管理" value={`${metricNumber(overview, ['onSaleProducts'], products.filter((item) => item.status === 'on_sale').length)}`} caption="当前上架" />
        <Metric label="库存管理" value={`${metricNumber(overview, ['stockAlerts'], lowStockProducts.length)}`} caption="低库存预警" tone="warn" />
        <Metric label="今日订单" value={`${metricNumber(overview, ['todayOrders', 'todayOrderCount'], todayOrders.length)}`} caption={`待处理 ${orders.filter((item) => item.status === 'paid').length}`} />
        <Metric label="异常订单" value={`${metricNumber(overview, ['afterSales', 'abnormalOrders'], abnormalOrders.length)}`} caption="退款 / 售后" tone="danger" />
      </View>

      <View className="grid grid-cols-5 gap-2">
        {panelTabs.map((item) => (
          <PanelTab key={item.key} active={panel === item.key} icon={item.icon} label={item.label} onClick={() => setPanel(item.key)} />
        ))}
      </View>

      {panel === 'products' && (
        <View className="space-y-3">
          <Section icon={PackagePlus} title="商品管理" caption="运营新增商品并维护规格、价格、图片和状态">
            <View className="grid grid-cols-2 gap-2">
              <Field label="商品名称" value={productForm.name} placeholder="例：精品番茄" onChange={(value) => updateProductForm(setProductForm, 'name', value)} />
              <Field label="SKU" value={productForm.sku} placeholder="SY-TOMATO-001" onChange={(value) => updateProductForm(setProductForm, 'sku', value)} />
              <Field label="分类" value={productForm.categoryCode} placeholder="vegetable" onChange={(value) => updateProductForm(setProductForm, 'categoryCode', value)} />
              <Field label="规格" value={productForm.spec} placeholder="500g/份" onChange={(value) => updateProductForm(setProductForm, 'spec', value)} />
              <Field label="售卖方式" value={productForm.saleMethod} placeholder="单瓶/整件/按斤" onChange={(value) => updateProductForm(setProductForm, 'saleMethod', value)} />
              <Field label="商品图片" value={productForm.imageUrl} placeholder="上传后图片地址" onChange={(value) => updateProductForm(setProductForm, 'imageUrl', value)} full />
              <Field label="进货价" type="digit" value={productForm.supplyPriceYuan} onChange={(value) => updateProductForm(setProductForm, 'supplyPriceYuan', value)} />
              <Field label="建议零售价" type="digit" value={productForm.priceYuan} onChange={(value) => updateProductForm(setProductForm, 'priceYuan', value)} />
              <Field label="划线价" type="digit" value={productForm.originalPriceYuan} onChange={(value) => updateProductForm(setProductForm, 'originalPriceYuan', value)} />
              <Field label="库存" type="number" value={productForm.stock} onChange={(value) => updateProductForm(setProductForm, 'stock', value)} />
              <Field label="长 cm" type="digit" value={productForm.lengthCm} onChange={(value) => updateProductForm(setProductForm, 'lengthCm', value)} />
              <Field label="宽 cm" type="digit" value={productForm.widthCm} onChange={(value) => updateProductForm(setProductForm, 'widthCm', value)} />
              <Field label="高 cm" type="digit" value={productForm.heightCm} onChange={(value) => updateProductForm(setProductForm, 'heightCm', value)} />
              <Field label="体积 L" type="digit" value={productForm.volumeLiters} onChange={(value) => updateProductForm(setProductForm, 'volumeLiters', value)} />
              <Field label="重量 kg" type="digit" value={productForm.weightKg} onChange={(value) => updateProductForm(setProductForm, 'weightKg', value)} />
            </View>
            <ActionButton icon={PackagePlus} label="新增商品" onClick={createProduct} />
          </Section>

          <Section icon={TriangleAlert} title="库存管理" caption="设置库存数量和库存预警值，避免无人车装载前才发现缺货">
            <View className="grid grid-cols-2 gap-2">
              <Field label="目标库存" type="number" value={inventoryTargetStock} onChange={setInventoryTargetStock} />
              <Field label="预警值" type="number" value={inventoryAlertThreshold} onChange={setInventoryAlertThreshold} />
            </View>
            <RecordList emptyText="暂无商品">
              {products.map((product) => (
                <RecordRow
                  key={product.id}
                  title={product.name}
                  subtitle={`${product.categoryCode} · 库存 ${product.stock} · 预警 ${product.stockAlertThreshold ?? 10} · ${specText(product)}`}
                  badge={product.status === 'on_sale' ? '上架中' : '已下架'}
                  tone={product.stock <= (product.stockAlertThreshold ?? 10) ? 'warn' : 'normal'}
                >
                  <ActionButton label="更新库存" size="sm" variant="outline" onClick={() => updateInventory(product)} />
                  <ActionButton label={product.status === 'on_sale' ? '下架' : '上架'} size="sm" onClick={() => toggleProduct(product)} />
                  <ActionButton label="申请" size="sm" variant="outline" onClick={() => submitListingRequest(product)} />
                </RecordRow>
              ))}
            </RecordList>
          </Section>

          <Section icon={CircleCheck} title="上下架申请" caption="提交申请并由平台运营审核后同步用户端">
            <RecordList emptyText="暂无上下架申请">
              {listingRequests.map((request) => (
                <RecordRow
                  key={textOf(request, ['id'])}
                  title={textOf(request, ['productName', 'name'], '未命名商品')}
                  subtitle={`${listingRequestType(request)} · ${textOf(request, ['reason'], '无备注')}`}
                  badge={listingRequestStatus(request)}
                  tone={listingRequestStatus(request) === 'pending' ? 'warn' : 'normal'}
                >
                  <ActionButton label="通过" size="sm" onClick={() => reviewListingRequest(request, true)} />
                  <ActionButton label="驳回" size="sm" variant="danger" onClick={() => reviewListingRequest(request, false)} />
                </RecordRow>
              ))}
            </RecordList>
          </Section>
        </View>
      )}

      {panel === 'orders' && (
        <View className="space-y-3">
          <Section icon={ClipboardList} title="今日订单" caption="按今日订单处理派车、推进和退款">
            <Field label="派车车辆编号" value={vehicleCode} onChange={setVehicleCode} />
            <RecordList emptyText="今日暂无订单">
              {todayOrders.map((order) => (
                <OrderRow key={order.id} order={order} onDispatch={dispatchOrder} onAdvance={advanceOrder} onRefund={refundOrder} />
              ))}
            </RecordList>
          </Section>

          <Section icon={ClipboardList} title="历史订单" caption="查看全部历史订单明细和履约状态">
            <RecordList emptyText="暂无历史订单">
              {orders.map((order) => (
                <OrderRow key={order.id} order={order} onDispatch={dispatchOrder} onAdvance={advanceOrder} onRefund={refundOrder} compact />
              ))}
            </RecordList>
          </Section>

          <Section icon={TriangleAlert} title="异常订单" caption="退款、售后和取消订单集中处理">
            <RecordList emptyText="暂无异常订单">
              {abnormalOrders.map((order) => (
                <OrderRow key={order.id} order={order} onDispatch={dispatchOrder} onAdvance={advanceOrder} onRefund={refundOrder} />
              ))}
            </RecordList>
          </Section>
        </View>
      )}

      {panel === 'delivery' && (
        <View className="space-y-3">
          <Section icon={Truck} title="配送单" caption="每日固定时间生成当日配送单，并可按自提点筛选">
            <View className="rounded-xl p-3" style={{ background: theme.primarySoft }}>
              <Text className="block text-xs font-bold" style={{ color: theme.muted }}>
                配送范围
              </Text>
              <View className="mt-2 flex flex-row flex-wrap gap-2">
                <ChoicePill label="全部自提点" active={!selectedPickupPointId} onClick={() => setSelectedPickupPointId('')} />
                {pickupPoints.slice(0, 6).map((point) => (
                  <ChoicePill key={point.id} label={point.name} active={selectedPickupPointId === point.id} onClick={() => setSelectedPickupPointId(point.id)} />
                ))}
              </View>
            </View>
            <ActionButton icon={Send} label="生成配送单" onClick={generateDeliverySheet} />
            <RecordList emptyText="暂无配送单">
              {deliverySheets.map((sheet) => (
                <RecordRow
                  key={textOf(sheet, ['id'])}
                  title={`${textOf(sheet, ['sheetDate', 'date'], todayKey())} · ${textOf(sheet, ['pickupPointName', 'communityName'], '全部自提点')}`}
                  subtitle={`订单 ${numberOf(sheet, ['orderCount'])} · 商品 ${numberOf(sheet, ['itemCount'])} · ${moneyOf(sheet, ['totalPayableCents', 'payableCents'])}`}
                  badge={deliveryStatusText(textOf(sheet, ['status'], 'generated'))}
                >
                  <ActionButton label="标记发货" size="sm" onClick={() => updateDeliveryStatus(sheet, 'shipped')} />
                  <ActionButton label="标记送达" size="sm" variant="outline" onClick={() => updateDeliveryStatus(sheet, 'delivered')} />
                </RecordRow>
              ))}
            </RecordList>
          </Section>

          <Section icon={Truck} title="配送状态" caption="实时跟踪配送单已生成、已发货、已送达">
            <View className="grid grid-cols-3 gap-2">
              <MiniMetric label="已生成" value={`${deliverySheets.filter((item) => textOf(item, ['status']) === 'generated').length}`} />
              <MiniMetric label="已发货" value={`${deliverySheets.filter((item) => textOf(item, ['status']) === 'shipped').length}`} />
              <MiniMetric label="已送达" value={`${deliverySheets.filter((item) => textOf(item, ['status']) === 'delivered').length}`} />
            </View>
          </Section>

          <Section icon={MapPin} title="自提点" caption="查看团长联系方式、地址和营业状态">
            <RecordList emptyText="暂无自提点">
              {pickupPoints.map((point) => (
                <RecordRow
                  key={point.id}
                  title={point.name}
                  subtitle={`${point.addressText} · ${point.groupLeaderName || point.contactName || '未配置团长'} ${point.groupLeaderName || point.contactName ? point.contactPhone || point.groupLeaderId || '' : ''}`}
                  badge={point.status}
                />
              ))}
            </RecordList>
          </Section>
        </View>
      )}

      {panel === 'finance' && (
        <View className="space-y-3">
          <Section icon={Wallet} title="账单明细" caption="每日、每周、每月账单展示供货金额、退款金额和实际结算金额">
            <RecordList emptyText="暂无账单">
              {financeBills.map((bill) => (
                <RecordRow
                  key={textOf(bill, ['id', 'billNo'])}
                  title={textOf(bill, ['periodLabel', 'billDate', 'date'], '账单')}
                  subtitle={`供货 ${moneyOf(bill, ['supplyAmountCents'])} · 退款 ${moneyOf(bill, ['refundAmountCents'])} · 实结 ${moneyOf(bill, ['settlementAmountCents', 'actualSettlementAmountCents'])}`}
                  badge={textOf(bill, ['status'], 'pending')}
                />
              ))}
            </RecordList>
          </Section>

          <Section icon={CircleCheck} title="结算记录" caption="查看历史结算状态和打款凭证">
            <RecordList emptyText="暂无结算记录">
              {settlements.map((item) => (
                <RecordRow
                  key={textOf(item, ['id', 'settlementNo'])}
                  title={textOf(item, ['periodLabel', 'settlementNo'], '结算记录')}
                  subtitle={`${moneyOf(item, ['settlementAmountCents', 'amountCents'])} · 凭证 ${textOf(item, ['voucherUrl', 'voucher_url'], '未上传')}`}
                  badge={textOf(item, ['status'], 'pending')}
                />
              ))}
            </RecordList>
          </Section>

          <Section icon={Wallet} title="提现申请" caption="平台运营提交提现申请，后台审核后打款">
            <Field label="提现金额" type="digit" value={withdrawalAmountYuan} onChange={setWithdrawalAmountYuan} />
            <ActionButton icon={Wallet} label="提交提现申请" onClick={createWithdrawal} />
          </Section>
        </View>
      )}

      {panel === 'stats' && (
        <View className="space-y-3">
          <Section icon={ChartNoAxesCombined} title="销量统计" caption="按商品、分类和时间查看销量">
            <View className="grid grid-cols-3 gap-2">
              <MiniMetric label="今日销售额" value={yuan(metricNumber(salesStats, ['todayRevenueCents'], metricNumber(overview, ['todayRevenueCents'], 0)))} />
              <MiniMetric label="本周销售额" value={yuan(metricNumber(salesStats, ['weekRevenueCents', 'weeklyRevenueCents'], 0))} />
              <MiniMetric label="本月销售额" value={yuan(metricNumber(salesStats, ['monthRevenueCents', 'monthlyRevenueCents'], 0))} />
            </View>
            <RecordList emptyText="暂无销量统计">
              {toList<RecordItem>(valueOf(salesStats, ['salesByCategory', 'categoryStats'])).map((item) => (
                <RecordRow
                  key={textOf(item, ['categoryCode', 'categoryName', 'name'])}
                  title={textOf(item, ['categoryName', 'name', 'categoryCode'], '未分类')}
                  subtitle={`销量 ${numberOf(item, ['quantity', 'soldCount', 'salesCount'])} · 销售额 ${moneyOf(item, ['revenueCents', 'payableCents'])}`}
                  badge="分类"
                />
              ))}
            </RecordList>
          </Section>

          <Section icon={ChartNoAxesCombined} title="收益统计" caption="查看每日、每周、每月收益">
            <View className="grid grid-cols-2 gap-2">
              <MiniMetric label="供货金额" value={yuan(metricNumber(salesStats, ['supplyAmountCents'], 0))} />
              <MiniMetric label="实际结算" value={yuan(metricNumber(salesStats, ['settlementAmountCents'], 0))} />
            </View>
          </Section>

          <Section icon={Trophy} title="热销商品" caption="运营优先关注自己的热销商品排行">
            <RecordList emptyText="暂无热销商品">
              {hotProducts.map((item, index) => (
                <RecordRow
                  key={textOf(item, ['id', 'productId', 'name'], `${index}`)}
                  title={`${index + 1}. ${textOf(item, ['productName', 'name'], '未命名商品')}`}
                  subtitle={`销量 ${numberOf(item, ['quantity', 'soldCount', 'salesCount'])} · 销售额 ${moneyOf(item, ['revenueCents', 'payableCents'])}`}
                  badge="TOP"
                  tone={index < 3 ? 'warn' : 'normal'}
                />
              ))}
            </RecordList>
          </Section>
        </View>
      )}
    </AppPageShell>
  )
}

const HeaderIcon = ({ icon: Icon }: { icon: IconType }) => (
  <View
    className="h-11 w-11 rounded-2xl flex items-center justify-center"
    style={{ background: theme.primarySoft, border: `1px solid ${theme.border}` }}
  >
    <Icon size={22} color={theme.primary} strokeWidth={2.4} />
  </View>
)

const PanelTab = ({ active, icon: Icon, label, onClick }: { active: boolean; icon: IconType; label: string; onClick: () => void }) => (
  <View
    className="rounded-2xl px-2 py-3 flex items-center justify-center"
    style={{
      minHeight: '66px',
      background: active ? theme.primary : theme.surface,
      border: `1px solid ${active ? theme.primary : theme.border}`,
      boxShadow: active ? '0 8px 18px rgba(47, 125, 50, 0.18)' : 'none',
    }}
    onClick={onClick}
  >
    <Icon size={18} color={active ? '#FFFFFF' : theme.primary} strokeWidth={2.4} />
    <Text className="mt-1 block text-xs font-black" style={{ color: active ? '#FFFFFF' : theme.ink }}>
      {label}
    </Text>
  </View>
)

const Metric = ({ label, value, caption, tone = 'normal' }: { label: string; value: string; caption: string; tone?: 'normal' | 'warn' | 'danger' }) => {
  const color = tone === 'danger' ? theme.danger : tone === 'warn' ? theme.accent : theme.primary
  const background = tone === 'danger' ? theme.dangerSoft : tone === 'warn' ? theme.accentSoft : theme.primarySoft

  return (
    <View className="rounded-2xl p-3" style={{ background, border: `1px solid ${theme.border}` }}>
      <Text className="block text-xs font-bold" style={{ color: theme.muted }}>
        {label}
      </Text>
      <Text className="mt-1 block text-2xl font-black" style={{ color }}>
        {value}
      </Text>
      <Text className="mt-1 block text-xs font-semibold" style={{ color: theme.muted }}>
        {caption}
      </Text>
    </View>
  )
}

const MiniMetric = ({ label, value }: { label: string; value: string }) => (
  <View className="rounded-xl p-3" style={{ background: theme.primarySoft, border: `1px solid ${theme.border}` }}>
    <Text className="block text-xs font-bold" style={{ color: theme.muted }}>
      {label}
    </Text>
    <Text className="mt-1 block text-base font-black" style={{ color: theme.primaryDark }}>
      {value}
    </Text>
  </View>
)

const Section = ({ icon: Icon, title, caption, children }: { icon: IconType; title: string; caption: string; children: ReactNode }) => (
  <View className="rounded-2xl p-4" style={{ background: theme.surface, border: `1px solid ${theme.border}`, boxShadow: '0 8px 22px rgba(29, 47, 33, 0.06)' }}>
    <View className="mb-3 flex flex-row items-start gap-2">
      <View className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: theme.primarySoft }}>
        <Icon size={18} color={theme.primary} strokeWidth={2.4} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="block text-base font-black" style={{ color: theme.ink }}>
          {title}
        </Text>
        <Text className="mt-1 block text-xs font-semibold leading-5" style={{ color: theme.muted }}>
          {caption}
        </Text>
      </View>
    </View>
    <View className="space-y-3">{children}</View>
  </View>
)

const Field = ({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  full,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'number' | 'digit'
  full?: boolean
}) => (
  <View className={full ? 'col-span-2' : ''}>
    <Text className="mb-1 block text-xs font-bold" style={{ color: theme.muted }}>
      {label}
    </Text>
    <Input
      className="h-11 rounded-xl px-3 text-sm font-semibold"
      style={{ background: theme.page, border: `1px solid ${theme.border}`, color: theme.ink }}
      placeholder={placeholder || label}
      placeholderClass="text-gray-400"
      type={type}
      value={value}
      onInput={(event) => onChange(String(event.detail.value || ''))}
    />
  </View>
)

const ActionButton = ({
  label,
  icon: Icon,
  onClick,
  variant = 'solid',
  tone = 'normal',
  size = 'md',
  disabled,
}: {
  label: string
  icon?: IconType
  onClick?: () => void
  variant?: 'solid' | 'outline' | 'danger'
  tone?: 'normal' | 'light'
  size?: 'sm' | 'md'
  disabled?: boolean
}) => {
  const isOutline = variant === 'outline'
  const isDanger = variant === 'danger'
  const background = disabled
    ? '#E5E8E0'
    : isDanger
      ? theme.danger
      : isOutline
        ? theme.surface
        : tone === 'light'
          ? theme.primarySoft
          : theme.primary
  const color = disabled
    ? theme.muted
    : isOutline
      ? theme.primary
      : tone === 'light'
        ? theme.primary
        : '#FFFFFF'

  return (
    <View
      className={`flex flex-row items-center justify-center gap-1 rounded-full ${size === 'sm' ? 'px-3 py-2' : 'px-4 py-3'}`}
      style={{
        background,
        border: `1px solid ${isOutline || tone === 'light' ? theme.border : background}`,
        opacity: disabled ? 0.72 : 1,
      }}
      onClick={() => {
        if (!disabled) onClick?.()
      }}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 16} color={color} strokeWidth={2.4} />}
      <Text className={`${size === 'sm' ? 'text-xs' : 'text-sm'} font-black`} style={{ color }}>
        {label}
      </Text>
    </View>
  )
}

const ChoicePill = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
  <View
    className="rounded-full px-3 py-2"
    style={{
      background: active ? theme.primary : theme.surface,
      border: `1px solid ${active ? theme.primary : theme.border}`,
    }}
    onClick={onClick}
  >
    <Text className="text-xs font-black" style={{ color: active ? '#FFFFFF' : theme.ink }}>
      {label}
    </Text>
  </View>
)

const RecordList = ({ emptyText, children }: { emptyText: string; children: ReactNode }) => {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)
  if (!hasChildren) return <EmptyState text={emptyText} />
  return <View className="space-y-2">{children}</View>
}

const EmptyState = ({ text }: { text: string }) => (
  <View className="rounded-xl p-4" style={{ background: theme.page, border: `1px dashed ${theme.border}` }}>
    <Text className="block text-center text-sm font-bold" style={{ color: theme.muted }}>
      {text}
    </Text>
  </View>
)

const RecordRow = ({
  title,
  subtitle,
  badge,
  tone = 'normal',
  children,
}: {
  title: string
  subtitle: string
  badge?: string
  tone?: 'normal' | 'warn' | 'danger'
  children?: ReactNode
}) => {
  const badgeColor = tone === 'danger' ? theme.danger : tone === 'warn' ? theme.accent : theme.primary
  const badgeBackground = tone === 'danger' ? theme.dangerSoft : tone === 'warn' ? theme.accentSoft : theme.primarySoft

  return (
    <View className="rounded-xl p-3" style={{ background: theme.page, border: `1px solid ${theme.border}` }}>
      <View className="flex flex-row items-start gap-2">
        <View className="min-w-0 flex-1">
          <Text className="block text-sm font-black leading-5" style={{ color: theme.ink }}>
            {title}
          </Text>
          <Text className="mt-1 block text-xs font-semibold leading-5" style={{ color: theme.muted }}>
            {subtitle}
          </Text>
        </View>
        {badge && (
          <View className="rounded-full px-2 py-1" style={{ background: badgeBackground }}>
            <Text className="text-xs font-black" style={{ color: badgeColor }}>
              {badge}
            </Text>
          </View>
        )}
      </View>
      {children && <View className="mt-3 flex flex-row flex-wrap gap-2">{children}</View>}
    </View>
  )
}

const OrderRow = ({
  order,
  compact,
  onDispatch,
  onAdvance,
  onRefund,
}: {
  order: MallOrder
  compact?: boolean
  onDispatch: (order: MallOrder) => void
  onAdvance: (order: MallOrder) => void
  onRefund: (order: MallOrder) => void
}) => (
  <RecordRow
    title={`${order.orderNo} · ${yuan(order.payableCents)}`}
    subtitle={`${order.pickupPointName || order.addressText || '未配置地址'} · ${orderStatusText(order.status)}${compact ? '' : ` · ${order.items?.length || 0} 件商品`}`}
    badge={orderStatusText(order.status)}
    tone={isAbnormalOrder(order) ? 'danger' : order.status === 'paid' ? 'warn' : 'normal'}
  >
    <ActionButton label="派车" size="sm" variant="outline" onClick={() => onDispatch(order)} />
    <ActionButton label="推进" size="sm" onClick={() => onAdvance(order)} />
    <ActionButton label="退款" size="sm" variant="danger" onClick={() => onRefund(order)} />
  </RecordRow>
)

function updateProductForm(
  setter: (next: (current: ProductForm) => ProductForm) => void,
  key: keyof ProductForm,
  value: string,
) {
  setter((current) => ({ ...current, [key]: value }))
}

function asRecord(value: unknown): RecordItem {
  if (!value || typeof value !== 'object') return {}
  return value as RecordItem
}

function toList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  const record = asRecord(value)
  if (Array.isArray(record.items)) return record.items as T[]
  if (Array.isArray(record.list)) return record.list as T[]
  if (Array.isArray(record.records)) return record.records as T[]
  if (Array.isArray(record.data)) return record.data as T[]
  return []
}

function valueOf(record: RecordItem | null, keys: string[]) {
  if (!record) return undefined
  for (const key of keys) {
    const value = record[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

function textOf(record: RecordItem | null, keys: string[], fallback = '') {
  const value = valueOf(record, keys)
  if (value === undefined || value === null) return fallback
  if (typeof value === 'object') return fallback
  return String(value)
}

function numberOf(record: RecordItem | null, keys: string[], fallback = 0) {
  const value = valueOf(record, keys)
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function metricNumber(record: RecordItem | null, keys: string[], fallback = 0) {
  return numberOf(record, keys, fallback)
}

function moneyOf(record: RecordItem | null, keys: string[]) {
  return yuan(numberOf(record, keys, 0))
}

function parseCents(value: string) {
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0
}

function parseInteger(value: string, fallback: number) {
  const number = Number.parseInt(value, 10)
  return Number.isFinite(number) ? number : fallback
}

function parseDecimal(value: string) {
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function dateKey(value?: string | null) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function specText(product: MallProduct) {
  if (product.specification || product.saleMethod) {
    return [product.specification, product.saleMethod].filter(Boolean).join(' · ')
  }
  const parts = [
    product.lengthCm ? `${product.lengthCm}cm` : '',
    product.widthCm ? `${product.widthCm}cm` : '',
    product.heightCm ? `${product.heightCm}cm` : '',
  ].filter(Boolean)
  const size = parts.length > 0 ? parts.join('x') : '未填尺寸'
  const weight = product.weightKg ? `${product.weightKg}kg` : '未填重量'
  return `${size} · ${weight}`
}

function listingRequestType(request: RecordItem) {
  const requestedStatus = textOf(request, ['requestedStatus', 'requested_status'])
  if (requestedStatus === 'on_sale') return '上架申请'
  if (requestedStatus === 'off_sale') return '下架申请'
  return textOf(request, ['requestType', 'request_type'], '上下架申请')
}

function listingRequestStatus(request: RecordItem) {
  return textOf(request, ['status', 'reviewStatus', 'review_status'], 'pending')
}

function isAbnormalOrder(order: MallOrder) {
  return Boolean(
    order.refundStatus ||
      order.afterSaleStatus ||
      order.status === 'cancelled' ||
      order.status === 'refund_pending' ||
      order.status === 'refunding',
  )
}

function nextOrderStatus(status: string) {
  const map: Record<string, string> = {
    pending_payment: 'paid',
    paid: 'dispatching',
    dispatching: 'delivering',
    delivering: 'completed',
  }
  return map[status] || 'completed'
}

function orderStatusText(status: string) {
  const map: Record<string, string> = {
    pending_payment: '待支付',
    paid: '待配送',
    dispatching: '已派车',
    delivering: '配送中',
    completed: '已完成',
    cancelled: '已取消',
    refund_pending: '待退款',
    refunding: '退款中',
  }
  return map[status] || status
}

function orderStatusDescription(status: string) {
  const map: Record<string, string> = {
    paid: '运营确认收款',
    dispatching: '无人车已派车',
    delivering: '无人车配送中',
    completed: '用户已收货',
  }
  return map[status] || '商城运营端更新状态'
}

function deliveryStatusText(status: string) {
  const map: Record<string, string> = {
    generated: '已生成',
    shipped: '已发货',
    delivered: '已送达',
  }
  return map[status] || status
}

function showError(error: unknown, fallback: string) {
  Taro.showToast({
    title: error instanceof Error ? error.message : fallback,
    icon: 'none',
  })
}
