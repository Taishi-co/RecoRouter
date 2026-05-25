import { Injectable, UnauthorizedException, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common'
import { RegisterDto, LoginDto, UpdatePaymentQrDto } from './dto/auth.dto'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { UserInfo } from './auth.types'
import * as bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { createFileStorage } from '@/storage/file-storage'
import { CaptchaService } from './captcha.service'

const storage = createFileStorage()

interface UploadedFile {
  buffer: Buffer
  originalname: string
  mimetype: string
}

@Injectable()
export class AuthService {
  constructor(private readonly captchaService: CaptchaService) {}

  async register(registerDto: RegisterDto) {
    const { phone, password, confirmPassword, captchaId, captchaCode, name, role } = registerDto

    if (!confirmPassword) {
      throw new BadRequestException('请再次确认密码')
    }

    if (password !== confirmPassword) {
      throw new BadRequestException('两次输入的密码不一致')
    }

    if (!captchaId || !captchaCode) {
      throw new BadRequestException('请输入图形验证码')
    }

    if (!this.captchaService.verifyCaptcha(captchaId, captchaCode)) {
      throw new BadRequestException('图形验证码错误或已过期，请刷新后重试')
    }

    // 检查手机号是否已注册
    const client = getSupabaseClient()
    const { data: existingUser, error: checkError } = await client
      .from('users')
      .select('id')
      .eq('phone', phone)
      .maybeSingle()

    if (checkError) {
      throw new UnauthorizedException(`查询失败: ${checkError.message}`)
    }

    if (existingUser) {
      throw new ConflictException('该手机号已注册')
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10)

    // 创建用户
    const userId = uuidv4()
    const { data: newUser, error: insertError } = await client
      .from('users')
      .insert({
        id: userId,
        phone,
        password: hashedPassword,
        role,
        name,
        status: 'active'
      })
      .select()
      .single()

    if (insertError) {
      throw new UnauthorizedException(`注册失败: ${insertError.message}`)
    }

    // 生成 token（简化版，使用用户ID）
    const token = userId

    // 返回用户信息（不包含密码）
    const userInfo: UserInfo = {
      id: newUser.id,
      phone: newUser.phone,
      name: newUser.name,
      role: newUser.role,
      token
    }

    return {
      code: 200,
      message: '注册成功',
      data: userInfo
    }
  }

  async login(loginDto: LoginDto) {
    const { phone, password } = loginDto

    // 查询用户
    const client = getSupabaseClient()
    const { data: user, error } = await client
      .from('users')
      .select('*')
      .eq('phone', phone)
      .maybeSingle()

    if (error) {
      throw new UnauthorizedException(`查询失败: ${error.message}`)
    }

    if (!user) {
      throw new UnauthorizedException('用户不存在')
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      throw new UnauthorizedException('密码错误')
    }

    // 检查用户状态
    if (user.status === 'disabled') {
      throw new UnauthorizedException('账号已被禁用')
    }

    // 生成 token（简化版，使用用户ID）
    const token = user.id

    // 返回用户信息（不包含密码）
    const userInfo: UserInfo = {
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      token
    }

    return {
      code: 200,
      message: '登录成功',
      data: userInfo
    }
  }

  async getUserInfo(userId: string) {
    const client = getSupabaseClient()

    const { data: user, error } = await client
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      throw new BadRequestException(`查询失败: ${error.message}`)
    }

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    // 如果有收款码，生成签名URL
    let paymentQrUrl: string | null = null
    if (user.wechat_payment_qr) {
      try {
        paymentQrUrl = await storage.generatePresignedUrl({
          key: user.wechat_payment_qr,
          expireTime: 86400 // 1天有效期
        })
        console.log('[AuthService] 收款码签名URL生成成功:', paymentQrUrl)
      } catch (err) {
        console.error('[AuthService] 生成签名URL失败:', err)
        paymentQrUrl = null
      }
    }

    // 只返回需要的字段
    const result = {
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      wechat_payment_qr: paymentQrUrl,
      created_at: user.created_at
    }

    return {
      code: 200,
      message: '查询成功',
      data: result
    }
  }

  async updatePaymentQr(updatePaymentQrDto: UpdatePaymentQrDto, file?: UploadedFile) {
    const { userId } = updatePaymentQrDto

    // 验证用户是否存在
    const client = getSupabaseClient()
    const { data: user, error: userError } = await client
      .from('users')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle()

    if (userError || !user) {
      throw new NotFoundException('用户不存在')
    }

    // 只有车主可以上传收款码
    if (user.role !== 'owner') {
      throw new BadRequestException('只有车主可以上传收款码')
    }

    if (!file) {
      throw new BadRequestException('请上传收款码图片')
    }

    // 上传图片到TOS
    let fileKey: string
    try {
      fileKey = await storage.uploadFile({
        fileContent: file.buffer,
        fileName: `payment_qr/${userId}_${Date.now()}_${file.originalname}`,
        contentType: file.mimetype,
      })
      console.log('[AuthService] 收款码上传成功，fileKey:', fileKey)
    } catch (error) {
      console.error('[AuthService] 收款码上传失败:', error)
      throw new BadRequestException('收款码上传失败')
    }

    // 更新用户收款码，只保存fileKey（不保存URL）
    const { data: updatedUser, error: updateError } = await client
      .from('users')
      .update({ wechat_payment_qr: fileKey })
      .eq('id', userId)
      .select('id, phone, name, role, wechat_payment_qr')
      .single()

    if (updateError) {
      throw new BadRequestException(`更新失败: ${updateError.message}`)
    }

    // 生成收款码签名URL返回给前端
    let paymentQrUrl: string | null = null
    try {
      paymentQrUrl = await storage.generatePresignedUrl({
        key: fileKey,
        expireTime: 86400 // 1天有效期
      })
      console.log('[AuthService] 收款码签名URL生成成功:', paymentQrUrl)
    } catch (err) {
      console.error('[AuthService] 生成签名URL失败:', err)
    }

    const result = {
      id: updatedUser.id,
      phone: updatedUser.phone,
      name: updatedUser.name,
      role: updatedUser.role,
      wechat_payment_qr: paymentQrUrl
    }

    return {
      code: 200,
      message: '收款码上传成功',
      data: result
    }
  }
}
