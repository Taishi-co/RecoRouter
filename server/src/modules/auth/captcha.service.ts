import { Injectable } from '@nestjs/common'
import { randomBytes, randomInt } from 'crypto'

interface CaptchaRecord {
  code: string
  expiresAt: number
}

const CAPTCHA_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

@Injectable()
export class CaptchaService {
  private readonly captchaTtlMs = 5 * 60 * 1000
  private readonly captchas = new Map<string, CaptchaRecord>()

  generateCaptcha() {
    this.cleanupExpiredCaptchas()

    const captchaId = randomBytes(16).toString('hex')
    const code = Array.from({ length: 4 }, () => CAPTCHA_CHARS[randomInt(CAPTCHA_CHARS.length)]).join('')
    const expiresAt = Date.now() + this.captchaTtlMs

    this.captchas.set(captchaId, { code, expiresAt })

    return {
      captchaId,
      image: this.renderCaptchaSvg(code),
      expiresAt: new Date(expiresAt).toISOString()
    }
  }

  verifyCaptcha(captchaId: string, captchaCode: string) {
    const record = this.captchas.get(captchaId)
    this.captchas.delete(captchaId)

    if (!record || record.expiresAt < Date.now()) {
      return false
    }

    return record.code === captchaCode.trim().toUpperCase()
  }

  private cleanupExpiredCaptchas() {
    const now = Date.now()
    for (const [captchaId, record] of this.captchas.entries()) {
      if (record.expiresAt < now) {
        this.captchas.delete(captchaId)
      }
    }
  }

  private renderCaptchaSvg(code: string) {
    const width = 132
    const height = 46
    const lines = Array.from({ length: 5 }, () => {
      const x1 = randomInt(width)
      const y1 = randomInt(height)
      const x2 = randomInt(width)
      const y2 = randomInt(height)
      const color = this.randomColor(90, 170)

      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.2" opacity="0.55"/>`
    }).join('')
    const dots = Array.from({ length: 22 }, () => {
      const cx = randomInt(width)
      const cy = randomInt(height)
      const color = this.randomColor(80, 180)

      return `<circle cx="${cx}" cy="${cy}" r="${randomInt(1, 3)}" fill="${color}" opacity="0.45"/>`
    }).join('')
    const characters = code.split('').map((char, index) => {
      const x = 22 + index * 24 + randomInt(-3, 4)
      const y = 31 + randomInt(-4, 5)
      const rotation = randomInt(-18, 19)
      const color = this.randomColor(25, 95)

      return `<text x="${x}" y="${y}" fill="${color}" font-size="25" font-family="Arial, Helvetica, sans-serif" font-weight="700" transform="rotate(${rotation} ${x} ${y})">${char}</text>`
    }).join('')
    const svg = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
      '<rect width="100%" height="100%" rx="8" fill="#f8fafc"/>',
      lines,
      dots,
      characters,
      '</svg>'
    ].join('')

    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  }

  private randomColor(min: number, max: number) {
    const range = max - min
    const red = min + randomInt(range)
    const green = min + randomInt(range)
    const blue = min + randomInt(range)

    return `rgb(${red},${green},${blue})`
  }
}
