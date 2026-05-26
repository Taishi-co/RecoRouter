import Taro from '@tarojs/taro'
import { isH5 } from './platform'

const toNumber = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export const getMiniProgramSafeAreaInsets = () => {
  if (isH5()) {
    return { top: 0, bottom: 0 }
  }

  try {
    const info = Taro.getSystemInfoSync() as any
    const statusBarHeight = toNumber(info.statusBarHeight)
    const safeTop = toNumber(info.safeArea?.top)
    const screenHeight = toNumber(info.screenHeight || info.windowHeight)
    const safeBottom = toNumber(info.safeArea?.bottom)

    return {
      top: Math.max(statusBarHeight, safeTop),
      bottom: screenHeight > 0 && safeBottom > 0 ? Math.max(0, screenHeight - safeBottom) : 0,
    }
  } catch {
    return { top: 0, bottom: 0 }
  }
}

export const getPageHeaderPaddingTop = () => {
  if (isH5()) return 24

  const { top } = getMiniProgramSafeAreaInsets()
  return Math.max(24, top + 12)
}

export const getFixedBottomPadding = (fallback: number) => {
  if (isH5()) return fallback

  const { bottom } = getMiniProgramSafeAreaInsets()
  return Math.max(fallback, bottom)
}
