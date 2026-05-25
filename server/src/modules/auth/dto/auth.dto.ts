import { z } from 'zod'

// 注册 DTO
export const registerSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
  password: z.string().min(6, '密码至少6位'),
  confirmPassword: z.string().min(6, '确认密码至少6位'),
  captchaId: z.string().min(1, '请刷新图形验证码'),
  captchaCode: z.string().min(4, '请输入图形验证码').max(6, '图形验证码最多6位'),
  name: z.string().min(1, '姓名不能为空').max(50, '姓名最多50个字符'),
  role: z.enum(['owner', 'merchant', 'enterprise'], {
    message: '角色必须为 owner、merchant 或 enterprise'
  })
})

export type RegisterDto = z.infer<typeof registerSchema>

// 登录 DTO
export const loginSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
  password: z.string().min(6, '密码至少6位')
})

export type LoginDto = z.infer<typeof loginSchema>

// 更新收款码 DTO
export const updatePaymentQrSchema = z.object({
  userId: z.string().min(1, '用户ID不能为空')
})

export type UpdatePaymentQrDto = z.infer<typeof updatePaymentQrSchema>
