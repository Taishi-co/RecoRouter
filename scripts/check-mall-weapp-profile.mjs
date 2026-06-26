import { readFileSync } from 'node:fs'

const workflow = readFileSync('.github/workflows/publish-miniapp.yml', 'utf8')
const uploadScript = readFileSync('deploy/upload-miniapp.sh', 'utf8')

const assertions = [
  {
    ok: /app_profile:[\s\S]*?default:\s*mall/.test(workflow),
    message: 'Publish miniapp workflow must expose app_profile with mall as the default',
  },
  {
    ok: /RECO_APP_PROFILE:\s*\$\{\{\s*inputs\.app_profile[\s\S]*?mall/.test(workflow),
    message: 'Publish miniapp workflow must set RECO_APP_PROFILE from app_profile and default to mall',
  },
  {
    ok: /RECO_APP_PROFILE='\$RECO_APP_PROFILE'[\s\S]*bash \/tmp\/recorouter-miniapp-install\/deploy\/upload-miniapp\.sh/.test(workflow),
    message: 'Publish miniapp workflow must pass RECO_APP_PROFILE to the remote upload script',
  },
  {
    ok: /APP_PROFILE="\$\{RECO_APP_PROFILE:-\$\{TARO_APP_PROFILE:-mall\}\}"/.test(uploadScript),
    message: 'Miniapp upload script must default to mall rather than all',
  },
  {
    ok: /verify_profile_dist\s*\(\)/.test(uploadScript)
      && /pages\/mall\/index\/index/.test(uploadScript)
      && /pages\/index\/index/.test(uploadScript),
    message: 'Miniapp upload script must verify the built app.json matches the selected profile before upload',
  },
]

for (const assertion of assertions) {
  if (!assertion.ok) {
    throw new Error(assertion.message)
  }
}

console.log(`Mall weapp profile checks passed (${assertions.length} checks).`)
