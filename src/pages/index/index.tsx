import { useState, useEffect } from 'react'
import { Image, View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Network } from '@/network'
import Taro from '@tarojs/taro'
import { Truck, Package, Check, Clock, Shield, User } from 'lucide-react-taro'

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

const demoStatistics: Statistics = {
  orders: {
    total: 128,
    completed: 96,
    in_transit: 18,
  },
  vehicles: {
    total: 73,
    active: 58,
  },
  demands: {
    total: 42,
    pending: 12,
  },
  recentOrders: [],
}

const demoLatestInfo: LatestInfo = {
  latestDemands: [
    {
      id: 'demo-demand-1',
      cargoName: '冷链奶品配送',
      cargoType: 'perishable',
      pickupAddress: '武汉东西湖中心仓',
      deliveryAddress: '江汉区前进四路门店',
      merchantPhone: '138****2651',
      createdAt: '2026-05-26T08:20:00+10:00',
    },
    {
      id: 'demo-demand-2',
      cargoName: '商超日配补货',
      cargoType: 'normal',
      pickupAddress: '汉阳四新配送站',
      deliveryAddress: '武昌徐东商圈',
      merchantPhone: '156****7098',
      createdAt: '2026-05-26T09:10:00+10:00',
    },
  ],
  completedOrders: [
    {
      id: 'demo-order-1',
      cargoName: '社区团购晨配',
      ownerPhone: '鄂A·7K21',
      farePrice: 286,
      completedTime: '2026-05-26T07:50:00+10:00',
    },
    {
      id: 'demo-order-2',
      cargoName: '校园餐饮补给',
      ownerPhone: '鄂A·9M32',
      farePrice: 338,
      completedTime: '2026-05-26T08:35:00+10:00',
    },
  ],
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
  const [verificationCode, setVerificationCode] = useState('')
  const [captchaId, setCaptchaId] = useState('')
  const [captchaImage, setCaptchaImage] = useState('')
  const [captchaLoading, setCaptchaLoading] = useState(false)
  const [name, setName] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  useEffect(() => {
    setCurrentUser(getStoredAuthUser())
    loadStatistics()
    loadLatestInfo()
  }, [])

  useEffect(() => {
    if (showAuthDialog && mode === 'register' && step === 'form') {
      loadRegisterCaptcha(true)
    }
  }, [showAuthDialog, mode, step])

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

  const loadRegisterCaptcha = async (silent = false) => {
    setCaptchaLoading(true)

    try {
      const res = await Network.request({
        url: '/api/auth/captcha',
        method: 'GET'
      })

      if (res.data.code === 200 && res.data.data?.captchaId && res.data.data?.image) {
        setCaptchaId(res.data.data.captchaId)
        setCaptchaImage(res.data.data.image)
        setVerificationCode('')
      } else {
        setCaptchaId('')
        setCaptchaImage('')
        Taro.showToast({
          title: res.data.message || '图形验证码获取失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('获取图形验证码失败:', error)
      setCaptchaId('')
      setCaptchaImage('')
      if (!silent) {
        Taro.showToast({
          title: '图形验证码获取失败',
          icon: 'none'
        })
      }
    } finally {
      setCaptchaLoading(false)
    }
  }

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

      if (!verificationCode) {
        Taro.showToast({
          title: '请输入图形验证码',
          icon: 'none'
        })
        return
      }

      if (!captchaId) {
        Taro.showToast({
          title: '请刷新图形验证码',
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
          data: { phone, password, confirmPassword, verificationCode, captchaId, name, role }
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
          loadRegisterCaptcha(true)
        }
      }
    } catch (error) {
      console.error('请求失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
      if (mode === 'register') {
        loadRegisterCaptcha(true)
      }
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
    setVerificationCode('')
    setCaptchaId('')
    setCaptchaImage('')
    setShowAuthDialog(true)
  }

  const displayStatistics = statistics || demoStatistics
  const displayLatestInfo = latestInfo || demoLatestInfo

  return (
    <>
      <AppPageShell
        title="RecoRouter 首页"
        subtitle="智能运力撮合 · 共享运营平台"
        bottom={<BottomNav type="common" active="home" />}
        scroll={false}
        contentClassName="space-y-3"
        right={
          currentUser ? (
            <Button
              size="icon"
              className="h-10 w-10 rounded-2xl bg-primary shadow-none"
              onClick={() => switchTabByRole(currentUser.role)}
            >
              <User size={18} color="#FFFFFF" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="h-10 w-10 rounded-2xl bg-primary shadow-none"
              onClick={() => openAuthDialog('login')}
            >
              <User size={18} color="#FFFFFF" />
            </Button>
          )
        }
      >
        {/* 数据统计卡片 */}
        <View>
          <Card className="bg-white rounded-lg shadow-md mb-4">
            <CardContent className="p-4">
              <View className="flex justify-between items-center" style={{ display: 'flex', alignItems: 'center' }}>
                <View className="text-center flex-1" style={{ flex: '1 1 0', minWidth: 0 }}>
                  <Text className="block text-2xl font-bold text-blue-500">
                    {displayStatistics.orders.total}
                  </Text>
                  <Text className="block text-xs text-gray-500 mt-1">总订单数</Text>
                </View>
                <View className="text-center flex-1" style={{ flex: '1 1 0', minWidth: 0 }}>
                  <Text className="block text-2xl font-bold text-green-500">
                    {displayStatistics.vehicles.total}
                  </Text>
                  <Text className="block text-xs text-gray-500 mt-1">车辆数</Text>
                </View>
                <View className="text-center flex-1" style={{ flex: '1 1 0', minWidth: 0 }}>
                  <Text className="block text-2xl font-bold text-orange-500">
                    {displayStatistics.demands.total}
                  </Text>
                  <Text className="block text-xs text-gray-500 mt-1">需求数</Text>
                </View>
              </View>
            </CardContent>
          </Card>
        </View>

        {/* 最新信息 */}
        <View>
          <View className="grid grid-cols-1 gap-3">
            {/* 最新需求 */}
            <Card className="bg-white rounded-lg shadow-sm overflow-hidden">
              <CardContent className="p-3">
                <View className="flex items-center justify-between mb-2">
                  <View className="flex items-center">
                    <Package size={16} color="#ef4444" />
                    <Text className="block text-sm font-semibold text-red-500 ml-2">
                      最新需求
                    </Text>
                  </View>
                  <Text className="text-xs text-gray-400">
                    共 {displayLatestInfo.latestDemands.length} 条
                  </Text>
                </View>
                <View className="space-y-2">
                  {displayLatestInfo.latestDemands.slice(0, 5).map(item => (
                    <View key={item.id} className="py-2 border-b border-gray-50 last:border-0">
                      <View className="flex justify-between items-start mb-1">
                        <Text className="text-xs font-medium text-gray-800 flex-1">
                          {item.cargoName}
                        </Text>
                        <Text className="text-xs text-gray-400 ml-2">
                          {item.cargoType === 'perishable' ? '易腐' : '普通'}
                        </Text>
                      </View>
                      <View className="flex items-start mb-1">
                        <Text className="text-xs text-gray-500 w-12 flex-shrink-0">取货:</Text>
                        <Text className="text-xs text-gray-700 flex-1">
                          {item.pickupAddress}
                        </Text>
                      </View>
                      <View className="flex items-start mb-1">
                        <Text className="text-xs text-gray-500 w-12 flex-shrink-0">送货:</Text>
                        <Text className="text-xs text-gray-700 flex-1">
                          {item.deliveryAddress}
                        </Text>
                      </View>
                      <View className="flex items-center justify-between">
                        <Text className="text-xs text-gray-400">
                          {item.merchantPhone}
                        </Text>
                        <Text className="max-w-32 truncate text-right text-xs text-gray-400">
                          {new Date(item.createdAt).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {displayLatestInfo.latestDemands.length === 0 && (
                    <Text className="text-xs text-gray-400 text-center py-4">
                      暂无需求
                    </Text>
                  )}
                </View>
              </CardContent>
            </Card>

            {/* 完单信息 */}
            <Card className="bg-white rounded-lg shadow-sm overflow-hidden">
              <CardContent className="p-3">
                <View className="flex items-center justify-between mb-2">
                  <View className="flex items-center">
                    <Check size={16} color="#10b981" />
                    <Text className="block text-sm font-semibold text-green-500 ml-2">
                      完单信息
                    </Text>
                  </View>
                  <Text className="text-xs text-gray-400">
                    共 {displayLatestInfo.completedOrders.length} 条
                  </Text>
                </View>
                <View className="space-y-2">
                  {displayLatestInfo.completedOrders.map(item => (
                    <View key={item.id} className="py-2 border-b border-gray-50 last:border-0">
                      <View className="flex justify-between items-start mb-1">
                        <Text className="text-xs font-medium text-gray-800 flex-1">
                          {item.cargoName}
                        </Text>
                        <Text className="text-xs font-bold text-green-500 ml-2">
                          ¥{item.farePrice}
                        </Text>
                      </View>
                      <Text className="text-xs text-gray-500 block">
                        运力方: {item.ownerPhone}
                      </Text>
                    </View>
                  ))}
                  {displayLatestInfo.completedOrders.length === 0 && (
                    <Text className="text-xs text-gray-400 text-center py-4">
                      暂无完单信息
                    </Text>
                  )}
                </View>
              </CardContent>
            </Card>
          </View>
        </View>

        {/* 平台特色 */}
        <View>
          <Text className="block text-lg font-semibold text-gray-800 mb-3">
            平台特色
          </Text>
          <View className="grid grid-cols-2 gap-3">
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <View className="flex items-center mb-2">
                <Clock size={20} color="#3b82f6" />
                <Text className="block text-sm font-semibold text-gray-700 ml-2">
                  快速匹配
                </Text>
              </View>
              <Text className="block text-xs text-gray-500">
                智能算法快速匹配车辆
              </Text>
            </Card>
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <View className="flex items-center mb-2">
                <Shield size={20} color="#10b981" />
                <Text className="block text-sm font-semibold text-gray-700 ml-2">
                  安全保障
                </Text>
              </View>
              <Text className="block text-xs text-gray-500">
                全程追踪，安全可靠
              </Text>
            </Card>
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <View className="flex items-center mb-2">
                <Truck size={20} color="#f59e0b" />
                <Text className="block text-sm font-semibold text-gray-700 ml-2">
                  运力充足
                </Text>
              </View>
              <Text className="block text-xs text-gray-500">
                多种车型，满足需求
              </Text>
            </Card>
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <View className="flex items-center mb-2">
                <Package size={20} color="#8b5cf6" />
                <Text className="block text-sm font-semibold text-gray-700 ml-2">
                便捷下单
                </Text>
              </View>
              <Text className="block text-xs text-gray-500">
                简单几步，轻松完成
              </Text>
            </Card>
          </View>
        </View>
      </AppPageShell>

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
              className={mode === 'login' ? 'bg-blue-500' : ''}
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
              className={mode === 'register' ? 'bg-blue-500' : ''}
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
                    className="w-full bg-gray-50"
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
                  className="w-full bg-gray-50"
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
                  <View className="flex gap-2">
                    <Input
                      className="flex-1 bg-gray-50"
                      placeholder="请输入图形验证码"
                      value={verificationCode}
                      onInput={(e) => setVerificationCode(e.detail.value.toUpperCase())}
                      maxlength={6}
                    />
                    <Button
                      size="sm"
                      className="h-10 min-w-28 rounded-lg border-blue-100 bg-blue-50 px-2 shadow-none"
                      variant="outline"
                      disabled={captchaLoading}
                      onClick={() => loadRegisterCaptcha()}
                    >
                      {captchaImage ? (
                        <Image
                          className="h-8 w-24"
                          src={captchaImage}
                          mode="aspectFit"
                        />
                      ) : (
                        <Text className="text-xs font-semibold text-blue-600">
                          {captchaLoading ? '加载中' : '刷新验证码'}
                        </Text>
                      )}
                    </Button>
                  </View>
                </View>
              )}

              <View className="mb-4">
                <Label className="block text-sm font-medium mb-2">
                  <Text className="text-red-500">*</Text>密码
                </Label>
                <Input
                  className="w-full bg-gray-50"
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
                    className="w-full bg-gray-50"
                    placeholder="请再次输入密码"
                    password
                    value={confirmPassword}
                    onInput={(e) => setConfirmPassword(e.detail.value)}
                  />
                </View>
              )}

              <Button
                className="w-full bg-blue-500"
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
    </>
  )
}
