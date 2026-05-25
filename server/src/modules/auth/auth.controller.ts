import { Controller, Post, Body, HttpCode, HttpStatus, Get, Query, UseInterceptors, UploadedFile } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { AuthService } from './auth.service'
import { CaptchaService } from './captcha.service'
import { LoginDto, RegisterDto, UpdatePaymentQrDto } from './dto/auth.dto'

interface UploadedFile {
  fieldname: string
  originalname: string
  encoding: string
  mimetype: string
  size: number
  destination: string
  filename: string
  path: string
  buffer: Buffer
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly captchaService: CaptchaService
  ) {}

  @Get('captcha')
  async generateCaptcha() {
    return {
      code: 200,
      message: '获取成功',
      data: this.captchaService.generateCaptcha()
    }
  }

  @Post('register')
  @HttpCode(HttpStatus.OK)
  async register(@Body() registerDto: RegisterDto) {
    console.log('[AuthController] 注册请求:', registerDto)
    return this.authService.register(registerDto)
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    console.log('[AuthController] 登录请求:', loginDto)
    return this.authService.login(loginDto)
  }

  @Get('user-info')
  async getUserInfo(@Query('userId') userId: string) {
    console.log('[AuthController] 获取用户信息:', userId)
    return this.authService.getUserInfo(userId)
  }

  @Post('update-payment-qr')
  @UseInterceptors(FileInterceptor('file'))
  async updatePaymentQr(
    @Body() updatePaymentQrDto: UpdatePaymentQrDto,
    @UploadedFile() file?: UploadedFile
  ) {
    console.log('[AuthController] 更新收款码:', updatePaymentQrDto.userId)
    return this.authService.updatePaymentQr(updatePaymentQrDto, file)
  }
}
