import Taro from '@tarojs/taro'

export type MallAuthMode = 'login' | 'register'

export function mallAuthUrl(returnUrl = '/pages/mall/profile/index', mode: MallAuthMode = 'login') {
  const safeReturnUrl = returnUrl.startsWith('/pages/mall/')
    ? returnUrl
    : '/pages/mall/profile/index'
  return `/pages/mall/auth/index?mode=${mode}&returnUrl=${encodeURIComponent(safeReturnUrl)}`
}

export function redirectToMallAuth(returnUrl?: string, mode?: MallAuthMode) {
  Taro.redirectTo({ url: mallAuthUrl(returnUrl, mode) })
}

export function navigateToMallAuth(returnUrl?: string, mode?: MallAuthMode) {
  Taro.navigateTo({ url: mallAuthUrl(returnUrl, mode) })
}
