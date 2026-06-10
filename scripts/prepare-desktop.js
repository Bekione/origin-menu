import fs from 'node:fs'
import path from 'node:path'

/**
 * Super simple .env parser to avoid extra dependencies
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

const VERCEL_URL = (
  env.VITE_VERCEL_URL || 'https://originrestaurant-menu.vercel.app'
).replace(/\/$/, '')
const UPDATER_ADMIN =
  env.VITE_UPDATER_ENDPOINT || `${VERCEL_URL}/updater-admin.json`
const UPDATER_KDS =
  env.VITE_KDS_UPDATER_ENDPOINT || `${VERCEL_URL}/updater-kds.json`

/**
 * Injects env vars into Splash Screen index.html files
 */
function prepareSplashScreens() {
  const targets = [
    { dir: 'src-tauri-admin/ui', suffix: 'admin' },
    { dir: 'src-tauri-kds/ui', suffix: 'staff' },
  ]

  targets.forEach(({ dir, suffix }) => {
    const htmlPath = path.join(process.cwd(), dir, 'index.html')
    if (!fs.existsSync(htmlPath)) return

    let content = fs.readFileSync(htmlPath, 'utf8')

    // Replace URL definitions
    content = content.replace(
      /const VERCEL_URL = '.*?'/g,
      `const VERCEL_URL = '${VERCEL_URL}/${suffix}'`,
    )
    // Replace fetch calls
    content = content.replace(/fetch\('.*?'/g, `fetch('${VERCEL_URL}/'`)

    fs.writeFileSync(htmlPath, content)
    console.log(`[Prepare] Updated splash screen at ${htmlPath}`)
  })
}

/**
 * Handles variable substitution in tauri.conf.json and capabilities files
 * USES THE .template PATTERN TO KEEP SOURCE DRY
 */
function prepareTauriConfigs() {
  const targets = [
    { dir: 'src-tauri-admin', updater: UPDATER_ADMIN },
    { dir: 'src-tauri-kds', updater: UPDATER_KDS },
  ]

  targets.forEach(({ dir, updater }) => {
    // 1. Process tauri.conf.json
    const configTpl = path.join(process.cwd(), dir, 'tauri.conf.json.template')
    const configDest = path.join(process.cwd(), dir, 'tauri.conf.json')
    if (fs.existsSync(configTpl)) {
      let content = fs.readFileSync(configTpl, 'utf8')
      content = content.replace(/%VITE_VERCEL_URL%/g, VERCEL_URL)
      content = content.replace(/%VITE_UPDATER_ENDPOINT%/g, updater)
      content = content.replace(/%VITE_KDS_UPDATER_ENDPOINT%/g, updater)
      fs.writeFileSync(configDest, content)
      console.log(`[Prepare] Generated Tauri config from template at ${dir}`)
    }

    // 2. Process capabilities/default.json
    const capTpl = path.join(
      process.cwd(),
      dir,
      'capabilities/default.json.template',
    )
    const capDest = path.join(process.cwd(), dir, 'capabilities/default.json')
    if (fs.existsSync(capTpl)) {
      let content = fs.readFileSync(capTpl, 'utf8')
      content = content.replace(/%VITE_VERCEL_URL%/g, VERCEL_URL)
      fs.writeFileSync(capDest, content)
      console.log(`[Prepare] Generated Capabilities from template at ${dir}`)
    }
  })
}

prepareSplashScreens()
prepareTauriConfigs()
