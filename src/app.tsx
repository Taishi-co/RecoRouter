import { PropsWithChildren, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { LucideTaroProvider } from 'lucide-react-taro';
import '@/app.css';
import { Toaster } from '@/components/ui/toast';
import {
  getPrivacyConsent,
  MALL_PRIVACY_POLICY_VERSION,
  MALL_PRIVACY_STORAGE_KEY,
} from '@/services/mall-compliance';
import { Preset } from './presets';

const App = ({ children }: PropsWithChildren) => {
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const rawProfile = typeof APP_PROFILE === 'string' ? APP_PROFILE.trim() : 'all';
      if (rawProfile !== 'mall') return;
      let hasCurrentConsent =
        Taro.getStorageSync(MALL_PRIVACY_STORAGE_KEY) === MALL_PRIVACY_POLICY_VERSION;
      const token = String(Taro.getStorageSync('token') || '').trim();
      if (token) {
        try {
          const consent = await getPrivacyConsent();
          const currentPolicyVersion =
            consent.currentPolicyVersion || MALL_PRIVACY_POLICY_VERSION;
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
      if (cancelled || hasCurrentConsent) return;
      const currentRoute = Taro.getCurrentPages().at(-1)?.route || '';
      if (currentRoute === 'pages/mall/privacy/index') return;
      Taro.reLaunch({
        url: `/pages/mall/privacy/index?firstLaunch=1&returnUrl=${encodeURIComponent('/pages/mall/index/index')}`,
      });
    }, 80);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <LucideTaroProvider defaultColor="#000" defaultSize={24}>
      <Preset>{children}</Preset>
      <Toaster />
    </LucideTaroProvider>
  );
};

export default App;
