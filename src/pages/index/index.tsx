import { useCallback, useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import { Building2, Clock, Package, ShieldCheck, Store, Truck, UserRound } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Network } from '@/network'

interface Statistics {
  orders: {
    total: number
  }
  vehicles: {
    total: number
  }
  demands: {
    total: number
  }
}

interface AuthUserInfo {
  id: string
  phone: string
  name: string
  role: string
  token?: string
}

const roleOptions = [
  { value: 'owner', label: '运力方', detail: '车辆管理、接单运输', icon: Truck },
  { value: 'merchant', label: '需求方', detail: '发布需求、租车下单', icon: Store },
  { value: 'enterprise', label: '企业端', detail: '企业配送和车队调度', icon: Building2 },
] as const

type RegisterRole = (typeof roleOptions)[number]['value']

const fallbackStats: Statistics = {
  orders: { total: 128 },
  vehicles: { total: 36 },
  demands: { total: 24 },
}

const persistAuthSession = (userInfo: AuthUserInfo) => {
  const token = userInfo.token || Taro.getStorageSync('token') || userInfo.id
  const normalizedUserInfo = { ...userInfo, token }

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
    token: userInfo.token || token || userInfo.id,
  })
}

const switchTabByRole = (userRole: string) => {
  if (userRole === 'owner') {
    Taro.redirectTo({ url: '/pages/owner/demands/index' })
    return
  }
  if (userRole === 'merchant') {
    Taro.redirectTo({ url: '/pages/merchant/demands/index' })
    return
  }
  if (userRole === 'admin') {
    Taro.redirectTo({ url: '/pages/admin/users/index' })
    return
  }
  if (userRole === 'enterprise_admin' || userRole === 'enterprise') {
    Taro.redirectTo({ url: '/pages/enterprise/index/index' })
  }
}

