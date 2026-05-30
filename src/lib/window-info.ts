import Taro from '@tarojs/taro'
import { canUseDOM, isH5 } from './platform'

export type AppWindowInfo = {
  windowWidth: number
  windowHeight: number
  screenWidth: number
  screenHeight: number
  statusBarHeight?: number
  safeArea?: {
    top?: number
    bottom?: number
  }
}

export const getAppWindowInfo = (): AppWindowInfo => {
  if (isH5() && canUseDOM()) {
    return {
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      screenWidth: window.screen?.width || window.innerWidth,
      screenHeight: window.screen?.height || window.innerHeight,
    }
  }

  try {
    return Taro.getWindowInfo()
  } catch {
    return {
      windowWidth: 375,
      windowHeight: 667,
      screenWidth: 375,
      screenHeight: 667,
    }
  }
}
