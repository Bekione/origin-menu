/**
 * Utilities for interacting with the Tauri desktop shell.
 */

interface TauriNotificationPlugin {
  sendNotification(options: {
    title: string
    body?: string
    icon?: string
  }): void
  requestPermission(): Promise<'granted' | 'denied' | 'default'>
  isPermissionGranted(): Promise<boolean>
}

interface TauriWindow {
  __TAURI__?: {
    notification: TauriNotificationPlugin
    updater: any
    shell: any
  }
}

const getTauri = () => (window as unknown as TauriWindow).__TAURI__

/**
 * Checks if the app is running inside a Tauri shell.
 */
export const isDesktop = () => !!getTauri()

/**
 * Sends a native desktop notification if possible.
 */
export async function sendDesktopNotification(title: string, body?: string) {
  const tauri = getTauri()
  if (!tauri?.notification) return

  try {
    let granted = await tauri.notification.isPermissionGranted()
    if (!granted) {
      const permission = await tauri.notification.requestPermission()
      granted = permission === 'granted'
    }

    if (granted) {
      tauri.notification.sendNotification({ title, body })
    }
  } catch (err) {
    console.error('Failed to send desktop notification', err)
  }
}
