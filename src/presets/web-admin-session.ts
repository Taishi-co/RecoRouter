import Taro from '@tarojs/taro'
import { IS_H5_ENV } from './env'

export interface WebAdminUserInfo {
  id: string
  phone: string
  name: string
  role: 'admin'
}

const WEB_ADMIN_USER: WebAdminUserInfo = {
  id: 'web-admin',
  phone: '18800000000',
  name: 'Web 管理员',
  role: 'admin',
}

export function ensureWebAdminSession() {
  if (!IS_H5_ENV) return null

  const storedUser = Taro.getStorageSync('userInfo') as Partial<WebAdminUserInfo> | undefined
  if (storedUser?.role === 'admin') {
    const adminUser = { ...WEB_ADMIN_USER, ...storedUser, role: 'admin' as const }
    Taro.setStorageSync('userInfo', adminUser)
    return adminUser
  }

  Taro.setStorageSync('userInfo', WEB_ADMIN_USER)
  return WEB_ADMIN_USER
}
