/**
 * Utilities for interacting with the Tauri v2 desktop shell.
 *
 * NOTE: Notification card click deep-linking is NOT supported on Windows
 * with tauri-plugin-notification v2. The plugin uses notify_rust under the
 * hood which discards the notification handle on Desktop, so no click
 * callbacks can be wired. The Web Notification onclick also does not fire
 * in WebView2. Notifications are fire-and-forget on Desktop.
 */

// ─── Environment ───────────────────────────────────────────────────────────

export const isDesktop = (): boolean => {
  if (typeof window === 'undefined') return false
  const win = window as any
  return !!(win.__TAURI_INTERNALS__ || win.__TAURI__ || win.__TAURI_METADATA__)
}

// ─── Notifications ─────────────────────────────────────────────────────────

/**
 * Sends a native desktop notification (fire-and-forget).
 * Uses the plugin's permission flow then falls back to window.Notification.
 */
export async function sendDesktopNotification(
  title: string,
  body?: string,
): Promise<void> {
  if (!isDesktop()) return
  try {
    const { isPermissionGranted, requestPermission, sendNotification } =
      await import('@tauri-apps/plugin-notification')

    let granted = await isPermissionGranted()
    if (!granted) {
      const permission = await requestPermission()
      granted = permission === 'granted'
    }

    if (granted) {
      sendNotification({ title, body })
    }
  } catch (err) {
    console.error('[Desktop] Failed to send notification', err)
  }
}

// ─── Taskbar Badge ──────────────────────────────────────────────────────────

/**
 * Generates a dynamic numeric badge icon using Canvas (32×32 RGBA).
 */
function generateBadgeRGBA(count: number): {
  data: Uint8Array
  width: number
  height: number
} {
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  if (!ctx) throw new Error('Canvas context not available')

  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
  ctx.fillStyle = '#ff4b4b'
  ctx.fill()

  ctx.strokeStyle = 'white'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.fillStyle = 'white'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const displayText = count > 99 ? '99+' : count.toString()
  const fontSize = count > 9 ? size * 0.5 : size * 0.7
  ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`
  ctx.fillText(displayText, size / 2, size / 2 + 1)

  const imageData = ctx.getImageData(0, 0, size, size)
  return { data: new Uint8Array(imageData.data), width: size, height: size }
}

/**
 * Updates the taskbar overlay badge with the current notification count.
 * Windows: Canvas-generated RGBA icon via setOverlayIcon.
 * macOS/Linux: Native setBadgeCount.
 */
export async function updateTaskbarBadge(totalCount: number) {
  if (!isDesktop()) return
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const appWindow = getCurrentWindow()

    if (navigator.userAgent.includes('Windows')) {
      try {
        if (totalCount > 0) {
          const { Image } = await import('@tauri-apps/api/image')
          if (typeof (appWindow as any).setOverlayIcon !== 'function') return

          const { data, width, height } = generateBadgeRGBA(totalCount)
          const ImageClass = Image as any
          let img
          if (typeof ImageClass.fromRgbaBytes === 'function') {
            img = await ImageClass.fromRgbaBytes(data, width, height)
          } else if (typeof ImageClass.new === 'function') {
            img = await ImageClass.new(data, width, height)
          } else {
            return
          }
          await (appWindow as any).setOverlayIcon(img)
        } else {
          await (appWindow as any).setOverlayIcon(null)
        }
      } catch (err) {
        console.error('[Desktop] Failed to set Windows overlay icon', err)
      }
      return
    }

    // macOS / Linux
    try {
      if ((appWindow as any).setBadgeCount) {
        await (appWindow as any).setBadgeCount(
          totalCount > 0 ? totalCount : undefined,
        )
      }
    } catch {
      // Fail silently on unsupported distros
    }
  } catch (err) {
    console.error('[Desktop] Failed to update taskbar badge', err)
  }
}
