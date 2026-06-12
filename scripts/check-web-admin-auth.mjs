import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('src/web-admin/main.tsx'), 'utf8')

const checks = [
  {
    ok: /apiPost\s*<[^>]+>\s*\(\s*['"]\/api\/auth\/login['"][\s\S]*?\{\s*phone[\s\S]*?password[\s\S]*?captchaId[\s\S]*?captchaCode[\s\S]*?\}/.test(source),
    message: 'Web admin login must call /api/auth/login with phone, password, captchaId and captchaCode',
  },
  {
    ok: /apiGet\s*<[^>]+>\s*\(\s*['"]\/api\/auth\/captcha['"]\s*\)/.test(source)
      && /图形验证码/.test(source)
      && /captchaImage/.test(source)
      && /刷新验证码|换一张/.test(source),
    message: 'Web admin login must render and refresh the backend graphic captcha',
  },
  {
    ok: /Authorization['"]?\s*:\s*`Bearer\s+\$\{[^}]+token[^}]*\}`/.test(source)
      || /Authorization['"]?\s*:\s*['"]Bearer\s+['"]\s*\+\s*[^,\n]+token/.test(source),
    message: 'Web admin API requests must attach Authorization: Bearer <token>',
  },
  {
    ok: /role\s*===\s*['"]admin['"]/.test(source),
    message: 'Web admin login must allow only role === admin',
  },
  {
    ok: /apiRequest\s*\(\s*['"]\/api\/auth\/logout['"][\s\S]*?method:\s*['"]POST['"]/.test(source),
    message: 'Web admin logout must call /api/auth/logout',
  },
  {
    ok: /logoutConfirmOpen/.test(source)
      && /确认退出登录/.test(source)
      && /onClick=\{\(\) => setLogoutConfirmOpen\(true\)\}/.test(source),
    message: 'Web admin logout must show a confirmation modal before calling logout',
  },
  {
    ok: /localStorage\.setItem\s*\([^)]*webAdminSession/.test(source)
      && /localStorage\.getItem\s*\([^)]*webAdminSession/.test(source)
      && /localStorage\.removeItem\s*\([^)]*webAdminSession/.test(source),
    message: 'Web admin must persist and clear localStorage session',
  },
  {
    ok: /\[\s*401\s*,\s*403\s*\]/.test(source)
      && /clearStoredAdminSession\s*\(\s*\)/.test(source),
    message: 'Web admin must clear session on 401/403 responses',
  },
]

const failed = checks.filter(check => !check.ok)

if (failed.length > 0) {
  throw new Error(failed.map(check => check.message).join('\n'))
}