export default function Index() {
  const [statistics, setStatistics] = useState<Statistics>(fallbackStats)
  const [currentUser, setCurrentUser] = useState<AuthUserInfo | null>(null)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [role, setRole] = useState<RegisterRole>('owner')
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
    if (TARO_ENV !== 'h5' || PROJECT_DOMAIN) {
      void loadStatistics()
    }
  }, [])

  const loadStatistics = async () => {
    try {
      const res = await Network.request({
        url: '/api/home/statistics',
        method: 'GET',
      })

      if (res.data?.code === 200) {
        setStatistics(res.data.data)
      }
    } catch (error) {
      console.error('加载统计数据失败:', error)
    }
  }

  const loadRegisterCaptcha = useCallback(async () => {
    setCaptchaLoading(true)

    try {
      const res = await Network.request({
        url: '/api/auth/captcha',
        method: 'GET',
      })

      if (res.data.code === 200 && res.data.data?.captchaId && res.data.data?.image) {
        setCaptchaId(res.data.data.captchaId)
        setCaptchaImage(res.data.data.image)
        setCaptchaCode('')
      } else {
        Taro.showToast({
          title: res.data.message || '验证码加载失败',
          icon: 'none',
        })
      }
    } catch (error) {
      console.error('加载图形验证码失败:', error)
      Taro.showToast({
        title: '验证码加载失败',
        icon: 'none',
      })
    } finally {
      setCaptchaLoading(false)
    }
  }, [])

  useEffect(() => {
    if (mode === 'register' && (TARO_ENV !== 'h5' || PROJECT_DOMAIN)) {
      void loadRegisterCaptcha()
    }
  }, [loadRegisterCaptcha, mode])

  const handleSubmit = async () => {
    if (!phone || !password) {
      Taro.showToast({
        title: '请填写完整信息',
        icon: 'none',
      })
      return
    }

    if (mode === 'register') {
      if (!name || !confirmPassword || !captchaId || !captchaCode) {
        Taro.showToast({
          title: '请补全注册信息',
          icon: 'none',
        })
        return
      }

      if (password !== confirmPassword) {
        Taro.showToast({
          title: '两次输入的密码不一致',
          icon: 'none',
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
          data: { phone, password },
        })

        if (res.data.code === 200) {
          const authUser = persistAuthSession(res.data.data as AuthUserInfo)
          setCurrentUser(authUser)
          Taro.showToast({ title: '登录成功', icon: 'success' })
          setTimeout(() => switchTabByRole(authUser.role), 800)
        } else {
          Taro.showToast({
            title: res.data.message || '登录失败',
            icon: 'none',
          })
        }
        return
      }

      const res = await Network.request({
        url: '/api/auth/register',
        method: 'POST',
        data: { phone, password, confirmPassword, captchaId, captchaCode, name, role },
      })

      if (res.data.code === 200) {
        const authUser = persistAuthSession(res.data.data as AuthUserInfo)
        setCurrentUser(authUser)
        Taro.showToast({ title: '注册成功，已自动登录', icon: 'success' })
        setTimeout(() => switchTabByRole(authUser.role), 800)
      } else {
        Taro.showToast({
          title: res.data.message || '注册失败',
          icon: 'none',
        })
        void loadRegisterCaptcha()
      }
    } catch (error) {
      console.error('认证请求失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none',
      })
    } finally {
      setAuthLoading(false)
    }
  }

  return (
    <View className="min-h-screen bg-slate-100">
      <ScrollView scrollY className="min-h-screen pb-8">
        <View className="flex flex-row items-center justify-between px-5 pt-3 pb-2">
          <Text className="block text-xs font-semibold text-slate-900">9:41</Text>
          <View className="flex flex-row items-center gap-1">
            <View className="size-2 rounded-full bg-slate-900" />
            <View className="size-2 rounded-full bg-slate-900" />
            <View className="h-2 w-4 rounded-full bg-slate-900" />
          </View>
        </View>

        <View className="mx-3 rounded-3xl bg-blue-600 px-5 py-6 shadow-lg shadow-blue-200">
          <View className="flex flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="block text-2xl font-bold text-white">无人车共享运营平台</Text>
              <Text className="mt-2 block text-sm leading-5 text-blue-100">
                需求发布 · 运力接单 · 企业调度
              </Text>
            </View>
            {currentUser ? (
              <Button className="rounded-full bg-white" size="sm" onClick={() => switchTabByRole(currentUser.role)}>
                <Text className="text-xs font-semibold text-blue-600">进入</Text>
              </Button>
            ) : null}
          </View>

          <View className="mt-5 grid grid-cols-3 gap-2">
            <View className="rounded-2xl bg-white px-3 py-3">
              <Text className="block text-xl font-bold text-blue-600">{statistics.orders.total}</Text>
              <Text className="mt-1 block text-xs text-slate-500">订单</Text>
            </View>
            <View className="rounded-2xl bg-white px-3 py-3">
              <Text className="block text-xl font-bold text-emerald-600">{statistics.vehicles.total}</Text>
              <Text className="mt-1 block text-xs text-slate-500">车辆</Text>
            </View>
            <View className="rounded-2xl bg-white px-3 py-3">
              <Text className="block text-xl font-bold text-amber-600">{statistics.demands.total}</Text>
              <Text className="mt-1 block text-xs text-slate-500">需求</Text>
            </View>
          </View>
        </View>

        <View className="flex flex-col gap-4 px-3 pt-4">
          <Card className="rounded-3xl border border-slate-100 bg-white shadow-sm">
            <CardContent className="p-4">
              <View className="mb-4 flex flex-row gap-2">
                <Button
                  className={mode === 'login' ? 'h-10 flex-1 rounded-2xl bg-blue-600' : 'h-10 flex-1 rounded-2xl bg-slate-50'}
                  variant={mode === 'login' ? 'default' : 'outline'}
                  onClick={() => setMode('login')}
                >
                  <Text className={mode === 'login' ? 'text-sm font-semibold text-white' : 'text-sm font-semibold text-slate-700'}>
                    登录
                  </Text>
                </Button>
                <Button
                  className={mode === 'register' ? 'h-10 flex-1 rounded-2xl bg-blue-600' : 'h-10 flex-1 rounded-2xl bg-slate-50'}
                  variant={mode === 'register' ? 'default' : 'outline'}
                  onClick={() => setMode('register')}
                >
                  <Text className={mode === 'register' ? 'text-sm font-semibold text-white' : 'text-sm font-semibold text-slate-700'}>
                    注册
                  </Text>
                </Button>
              </View>

              <View className="mb-4 grid grid-cols-3 gap-2">
                {roleOptions.map((option) => {
                  const Icon = option.icon
                  const selected = role === option.value
                  return (
                    <View
                      key={option.value}
                      className={selected ? 'rounded-2xl border border-blue-200 bg-blue-50 px-2 py-3' : 'rounded-2xl border border-slate-100 bg-slate-50 px-2 py-3'}
                      onClick={() => setRole(option.value)}
                    >
                      <View className="items-center">
                        <Icon size={18} color={selected ? '#0062FF' : '#64748B'} strokeWidth={2.2} />
                        <Text className={selected ? 'mt-2 block text-center text-xs font-bold text-blue-600' : 'mt-2 block text-center text-xs font-bold text-slate-700'}>
                          {option.label}
                        </Text>
                        <Text className="mt-1 block text-center text-xs text-slate-400">{option.detail}</Text>
                      </View>
                    </View>
                  )
                })}
              </View>

              <View className="flex flex-col gap-3">
                {mode === 'register' ? (
                  <View>
                    <Label className="mb-2 block text-xs font-semibold text-slate-500">姓名</Label>
                    <Input className="rounded-2xl bg-slate-50" placeholder="请输入您的姓名" value={name} onInput={(event) => setName(event.detail.value)} />
                  </View>
                ) : null}

                <View>
                  <Label className="mb-2 block text-xs font-semibold text-slate-500">手机号</Label>
                  <Input
                    className="rounded-2xl bg-slate-50"
                    placeholder="请输入手机号"
                    type="number"
                    value={phone}
                    onInput={(event) => setPhone(event.detail.value)}
                  />
                </View>

                {mode === 'register' ? (
                  <View>
                    <Label className="mb-2 block text-xs font-semibold text-slate-500">图形验证码</Label>
                    <View className="flex flex-row items-center gap-2">
                      <Input
                        className="flex-1 rounded-2xl bg-slate-50"
                        placeholder="验证码"
                        value={captchaCode}
                        maxlength={6}
                        onInput={(event) => setCaptchaCode(event.detail.value.toUpperCase())}
                      />
                      <Button className="h-11 rounded-2xl bg-slate-50 px-2" variant="outline" disabled={captchaLoading} onClick={loadRegisterCaptcha}>
                        {captchaImage ? (
                          <Image src={captchaImage} mode="aspectFit" className="h-8 w-24" />
                        ) : (
                          <Text className="text-xs text-slate-500">{TARO_ENV === 'h5' && !PROJECT_DOMAIN ? '预览' : '加载中'}</Text>
                        )}
                      </Button>
                    </View>
                  </View>
                ) : null}

                <View>
                  <Label className="mb-2 block text-xs font-semibold text-slate-500">密码</Label>
                  <Input className="rounded-2xl bg-slate-50" placeholder="请输入密码" password value={password} onInput={(event) => setPassword(event.detail.value)} />
                </View>

                {mode === 'register' ? (
                  <View>
                    <Label className="mb-2 block text-xs font-semibold text-slate-500">确认密码</Label>
                    <Input
                      className="rounded-2xl bg-slate-50"
                      placeholder="请再次输入密码"
                      password
                      value={confirmPassword}
                      onInput={(event) => setConfirmPassword(event.detail.value)}
                    />
                  </View>
                ) : null}

                <Button className="mt-1 h-12 rounded-2xl bg-blue-600" disabled={authLoading} onClick={handleSubmit}>
                  <Text className="text-sm font-semibold text-white">
                    {authLoading ? (mode === 'login' ? '登录中...' : '注册中...') : mode === 'login' ? '登录' : '注册'}
                  </Text>
                </Button>
              </View>
            </CardContent>
          </Card>

          <View className="grid grid-cols-2 gap-3">
            <Card className="rounded-3xl border border-slate-100 bg-white shadow-sm">
              <CardContent className="p-4">
                <Clock size={20} color="#0062FF" />
                <Text className="mt-3 block text-sm font-bold text-slate-900">快速匹配</Text>
                <Text className="mt-1 block text-xs text-slate-500">发布后自动匹配车辆</Text>
              </CardContent>
            </Card>
            <Card className="rounded-3xl border border-slate-100 bg-white shadow-sm">
              <CardContent className="p-4">
                <ShieldCheck size={20} color="#10B981" />
                <Text className="mt-3 block text-sm font-bold text-slate-900">安全保障</Text>
                <Text className="mt-1 block text-xs text-slate-500">订单、车辆、履约可追踪</Text>
              </CardContent>
            </Card>
            <Card className="rounded-3xl border border-slate-100 bg-white shadow-sm">
              <CardContent className="p-4">
                <Truck size={20} color="#F59E0B" />
                <Text className="mt-3 block text-sm font-bold text-slate-900">运力充足</Text>
                <Text className="mt-1 block text-xs text-slate-500">多车型覆盖核心线路</Text>
              </CardContent>
            </Card>
            <Card className="rounded-3xl border border-slate-100 bg-white shadow-sm">
              <CardContent className="p-4">
                <Package size={20} color="#4F46E5" />
                <Text className="mt-3 block text-sm font-bold text-slate-900">便捷下单</Text>
                <Text className="mt-1 block text-xs text-slate-500">常用模板快速复用</Text>
              </CardContent>
            </Card>
          </View>

          {currentUser ? (
            <Card className="rounded-3xl border border-blue-100 bg-blue-50 shadow-sm">
              <CardContent className="p-4">
                <View className="flex flex-row items-center gap-3">
                  <View className="flex size-10 items-center justify-center rounded-2xl bg-white">
                    <UserRound size={20} color="#0062FF" />
                  </View>
                  <View className="flex-1">
                    <Text className="block text-sm font-bold text-slate-900">{currentUser.name || currentUser.phone}</Text>
                    <Text className="mt-1 block text-xs text-slate-500">已登录 · {currentUser.role}</Text>
                  </View>
                  <Button className="rounded-2xl bg-blue-600" size="sm" onClick={() => switchTabByRole(currentUser.role)}>
                    <Text className="text-xs font-semibold text-white">进入工作台</Text>
                  </Button>
                </View>
              </CardContent>
            </Card>
          ) : null}
        </View>
      </ScrollView>
    </View>
  )
}
