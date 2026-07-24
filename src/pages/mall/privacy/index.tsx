import { useEffect, useMemo, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { ChevronLeft, ChevronRight, FileCheck, Headphones, ShieldCheck, Trash2 } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  const policyUpdated = params.reason === 'policy_updated'
  const returnUrl = useMemo(() => {
    const raw = typeof params.returnUrl === 'string' ? decodeURIComponent(params.returnUrl) : ''
    return raw.startsWith('/pages/mall/') ? raw : '/pages/mall/profile/index'
  }, [params.returnUrl])
  const [legalCenter, setLegalCenter] = useState<LegalCenter | null>(null)
  const [deletion, setDeletion] = useState<AccountDeletionStatus | null>(null)
  const [privacyConsent, setPrivacyConsent] = useState<PrivacyConsentStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [promptOpen, setPromptOpen] = useState(firstLaunch)
  const token = String(Taro.getStorageSync('token') || '')

  useDidShow(() => {
    if (firstLaunch) setPromptOpen(true)
  })

  useDidHide(() => {
    setPromptOpen(false)
  })

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
  const consentDocuments = [
    legalCenter?.documents.find((document) => document.documentType === 'privacy_policy'),
    legalCenter?.documents.find((document) => document.documentType === 'service_agreement'),
    legalCenter?.documents.find((document) => document.documentType === 'transaction_rules'),
  ].filter((document): document is NonNullable<typeof document> => Boolean(document))
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

  const openDocument = (documentType: string) => {
    const query = [
      `documentType=${encodeURIComponent(documentType)}`,
      'returnToConsent=1',
      `returnUrl=${encodeURIComponent(returnUrl)}`,
    ]
    if (policyUpdated) query.push('reason=policy_updated')
    Taro.navigateTo({
      url: `/pages/mall/legal/index?${query.join('&')}`,
    })
  }

  if (firstLaunch) {
    return (
      <MallPage active="mine" noTab hideNotificationBanner>
        <View className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
          <View className="flex h-16 w-16 items-center justify-center rounded-3xl bg-green-50">
            <ShieldCheck size={34} color="#2F7E43" />
          </View>
          <Text className="block text-lg font-semibold text-slate-800">叁友甄选</Text>
          <Text className="block text-sm text-slate-500">放心选购，安心使用</Text>
        </View>

        <Dialog
          open={promptOpen}
          onOpenChange={(open) => {
            if (open) setPromptOpen(true)
          }}
        >
          <DialogContent
            className="max-w-md gap-5 border-green-100 bg-white p-5"
            closeClassName="hidden"
          >
            <DialogHeader className="space-y-3 text-left">
              <View className="flex items-center gap-3">
                <View className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-green-50">
                  <ShieldCheck size={24} color="#2F7E43" />
                </View>
                <View className="flex min-w-0 flex-col gap-1">
                  {policyUpdated ? (
                    <Text className="block text-xs font-semibold text-amber-700">条款已更新</Text>
                  ) : null}
                  <DialogTitle>
                    <Text className="block text-lg font-semibold text-slate-900">
                      {policyUpdated ? '请确认新版隐私条款' : '服务条款与隐私保护'}
                    </Text>
                  </DialogTitle>
                </View>
              </View>
              <DialogDescription>
                <Text className="block text-sm leading-relaxed text-slate-600">
                  为提供登录、下单、配送和售后服务，请阅读并同意以下条款。点击条款名称可查看完整内容。
                </Text>
              </DialogDescription>
            </DialogHeader>

            <View className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {consentDocuments.map((document) => (
                <Button
                  key={document.id}
                  variant="ghost"
                  className="h-auto w-full justify-between rounded-none border-b border-slate-200 px-4 py-3 text-left last:border-b-0"
                  onClick={() => openDocument(document.documentType)}
                >
                  <View className="flex min-w-0 items-center gap-3">
                    <FileCheck size={18} color="#2F7E43" />
                    <View className="flex min-w-0 flex-col gap-1">
                      <Text className="block text-sm font-semibold text-slate-800">《{document.title}》</Text>
                      <Text className="block text-xs font-normal text-slate-500">版本 {document.version}</Text>
                    </View>
                  </View>
                  <ChevronRight size={18} color="#849085" />
                </Button>
              ))}
              {!loading && !consentDocuments.length ? (
                <Text className="block px-4 py-5 text-center text-sm text-amber-700">
                  条款加载失败，请稍后重新打开
                </Text>
              ) : null}
            </View>

            <Text className="block text-center text-xs leading-relaxed text-slate-500">
              点击“同意并继续”即表示您已阅读并同意以上条款。隐私政策当前版本为 {currentPolicyVersion}。
            </Text>
            <View className="flex flex-col gap-2">
              <Button
                className="w-full bg-green-700 text-white"
                disabled={loading || !privacyPolicy || submitting}
                onClick={acceptPrivacy}
              >
                <Text>{submitting ? '保存中' : loading ? '条款加载中' : '同意并继续'}</Text>
              </Button>
              <Button variant="ghost" className="w-full text-slate-500" onClick={browseOnly}>
                <Text>暂不同意，仅浏览商品</Text>
              </Button>
            </View>
          </DialogContent>
        </Dialog>
      </MallPage>
    )
  }

  return (
    <MallPage active="mine" noTab>
      <View className="mall-back-row">
        <ChevronLeft size={24} color="#1F2D1F" onClick={() => Taro.navigateBack()} />
        <Text className="mall-section-action">返回</Text>
      </View>

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
    </MallPage>
  )
}
