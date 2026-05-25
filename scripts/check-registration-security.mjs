import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const authDto = readFileSync(resolve('server/src/modules/auth/dto/auth.dto.ts'), 'utf8')
const authService = readFileSync(resolve('server/src/modules/auth/auth.service.ts'), 'utf8')
const indexPage = readFileSync(resolve('src/pages/index/index.tsx'), 'utf8')

const assertions = [
  {
    ok: /confirmPassword:\s*z\.string\(\)\.min\(\s*6/.test(authDto),
    message: 'Register DTO must require confirmPassword with the same minimum length as password',
  },
  {
    ok: /verificationCode:\s*z\.string\(\)\.min\(\s*4/.test(authDto),
    message: 'Register DTO must require a verificationCode field',
  },
  {
    ok: /password\s*!==\s*confirmPassword/.test(authService) && /两次输入的密码不一致/.test(authService),
    message: 'Register service must reject mismatched password confirmation',
  },
  {
    ok: /\.from\(\s*['"]sms_codes['"]\s*\)[\s\S]*\.eq\(\s*['"]phone['"]\s*,\s*phone\s*\)[\s\S]*\.eq\(\s*['"]code['"]\s*,\s*verificationCode\s*\)[\s\S]*\.eq\(\s*['"]type['"]\s*,\s*['"]register['"]\s*\)/.test(authService),
    message: 'Register service must verify the register SMS code for the submitted phone',
  },
  {
    ok: /\.from\(\s*['"]sms_codes['"]\s*\)[\s\S]*\.update\(\s*\{\s*is_used:\s*true/.test(authService),
    message: 'Register service must mark the SMS code as used after successful registration',
  },
  {
    ok: /const\s+\[confirmPassword,\s*setConfirmPassword\]\s*=\s*useState\(\s*['"]{2}\s*\)/.test(indexPage),
    message: 'Register page must keep confirmPassword state',
  },
  {
    ok: /const\s+\[verificationCode,\s*setVerificationCode\]\s*=\s*useState\(\s*['"]{2}\s*\)/.test(indexPage),
    message: 'Register page must keep verificationCode state',
  },
  {
    ok: /url:\s*['"]\/api\/account-settings\/send-sms-code['"][\s\S]*type:\s*['"]register['"]/.test(indexPage),
    message: 'Register page must request a register SMS code',
  },
  {
    ok: /data:\s*\{[\s\S]*phone[\s\S]*password[\s\S]*confirmPassword[\s\S]*verificationCode[\s\S]*role[\s\S]*\}/.test(indexPage),
    message: 'Register request payload must include confirmPassword and verificationCode',
  },
  {
    ok: /再次确认密码/.test(indexPage) && /验证码/.test(indexPage) && /获取验证码/.test(indexPage),
    message: 'Register dialog must render confirm-password and SMS-code controls',
  },
]

for (const assertion of assertions) {
  if (!assertion.ok) {
    throw new Error(assertion.message)
  }
}
