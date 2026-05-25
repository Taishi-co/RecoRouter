import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Network } from '@/network'
import Taro from '@tarojs/taro'
import {
  Building2,
  ChevronRight,
  Clock,
  Package,
  Shield,
  Smartphone,
  Truck,
  UserPlus
} from 'lucide-react-taro'

interface Statistics {
  orders: {
    total: number
    completed: number
    in_transit: number
  }
  vehicles: {
    total: number
    active: number
  }
  demands: {
    total: number
    pending: number
  }
  recentOrders: Array<{
    id: string
    cargoName: string
    ownerName: string
    farePrice: number
    completeTime: string
  }>
}

interface LatestInfo {
  latestDemands: Array<{
    id: string
    cargoName: string
    cargoType: string
    pickupAddress: string
    deliveryAddress: string
    merchantPhone: string
    createdAt: string
  }>
  completedOrders: Array<{
    id: string
    cargoName: string
    ownerPhone: string
    farePrice: number
    completedTime: string
  }>
}

interface AuthUserInfo {
  id: string
  phone: string
  name: string
  role: string
  token?: string
}

const persistAuthSession = (userInfo: AuthUserInfo) => {
  const token = userInfo.token || Taro.getStorageSync('token') || userInfo.id
  const normalizedUserInfo = {
    ...userInfo,
    token
  }

  Taro.setStorageSync('userInfo', normalizedUserInfo)
  Taro.setStorageSync('token', token)

  return normalizedUserInfo
}

const getStoredAuthUser = (): AuthUserInfo | null => {
  const userInfo = Taro.getStorageSync('userInfo') as AuthUserInfo | undefined
  const token = Taro.getStorageSync('token') as string | undefined

  if (!userInfo || !userInfo.id || !userInfo.role) {
    return null
  }

  return persistAuthSession({
    ...userInfo,
    token: userInfo.token || token || userInfo.id
  })
}

