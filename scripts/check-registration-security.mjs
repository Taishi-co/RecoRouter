import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const authDto = readFileSync(resolve('server/src/modules/auth/dto/auth.dto.ts'), 'utf8')
const authService = readFileSync(resolve('server/src/modules/auth/auth.service.ts'), 'utf8')
const authController = readFileSync(resolve('server/src/modules/auth/auth.controller.ts'), 'utf8')
const indexPage = readFileSync(resolve('src/pages/index/index.tsx'), 'utf8')

const assertions = [
  {
    ok: /confirmPassword:\s*z\.string\(\)\.min\(\s*6/.test(authDto),
    message: 'Register DTO must require confirmPassword with the same minimum length as password',
  },
  {
    ok: /captchaId:\s*z\.string\(\)\.min\(\s*1/.test(authDto),
    message: 'Register DTO must require a captchaId field',
  },
  {
    ok: /captchaCode:\s*z\.string\(\)\.min\(\s*4/.test(authDto),
    message: 'Register DTO must require a captchaCode field',
  },
  {
    ok: /password\s*!==\s*confirmPassword/.test(authService) && /两次输入的密码不一致/.test(authService),
    message: 'Register service must reject mismatched password confirmation',
  },
  {
    ok: /verifyCaptcha\(\s*captchaId\s*,\s*captchaCode\s*\)/.test(authService),
    message: 'Register service must verify the graphical captcha before creating the user',
  },
  {
    ok: /@Get\(\s*['"]captcha['"]\s*\)/.test(authController) && /generateCaptcha\(\)/.test(authController),
    message: 'Auth controller must expose a graphical captcha endpoint',
  },
  {
    ok: /const\s+\[confirmPassword,\s*setConfirmPassword\]\s*=\s*useState\(\s*['"]{2}\s*\)/.test(indexPage),
    message: 'Register page must keep confirmPassword state',
  },
  {
    ok: /const\s+\[captchaId,\s*setCaptchaId\]\s*=\s*useState\(\s*['"]{2}\s*\)/.test(indexPage),
    message: 'Register page must keep captchaId state',
  },
  {
    ok: /const\s+\[captchaCode,\s*setCaptchaCode\]\s*=\s*useState\(\s*['"]{2}\s*\)/.test(indexPage),
    message: 'Register page must keep captchaCode state',
  },
  {
    ok: /url:\s*['"]\/api\/auth\/captcha['"]/.test(indexPage),
    message: 'Register page must request a graphical captcha',
  },
  {
    ok: /data:\s*\{[\s\S]*phone[\s\S]*password[\s\S]*confirmPassword[\s\S]*captchaId[\s\S]*captchaCode[\s\S]*role[\s\S]*\}/.test(indexPage),
    message: 'Register request payload must include confirmPassword, captchaId, and captchaCode',
  },
  {
    ok: /再次确认密码/.test(indexPage) && /图形验证码/.test(indexPage) && /刷新验证码/.test(indexPage),
    message: 'Register dialog must render confirm-password and graphical captcha controls',
  },
  {
    ok: !/send-sms-code/.test(indexPage) && !/verificationCode/.test(authDto) && !/verificationCode/.test(authService),
    message: 'Register flow must not use the SMS verification code path',
  },
]

for (const assertion of assertions) {
  if (!assertion.ok) {
    throw new Error(assertion.message)
  }
}
