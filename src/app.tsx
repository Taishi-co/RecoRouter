import { PropsWithChildren } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { LucideTaroProvider } from 'lucide-react-taro';
import '@/app.css';
import { Toaster } from '@/components/ui/toast';
import {
  getLegalCenter,
  getPrivacyConsent,
  MALL_PRIVACY_POLICY_VERSION,
  MALL_PRIVACY_STORAGE_KEY,
  resolvePrivacyPolicyVersion,
} from '@/services/mall-compliance';
import { Preset } from './presets';

let mallPrivacyCheckRunning = false;

const scheduleMallPrivacyCheck = () => {
  if (mallPrivacyCheckRunning) return;
  mallPrivacyCheckRunning = true;
  setTimeout(() => {
    void verifyMallPrivacyConsent().finally(() => {
      mallPrivacyCheckRunning = false;
    });
  }, 80);
};

async function verifyMallPrivacyConsent() {
  const rawProfile = typeof APP_PROFILE === 'string' ? APP_PROFILE.trim() : 'all';
  if (rawProfile !== 'mall') return;
  const acceptedPolicyVersion = String(
    Taro.getStorageSync(MALL_PRIVACY_STORAGE_KEY) || '',
  );
  let currentPolicyVersion = MALL_PRIVACY_POLICY_VERSION;
  let hasCurrentConsent = acceptedPolicyVersion === currentPolicyVersion;
  const token = String(Taro.getStorageSync('token') || '').trim();
  try {
    const center = await getLegalCenter();
    currentPolicyVersion = resolvePrivacyPolicyVersion(center);
    hasCurrentConsent = acceptedPolicyVersion === currentPolicyVersion;
  } catch {
    // 离线时暂用内置版本；联网后会再次比对管理端当前发布版本。
  }
  if (token) {
    try {
      const consent = await getPrivacyConsent();
      currentPolicyVersion =
        consent.currentPolicyVersion || currentPolicyVersion;
      hasCurrentConsent =
        consent.action === 'granted'
        && consent.policyVersion === currentPolicyVersion;
      if (hasCurrentConsent) {
        Taro.setStorageSync(MALL_PRIVACY_STORAGE_KEY, currentPolicyVersion);
      } else {
        Taro.removeStorageSync(MALL_PRIVACY_STORAGE_KEY);
      }
    } catch {
      // 网络不可用时保留本地选择，避免把离线用户困在隐私页。
    }
  }
  if (hasCurrentConsent) return;
  const currentRoute = Taro.getCurrentPages().at(-1)?.route || '';
  if (currentRoute === 'pages/mall/privacy/index') return;
  const reason = acceptedPolicyVersion && acceptedPolicyVersion !== currentPolicyVersion
    ? '&reason=policy_updated'
    : '';
  Taro.reLaunch({
    url: `/pages/mall/privacy/index?firstLaunch=1&returnUrl=${encodeURIComponent('/pages/mall/index/index')}${reason}`,
  });
}

const App = ({ children }: PropsWithChildren) => {
  useDidShow(scheduleMallPrivacyCheck);

  return (
    <LucideTaroProvider defaultColor="#000" defaultSize={24}>
      <Preset>{children}</Preset>
      <Toaster />
    </LucideTaroProvider>
  );
};

export default App;
