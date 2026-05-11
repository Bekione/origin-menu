import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'
import { useEffect } from 'react'
import { Toaster, toast } from 'sonner'
import { ThemeProvider, useTheme } from '@/components/ThemeProvider'

import appCss from '../styles.css?url'

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl text-primary">404</h1>
        <h2 className="mt-4 font-display text-2xl tracking-widest text-primary">
          PAGE NOT FOUND
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary/10"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  )
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error)
  const router = useRouter()

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl tracking-widest text-primary uppercase">
          SERVER ERROR
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back
          home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate()
              reset()
            }}
            className="inline-flex items-center justify-center rounded-md border border-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary/10"
          >
            Try Again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary/20"
          >
            Go Home
          </a>
        </div>
      </div>
    </div>
  )
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { title: 'Origin Restaurant — Fearless Flavor' },
        {
          name: 'description',
          content:
            'Origin Restaurant menu — fearless flavor served fresh in Addis Ababa. Scan, browse and order.',
        },
        { name: 'author', content: 'Origin Restaurant' },
        { name: 'theme-color', content: '#0d0d0d' },
        {
          property: 'og:title',
          content: 'Origin Restaurant — Fearless Flavor',
        },
        {
          property: 'og:description',
          content: "Browse Origin Restaurant's menu.",
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
    }),
    shellComponent: RootShell,
    component: RootComponent,
    notFoundComponent: NotFoundComponent,
    errorComponent: ErrorComponent,
  },
)

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext()

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RootInner />
      </QueryClientProvider>
    </ThemeProvider>
  )
}

function RootInner() {
  const { theme } = useTheme()

  useEffect(() => {
    const handleOffline = () => {
      toast.error('Connection lost', {
        description: 'You are currently offline. Changes may not be saved.',
        duration: 5000,
      })
    }
    const handleOnline = () => {
      toast.success('Back online', {
        description: 'Internet connection is restored.',
        duration: 3000,
      })
    }

    if (!navigator.onLine) {
      handleOffline()
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  return (
    <>
      <Outlet />
      <Toaster position="bottom-right" richColors theme={theme} />
    </>
  )
}
