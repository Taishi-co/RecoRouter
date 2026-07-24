import { useEffect, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Building2, ChevronLeft, FileText, ShieldCheck } from 'lucide-react-taro'
import { Card, CardContent } from '@/components/ui/card'
import { getLegalCenter, type LegalCenter } from '@/services/mall-compliance'
import { MallPage } from '../mall-ui'

export default function MallLegalCenterPage() {
  const params = Taro.getCurrentInstance().router?.params || {}
  const requestedDocumentType = typeof params.documentType === 'string'
    ? decodeURIComponent(params.documentType)
    : ''
  const [center, setCenter] = useState<LegalCenter | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getLegalCenter()
      .then(setCenter)
      .catch((error) => Taro.showToast({
        title: error instanceof Error ? error.message : '公示信息加载失败',
        icon: 'none',
      }))
      .finally(() => setLoading(false))
  }, [])

  const preview = (url?: string) => {
    if (!url) return
    Taro.previewImage({ urls: [url], current: url })
  }

  const selectedDocument = requestedDocumentType
    ? center?.documents.find((document) => document.documentType === requestedDocumentType)
    : undefined

  if (requestedDocumentType) {
    return (
      <MallPage active="mine" noTab>
        <View className="mall-back-row">
          <ChevronLeft size={24} color="#1F2D1F" onClick={() => Taro.navigateBack()} />
          <Text className="mall-section-action">返回确认页</Text>
        </View>
        {loading ? <Text className="mall-empty-copy">正在加载条款全文…</Text> : null}
        {selectedDocument ? (
          <>
            <View className="mall-compliance-hero">
              <View className="mall-compliance-icon"><FileText size={28} color="#2F7E43" /></View>
              <Text className="mall-page-title">{selectedDocument.title}</Text>
              {selectedDocument.summary ? (
                <Text className="block text-sm leading-relaxed text-slate-600">{selectedDocument.summary}</Text>
              ) : null}
              <Text className="block text-xs leading-relaxed text-slate-500">
                版本 {selectedDocument.version} · 生效时间 {formatDate(selectedDocument.effectiveAt || selectedDocument.publishedAt)}
              </Text>
            </View>
            <Card className="border-green-100 bg-white">
              <CardContent className="flex flex-col gap-5 p-4">
                {selectedDocument.content.map((section) => (
                  <View className="flex flex-col gap-2 border-b border-slate-100 pb-5 last:border-b-0 last:pb-0" key={section.heading}>
                    <Text className="block text-base font-semibold text-slate-900">{section.heading}</Text>
                    {section.body ? (
                      <Text className="block text-sm leading-relaxed text-slate-600">{section.body}</Text>
                    ) : null}
                    {section.items?.map((item) => (
                      <Text className="block text-sm leading-relaxed text-slate-600" key={item}>• {item}</Text>
                    ))}
                  </View>
                ))}
              </CardContent>
            </Card>
          </>
        ) : !loading ? (
          <View className="mall-empty">
            <Text className="mall-empty-title">该条款暂未发布</Text>
            <Text className="mall-empty-copy">请返回确认页后稍后再试。</Text>
          </View>
        ) : null}
      </MallPage>
    )
  }

  return (
    <MallPage active="mine" noTab>
      <View className="mall-back-row">
        <ChevronLeft size={24} color="#1F2D1F" onClick={() => Taro.navigateBack()} />
        <Text className="mall-section-action">返回</Text>
      </View>
      <Text className="mall-page-title">平台规则与经营资质</Text>
      <Text className="mall-page-subtitle">交易规则按版本存档；平台和商家证照会持续核验并公示有效期。</Text>

      {loading ? <Text className="mall-empty-copy">正在加载公示信息…</Text> : null}
      {center ? (
        <View className="mall-card mall-compliance-section">
          <View className="mall-compliance-title-row">
            <Building2 size={19} color="#2F7E43" />
            <Text className="mall-list-title">平台经营主体</Text>
          </View>
          <InfoRow label="平台名称" value={center.profile.operatorName} />
          <InfoRow label="经营主体" value={center.profile.legalEntityName || '待运营补充'} warning={!center.profile.legalEntityName} />
          <InfoRow label="统一社会信用代码" value={center.profile.unifiedSocialCreditCode || '待运营补充'} warning={!center.profile.unifiedSocialCreditCode} />
          <InfoRow label="经营地址" value={center.profile.officeAddress || '待运营补充'} warning={!center.profile.officeAddress} />
          <InfoRow label="投诉渠道" value={center.profile.complaintPhone || center.profile.complaintEmail || center.profile.complaintDescription || '小程序客服中心'} />
          {center.profile.businessLicenseUrl ? (
            <View className="mall-license-card" onClick={() => preview(center.profile.businessLicenseUrl)}>
              <Image className="mall-license-preview" src={center.profile.businessLicenseUrl} mode="aspectFit" />
              <Text className="mall-section-action">查看平台营业执照</Text>
            </View>
          ) : (
            <Text className="mall-compliance-warning">平台营业执照尚未上传，正式提审前必须补齐真实证照。</Text>
          )}
        </View>
      ) : null}

      {center?.documents.map((document) => (
        <View className="mall-card mall-compliance-section" key={document.id}>
          <View className="mall-list-row" style={{ marginTop: 0 }}>
            <View className="mall-compliance-title-row">
              <FileText size={18} color="#2F7E43" />
              <Text className="mall-list-title">{document.title}</Text>
            </View>
            <Text className="mall-compliance-version">v{document.version}</Text>
          </View>
          {document.summary ? <Text className="mall-compliance-body">{document.summary}</Text> : null}
          {document.content.map((section) => (
            <View className="mall-rule-section" key={section.heading}>
              <Text className="mall-rule-heading">{section.heading}</Text>
              {section.body ? <Text className="mall-compliance-body">{section.body}</Text> : null}
              {section.items?.map((item) => <Text className="mall-compliance-body" key={item}>• {item}</Text>)}
            </View>
          ))}
          <Text className="mall-compliance-meta">生效时间：{formatDate(document.effectiveAt || document.publishedAt)}</Text>
        </View>
      ))}

      <View className="mall-compliance-title-row mall-compliance-subheading">
        <ShieldCheck size={19} color="#2F7E43" />
        <Text className="mall-list-title">入驻商家资质</Text>
      </View>
      {center?.merchants.length ? center.merchants.map((merchant) => (
        <View className="mall-card mall-compliance-section" key={merchant.id}>
          <Text className="mall-list-title">{merchant.name}</Text>
          <Text className="mall-compliance-body">经营主体：{merchant.legalName || '未公示'}</Text>
          <InfoRow label="营业执照编号" value={merchant.businessLicenseNumber || '未公示'} warning={!merchant.businessLicenseNumber} />
          <InfoRow label="营业执照有效期" value={formatDate(merchant.businessLicenseExpiresAt)} warning={!merchant.businessLicenseExpiresAt} />
          {merchant.qualifications.map((qualification) => (
            <View className="mall-qualification-row" key={qualification.id} onClick={() => preview(qualification.certificateUrl)}>
              <View>
                <Text className="mall-link-title">{qualification.qualificationName}</Text>
                <Text className="mall-link-subtitle">编号 {qualification.certificateNumber} · 有效期至 {formatDate(qualification.expiresAt)}</Text>
              </View>
              <Text className={qualification.status === 'approved' ? 'mall-status-ok' : 'mall-compliance-warning'}>
                {qualification.status === 'approved' ? '已核验' : '已过期'}
              </Text>
            </View>
          ))}
          {!merchant.qualifications.length ? <Text className="mall-compliance-warning">未公示食品经营许可证或预包装食品备案。</Text> : null}
        </View>
      )) : (
        <View className="mall-empty">
          <Text className="mall-empty-title">暂无已通过核验的合作商家</Text>
          <Text className="mall-empty-copy">自营商品由平台主体经营；合作商家完成资质核验后将在这里展示。</Text>
        </View>
      )}
    </MallPage>
  )
}

function InfoRow({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return (
    <View className="mall-compliance-info-row">
      <Text>{label}</Text>
      <Text className={warning ? 'mall-compliance-warning' : ''}>{value}</Text>
    </View>
  )
}

function formatDate(value?: string) {
  if (!value) return '未设置'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('zh-CN')
}
