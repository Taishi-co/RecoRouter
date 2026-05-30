import { readFileSync } from 'node:fs'

const checks = [
  {
    file: 'src/app.config.ts',
    snippets: ['pages/owner/wallet/index'],
  },
  {
    file: 'src/services/owner-wallet.ts',
    snippets: ['/api/owner-wallet/withdrawals', 'requestMerchantTransfer'],
  },
  {
    file: 'src/pages/owner/profile/index.tsx',
    snippets: ['/pages/owner/wallet/index'],
  },
  {
    file: 'src/components/layout/bottom-nav.tsx',
    snippets: ["url: '/pages/owner/wallet/index'"],
  },
]

const failures = []

for (const check of checks) {
  let text = ''
  try {
    text = readFileSync(check.file, 'utf8')
  } catch {
    failures.push(`${check.file} is missing`)
    continue
  }

  for (const snippet of check.snippets) {
    if (!text.includes(snippet)) {
      failures.push(`${check.file} missing ${snippet}`)
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('owner wallet page wiring check passed')
