import { Module } from '@nestjs/common'
import { MulterModule } from '@nestjs/platform-express'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { CaptchaService } from './captcha.service'

@Module({
  imports: [
    MulterModule.register({
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    })
  ],
  controllers: [AuthController],
  providers: [AuthService, CaptchaService],
  exports: [AuthService]
})
export class AuthModule {}
