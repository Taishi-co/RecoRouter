import Taro from '@tarojs/taro'

export type MallAuthMode = 'login' | 'register'

const defaultMallAuthReturnUrl = '/pages/mall/index/index'

export function mallAuthUrl(returnUrl = defaultMallAuthReturnUrl, mode: MallAuthMode = 'login') {
  const safeReturnUrl = returnUrl.startsWith('/pages/mall/')
    ? returnUrl
    : defaultMallAuthReturnUrl
  return `/pages/mall/auth/index?mode=${mode}&returnUrl=${encodeURIComponent(safeReturnUrl)}`
}

export function redirectToMallAuth(returnUrl?: string, mode?: MallAuthMode) {
  Taro.redirectTo({ url: mallAuthUrl(returnUrl, mode) })
}

export function navigateToMallAuth(returnUrl?: string, mode?: MallAuthMode) {
  Taro.navigateTo({ url: mallAuthUrl(returnUrl, mode) })
}
