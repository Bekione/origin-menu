/**
 * Utilities for interacting with the Tauri v2 desktop shell.
 * Focused strictly on Windows/Desktop functionality.
 */

// ─── Environment ───────────────────────────────────────────────────────────

/**
 * Robust check for Tauri environment.
 */
export const isDesktop = (): boolean => {
  if (typeof window === 'undefined') return false
  const win = window as any
  return !!(win.__TAURI_INTERNALS__ || win.__TAURI__ || win.__TAURI_METADATA__)
}

// ─── Notification ──────────────────────────────────────────────────────────

/**
 * Listens for notification-related window focus events.
 * On Windows, clicking a notification focuses the app automatically via the OS.
 * We just ensure the window is restored if it was minimized/hidden.
 */
export async function listenNotificationActions(_callbacks: {
  onOrder: () => void
  onWaiterCall: () => void
}) {
  // On Windows, native notification clicks are handled by the OS shell.
  // The window is raised automatically. No custom listener needed.
  // Deep-linking not supported on Desktop in Tauri v2 without mobile actions.
  return
}

/**
 * Sends a native desktop notification if running in Tauri.
 * Kept intentionally minimal — additional fields like channelId or id
 * can cause silent failures on Windows when not registered.
 */
export async function sendDesktopNotification(title: string, body?: string) {
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
    console.error('[Desktop] Failed to send desktop notification', err)
  }
}

// ─── Taskbar Badge ──────────────────────────────────────────────────────────

/**
 * Generates a dynamic notification badge icon using Canvas.
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

  // Draw Circle (Red)
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
  ctx.fillStyle = '#ff4b4b'
  ctx.fill()

  // Draw Border (White)
  ctx.strokeStyle = 'white'
  ctx.lineWidth = 2
  ctx.stroke()

  // Draw Number (White)
  ctx.fillStyle = 'white'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const displayText = count > 99 ? '99+' : count.toString()
  const fontSize = count > 9 ? size * 0.5 : size * 0.7
  ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`

  ctx.fillText(displayText, size / 2, size / 2 + 1)

  const imageData = ctx.getImageData(0, 0, size, size)
  return {
    data: new Uint8Array(imageData.data),
    width: size,
    height: size,
  }
}

/**
 * Updates the taskbar icon badge with the total notification count.
 */
export async function updateTaskbarBadge(totalCount: number) {
  if (!isDesktop()) return
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const appWindow = getCurrentWindow()

    // Windows Dynamic Numeric Overlay
    if (navigator.userAgent.includes('Windows')) {
      try {
        if (totalCount > 0) {
          const { Image } = await import('@tauri-apps/api/image')

          if (typeof (appWindow as any).setOverlayIcon !== 'function') {
            return
          }

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

    // macOS / Linux Native Numeric Badge
    try {
      if ((appWindow as any).setBadgeCount) {
        await (appWindow as any).setBadgeCount(
          totalCount > 0 ? totalCount : undefined,
        )
      }
    } catch {
      // Fail silently
    }
  } catch (err) {
    console.error('[Desktop] Failed to update taskbar badge', err)
  }
}

// ─── Legacy Cleanup ────────────────────────────────────────────────────────
export async function initNotificationActions() {}
