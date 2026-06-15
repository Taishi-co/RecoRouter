import { useMemo, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { BadgePercent, Gift, Medal, ShoppingBag, Ticket } from 'lucide-react-taro'
import {
  claimMallCoupon,
  getMallPointsMall,
  type MallCoupon,
  type MallPointsMall,
  type MallProduct,
} from '@/services/mall'
import { MallPage, MallProductThumb, MallPrimaryButton, mallYuan } from '../mall-ui'
import { redirectToMallAuth } from '../auth-route'

interface StoredUser {
  id?: string
}

const emptyPointsMall: MallPointsMall = {
  couponRewards: [],
  productRewards: [],
}

export default function MallPointsPage() {
  const [data, setData] = useState<MallPointsMall>(emptyPointsMall)
  const [activeTab, setActiveTab] = useState<'coupon' | 'product'>('coupon')
  const [loading, setLoading] = useState(false)
  const [claimingId, setClaimingId] = useState('')
  const userId = (Taro.getStorageSync('userInfo') as StoredUser | undefined)?.id || ''

  useDidShow(() => {
    loadPointsMall()
  })

  const loadPointsMall = async () => {
    if (!userId) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      redirectToMallAuth('/pages/mall/points/index')
      return
    }
    setLoading(true)
    try {
      setData(await getMallPointsMall(userId))
    } catch (error) {
      setData(emptyPointsMall)
      Taro.showToast({
        title: error instanceof Error ? error.message : '积分商城加载失败',
        icon: 'none',
      })
    } finally {
      setLoading(false)
    }
  }

  const points = Number(data.member?.points || 0)
  const levelName = data.member?.level?.name || '普通会员'
  const maxDeductCents = Math.floor(points / Number(data.rules?.redeemRatePoints || 100)) * Number(data.rules?.redeemRateCents || 100)
  const benefits = useMemo(() => data.member?.level?.benefits || [], [data.member?.level?.benefits])

  const claimCoupon = async (coupon: MallCoupon) => {
    if (!coupon.id || claimingId) return
    setClaimingId(coupon.id)
    try {
      await claimMallCoupon(userId, coupon.id)
      Taro.showToast({ title: '领取成功', icon: 'success' })
      await loadPointsMall()
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '领取失败',
        icon: 'none',
      })
    } finally {
      setClaimingId('')
    }
  }

  return (
    <MallPage active="mine">
      <Text className="mall-breadcrumb">我的 / 积分商城</Text>
      <Text className="mall-page-title">积分商城</Text>

      <View className="mall-points-hero">
        <View>
          <Text className="mall-points-label">当前积分</Text>
          <Text className="mall-points-value">{points}</Text>
          <Text className="mall-points-copy">最高可抵 {mallYuan(maxDeductCents)}</Text>
        </View>
        <View className="mall-points-level">
          <Medal size={20} color="#2F7E43" />
          <Text>{levelName}</Text>
        </View>
      </View>

      <View className="mall-points-rules">
        <RuleItem icon={<Gift size={18} color="#2F7E43" />} title="消费积分" value="消费 1 元积 1 分" />
        <RuleItem icon={<BadgePercent size={18} color="#2F7E43" />} title="积分抵扣" value="100 积分抵 1 元" />
        <RuleItem icon={<Medal size={18} color="#2F7E43" />} title="会员权益" value={benefits.length ? benefits.join('、') : '按累计消费自动升级'} />
      </View>

      <View className="mall-wallet-tabs mall-points-tabs">
        <View
          className={activeTab === 'coupon' ? 'mall-wallet-tab mall-wallet-tab-active' : 'mall-wallet-tab'}
          onClick={() => setActiveTab('coupon')}
        >
          <Text>积分券</Text>
          <Text>{data.couponRewards.length}</Text>
        </View>
        <View
          className={activeTab === 'product' ? 'mall-wallet-tab mall-wallet-tab-active' : 'mall-wallet-tab'}
          onClick={() => setActiveTab('product')}
        >
          <Text>可抵商品</Text>
          <Text>{data.productRewards.length}</Text>
        </View>
      </View>

      {activeTab === 'coupon' ? (
        <View className="mall-points-list">
          {data.couponRewards.map((coupon) => (
            <View key={coupon.id} className="mall-points-coupon-card">
              <View className="mall-link-icon">
                <Ticket size={20} color="#2F7E43" />
              </View>
              <View className="mall-link-copy">
                <Text className="mall-link-title">{coupon.name}</Text>
                <Text className="mall-link-subtitle">
                  满 {mallYuan(coupon.thresholdCents)} 减 {mallYuan(coupon.discountCents)} · 参考 {Number(coupon.pointsCost || 0)} 积分
                </Text>
              </View>
              <View className="mall-coupon-action" onClick={() => claimCoupon(coupon)}>
                <Text>{claimingId === coupon.id ? '领取中' : '领取'}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View className="mall-points-list">
          {data.productRewards.map((product) => (
            <ProductRewardCard key={product.id} product={product} />
          ))}
        </View>
      )}

      {(activeTab === 'coupon' ? data.couponRewards.length : data.productRewards.length) === 0 ? (
        <View className="mall-empty">
          <Text className="mall-empty-title">{loading ? '加载中...' : '暂无可兑换内容'}</Text>
          <Text className="mall-empty-copy">新的积分券和积分抵扣商品上线后会展示在这里。</Text>
          <View style={{ marginTop: 14 }}>
            <MallPrimaryButton onClick={() => Taro.navigateTo({ url: '/pages/mall/index/index' })}>
              <Text>返回首页</Text>
            </MallPrimaryButton>
          </View>
        </View>
      ) : null}
    </MallPage>
  )
}

function RuleItem({ icon, title, value }: { icon: JSX.Element; title: string; value: string }) {
  return (
    <View className="mall-points-rule">
      {icon}
      <View>
        <Text>{title}</Text>
        <Text>{value}</Text>
      </View>
    </View>
  )
}

function ProductRewardCard({ product }: { product: MallProduct }) {
  return (
    <View className="mall-points-product-card" onClick={() => Taro.navigateTo({ url: `/pages/mall/product/index?id=${product.id}` })}>
      <View className="mall-points-product-image">
        <MallProductThumb product={product} />
      </View>
      <View className="mall-link-copy">
        <Text className="mall-link-title">{product.name}</Text>
        <Text className="mall-link-subtitle">{product.specification || product.subtitle || product.saleMethod || '叁友甄选商品'}</Text>
        <View className="mall-points-product-price">
          <Text>{mallYuan(product.discountedPriceCents ?? product.priceCents)}</Text>
          <Text>积分最高抵 {mallYuan(product.pointsDeductibleCents || 0)}</Text>
        </View>
      </View>
      <ShoppingBag size={20} color="#2F7E43" />
    </View>
  )
}
