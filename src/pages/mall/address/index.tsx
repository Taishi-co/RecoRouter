import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ChevronLeft, Plus } from 'lucide-react-taro'
import { Input } from '@/components/ui/input'
import {
  createMallAddress,
  listMallAddresses,
  type MallAddress,
} from '@/services/mall'
import { MallLocationStrip, MallPage, MallPrimaryButton } from '../mall-ui'

interface StoredUser {
  id?: string
  name?: string
  phone?: string
}

interface AddressForm {
  contactName: string
  contactPhone: string
  addressLabel: string
  addressText: string
}

const initialForm: AddressForm = {
  contactName: '',
  contactPhone: '',
  addressLabel: '',
  addressText: '',
}

export default function MallAddressPage() {
  const [addresses, setAddresses] = useState<MallAddress[]>([])
  const [form, setForm] = useState<AddressForm>(initialForm)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const storedUser = (Taro.getStorageSync('userInfo') as StoredUser | undefined) || {}
  const userId = storedUser.id || ''

  useEffect(() => {
    loadAddresses()
  }, [])

  const loadAddresses = async () => {
    if (!userId) return
    setLoading(true)
    try {
      const data = await listMallAddresses(userId)
      setAddresses(data)
      if (!form.contactName && !form.contactPhone) {
        setForm((current) => ({
          ...current,
          contactName: storedUser.name || '',
          contactPhone: storedUser.phone || '',
        }))
      }
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '地址加载失败',
        icon: 'none',
      })
    } finally {
      setLoading(false)
    }
  }

  const saveAddress = async () => {
    if (!userId) return
    if (!form.contactName.trim()) {
      Taro.showToast({ title: '请填写收货人', icon: 'none' })
      return
    }
    if (!form.contactPhone.trim()) {
      Taro.showToast({ title: '请填写手机号', icon: 'none' })
      return
    }
    if (!form.addressText.trim()) {
      Taro.showToast({ title: '请填写送货地址', icon: 'none' })
      return
    }
    setSaving(true)
    try {
      const address = await createMallAddress({
        userId,
        contactName: form.contactName.trim(),
        contactPhone: form.contactPhone.trim(),
        addressLabel: form.addressLabel.trim() || '默认送货地址',
        addressText: form.addressText.trim(),
        addressType: 'delivery',
        isDefault: addresses.length === 0,
      })
      setAddresses((current) => [address, ...current])
      setForm(initialForm)
      Taro.showToast({ title: '收货地址已保存', icon: 'success' })
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '新增失败',
        icon: 'none',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <MallPage active="mine">
      <View className="mall-back-row">
        <ChevronLeft size={24} color="#1F2D1F" onClick={() => Taro.navigateBack()} />
        <Text className="mall-breadcrumb">我的 / 收货地址</Text>
      </View>
      <Text className="mall-page-title">收货地址</Text>
      <Text className="mall-page-subtitle">下单后将按这里的地址送货到家。</Text>

      <View className="mall-card">
        <Text className="mall-list-title">新增送货地址</Text>
        <View className="mall-address-form">
          <Input className="mall-form-input" value={form.contactName} placeholder="收货人" onInput={(event) => setForm((current) => ({ ...current, contactName: String(event.detail.value) }))} />
          <Input className="mall-form-input" value={form.contactPhone} placeholder="手机号" type="number" onInput={(event) => setForm((current) => ({ ...current, contactPhone: String(event.detail.value) }))} />
          <Input className="mall-form-input" value={form.addressLabel} placeholder="地址标签，例如家、公司" onInput={(event) => setForm((current) => ({ ...current, addressLabel: String(event.detail.value) }))} />
          <Input className="mall-form-input" value={form.addressText} placeholder="详细送货地址，楼栋门牌越完整越好" onInput={(event) => setForm((current) => ({ ...current, addressText: String(event.detail.value) }))} />
        </View>
        <View style={{ marginTop: 14 }}>
          <MallPrimaryButton onClick={saveAddress}>
            <Plus size={18} color="#FFFFFF" />
            <Text style={{ marginLeft: 6 }}>{saving ? '保存中' : '保存收货地址'}</Text>
          </MallPrimaryButton>
        </View>
      </View>

      {addresses.map((address) => (
        <View key={address.id} style={{ marginTop: 12 }}>
          <MallLocationStrip
            active={address.isDefault || address.is_default}
            title={address.addressLabel || address.address_name || '送货地址'}
            subtitle={address.addressText || address.address || '详细地址待补充'}
            onClick={() => Taro.navigateBack()}
          />
        </View>
      ))}

      {!addresses.length ? (
        <View className="mall-empty">
          <Text className="mall-empty-title">{loading ? '加载中...' : '暂无收货地址'}</Text>
          <Text className="mall-empty-copy">填写地址后，购物车和确认订单会自动使用。</Text>
        </View>
      ) : null}
    </MallPage>
  )
}
