import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

/**
 * Super simple .env parser
 */
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return {}

  const env = {}
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  lines.forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
    if (match) {
      let value = (match[2] || '').trim()
      if (value.startsWith('"') && value.endsWith('"'))
        value = value.slice(1, -1)
      if (value.startsWith("'") && value.endsWith("'"))
        value = value.slice(1, -1)
      env[match[1]] = value
    }
  })
  return env
}

const env = loadEnv()
const target = process.argv[2] // 'admin' or 'kds'

if (!target) {
  console.error('Usage: node scripts/release-desktop.js [admin|kds]')
  process.exit(1)
}

const tauriDir = target === 'admin' ? 'src-tauri-admin' : 'src-tauri-kds'

console.log(`[Release] Starting build for ${target}...`)

// Set environment variables for the child process
const processEnv = {
  ...process.env,
  ...env,
  TAURI_SIGNING_PRIVATE_KEY:
    env.TAURI_SIGNING_PRIVATE_KEY || process.env.TAURI_SIGNING_PRIVATE_KEY,
}

// Run tauri build
const build = spawn('npx', ['tauri', 'build'], {
  cwd: path.join(process.cwd(), tauriDir),
  env: processEnv,
  shell: true,
  stdio: 'inherit',
})

build.on('close', (code) => {
  if (code === 0) {
    console.log(`[Release] Successfully built ${target}!`)
  } else {
    console.error(`[Release] Build failed with code ${code}`)
    process.exit(code)
  }
})
