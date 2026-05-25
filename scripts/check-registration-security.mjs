import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const authModule = readFileSync(resolve('server/src/modules/auth.rs'), 'utf8')
const indexPage = readFileSync(resolve('src/pages/index/index.tsx'), 'utf8')

const assertions = [
  {
    ok: /confirm_password:\s*Option<String>/.test(authModule),
    message: 'Register request must accept confirmPassword',
  },
  {
    ok: /verification_code:\s*String/.test(authModule),
    message: 'Register request must require a verificationCode field',
  },
  {
    ok: /confirm_password\s*!=\s*&body\.password/.test(authModule) && /两次输入的密码不一致/.test(authModule),
    message: 'Register service must reject mismatched password confirmation',
  },
  {
    ok: /captcha_store[\s\S]*\.verify\(\s*&body\.captcha_id,\s*&body\.verification_code\s*\)/.test(authModule),
    message: 'Register service must verify the submitted captcha code',
  },
  {
    ok: /captcha_store[\s\S]*\.verify\(\s*&body\.captcha_id,\s*&body\.verification_code\s*\)/.test(authModule),
    message: 'Register service must consume the captcha after successful verification',
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
    ok: /url:\s*['"]\/api\/auth\/captcha['"]/.test(indexPage),
    message: 'Register page must request a backend graphic captcha',
  },
  {
    ok: /data:\s*\{[\s\S]*phone[\s\S]*password[\s\S]*confirmPassword[\s\S]*verificationCode[\s\S]*captchaId[\s\S]*role[\s\S]*\}/.test(indexPage),
    message: 'Register request payload must include confirmPassword, verificationCode, and captchaId',
  },
  {
    ok: /再次确认密码/.test(indexPage) && /图形验证码/.test(indexPage) && /刷新验证码/.test(indexPage),
    message: 'Register dialog must render confirm-password and graphic-captcha controls',
  },
]

for (const assertion of assertions) {
  if (!assertion.ok) {
    throw new Error(assertion.message)
  }
}
