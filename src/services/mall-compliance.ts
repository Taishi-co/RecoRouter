import { Network } from '@/network'

export const MALL_PRIVACY_POLICY_VERSION = '2026.07'
export const MALL_PRIVACY_STORAGE_KEY = 'mallPrivacyConsentVersion'

interface ApiEnvelope<T> {
  code?: number
  message?: string
  data?: T
}

export interface LegalDocumentSection {
  heading: string
  body?: string
  items?: string[]
}

export interface LegalDocument {
  id: string
  documentType: 'privacy_policy' | 'service_agreement' | 'transaction_rules' | string
  title: string
  version: string
  summary?: string
  content: LegalDocumentSection[]
  status: string
  effectiveAt?: string
  publishedAt?: string
}

export interface MerchantQualification {
  id: string
  qualificationType: string
  qualificationName: string
  certificateNumber: string
  certificateUrl: string
  issuer?: string
  issuedAt?: string
  expiresAt?: string
  status: string
}

export interface PublicMerchantQualification {
  id: string
  name: string
  legalName?: string
  qualificationStatus: string
  businessLicenseNumber?: string
  businessLicenseUrl?: string
  businessLicenseExpiresAt?: string
  qualifications: MerchantQualification[]
}

export interface LegalCenter {
  profile: {
    operatorName: string
    legalEntityName?: string
    unifiedSocialCreditCode?: string
    businessLicenseUrl?: string
    businessLicenseExpiresAt?: string
    platformQualificationType?: string
    platformQualificationNumber?: string
    platformQualificationUrl?: string
    platformQualificationExpiresAt?: string
    servicePhone?: string
    serviceEmail?: string
    complaintPhone?: string
    complaintEmail?: string
    complaintDescription?: string
    officeAddress?: string
  }
  documents: LegalDocument[]
  merchants: PublicMerchantQualification[]
}

export interface AccountDeletionStatus {
  id?: string
  status: 'not_requested' | 'pending' | 'waiting' | 'completed' | 'cancelled' | 'rejected'
  reason?: string
  blockers?: Array<{ type: string; id: string; label: string; message: string }>
  requestedAt?: string
  completedAt?: string
  cancelledAt?: string
}

export interface PrivacyConsentStatus {
  policyVersion?: string
  currentPolicyVersion?: string
  action: 'not_recorded' | 'granted' | 'withdrawn'
  consentItems?: string[]
  createdAt?: string
}

export interface MallInvoiceRequest {
  id: string
  invoiceNo: string
  orderId: string
  invoiceType: string
  titleType: string
  title: string
  taxNumber?: string
  email: string
  amountCents: number
  status: string
  invoiceUrl?: string
  invoiceCode?: string
  rejectionReason?: string
  issuedAt?: string
  createdAt: string
}

async function request<T>(
  url: string,
  method: 'GET' | 'POST' | 'DELETE',
  data?: unknown,
): Promise<T> {
  const response = await Network.request({
    url,
    method,
    data,
    header: method === 'GET' ? undefined : { 'content-type': 'application/json' },
  })
  const body = response.data as ApiEnvelope<T>
  if (response.statusCode < 200 || response.statusCode >= 300 || body.code !== 200) {
    throw new Error(body.message || '请求失败')
  }
  return body.data as T
}

export function getLegalCenter(): Promise<LegalCenter> {
  return request('/api/mall/legal-center', 'GET')
}

export function resolvePrivacyPolicyVersion(center?: LegalCenter | null) {
  return center?.documents.find((document) => document.documentType === 'privacy_policy')?.version
    || MALL_PRIVACY_POLICY_VERSION
}

export function getPrivacyConsent(): Promise<PrivacyConsentStatus> {
  return request('/api/mall/privacy/consent', 'GET')
}

export function recordPrivacyConsent(
  action: 'granted' | 'withdrawn',
  policyVersion = MALL_PRIVACY_POLICY_VERSION,
): Promise<PrivacyConsentStatus> {
  return request('/api/mall/privacy/consent', 'POST', {
    policyVersion,
    action,
    consentItems: action === 'granted'
      ? ['account', 'order_fulfillment', 'customer_service', 'security']
      : [],
  })
}

export function getAccountDeletion(): Promise<AccountDeletionStatus> {
  return request('/api/mall/account/deletion', 'GET')
}

export function requestAccountDeletion(reason?: string): Promise<AccountDeletionStatus> {
  return request('/api/mall/account/deletion', 'POST', { reason })
}

export function cancelAccountDeletion(): Promise<AccountDeletionStatus> {
  return request('/api/mall/account/deletion', 'DELETE')
}

export function listMallInvoices(): Promise<MallInvoiceRequest[]> {
  return request('/api/mall/invoices', 'GET')
}

export function createMallInvoice(data: {
  orderId: string
  invoiceType: 'electronic_normal' | 'electronic_special'
  titleType: 'individual' | 'enterprise'
  title: string
  taxNumber?: string
  email: string
}): Promise<MallInvoiceRequest> {
  return request('/api/mall/invoices', 'POST', data)
}

export function cancelMallInvoice(id: string): Promise<MallInvoiceRequest> {
  return request(`/api/mall/invoices/${id}/cancel`, 'POST')
}
