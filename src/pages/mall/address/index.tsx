import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ChevronLeft, LocateFixed, MapPin, Plus } from 'lucide-react-taro'
import { Input } from '@/components/ui/input'
import {
  createMallAddress,
  listMallAddresses,
  type MallAddress,
} from '@/services/mall'
import { MALL_SELECTED_ADDRESS_STORAGE_KEY, MallLocationStrip, MallPage, MallPrimaryButton } from '../mall-ui'

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
  latitude?: number
  longitude?: number
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
  const [selectedAddressId, setSelectedAddressId] = useState(
    String(Taro.getStorageSync(MALL_SELECTED_ADDRESS_STORAGE_KEY) || ''),
  )
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const storedUser = (Taro.getStorageSync('userInfo') as StoredUser | undefined) || {}
  const userId = storedUser.id || ''
  const isSelecting = String(Taro.getCurrentInstance().router?.params?.select || '') === '1'

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
    if (!hasAddressLocation(form)) {
      Taro.showToast({ title: '请获取定位或在地图上选点', icon: 'none' })
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
        latitude: form.latitude,
        longitude: form.longitude,
        addressType: 'delivery',
        isDefault: addresses.length === 0,
      })
      Taro.setStorageSync(MALL_SELECTED_ADDRESS_STORAGE_KEY, address.id)
      setSelectedAddressId(address.id)
      setAddresses((current) => [address, ...current])
      setForm(initialForm)
      Taro.showToast({ title: '收货地址已保存', icon: 'success' })
      if (isSelecting) {
        setTimeout(() => Taro.navigateBack(), 450)
      }
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '新增失败',
        icon: 'none',
      })
    } finally {
      setSaving(false)
    }
  }

  const getUserLocation = async () => {
    if (!isMiniApp()) {
      Taro.showToast({ title: '请在小程序中使用定位', icon: 'none' })
      return
    }
    try {
      const location = await Taro.getLocation({ type: 'gcj02' })
      setForm((current) => ({
        ...current,
        latitude: location.latitude,
        longitude: location.longitude,
      }))
      Taro.showToast({ title: '定位已获取', icon: 'success' })
    } catch (error) {
      const errMsg = getTaroErrMsg(error)
      Taro.showToast({
        title: errMsg.includes('auth') || errMsg.includes('deny') ? '请允许获取位置' : '定位失败',
        icon: 'none',
      })
    }
  }

  const chooseMapLocation = async () => {
    if (!isMiniApp()) {
      Taro.showToast({ title: '请在小程序中打开地图选点', icon: 'none' })
      return
    }
    try {
      const location = await Taro.chooseLocation({
        latitude: form.latitude || 39.63,
        longitude: form.longitude || 118.18,
      })
      const addressText = location.address || location.name || form.addressText
      setForm((current) => ({
        ...current,
        addressLabel: current.addressLabel || location.name || '送货地址',
        addressText,
        latitude: location.latitude,
        longitude: location.longitude,
      }))
      Taro.showToast({ title: '位置已选择', icon: 'success' })
    } catch (error) {
      if (getTaroErrMsg(error).includes('cancel')) return
      Taro.showToast({ title: '选点失败', icon: 'none' })
    }
  }

  const selectAddress = (address: MallAddress) => {
    if (!hasAddressLocation(address)) {
      setForm({
        contactName: address.contactName || '',
        contactPhone: address.contactPhone || '',
        addressLabel: address.addressLabel || address.address_name || '',
        addressText: address.addressText || address.address || '',
      })
      Taro.showToast({ title: '请用地图补充定位后保存', icon: 'none' })
      return
    }
    Taro.setStorageSync(MALL_SELECTED_ADDRESS_STORAGE_KEY, address.id)
    setSelectedAddressId(address.id)
    Taro.showToast({ title: '已选择送货地址', icon: 'success' })
    setTimeout(() => Taro.navigateBack(), 300)
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
        <View className="mall-address-location-actions">
          <View className="mall-address-location-button" onClick={getUserLocation}>
            <LocateFixed size={16} color="#2F7E43" />
            <Text>获取定位</Text>
          </View>
          <View className="mall-address-location-button" onClick={chooseMapLocation}>
            <MapPin size={16} color="#2F7E43" />
            <Text>地图选点</Text>
          </View>
        </View>
        <Text className={hasAddressLocation(form) ? 'mall-address-location-ok' : 'mall-address-location-hint'}>
          {hasAddressLocation(form)
            ? `已记录定位 ${form.latitude?.toFixed(5)}, ${form.longitude?.toFixed(5)}`
            : '送货地址需要定位，用于判断配送范围和运费'}
        </Text>
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
            active={selectedAddressId ? address.id === selectedAddressId : address.isDefault || address.is_default}
            title={address.addressLabel || address.address_name || '送货地址'}
            subtitle={addressSubtitle(address)}
            onClick={() => selectAddress(address)}
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

function isMiniApp() {
  const env = Taro.getEnv()
  return env === Taro.ENV_TYPE.WEAPP || env === Taro.ENV_TYPE.TT
}

function hasAddressLocation(address: Pick<MallAddress, 'latitude' | 'longitude'> | AddressForm) {
  return Number.isFinite(Number(address.latitude)) && Number.isFinite(Number(address.longitude))
}

function addressSubtitle(address: MallAddress) {
  const text = address.addressText || address.address || '详细地址待补充'
  return hasAddressLocation(address) ? text : `${text} · 缺少定位`
}

function getTaroErrMsg(error: unknown) {
  return String((error as { errMsg?: string })?.errMsg || (error instanceof Error ? error.message : ''))
}
