import Taro from '@tarojs/taro'
import { isH5 } from './platform'
import { getAppWindowInfo } from './window-info'

const toNumber = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const getMenuButtonBottom = () => {
  if (isH5()) return 0

  try {
    return toNumber(Taro.getMenuButtonBoundingClientRect().bottom)
  } catch {
    return 0
  }
}

export const getMiniProgramSafeAreaInsets = () => {
  if (isH5()) {
    return { top: 0, bottom: 0 }
  }

  try {
    const info = getAppWindowInfo()
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

export const getPageBodyPaddingTop = () => {
  if (isH5()) return 22

  const { top } = getMiniProgramSafeAreaInsets()
  const menuBottom = getMenuButtonBottom()
  return Math.max(22, top + 22, menuBottom + 20)
}

export const getHomePageBodyPaddingTop = () => {
  if (isH5()) return 22

  const { top } = getMiniProgramSafeAreaInsets()
  return Math.max(14, top + 6)
}

export const getStickyHeaderTop = () => {
  if (isH5()) return 0

  const { top } = getMiniProgramSafeAreaInsets()
  const menuBottom = getMenuButtonBottom()
  return Math.max(0, top + 12, menuBottom + 8)
}

export const getHomeStickyHeaderTop = () => {
  if (isH5()) return 0

  const { top } = getMiniProgramSafeAreaInsets()
  return Math.max(0, top + 2)
}

export const getPageHeaderPaddingTop = () => {
  if (isH5()) return 24

  const { top } = getMiniProgramSafeAreaInsets()
  return Math.max(24, top + 12)
}

export const getPageHeaderPaddingRight = () => {
  if (isH5()) return 16

  try {
    const info = getAppWindowInfo()
    const menuButton = Taro.getMenuButtonBoundingClientRect()
    const windowWidth = toNumber(info.windowWidth || info.screenWidth)
    const menuLeft = toNumber(menuButton.left)

    if (windowWidth > 0 && menuLeft > 0) {
      return Math.max(16, windowWidth - menuLeft + 12)
    }
  } catch {
    return 16
  }

  return 16
}

export const getFixedBottomPadding = (fallback: number) => {
  if (isH5()) return fallback

  const { bottom } = getMiniProgramSafeAreaInsets()
  return Math.max(fallback, bottom)
}
