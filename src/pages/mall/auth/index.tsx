import { useEffect, useMemo, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ChevronLeft, RefreshCw, ShieldCheck } from 'lucide-react-taro'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import { MallPage, MallPrimaryButton } from '../mall-ui'

type AuthMode = 'login' | 'register'

interface AuthUserInfo {
  id: string
  phone: string
  name: string
  role: string
  token: string
}

interface CaptchaInfo {
  captchaId: string
  image: string
}

interface ApiEnvelope<T> {
  code?: number
  message?: string
  data?: T
}

const defaultReturnUrl = '/pages/mall/profile/index'

export default function MallAuthPage() {
  const params = Taro.getCurrentInstance().router?.params || {}
  const initialMode = params.mode === 'register' ? 'register' : 'login'
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [captchaId, setCaptchaId] = useState('')
  const [captchaImage, setCaptchaImage] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [captchaLoading, setCaptchaLoading] = useState(false)

  const returnUrl = useMemo(() => {
    const raw = typeof params.returnUrl === 'string'
      ? decodeURIComponent(params.returnUrl)
      : defaultReturnUrl
    return raw.startsWith('/pages/mall/') ? raw : defaultReturnUrl
  }, [params.returnUrl])

  useEffect(() => {
    if (mode === 'register') {
      loadCaptcha()
    }
  }, [mode])

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setCaptchaCode('')
    if (nextMode === 'register' && !captchaImage) {
      loadCaptcha()
    }
  }

  const loadCaptcha = async () => {
    setCaptchaLoading(true)
    try {
      const captcha = await requestApi<CaptchaInfo>('/api/auth/captcha', 'GET')
      setCaptchaId(captcha.captchaId)
      setCaptchaImage(captcha.image)
      setCaptchaCode('')
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '验证码加载失败',
        icon: 'none',
      })
    } finally {
      setCaptchaLoading(false)
    }
  }

  const submit = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone.trim())) {
      Taro.showToast({ title: '请输入正确手机号', icon: 'none' })
      return
    }
    if (password.length < 6) {
      Taro.showToast({ title: '密码至少6位', icon: 'none' })
      return
    }
    if (mode === 'register') {
      if (!name.trim()) {
        Taro.showToast({ title: '请输入姓名', icon: 'none' })
        return
      }
      if (!captchaId || !captchaCode.trim()) {
        Taro.showToast({ title: '请输入图形验证码', icon: 'none' })
        return
      }
      if (password !== confirmPassword) {
        Taro.showToast({ title: '两次密码不一致', icon: 'none' })
        return
      }
    }

    setLoading(true)
    try {
      const authUser = mode === 'login'
        ? await requestApi<AuthUserInfo>('/api/auth/login', 'POST', { phone, password })
        : await requestApi<AuthUserInfo>('/api/auth/register', 'POST', {
          phone,
          password,
          confirmPassword,
          verificationCode: captchaCode.trim(),
          captchaId,
          name: name.trim(),
          role: 'customer',
        })
      persistAuth(authUser)
      Taro.showToast({ title: mode === 'login' ? '登录成功' : '注册成功', icon: 'success' })
      setTimeout(() => Taro.redirectTo({ url: returnUrl }), 500)
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : mode === 'login' ? '登录失败' : '注册失败',
        icon: 'none',
      })
      if (mode === 'register') {
        loadCaptcha()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <MallPage active="mine" noTab>
      <View className="mall-back-row">
        <ChevronLeft size={24} color="#1F2D1F" onClick={() => Taro.navigateBack()} />
        <Text className="mall-section-action">叁友甄选</Text>
      </View>
      <Text className="mall-page-title">{mode === 'login' ? '登录商城' : '注册商城账号'}</Text>
      <Text className="mall-page-subtitle">登录后查看订单、自提码、售后和邻里团购消息。</Text>

      <View className="mall-auth-tabs">
        <View className={mode === 'login' ? 'mall-auth-tab mall-auth-tab-active' : 'mall-auth-tab'} onClick={() => switchMode('login')}>
          <Text>登录</Text>
        </View>
        <View className={mode === 'register' ? 'mall-auth-tab mall-auth-tab-active' : 'mall-auth-tab'} onClick={() => switchMode('register')}>
          <Text>注册</Text>
        </View>
      </View>

      <View className="mall-card">
        {mode === 'register' ? (
          <Field label="姓名">
            <Input className="mall-form-input" value={name} placeholder="请输入姓名" onInput={(event) => setName(String(event.detail.value || ''))} />
          </Field>
        ) : null}
        <Field label="手机号">
          <Input className="mall-form-input" type="number" value={phone} placeholder="请输入手机号" onInput={(event) => setPhone(String(event.detail.value || ''))} />
        </Field>
        {mode === 'register' ? (
          <Field label="图形验证码">
            <View className="mall-captcha-row">
              <Input
                className="mall-form-input"
                value={captchaCode}
                placeholder="请输入验证码"
                maxlength={6}
                onInput={(event) => setCaptchaCode(String(event.detail.value || '').toUpperCase())}
              />
              <View className="mall-captcha" onClick={loadCaptcha}>
                {captchaImage ? (
                  <Image className="mall-captcha-image" src={captchaImage} mode="aspectFit" />
                ) : (
                  <RefreshCw size={18} color="#63BF54" />
                )}
                <Text>{captchaLoading ? '加载中' : '换一张'}</Text>
              </View>
            </View>
          </Field>
        ) : null}
        <Field label="密码">
          <Input className="mall-form-input" password value={password} placeholder="请输入密码" onInput={(event) => setPassword(String(event.detail.value || ''))} />
        </Field>
        {mode === 'register' ? (
          <Field label="确认密码">
            <Input className="mall-form-input" password value={confirmPassword} placeholder="请再次输入密码" onInput={(event) => setConfirmPassword(String(event.detail.value || ''))} />
          </Field>
        ) : null}
        <MallPrimaryButton onClick={submit}>
          <ShieldCheck size={18} color="#FFFFFF" />
          <Text>{loading ? '提交中' : mode === 'login' ? '登录' : '注册并登录'}</Text>
        </MallPrimaryButton>
      </View>
    </MallPage>
  )
}

function Field({ label, children }: { label: string; children: JSX.Element }) {
  return (
    <View className="mall-form-field">
      <Text className="mall-form-label">{label}</Text>
      {children}
    </View>
  )
}

async function requestApi<T>(url: string, method: 'GET' | 'POST', data?: unknown): Promise<T> {
  const response = await Network.request({
    url,
    method,
    header: method === 'POST' ? { 'content-type': 'application/json' } : undefined,
    data,
  })
  const body = response.data as ApiEnvelope<T>
  if (response.statusCode < 200 || response.statusCode >= 300 || body.code !== 200) {
    throw new Error(body.message || '请求失败')
  }
  return body.data as T
}

function persistAuth(authUser: AuthUserInfo) {
  Taro.setStorageSync('userInfo', {
    id: authUser.id,
    phone: authUser.phone,
    name: authUser.name,
    role: authUser.role,
  })
  Taro.setStorageSync('token', authUser.token)
}
