import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Toaster, toast } from 'sonner'
import { ThemeProvider, useTheme } from '@/components/ThemeProvider'

import { LanguageProvider, useTranslation } from '@/lib/i18n'
import { translations } from '@/lib/translations'
import { UpdaterModal, type UpdateInfo } from '@/components/UpdaterModal'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { Analytics } from '@vercel/analytics/react'

import appCss from '../styles.css?url'

function NotFoundComponent() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl text-primary font-bold">404</h1>
        <h2 className="mt-4 font-display text-2xl tracking-widest text-primary uppercase">
          {t('page_not_found')}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('page_not_found_desc')}
        </p>
        <div className="mt-6">
          <Link
            to="/"
            search={{ table: undefined }}
            className="inline-flex items-center justify-center rounded-md border border-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary/10"
          >
            {t('go_home')}
          </Link>
        </div>
      </div>
    </div>
  )
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error)
  const router = useRouter()
  const { t } = useTranslation()

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl tracking-widest text-primary uppercase font-bold">
          {t('server_error')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('server_error_desc')}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate()
              reset()
            }}
            className="inline-flex items-center justify-center rounded-md border border-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary/10"
          >
            {t('try_again')}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary/20"
          >
            {t('go_home')}
          </a>
        </div>
      </div>
    </div>
  )
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    loader: async () => {
      const { getLanguageFromCookie } = await import('@/server/i18n.functions')
      const lang = await getLanguageFromCookie()
      return { lang }
    },
    head: ({ loaderData }) => {
      const lang = (loaderData?.lang as 'en' | 'am') || 'en'
      const t = (key: string) =>
        (translations[lang] as any)[key] || (translations['en'] as any)[key]

      return {
        meta: [
          { charSet: 'utf-8' },
          { name: 'viewport', content: 'width=device-width, initial-scale=1' },
          { title: t('meta_title') },
          {
            name: 'description',
            content: t('meta_description'),
          },
          { name: 'author', content: 'Origin Restaurant' },
          { name: 'theme-color', content: '#0d0d0d' },
          {
            property: 'og:title',
            content: t('meta_title'),
          },
          {
            property: 'og:description',
            content: t('meta_description'),
          },
          { property: 'og:type', content: 'website' },
          { name: 'twitter:card', content: 'summary' },
          { name: 'twitter:site', content: '@Lovable' },
        ],
        links: [
          {
            rel: 'apple-touch-icon',
            sizes: '180x180',
            href: '/apple-touch-icon.png',
          },
          {
            rel: 'icon',
            type: 'image/png',
            sizes: '32x32',
            href: '/favicon-32x32.png',
          },
          {
            rel: 'icon',
            type: 'image/png',
            sizes: '16x16',
            href: '/favicon-16x16.png',
          },
          { rel: 'manifest', href: '/site.webmanifest' },
          { rel: 'shortcut icon', href: '/favicon.ico' },
          { rel: 'stylesheet', href: appCss },
          { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
          {
            rel: 'preconnect',
            href: 'https://fonts.gstatic.com',
            crossOrigin: 'anonymous',
          },
          {
            rel: 'stylesheet',
            href: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&family=Noto+Sans+Ethiopic:wght@400;600&display=swap',
          },
        ],
      }
    },
    shellComponent: RootShell,
    component: RootComponent,
    notFoundComponent: NotFoundComponent,
    errorComponent: ErrorComponent,
  },
)

function RootShell({ children }: { children: React.ReactNode }) {
  const themeScript = `
    (function() {
      try {
        var theme = localStorage.getItem('theme') || 'dark';
        document.documentElement.classList.add(theme);
      } catch (e) {
        document.documentElement.classList.add('dark');
      }
    })();
  `
  const i18nScript = `
    (function() {
      try {
        var lang = localStorage.getItem('origin_app_lang') || 'en';
        document.documentElement.lang = lang;
        if (lang === 'am') {
          document.documentElement.classList.add('font-amharic');
        } else {
          document.documentElement.classList.remove('font-amharic');
        }
      } catch (e) {}
    })();
  `
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: i18nScript }} />
        <HeadContent />
      </head>
      <body>
        <Analytics />
        <RootProviders>{children}</RootProviders>
        <Scripts />
      </body>
    </html>
  )
}

function RootProviders({ children }: { children: React.ReactNode }) {
  const { lang } = Route.useLoaderData()
  const { queryClient } = Route.useRouteContext()

  return (
    <LanguageProvider initialLang={lang}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </ThemeProvider>
    </LanguageProvider>
  )
}

function RootComponent() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => console.warn('SW Register Failed:', err))
    }
  }, [])

  return <RootInner />
}

