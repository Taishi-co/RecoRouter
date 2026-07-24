import { useEffect, useMemo, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ChevronLeft, FileCheck, Headphones, ShieldCheck, Trash2 } from 'lucide-react-taro'
import {
  cancelAccountDeletion,
  getAccountDeletion,
  getLegalCenter,
  getPrivacyConsent,
  MALL_PRIVACY_POLICY_VERSION,
  MALL_PRIVACY_STORAGE_KEY,
  recordPrivacyConsent,
  requestAccountDeletion,
  type AccountDeletionStatus,
  type LegalCenter,
  type PrivacyConsentStatus,
} from '@/services/mall-compliance'
import { MallPage, MallPrimaryButton } from '../mall-ui'

export default function MallPrivacyPage() {
  const params = Taro.getCurrentInstance().router?.params || {}
  const firstLaunch = params.firstLaunch === '1'
  const returnUrl = useMemo(() => {
    const raw = typeof params.returnUrl === 'string' ? decodeURIComponent(params.returnUrl) : ''
    return raw.startsWith('/pages/mall/') ? raw : '/pages/mall/profile/index'
  }, [params.returnUrl])
  const [legalCenter, setLegalCenter] = useState<LegalCenter | null>(null)
  const [deletion, setDeletion] = useState<AccountDeletionStatus | null>(null)
  const [privacyConsent, setPrivacyConsent] = useState<PrivacyConsentStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const token = String(Taro.getStorageSync('token') || '')

  useEffect(() => {
    Promise.all([
      getLegalCenter(),
      token ? getAccountDeletion().catch(() => null) : Promise.resolve(null),
      token ? getPrivacyConsent().catch(() => null) : Promise.resolve(null),
    ])
      .then(([center, nextDeletion, nextPrivacyConsent]) => {
        setLegalCenter(center)
        setDeletion(nextDeletion)
        setPrivacyConsent(nextPrivacyConsent)
        if (nextDeletion?.status === 'completed') {
          Taro.removeStorageSync('token')
          Taro.removeStorageSync('userInfo')
          Taro.removeStorageSync(MALL_PRIVACY_STORAGE_KEY)
          Taro.showToast({ title: '账号已注销', icon: 'success' })
          setTimeout(() => Taro.reLaunch({ url: '/pages/mall/index/index' }), 500)
        }
      })
      .catch((error) => {
        Taro.showToast({
          title: error instanceof Error ? error.message : '隐私政策加载失败',
          icon: 'none',
        })
      })
      .finally(() => setLoading(false))
  }, [token])

  const privacyPolicy = legalCenter?.documents.find((document) => document.documentType === 'privacy_policy')
  const currentPolicyVersion = privacyPolicy?.version || MALL_PRIVACY_POLICY_VERSION
  const hasGrantedPrivacy = token
    ? privacyConsent?.action === 'granted' && privacyConsent.policyVersion === currentPolicyVersion
    : Taro.getStorageSync(MALL_PRIVACY_STORAGE_KEY) === currentPolicyVersion

  const acceptPrivacy = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const nextConsent = token
        ? await recordPrivacyConsent('granted', currentPolicyVersion)
        : { action: 'granted' as const, policyVersion: currentPolicyVersion }
      setPrivacyConsent(nextConsent)
      Taro.setStorageSync(MALL_PRIVACY_STORAGE_KEY, currentPolicyVersion)
      Taro.showToast({ title: '隐私选择已保存', icon: 'success' })
      setTimeout(() => Taro.reLaunch({ url: returnUrl }), 350)
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '保存失败',
        icon: 'none',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const browseOnly = () => {
    Taro.showToast({ title: '可浏览商品，登录与下单前需同意', icon: 'none' })
    setTimeout(() => Taro.reLaunch({ url: '/pages/mall/index/index' }), 500)
  }

  const withdrawPrivacy = async () => {
    const result = await Taro.showModal({
      title: '撤回隐私同意',
      content: '撤回后仍可浏览商品，但登录、下单、配送和售后功能将暂停，重新同意后可恢复。',
      confirmText: '确认撤回',
      confirmColor: '#B45309',
    })
    if (!result.confirm) return
    try {
      const nextConsent = token
        ? await recordPrivacyConsent('withdrawn', currentPolicyVersion)
        : { action: 'withdrawn' as const, policyVersion: currentPolicyVersion }
      setPrivacyConsent(nextConsent)
      Taro.removeStorageSync(MALL_PRIVACY_STORAGE_KEY)
      Taro.showToast({ title: '已撤回同意', icon: 'success' })
      setTimeout(() => Taro.reLaunch({ url: '/pages/mall/index/index' }), 500)
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : '撤回失败', icon: 'none' })
    }
  }

  const deleteAccount = async () => {
    const result = await Taro.showModal({
      title: '申请注销商城账号',
      content: '注销后登录凭证、地址、购物车等信息会被删除，依法需要保留的交易记录将匿名化。该操作不可恢复。',
      confirmText: '确认注销',
      confirmColor: '#B91C1C',
    })
    if (!result.confirm) return
    setSubmitting(true)
    try {
      const nextDeletion = await requestAccountDeletion('用户在隐私中心主动申请注销')
      setDeletion(nextDeletion)
      if (nextDeletion.status === 'completed') {
        Taro.removeStorageSync('token')
        Taro.removeStorageSync('userInfo')
        Taro.removeStorageSync(MALL_PRIVACY_STORAGE_KEY)
        Taro.showToast({ title: '账号已注销', icon: 'success' })
        setTimeout(() => Taro.reLaunch({ url: '/pages/mall/index/index' }), 500)
      } else {
        Taro.showToast({ title: '申请已受理，请先处理未完成事项', icon: 'none' })
      }
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : '注销申请失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const cancelDeletion = async () => {
    try {
      setDeletion(await cancelAccountDeletion())
      Taro.showToast({ title: '注销申请已撤销', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : '撤销失败', icon: 'none' })
    }
  }

  return (
    <MallPage active="mine" noTab>
      {!firstLaunch ? (
        <View className="mall-back-row">
          <ChevronLeft size={24} color="#1F2D1F" onClick={() => Taro.navigateBack()} />
          <Text className="mall-section-action">返回</Text>
        </View>
      ) : null}

      <View className="mall-compliance-hero">
        <View className="mall-compliance-icon"><ShieldCheck size={30} color="#2F7E43" /></View>
        <Text className="mall-page-title">隐私与个人信息保护</Text>
        <Text className="mall-page-subtitle">
          我们只在登录、下单、配送和售后所必需的范围内处理信息。您可以先浏览，再决定是否同意。
        </Text>
        <Text className="mall-compliance-version">当前版本 {privacyPolicy?.version || MALL_PRIVACY_POLICY_VERSION}</Text>
      </View>

      {loading ? <Text className="mall-empty-copy">正在加载隐私政策…</Text> : null}
      {privacyPolicy?.content.map((section) => (
        <View className="mall-card mall-compliance-section" key={section.heading}>
          <Text className="mall-list-title">{section.heading}</Text>
          {section.body ? <Text className="mall-compliance-body">{section.body}</Text> : null}
          {section.items?.map((item) => (
            <View className="mall-compliance-list-item" key={item}>
              <Text>•</Text><Text>{item}</Text>
            </View>
          ))}
        </View>
      ))}

      <View className="mall-card mall-compliance-section">
        <View className="mall-list-row" style={{ marginTop: 0 }}>
          <View className="mall-compliance-title-row">
            <FileCheck size={18} color="#2F7E43" />
            <Text className="mall-list-title">平台规则与经营资质</Text>
          </View>
          <Text className="mall-section-action" onClick={() => Taro.navigateTo({ url: '/pages/mall/legal/index' })}>查看全部</Text>
        </View>
        <Text className="mall-compliance-body">用户服务协议、交易规则、营业执照及商家食品经营资质均在此公示，并保留历史版本。</Text>
        {legalCenter?.profile.businessLicenseUrl ? (
          <Image className="mall-license-preview" src={legalCenter.profile.businessLicenseUrl} mode="aspectFit" />
        ) : (
          <Text className="mall-compliance-warning">平台主体证照仍待运营人员上传，正式提审前必须补齐。</Text>
        )}
      </View>

      <View className="mall-card mall-compliance-section">
        <View className="mall-compliance-title-row">
          <Headphones size={18} color="#2F7E43" />
          <Text className="mall-list-title">投诉与联系</Text>
        </View>
        <Text className="mall-compliance-body">
          {legalCenter?.profile.complaintDescription || '可在小程序客服中心提交投诉工单，平台将在十五个工作日内反馈。'}
        </Text>
        <Text className="mall-section-action" onClick={() => Taro.navigateTo({ url: '/pages/mall/support/index?topic=privacy_complaint' })}>前往客服中心</Text>
      </View>

      {firstLaunch ? (
        <View className="mall-compliance-actions">
          <MallPrimaryButton onClick={acceptPrivacy}>
            <Text>{submitting ? '保存中' : '同意并继续'}</Text>
          </MallPrimaryButton>
          <MallPrimaryButton subtle onClick={browseOnly}>
            <Text>暂不同意，仅浏览商品</Text>
          </MallPrimaryButton>
        </View>
      ) : (
        <View className="mall-card mall-compliance-section">
          <Text className="mall-list-title">隐私选择与账号管理</Text>
          <Text className="mall-compliance-body">撤回同意不影响撤回前处理的合法性；账号注销会先检查未完成订单和售后。</Text>
          <View className="mall-compliance-actions">
            {hasGrantedPrivacy ? (
              <MallPrimaryButton subtle onClick={withdrawPrivacy}><Text>撤回隐私同意</Text></MallPrimaryButton>
            ) : (
              <MallPrimaryButton onClick={acceptPrivacy}>
                <Text>{submitting ? '保存中' : '重新同意并恢复功能'}</Text>
              </MallPrimaryButton>
            )}
            {token ? (
              <MallPrimaryButton subtle onClick={deleteAccount}>
                <Trash2 size={16} color="#B91C1C" /><Text>申请注销账号</Text>
              </MallPrimaryButton>
            ) : null}
          </View>
          {deletion?.status === 'waiting' ? (
            <View className="mall-compliance-blockers">
              <Text className="mall-compliance-warning">注销申请等待处理：</Text>
              {deletion.blockers?.map((blocker) => <Text key={blocker.id}>{blocker.message}（{blocker.label}）</Text>)}
              <Text className="mall-section-action" onClick={cancelDeletion}>撤销注销申请</Text>
            </View>
          ) : null}
          {deletion?.status === 'completed' ? (
            <Text className="mall-compliance-warning">账号注销已完成，当前登录已退出。</Text>
          ) : null}
        </View>
      )}
    </MallPage>
  )
}
