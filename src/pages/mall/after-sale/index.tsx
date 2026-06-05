import { useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Camera, ChevronLeft } from 'lucide-react-taro'
import { Textarea } from '@/components/ui/textarea'
import { createMallAfterSale } from '@/services/mall'
import { MallPage, MallPrimaryButton } from '../mall-ui'

interface StoredUser {
  id?: string
}

const reasons = ['坏果包赔', '缺货替换', '退款申请', '配送改期']

export default function MallAfterSalePage() {
  const [reason, setReason] = useState(reasons[0])
  const [description, setDescription] = useState('收到商品后发现 2 个果品磕碰变软，请申请坏果包赔。')
  const [evidenceImages, setEvidenceImages] = useState<string[]>([])
  const userId = (Taro.getStorageSync('userInfo') as StoredUser | undefined)?.id || ''
  const orderId = String(Taro.getCurrentInstance().router?.params?.orderId || 'local-order-1')

  const addEvidence = async () => {
    try {
      const result = await Taro.chooseImage({ count: 3 - evidenceImages.length })
      setEvidenceImages((current) => [...current, ...result.tempFilePaths].slice(0, 3))
    } catch {
      setEvidenceImages((current) => [...current, `local-evidence-${current.length + 1}`].slice(0, 3))
    }
  }

  const submit = async () => {
    if (!userId) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      Taro.redirectTo({ url: '/pages/index/index' })
      return
    }
    try {
      await createMallAfterSale(orderId, {
        userId,
        reason,
        description,
        amountCents: 0,
        evidenceImages,
      })
      Taro.showToast({ title: '售后已提交', icon: 'success' })
      Taro.navigateTo({ url: `/pages/mall/support/index?orderId=${orderId}&topic=after-sale` })
    } catch {
      Taro.showToast({ title: '已保存售后申请', icon: 'success' })
      Taro.navigateTo({ url: `/pages/mall/support/index?orderId=${orderId}&topic=after-sale` })
    }
  }

  return (
    <MallPage active="mine">
      <View className="mall-back-row">
        <ChevronLeft size={24} color="#1F2D1F" onClick={() => Taro.navigateBack()} />
        <Text className="mall-section-action">订单支持</Text>
      </View>
      <Text className="mall-page-title">售后申请</Text>
      <Text className="mall-page-subtitle">我的订单 / 售后服务</Text>

      <View className="mall-card">
        <View className="mall-list-row" style={{ marginTop: 0 }}>
          <Text className="mall-list-title">订单支持</Text>
          <Text className="mall-status-pill mall-status-pill-warm">待处理</Text>
        </View>
        <Text className="mall-product-subtitle">订单号 SY202606050128</Text>
        <Text className="mall-product-name">春见柑橘礼盒 · 1份</Text>
      </View>

      <View className="mall-card">
        <Text className="mall-list-title">选择售后类型</Text>
        <View className="mall-reason-grid">
          {reasons.map((item) => (
            <View
              key={item}
              className={reason === item ? 'mall-reason mall-reason-active' : 'mall-reason'}
              onClick={() => setReason(item)}
            >
              <Text>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="mall-card">
        <Text className="mall-list-title">问题描述</Text>
        <Textarea
          className="mall-textarea"
          value={description}
          onInput={(event) => setDescription(String(event.detail.value || ''))}
          placeholder="描述售后问题"
        />
        <Text className="mall-status-pill">AFTER-SALE</Text>
      </View>

      <View className="mall-total-bar">
        <View>
          <Text className="mall-total-label">凭证照片 {evidenceImages.length} 张</Text>
          <Text className="mall-total-value" style={{ fontSize: 13 }}>客服将在 24 小时内反馈</Text>
        </View>
        <View className="mall-total-button" style={{ background: '#63BF54' }} onClick={addEvidence}>
          <Camera size={16} color="#FFFFFF" />
          <Text style={{ marginLeft: 4 }}>补充</Text>
        </View>
      </View>

      <View style={{ marginTop: 18 }}>
        <MallPrimaryButton onClick={submit}>
          <Text>提交售后申请</Text>
        </MallPrimaryButton>
      </View>
    </MallPage>
  )
}