export default function Index() {
  const [statistics, setStatistics] = useState<Statistics | null>(null)
  const [latestInfo, setLatestInfo] = useState<LatestInfo | null>(null)
  const [currentUser, setCurrentUser] = useState<AuthUserInfo | null>(null)

  // 登录/注册弹窗
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [role, setRole] = useState<'owner' | 'merchant' | 'enterprise'>('owner')
  const [step, setStep] = useState<'role' | 'form'>('role')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [captchaId, setCaptchaId] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaImage, setCaptchaImage] = useState('')
  const [name, setName] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [captchaLoading, setCaptchaLoading] = useState(false)

  useEffect(() => {
    setCurrentUser(getStoredAuthUser())
    loadStatistics()
    loadLatestInfo()
  }, [])

  const loadStatistics = async () => {
    try {
      const res = await Network.request({
        url: '/api/home/statistics',
        method: 'GET'
      })

      console.log('统计数据响应:', res.data)

      if (res.data.code === 200) {
        setStatistics(res.data.data)
      }
    } catch (error) {
      console.error('加载统计数据失败:', error)
    }
  }

  const loadLatestInfo = async () => {
    try {
      const res = await Network.request({
        url: '/api/home/latest-info',
        method: 'GET'
      })

      console.log('最新信息响应:', res.data)

      if (res.data.code === 200) {
        setLatestInfo(res.data.data)
      }
    } catch (error) {
      console.error('加载最新信息失败:', error)
    }
  }

  const handleRoleSelect = (selectedRole: 'owner' | 'merchant' | 'enterprise') => {
    setRole(selectedRole)
    if (mode === 'register') {
      setStep('form')
    } else {
      setStep('form')
    }
  }

  const loadRegisterCaptcha = useCallback(async () => {
    setCaptchaLoading(true)

    try {
      const res = await Network.request({
        url: '/api/auth/captcha',
        method: 'GET'
      })

      if (res.data.code === 200 && res.data.data?.captchaId && res.data.data?.image) {
        setCaptchaId(res.data.data.captchaId)
        setCaptchaImage(res.data.data.image)
        setCaptchaCode('')
      } else {
        Taro.showToast({
          title: res.data.message || '验证码加载失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('加载图形验证码失败:', error)
      Taro.showToast({
        title: '验证码加载失败',
        icon: 'none'
      })
    } finally {
      setCaptchaLoading(false)
    }
  }, [])

  useEffect(() => {
    if (showAuthDialog && mode === 'register' && step === 'form') {
      void loadRegisterCaptcha()
    }
  }, [loadRegisterCaptcha, mode, showAuthDialog, step])

  const handleSubmit = async () => {
    if (!phone || !password) {
      Taro.showToast({
        title: '请填写完整信息',
        icon: 'none'
      })
      return
    }

    if (mode === 'register') {
      if (!name) {
        Taro.showToast({
          title: '请填写姓名',
          icon: 'none'
        })
        return
      }

      if (!captchaId || !captchaCode) {
        Taro.showToast({
          title: '请输入图形验证码',
          icon: 'none'
        })
        return
      }

      if (!confirmPassword) {
        Taro.showToast({
          title: '请再次确认密码',
          icon: 'none'
        })
        return
      }

      if (password !== confirmPassword) {
        Taro.showToast({
          title: '两次输入的密码不一致',
          icon: 'none'
        })
        return
      }
    }

    setAuthLoading(true)

    try {
      if (mode === 'login') {
        const res = await Network.request({
          url: '/api/auth/login',
          method: 'POST',
          data: { phone, password }
        })

        if (res.data.code === 200) {
          const authUser = persistAuthSession(res.data.data as AuthUserInfo)
          setCurrentUser(authUser)

          Taro.showToast({
            title: '登录成功',
            icon: 'success'
          })

          setTimeout(() => {
            switchTabByRole(authUser.role)
          }, 1500)
        } else {
          Taro.showToast({
            title: res.data.message || '登录失败',
            icon: 'none'
          })
        }
      } else {
        const res = await Network.request({
          url: '/api/auth/register',
          method: 'POST',
          data: { phone, password, confirmPassword, captchaId, captchaCode, name, role }
        })

        if (res.data.code === 200) {
          const authUser = persistAuthSession(res.data.data as AuthUserInfo)
          setCurrentUser(authUser)

          Taro.showToast({
            title: '注册成功，已自动登录',
            icon: 'success'
          })

          setTimeout(() => {
            switchTabByRole(authUser.role)
          }, 1500)
        } else {
          Taro.showToast({
            title: res.data.message || '注册失败',
            icon: 'none'
          })
          void loadRegisterCaptcha()
        }
      }
    } catch (error) {
      console.error('请求失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    } finally {
      setAuthLoading(false)
    }
  }

  const switchTabByRole = (userRole: string) => {
    setShowAuthDialog(false)
    if (userRole === 'owner') {
      Taro.redirectTo({ url: '/pages/owner/demands/index' })
    } else if (userRole === 'merchant') {
      Taro.redirectTo({ url: '/pages/merchant/demands/index' })
    } else if (userRole === 'admin') {
      Taro.redirectTo({ url: '/pages/admin/users/index' })
    } else if (userRole === 'enterprise_admin' || userRole === 'enterprise') {
      Taro.redirectTo({ url: '/pages/enterprise/index/index' })
    }
  }

  const openAuthDialog = (authMode: 'login' | 'register') => {
    setMode(authMode)
    setStep('role')
    setShowAuthDialog(true)
  }

  const handleRoleEntry = (selectedRole: 'owner' | 'merchant' | 'enterprise') => {
    setRole(selectedRole)
    if (currentUser) {
      switchTabByRole(currentUser.role)
      return
    }
    openAuthDialog('login')
  }

  const latestDemand = latestInfo?.latestDemands?.[0]
  const completedOrder = latestInfo?.completedOrders?.[0]

  return (
    <View className="min-h-screen bg-background">
      <ScrollView scrollY className="h-full">
        <View className="bg-gradient-to-br from-primary to-indigo-600 px-5 pt-12 pb-10">
          <View className="mb-8 flex items-center justify-between">
            <View className="flex items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white">
                <Package size={24} color="#0062ff" />
              </View>
              <Text className="text-xl font-bold text-white">RecoRouter</Text>
            </View>
            <View className="flex gap-2">
              {currentUser ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-white bg-white bg-opacity-20"
                  onClick={() => switchTabByRole(currentUser.role)}
                >
                  <Text className="text-xs text-white font-medium">进入</Text>
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-white bg-white bg-opacity-20"
                    onClick={() => openAuthDialog('login')}
                  >
                    <Text className="text-xs text-white font-medium">登录</Text>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-white bg-white bg-opacity-20"
                    onClick={() => openAuthDialog('register')}
                  >
                    <Text className="text-xs text-white font-medium">注册</Text>
                  </Button>
                </>
              )}
            </View>
          </View>

          <Text className="block text-3xl font-bold leading-tight text-white">
            无人车取送货调度平台
          </Text>
          <Text className="mt-3 block text-sm leading-5 text-white">
            发布需求、智能接单、企业调度和车辆租赁在一个小程序内闭环
          </Text>

          <View className="mt-6 grid grid-cols-3 gap-3">
            <View className="rounded-2xl bg-white px-3 py-4 text-center">
              <Text className="block text-2xl font-bold text-primary">
                {statistics?.orders.total || 0}
              </Text>
              <Text className="mt-1 block text-xs text-muted-foreground">今日订单</Text>
            </View>
            <View className="rounded-2xl bg-white px-3 py-4 text-center">
              <Text className="block text-2xl font-bold text-primary">
                {statistics?.vehicles.active || statistics?.vehicles.total || 0}
              </Text>
              <Text className="mt-1 block text-xs text-muted-foreground">在线车辆</Text>
            </View>
            <View className="rounded-2xl bg-white px-3 py-4 text-center">
              <Text className="block text-2xl font-bold text-primary">
                {statistics?.orders.total
                  ? `${Math.round((statistics.orders.completed / statistics.orders.total) * 100)}%`
                  : '0%'}
              </Text>
              <Text className="mt-1 block text-xs text-muted-foreground">准时率</Text>
            </View>
          </View>
        </View>

        <View className="px-5 pb-8 -mt-5">
          <Card className="mb-5 shadow-sm">
            <CardContent className="p-5">
              <View className="mb-4 flex items-center justify-between">
                <Text className="text-xl font-bold text-foreground">选择身份进入</Text>
                <View className="rounded-full bg-emerald-50 px-3 py-1">
                  <Text className="text-xs font-semibold text-emerald-600">三端共用账号</Text>
                </View>
              </View>

              <View className="space-y-3">
                <Button
                  variant="ghost"
                  className="h-auto w-full justify-between bg-muted px-4 py-3"
                  onClick={() => handleRoleEntry('owner')}
                >
                  <View className="flex items-center gap-3">
                    <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white">
                      <Truck size={24} color="#0062ff" />
                    </View>
                    <View>
                      <Text className="block text-base font-bold text-foreground">
                        运力方（车主）
                      </Text>
                      <Text className="mt-1 block text-xs text-muted-foreground">
                        注册车辆、接单、查看收益
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color="#8b95a7" />
                </Button>

                <Button
                  variant="ghost"
                  className="h-auto w-full justify-between bg-muted px-4 py-3"
                  onClick={() => handleRoleEntry('merchant')}
                >
                  <View className="flex items-center gap-3">
                    <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white">
                      <Package size={24} color="#10b981" />
                    </View>
                    <View>
                      <Text className="block text-base font-bold text-foreground">需求方</Text>
                      <Text className="mt-1 block text-xs text-muted-foreground">
                        发布需求、追踪订单、复用模板
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color="#8b95a7" />
                </Button>

                <Button
                  variant="ghost"
                  className="h-auto w-full justify-between bg-muted px-4 py-3"
                  onClick={() => handleRoleEntry('enterprise')}
                >
                  <View className="flex items-center gap-3">
                    <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white">
                      <Building2 size={24} color="#f59e0b" />
                    </View>
                    <View>
                      <Text className="block text-base font-bold text-foreground">企业端</Text>
                      <Text className="mt-1 block text-xs text-muted-foreground">
                        批量配送、车队与奶站调度
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color="#8b95a7" />
                </Button>
              </View>
            </CardContent>
          </Card>

          <View className="mb-5 grid grid-cols-2 gap-3">
            <Button className="h-14 rounded-2xl" onClick={() => openAuthDialog('login')}>
              <Smartphone size={20} color="#fff" />
              <Text className="text-base font-bold text-white">手机号登录</Text>
            </Button>
            <Button
              variant="outline"
              className="h-14 rounded-2xl"
              onClick={() => openAuthDialog('register')}
            >
              <UserPlus size={20} color="#0062ff" />
              <Text className="text-base font-bold text-foreground">创建账号</Text>
            </Button>
          </View>

          <View className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <View className="mb-3 inline-flex rounded-full bg-red-50 px-3 py-1">
                  <Text className="text-xs font-semibold text-red-500">最新需求</Text>
                </View>
                <Text className="block text-lg font-bold text-foreground">
                  {latestDemand?.cargoName || '暂无需求'}
                </Text>
                <Text className="mt-2 block text-xs leading-5 text-muted-foreground">
                  {latestDemand
                    ? `${latestDemand.pickupAddress} → ${latestDemand.deliveryAddress}`
                    : '后端暂无最新需求'}
                </Text>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <View className="mb-3 inline-flex rounded-full bg-emerald-50 px-3 py-1">
                  <Text className="text-xs font-semibold text-emerald-600">完单信息</Text>
                </View>
                <Text className="block text-lg font-bold text-foreground">
                  {completedOrder ? `¥${completedOrder.farePrice}` : '暂无完单'}
                </Text>
                <Text className="mt-2 block text-xs leading-5 text-muted-foreground">
                  {completedOrder
                    ? `${completedOrder.cargoName} 已送达`
                    : '后端暂无完单信息'}
                </Text>
              </CardContent>
            </Card>
          </View>

          <View className="mt-6">
            <Text className="mb-3 block text-lg font-bold text-foreground">平台特色</Text>
            <View className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-4">
                  <View className="mb-2 flex items-center">
                    <Clock size={20} color="#0062ff" />
                    <Text className="ml-2 text-sm font-semibold text-foreground">快速匹配</Text>
                  </View>
                  <Text className="block text-xs text-muted-foreground">
                    智能算法快速匹配车辆
                  </Text>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <View className="mb-2 flex items-center">
                    <Shield size={20} color="#10b981" />
                    <Text className="ml-2 text-sm font-semibold text-foreground">安全保障</Text>
                  </View>
                  <Text className="block text-xs text-muted-foreground">
                    全程追踪，安全可靠
                  </Text>
                </CardContent>
              </Card>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* 登录/注册弹窗 */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-center">
              {mode === 'login' ? '登录' : '注册'}
            </DialogTitle>
          </DialogHeader>

          <View className="flex justify-center gap-4 mb-4">
            <Button
              variant={mode === 'login' ? 'default' : 'outline'}
              onClick={() => {
                setMode('login')
                setStep('role')
              }}
              className={mode === 'login' ? 'bg-primary' : ''}
              size="sm"
            >
              <Text className="text-sm">登录</Text>
            </Button>
            <Button
              variant={mode === 'register' ? 'default' : 'outline'}
              onClick={() => {
                setMode('register')
                setStep('role')
              }}
              className={mode === 'register' ? 'bg-primary' : ''}
              size="sm"
            >
              <Text className="text-sm">注册</Text>
            </Button>
          </View>

          {step === 'role' && mode === 'register' ? (
            <View>
              <Text className="block text-sm font-semibold text-center mb-4">
                选择您的角色
              </Text>
              <View className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full h-16"
                  onClick={() => handleRoleSelect('owner')}
                >
                  <View className="text-center">
                    <Text className="block text-base font-semibold">运力方（车主）</Text>
                    <Text className="block text-xs text-gray-500 mt-1">注册车辆、接单、查看收益</Text>
                  </View>
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-16"
                  onClick={() => handleRoleSelect('merchant')}
                >
                  <View className="text-center">
                    <Text className="block text-base font-semibold">需求方</Text>
                    <Text className="block text-xs text-gray-500 mt-1">发布需求、下单、追踪订单</Text>
                  </View>
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-16"
                  onClick={() => handleRoleSelect('enterprise')}
                >
                  <View className="text-center">
                    <Text className="block text-base font-semibold">企业端</Text>
                    <Text className="block text-xs text-gray-500 mt-1">企业配送、车队管理、奶站调货</Text>
                  </View>
                </Button>
              </View>
            </View>
          ) : (
            <View>
              {mode === 'register' && (
                <View className="mb-4">
                  <Label className="block text-sm font-medium mb-2">
                    <Text className="text-red-500">*</Text>姓名
                  </Label>
                  <Input
                    className="w-full bg-muted"
                    placeholder="请输入您的姓名"
                    value={name}
                    onInput={(e) => setName(e.detail.value)}
                  />
                </View>
              )}

              <View className="mb-4">
                <Label className="block text-sm font-medium mb-2">
                  <Text className="text-red-500">*</Text>手机号
                </Label>
                <Input
                  className="w-full bg-muted"
                  placeholder="请输入手机号"
                  type="number"
                  value={phone}
                  onInput={(e) => setPhone(e.detail.value)}
                />
              </View>

              {mode === 'register' && (
                <View className="mb-4">
                  <Label className="block text-sm font-medium mb-2">
                    <Text className="text-red-500">*</Text>图形验证码
                  </Label>
                  <View className="flex gap-2 items-center">
                    <Input
                      className="flex-1 bg-muted"
                      placeholder="请输入图形验证码"
                      value={captchaCode}
                      onInput={(e) => setCaptchaCode(e.detail.value.toUpperCase())}
                      maxlength={6}
                    />
                    <Button
                      size="sm"
                      className="h-10 px-2"
                      variant="outline"
                      disabled={captchaLoading}
                      onClick={loadRegisterCaptcha}
                    >
                      {captchaImage ? (
                        <Image
                          src={captchaImage}
                          mode="aspectFit"
                          className="w-28 h-8"
                        />
                      ) : (
                        <Text className="text-xs">加载中</Text>
                      )}
                    </Button>
                  </View>
                  <Text
                    className="block text-xs text-primary mt-2"
                    onClick={loadRegisterCaptcha}
                  >
                    刷新验证码
                  </Text>
                </View>
              )}

              <View className="mb-4">
                <Label className="block text-sm font-medium mb-2">
                  <Text className="text-red-500">*</Text>密码
                </Label>
                <Input
                  className="w-full bg-muted"
                  placeholder="请输入密码"
                  password
                  value={password}
                  onInput={(e) => setPassword(e.detail.value)}
                />
              </View>

              {mode === 'register' && (
                <View className="mb-4">
                  <Label className="block text-sm font-medium mb-2">
                    <Text className="text-red-500">*</Text>再次确认密码
                  </Label>
                  <Input
                    className="w-full bg-muted"
                    placeholder="请再次输入密码"
                    password
                    value={confirmPassword}
                    onInput={(e) => setConfirmPassword(e.detail.value)}
                  />
                </View>
              )}

              <Button
                className="w-full bg-primary"
                onClick={handleSubmit}
                disabled={authLoading}
              >
                <Text className="text-sm">
                  {authLoading
                    ? mode === 'login'
                      ? '登录中...'
                      : '注册中...'
                    : mode === 'login'
                    ? '登录'
                    : '注册'}
                </Text>
              </Button>
            </View>
          )}
        </DialogContent>
      </Dialog>
    </View>
  )
}