function RootInner() {
  const { theme } = useTheme()
  const { t } = useTranslation()

  // Update State
  const [updateModalOpen, setUpdateModalOpen] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [updateStatus, setUpdateStatus] = useState<
    'idle' | 'downloading' | 'installing' | 'restarting' | 'complete' | 'error'
  >('idle')
  const [updateProgress, setUpdateProgress] = useState(0)
  const [totalSize, setTotalSize] = useState<number | null>(null)
  const [downloadedBytes, setDownloadedBytes] = useState(0)
  const [updateInstance, setUpdateInstance] = useState<any>(null)

  const handleApplyUpdate = async () => {
    if (!updateInstance) return
    setUpdateStatus('downloading')
    setUpdateProgress(0)
    setDownloadedBytes(0)

    try {
      let currentDownloaded = 0
      let currentTotal = 0

      await updateInstance.downloadAndInstall((event: any) => {
        if (event.event === 'Started') {
          const len = event.data.contentLength || 0
          currentTotal = len
          setTotalSize(len)
          setUpdateProgress(0)
        } else if (event.event === 'Progress') {
          currentDownloaded += event.data.chunkLength
          setDownloadedBytes(currentDownloaded)

          if (currentTotal > 0) {
            const pct = Math.floor((currentDownloaded / currentTotal) * 100)
            setUpdateProgress(Math.min(99, pct))
          }
        } else if (event.event === 'Finished') {
          setUpdateProgress(100)
          setUpdateStatus('installing')
        }
      })

      setUpdateStatus('restarting')
      // Short delay to show the "Restarting" state before the app actually closes
      setTimeout(async () => {
        await relaunch()
      }, 2000)
    } catch (err) {
      console.error('Update lifecycle failed:', err)
      setUpdateStatus('error')
    }
  }

  useEffect(() => {
    const handleOffline = () => {
      toast.error(t('connection_lost'), {
        description: t('connection_lost_desc'),
        duration: 5000,
      })
    }
    const handleOnline = () => {
      toast.success(t('back_online'), {
        description: t('back_online_desc'),
        duration: 3000,
      })
    }

    if (!navigator.onLine) {
      handleOffline()
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    // Post-Update Welcome Logic
    const currentVersion =
      typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.1'
    const lastSeenVersion = localStorage.getItem('origin_app_last_version')
    if (lastSeenVersion && lastSeenVersion !== currentVersion) {
      const cachedNotes = localStorage.getItem('origin_app_pending_notes')
      toast.success(`Welcome to Origin v${currentVersion}`, {
        description: t('update_ready'),
        duration: 8000,
        action: cachedNotes
          ? {
              label: "What's New",
              onClick: () => {
                setUpdateInfo({ version: currentVersion, notes: cachedNotes })
                setUpdateStatus('complete')
                setUpdateModalOpen(true)
              },
            }
          : undefined,
      })
    }
    localStorage.setItem('origin_app_last_version', currentVersion)

    // Tauri Update Check — delayed so user can log in first
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      const checkUpdate = async () => {
        try {
          const update = await check()
          if (update?.available) {
            const body =
              (update as any).body || 'Bug fixes and performance improvements.'
            localStorage.setItem('origin_app_pending_notes', body)
            setUpdateInfo({
              version: update.version,
              notes: body,
            })
            setUpdateInstance(update)
            setUpdateModalOpen(true)
          }
        } catch (err) {
          console.error('Update check failed:', err)
        }
      }
      // Wait 10s after mount so the user has plenty of time to type credentials
      const updateTimer = setTimeout(checkUpdate, 10000)
      return () => {
        clearTimeout(updateTimer)
        window.removeEventListener('offline', handleOffline)
        window.removeEventListener('online', handleOnline)
      }
    }
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  return (
    <>
      <Outlet />

      {/* Premium Updater Modal */}
      {updateModalOpen && (
        <UpdaterModal
          open={updateModalOpen}
          info={updateInfo}
          progress={updateProgress}
          status={updateStatus as any}
          downloadedBytes={downloadedBytes}
          totalSizeBytes={totalSize || 0}
          onUpdate={handleApplyUpdate}
          onCancel={() => setUpdateModalOpen(false)}
        />
      )}

      <Toaster
        position="bottom-right"
        theme={theme}
        toastOptions={{
          style:
            theme === 'dark'
              ? {
                  background: 'oklch(0.18 0.008 60)',
                  border: '1px solid oklch(1 0 0 / 8%)',
                  color: 'oklch(0.97 0.005 80)',
                  boxShadow: '0 8px 32px oklch(0 0 0 / 60%)',
                }
              : {
                  background: 'oklch(1 0 0)',
                  border: '1px solid oklch(0 0 0 / 10%)',
                  color: 'oklch(0.13 0.005 60)',
                  boxShadow: '0 8px 32px oklch(0 0 0 / 12%)',
                },
          classNames: {
            actionButton:
              theme === 'dark'
                ? 'bg-[oklch(0.72_0.19_45)] text-[oklch(0.13_0.005_60)] text-xs font-semibold rounded px-2 py-1'
                : 'bg-[oklch(0.66_0.2_45)] text-white text-xs font-semibold rounded px-2 py-1',
          },
        }}
      />
    </>
  )
}
