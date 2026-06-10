/**
 * Utilities for interacting with the Tauri v2 desktop shell.
 * All functions are safe to call in a browser — they no-op gracefully if not in Tauri.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export type NotificationType = 'order' | 'waiter'

// Action IDs sent with notifications so we can route clicks
const ACTION_OPEN_ORDERS = 'open-orders'
const ACTION_OPEN_WAITER_CALLS = 'open-waiter-calls'

// ─── Environment ───────────────────────────────────────────────────────────

/**
 * Checks if the app is running inside a Tauri shell.
 */
export const isDesktop = (): boolean =>
  typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__

// ─── Notification ──────────────────────────────────────────────────────────

/**
 * Registers notification action categories for deep-linking on click.
 * Call this ONCE on admin mount.
 */
export async function initNotificationActions() {
  if (!isDesktop()) return
  try {
    const { registerActionTypes } =
      await import('@tauri-apps/plugin-notification')
    await registerActionTypes([
      {
        id: 'order',
        actions: [
          {
            id: ACTION_OPEN_ORDERS,
            title: 'View Orders',
            foreground: true,
          },
        ],
      },
      {
        id: 'waiter',
        actions: [
          {
            id: ACTION_OPEN_WAITER_CALLS,
            title: 'View Waiter Calls',
            foreground: true,
          },
        ],
      },
    ])
  } catch (err) {
    console.error('[Desktop] Failed to register notification action types', err)
  }
}

/**
 * Proactively restores and focuses the application window.
 */
async function focusWindow() {
  if (!isDesktop()) return
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const appWindow = getCurrentWindow()
    await appWindow.unminimize()
    await appWindow.show()
    await appWindow.setFocus()
  } catch (err) {
    console.error('[Desktop] Failed to focus window', err)
  }
}

/**
 * Listens for clicks on desktop notifications and routes accordingly.
 * @param callbacks - { onOrder: () => void, onWaiterCall: () => void }
 * Call this ONCE on admin mount after initNotificationActions.
 */
export async function listenNotificationActions(callbacks: {
  onOrder: () => void
  onWaiterCall: () => void
}) {
  if (!isDesktop()) return
  try {
    const { onAction } = await import('@tauri-apps/plugin-notification')

    onAction(async (notification) => {
      // Focus/restore the window first
      await focusWindow()

      const actionId = (notification as any).action?.id
      const channelId =
        (notification as any).notification?.channelId ??
        (notification as any).channelId

      if (actionId === ACTION_OPEN_ORDERS || channelId === 'order') {
        callbacks.onOrder()
      } else if (
        actionId === ACTION_OPEN_WAITER_CALLS ||
        channelId === 'waiter'
      ) {
        callbacks.onWaiterCall()
      }
    })
  } catch (err) {
    console.error(
      '[Desktop] Failed to set up notification action listener',
      err,
    )
  }
}

/**
 * Sends a native desktop notification if running in Tauri.
 * @param title - Notification title
 * @param body - Optional subtitle
 * @param type - 'order' | 'waiter' — determines channelId for deep-linking on click
 */
export async function sendDesktopNotification(
  title: string,
  body?: string,
  type: NotificationType = 'order',
) {
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
      sendNotification({
        title,
        body,
        // channelId maps to the action type registered in initNotificationActions
        channelId: type,
      } as any)
    }
  } catch (err) {
    console.error('[Desktop] Failed to send desktop notification', err)
  }
}

// ─── Taskbar Badge ──────────────────────────────────────────────────────────

/**
 * Updates the taskbar icon badge with the total notification count.
 * - Windows: uses setOverlayIcon with badge-dot.ico (on/off only; no numeric)
 * - macOS / Linux: uses setBadgeCount for numeric badge
 *
 * @param totalCount - Sum of pending orders + active waiter calls
 */
export async function updateTaskbarBadge(totalCount: number) {
  if (!isDesktop()) return
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const appWindow = getCurrentWindow()

    // Windows: use overlay icon (binary on/off)
    if (navigator.userAgent.includes('Windows')) {
      try {
        if (totalCount > 0) {
          const { resolveResource } = await import('@tauri-apps/api/path')
          const { Image } = await import('@tauri-apps/api/image')

          // Resolve path to the bundled resource we added in tauri.conf.json
          const resourcePath = await resolveResource('icons/badge-dot.ico')
          const img = await Image.fromPath(resourcePath)

          await (appWindow as any).setOverlayIcon(img)
        } else {
          await (appWindow as any).setOverlayIcon(null)
        }
      } catch (err) {
        console.error('[Desktop] Failed to set Windows overlay icon', err)
      }
      return
    }

    // macOS / Linux: numeric badge
    try {
      await (appWindow as any).setBadgeCount(
        totalCount > 0 ? totalCount : undefined,
      )
    } catch {
      // fail silently on platforms that don't support it
    }
  } catch (err) {
    console.error('[Desktop] Failed to update taskbar badge', err)
  }
}
