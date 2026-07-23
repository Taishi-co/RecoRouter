import { PropsWithChildren, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { LucideTaroProvider } from 'lucide-react-taro';
import '@/app.css';
import { Toaster } from '@/components/ui/toast';
import { MALL_PRIVACY_POLICY_VERSION, MALL_PRIVACY_STORAGE_KEY } from '@/services/mall-compliance';
import { Preset } from './presets';

const App = ({ children }: PropsWithChildren) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      const rawProfile = typeof APP_PROFILE === 'string' ? APP_PROFILE.trim() : 'all';
      if (rawProfile !== 'mall') return;
      if (Taro.getStorageSync(MALL_PRIVACY_STORAGE_KEY) === MALL_PRIVACY_POLICY_VERSION) return;
      const currentRoute = Taro.getCurrentPages().at(-1)?.route || '';
      if (currentRoute === 'pages/mall/privacy/index') return;
      Taro.reLaunch({
        url: `/pages/mall/privacy/index?firstLaunch=1&returnUrl=${encodeURIComponent('/pages/mall/index/index')}`,
      });
    }, 80);
    return () => clearTimeout(timer);
  }, []);

  return (
    <LucideTaroProvider defaultColor="#000" defaultSize={24}>
      <Preset>{children}</Preset>
      <Toaster />
    </LucideTaroProvider>
  );
};

export default App;
