import { useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Gift, Headphones, LogOut, MapPin, PackageCheck, Pencil, Phone, Settings } from 'lucide-react-taro'
import { Input } from '@/components/ui/input'
import {
  getMallProfile,
  listMallOrders,
  updateMallProfile,
  type MallOrder,
  type MallProfile,
} from '@/services/mall'
import { MallBrandMark, MallPage, MallPrimaryButton, mallYuan } from '../mall-ui'
import { navigateToMallAuth } from '../auth-route'

interface StoredUser {
  id?: string
  name?: string
  nickname?: string
  phone?: string
}

interface ProfileForm {
  nickname: string
  phone: string
}

export default function MallProfilePage() {
  const [profile, setProfile] = useState<MallProfile | null>(null)
  const [orders, setOrders] = useState<MallOrder[]>([])
  const [user, setUser] = useState<StoredUser>({})
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [editProfile, setEditProfile] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState<ProfileForm>({ nickname: '', phone: '' })

  useDidShow(() => {
    loadProfile()
  })

  const loadProfile = async () => {
    const storedUser = (Taro.getStorageSync('userInfo') as StoredUser | undefined) || {}
    setUser(storedUser)
    setLoadError('')

    if (!storedUser.id) {
      setProfile(null)
      setOrders([])
      return
    }

    setLoading(true)
    try {
      const [nextProfile, nextOrders] = await Promise.all([
        getMallProfile(storedUser.id),
        listMallOrders(storedUser.id),
      ])
      setProfile(nextProfile)
      setOrders(nextOrders)
    } catch (error) {
      setProfile(null)
      setOrders([])
      const message = error instanceof Error ? error.message : '会员信息加载失败'
      setLoadError(message)
      Taro.showToast({ title: message, icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    Taro.removeStorageSync('userInfo')
    Taro.removeStorageSync('token')
    setUser({})
    setProfile(null)
    setOrders([])
    Taro.showToast({ title: '已退出登录', icon: 'success' })
  }

  const openEditProfile = () => {
    const member = profile?.member
    setProfileForm({
      nickname: member?.nickname || member?.name || user.nickname || user.name || '',
      phone: member?.phone || user.phone || '',
    })
    setEditProfile(true)
  }

  const saveProfile = async () => {
    if (!user.id) return
    const nickname = profileForm.nickname.trim()
    const phone = profileForm.phone.trim()
    if (!nickname) {
      Taro.showToast({ title: '请填写昵称', icon: 'none' })
      return
    }
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
      Taro.showToast({ title: '手机号格式不正确', icon: 'none' })
      return
    }
    setSavingProfile(true)
    try {
      const member = await updateMallProfile({
        userId: user.id,
        nickname,
        phone: phone || undefined,
      })
      const nextUser = {
        ...user,
        name: member?.name || nickname,
        nickname: member?.nickname || nickname,
        phone: member?.phone || phone || user.phone,
      }
      Taro.setStorageSync('userInfo', nextUser)
      setUser(nextUser)
      setProfile((current) => current
        ? { ...current, member: { ...(current.member || {}), ...(member || {}) } }
        : current)
      setEditProfile(false)
      Taro.showToast({ title: '资料已保存', icon: 'success' })
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '保存失败',
        icon: 'none',
      })
    } finally {
      setSavingProfile(false)
    }
  }

  if (!user.id) {
    return <MallProfileLoginState />
  }

  const member = profile?.member
  const displayName = member?.nickname || member?.name || member?.username || user.nickname || user.name || maskPhone(member?.phone || user.phone) || '商城用户'
  const displayPhone = member?.phone || user.phone || ''
  const memberLevel = member?.level?.name || profile?.memberLevel || '普通会员'
  const points = Number(member?.points || 0)
  const totalSpendCents = Number(member?.totalSpendCents || 0)
  const orderCounts = orderCountView(profile, orders)
  const couponWallet = profile?.couponWallet || {}
  const availableCouponCount = Number(couponWallet.availableCount || 0)
  const expiringCouponCount = Number(couponWallet.expiringCount || 0)
  const deliveryAddressName = profile?.defaultAddress?.addressLabel
    || profile?.defaultAddress?.address_name
    || '未设置送货地址'
  const deliveryAddressDetail = profile?.defaultAddress?.addressText
    || profile?.defaultAddress?.address
    || '填写收货地址后用于送货到家'

  return (
    <MallPage active="mine">
      <View className="mall-v7-profile-hero">
        <View className="mall-profile-avatar">
          <Text>{displayName.slice(0, 1)}</Text>
        </View>
        <View className="mall-v7-profile-main">
          <Text className="mall-profile-name">{displayName}</Text>
          <Text className="mall-v7-profile-meta">{memberLevel} · 当前积分 {points}</Text>
          <View className="mall-v7-profile-stats">
            <Text>累计消费 {mallYuan(totalSpendCents)}</Text>
            <Text>{displayPhone ? maskPhone(displayPhone) : '未绑定手机号'}</Text>
          </View>
        </View>
        <View className="mall-profile-edit-button" onClick={openEditProfile}>
          <Pencil size={14} color="#1D2F21" />
          <Text>编辑资料</Text>
        </View>
      </View>

      <ProfileLink
        icon={<Phone size={20} color="#2F7E43" />}
        title="账号资料"
        subtitle={displayPhone ? `${maskPhone(displayPhone)} · 可修改昵称和换绑手机号` : '可修改昵称并绑定手机号'}
        action={displayPhone ? '换绑手机号' : '绑定手机号'}
        onClick={openEditProfile}
      />

      {loadError ? (
        <View className="mall-empty">
          <Text className="mall-empty-title">会员信息加载失败</Text>
          <Text className="mall-empty-copy">{loadError}</Text>
          <View style={{ marginTop: 14 }}>
            <MallPrimaryButton onClick={loadProfile}>
              <Text>重新加载</Text>
            </MallPrimaryButton>
          </View>
        </View>
      ) : null}

      <View className="mall-card">
        <View className="mall-list-row" style={{ marginTop: 0 }}>
          <Text className="mall-list-title">我的订单</Text>
          <Text className="mall-section-action" onClick={() => Taro.navigateTo({ url: '/pages/mall/orders/index' })}>全部</Text>
        </View>
        <View className="mall-v7-order-entry-grid">
          <ProfileEntry label="全部" value={loading ? 0 : orderCounts.total} onClick={() => Taro.navigateTo({ url: '/pages/mall/orders/index' })} />
          <ProfileEntry label="待支付" value={loading ? 0 : orderCounts.pendingPayment} onClick={() => Taro.navigateTo({ url: '/pages/mall/orders/index' })} />
          <ProfileEntry label="待收货" value={loading ? 0 : orderCounts.pendingReceipt} onClick={() => Taro.navigateTo({ url: '/pages/mall/orders/index' })} />
          <ProfileEntry label="售后" value={loading ? 0 : orderCounts.afterSales} onClick={() => Taro.navigateTo({ url: '/pages/mall/orders/index' })} />
        </View>
      </View>

      <ProfileLink
        icon={<PackageCheck size={20} color="#2F7E43" />}
        title="卡包优惠券"
        subtitle={`可用 ${availableCouponCount} 张${expiringCouponCount > 0 ? ` · ${expiringCouponCount} 张即将过期` : ''}`}
        action="查看"
        onClick={() => Taro.navigateTo({ url: '/pages/mall/coupons/index' })}
      />
      <ProfileLink
        icon={<MapPin size={20} color="#2F7E43" />}
        title="送货地址"
        subtitle={`${deliveryAddressName} · ${deliveryAddressDetail}`}
        action="管理"
        onClick={() => Taro.navigateTo({ url: '/pages/mall/address/index' })}
      />
      <ProfileLink
        icon={<Settings size={20} color="#2F7E43" />}
        title="发票申请"
        subtitle="按商城订单申请电子发票，状态同步到客服售后"
        action="申请"
        onClick={() => Taro.navigateTo({ url: '/pages/mall/support/index?topic=invoice' })}
      />
      <ProfileLink
        icon={<Gift size={20} color="#2F7E43" />}
        title="积分商城"
        subtitle={`当前 ${points} 积分，可兑换商品 / 优惠券`}
        action="兑换"
        onClick={() => Taro.navigateTo({ url: '/pages/mall/points/index' })}
      />
      <ProfileLink
        icon={<Headphones size={20} color="#2F7E43" />}
        title="客服售后"
        subtitle={`售后 ${Number(profile?.support?.afterSales || 0)} 单 · 会话 ${Number(profile?.support?.openSessions || 0)} 个`}
        action="联系"
        onClick={() => Taro.navigateTo({ url: '/pages/mall/support/index' })}
      />
      <ProfileLink
        icon={<LogOut size={20} color="#B45309" />}
        title="退出登录"
        subtitle={maskPhone(member?.phone || user.phone) || '退出当前商城账号'}
        action="退出"
        onClick={logout}
      />

      {editProfile ? (
        <View className="mall-modal-mask">
          <View className="mall-profile-editor">
            <Text className="mall-list-title">编辑账号资料</Text>
            <View className="mall-address-form">
              <Text className="mall-form-label">昵称</Text>
              <Input
                className="mall-form-input"
                value={profileForm.nickname}
                placeholder="填写昵称"
                onInput={(event) => setProfileForm((current) => ({ ...current, nickname: String(event.detail.value) }))}
              />
              <Text className="mall-form-label">{displayPhone ? '换绑手机号' : '绑定手机号'}</Text>
              <Input
                className="mall-form-input"
                value={profileForm.phone}
                placeholder="填写手机号"
                type="number"
                onInput={(event) => setProfileForm((current) => ({ ...current, phone: String(event.detail.value) }))}
              />
            </View>
            <View className="mall-profile-editor-actions">
              <View className="mall-profile-editor-cancel" onClick={() => setEditProfile(false)}>
                <Text>取消</Text>
              </View>
              <View className="mall-profile-editor-save" onClick={saveProfile}>
                <Text>{savingProfile ? '保存中' : '保存资料'}</Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </MallPage>
  )
}

function MallProfileLoginState() {
  return (
    <MallPage active="mine">
      <View className="mall-v7-head-brand">
        <MallBrandMark compact />
        <Text className="mall-breadcrumb">叁友甄选</Text>
      </View>
      <Text className="mall-page-title">我的</Text>
      <Text className="mall-page-subtitle">登录后查看订单、配送进度、售后、积分和优惠券。</Text>
      <View className="mall-auth-empty">
        <MallBrandMark />
        <Text className="mall-empty-title">登录商城账号</Text>
        <Text className="mall-empty-copy">登录或注册后，“我的”会从后端同步会员、订单、送货地址和客服状态。</Text>
        <View className="mall-auth-actions">
          <MallPrimaryButton onClick={() => navigateToMallAuth('/pages/mall/profile/index', 'login')}>
            <Text>登录</Text>
          </MallPrimaryButton>
          <MallPrimaryButton subtle onClick={() => navigateToMallAuth('/pages/mall/profile/index', 'register')}>
            <Text>注册</Text>
          </MallPrimaryButton>
        </View>
      </View>
    </MallPage>
  )
}

function ProfileEntry({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return (
    <View className="mall-v7-profile-entry" onClick={onClick}>
      <Text>{value}</Text>
      <Text>{label}</Text>
    </View>
  )
}

function ProfileLink({
  icon,
  title,
  subtitle,
  action,
  onClick,
}: {
  icon: JSX.Element
  title: string
  subtitle: string
  action: string
  onClick: () => void
}) {
  return (
    <View className="mall-link-card" onClick={onClick}>
      <View className="mall-link-icon">{icon}</View>
      <View className="mall-link-copy">
        <Text className="mall-link-title">{title}</Text>
        <Text className="mall-link-subtitle">{subtitle}</Text>
      </View>
      <Text className="mall-section-action">{action}</Text>
    </View>
  )
}

function orderCountView(profile: MallProfile | null, orders: MallOrder[]) {
  const backendCounts = profile?.orderCounts
  const pendingPayment = Number(backendCounts?.pendingPayment ?? orders.filter((order) => order.paymentStatus !== 'paid').length)
  const pendingReceipt = orders.filter((order) => order.paymentStatus === 'paid' && ['ready_for_pickup', 'pending_pickup', 'delivering'].some((status) => order.status.includes(status))).length
  const afterSales = Number(backendCounts?.afterSales ?? orders.filter((order) => order.afterSaleStatus || order.refundStatus).length)
  const total = Number(backendCounts?.total ?? orders.length)

  return {
    pendingPayment,
    pendingReceipt,
    afterSales,
    total,
  }
}

function maskPhone(phone?: string) {
  if (!phone) return ''
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}
