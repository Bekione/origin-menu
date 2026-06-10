import React, { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  Search,
  MapPin,
  Instagram,
  Leaf,
  Flame,
  Sparkles,
  Menu as MenuIcon,
  X,
  Clock,
  Phone,
  UtensilsCrossed,
  Utensils,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  ChevronUp,
  Wifi,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Copy,
  Star,
  Loader2,
  ScanLine,
  Bell,
  Facebook,
  Send,
  Youtube,
  MessageCircle,
  LayoutGrid,
  LayoutList,
  Salad,
  Wheat,
  MilkOff,
  Bean,
  Heart,
} from 'lucide-react'
import {
  getMenuData,
  type MenuData,
  type MenuItem,
  type Category,
} from '@/server/menu.functions'
import logo from '@/assets/origin-logo.jpg'
import logoGray from '@/assets/origin-logo-gray.png'
import ScrollFade from '@/components/ScrollFade'
import { Skeleton } from '@/components/ui/skeleton'
import { ThemeToggle } from '@/components/ThemeToggle'
import { toast } from 'sonner'
import {
  callWaiter,
  verifyTableToken,
  placeOrder,
  recordQrScan,
} from '@/server/table.functions'
import { CartProvider, useCart } from '@/components/CartProvider'
import {
  getDeviceId,
  isRateLimitedLocally,
  recordWaiterCall,
} from '@/lib/device-fingerprint'
import { submitFeedback } from '@/server/feedback.functions'
import { getMyOrders, type TableOrder } from '@/server/table.functions'
import { LoyaltyFloatingButton } from '@/components/LoyaltyCard'
import { AIChatDrawer } from '@/components/AIChatDrawer'
import { Drawer } from 'vaul'
import { optimizeImage } from '@/lib/image'
import { MediaSlideshow } from '@/components/MediaSlideshow'
import { getMediaType } from '@/lib/media'
import { getServerData } from '@/server/i18n.functions'
import { supabaseBrowser } from '@/integrations/supabase/client.browser'

type SearchOptions = {
  table?: number
  t?: string // QR table token
  tags?: string
}

export const Route = createFileRoute('/')({
  loader: async () => {
    const [menuData, serverData] = await Promise.all([
      getMenuData(),
      getServerData(),
    ])
    return { ...menuData, ...serverData }
  },
  validateSearch: (search: Record<string, unknown>): SearchOptions => ({
    table: search.table ? Number(search.table) : undefined,
    t: typeof search.t === 'string' ? search.t : undefined,
    tags: typeof search.tags === 'string' ? search.tags : undefined,
  }),
  component: MenuPage,
  pendingComponent: MenuSkeleton,
  pendingMs: 0,
})

import { useTranslation } from '@/lib/i18n'

type FilterTag = string

function formatBirr(n: number) {
  return new Intl.NumberFormat('en-US').format(n)
}

const FEEDBACK_DONE_KEY = 'origin_feedback_submitted_date'
const SESSION_KEY = 'origin_table_session'

function MenuPage() {
  const {
    categories,
    items,
    info,
    layout: initialLayout,
  } = Route.useLoaderData() as MenuData & { layout: 'list' | 'grid' }

  return (
    <CartProvider>
      <MenuPageInner
        categories={categories}
        items={items}
        info={info}
        initialLayout={initialLayout}
      />
    </CartProvider>
  )
}

function MenuPageInner({
  categories,
  items: initialItems,
  info,
  initialLayout,
}: {
  categories: Category[]
  items: MenuItem[]
  info: any
  initialLayout: 'list' | 'grid'
}) {
  const { lang, setLang, t, dt } = useTranslation()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const table = search.table
  const qrToken = search.t
  type TableSession = { token: string; tableId: string; tableLabel: string }
  // Live items state — updated in real-time from Supabase
  const [liveItems, setLiveItems] = useState<MenuItem[]>(initialItems)

  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [pastOrders, setPastOrders] = useState<TableOrder[]>([])
  const [isReturning, setIsReturning] = useState(false)

  useEffect(() => {
    getDeviceId().then((id) => {
      setDeviceId(id)
      if (id) {
        getMyOrders({ data: { device_id: id } }).then((orders) => {
          setPastOrders(orders)
          if (orders.length > 0) setIsReturning(true)
        })
      }
    })
  }, [])

  // Calculate favorites (top 3 most ordered items)
  const favorites = useMemo(() => {
    if (pastOrders.length === 0) return []
    const counts: Record<string, number> = {}
    pastOrders.forEach((o) => {
      o.items.forEach((it) => {
        counts[it.id] = (counts[it.id] ?? 0) + it.qty
      })
    })
    const sortedIds = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id)
    return liveItems.filter((i) => sortedIds.includes(i.id))
  }, [pastOrders, liveItems])

  const FEEDBACK_SKIP_KEY = 'origin_feedback_skips'
  const MAX_DAILY_SKIPS = 2

  const handleFeedbackSkip = () => {
    const today = new Date().toDateString()
    try {
      const raw = localStorage.getItem(FEEDBACK_SKIP_KEY)
      const stored = raw ? JSON.parse(raw) : {}
      const todayCount = stored.date === today ? (stored.count ?? 0) : 0
      localStorage.setItem(
        FEEDBACK_SKIP_KEY,
        JSON.stringify({ date: today, count: todayCount + 1 }),
      )
    } catch {
      // ignore
    }
    setFeedbackOpen(false)
  }

  // Real-time subscription to menu_items availability changes
  useEffect(() => {
    const channel = supabaseBrowser
      .channel('menu-availability')
      .on('broadcast', { event: 'toggle' }, (payload: any) => {
        const { id, is_available } = payload.payload
        setLiveItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, is_available } : item,
          ),
        )

        // If the item became unavailable, remove it from the cart across all UI
        if (!is_available) {
          // We use a custom event to tell the CartProvider to remove this item
          window.dispatchEvent(
            new CustomEvent('origin:cart:remove', {
              detail: { id },
            }),
          )
        }
      })
      .subscribe()

    // Real-time listener for order status changes (to trigger feedback)
    const orderChannel = supabaseBrowser
      .channel('origin-realtime')
      .on(
        'broadcast',
        { event: 'order_status_updated' },
        async ({ payload }) => {
          const order = payload as TableOrder
          const did = await getDeviceId()
          if (order.device_id === did && order.status === 'completed') {
            // Only show if not already submitted today AND hasn't been skipped enough times
            const today = new Date().toDateString()
            const lastDone = localStorage.getItem(FEEDBACK_DONE_KEY)
            if (lastDone === today) return
            try {
              const skipRaw = localStorage.getItem(FEEDBACK_SKIP_KEY)
              const skips = skipRaw ? JSON.parse(skipRaw) : {}
              if (skips.date === today && (skips.count ?? 0) >= MAX_DAILY_SKIPS)
                return
            } catch {
              /* ignore */
            }
            setFeedbackOpen(true)
          }
        },
      )
      .subscribe()

    return () => {
      supabaseBrowser.removeChannel(channel)
      supabaseBrowser.removeChannel(orderChannel)
    }
  }, [FEEDBACK_DONE_KEY]) // Added FEEDBACK_DONE_KEY to deps although it's constant

  // Check for completed orders on mount (in case status changed while offline/reloading)
  useEffect(() => {
    const check = async () => {
      const today = new Date().toDateString()
      const lastDone = localStorage.getItem(FEEDBACK_DONE_KEY)
      if (lastDone === today) return
      // Also skip if already skipped too many times today
      try {
        const skipRaw = localStorage.getItem(FEEDBACK_SKIP_KEY)
        const skips = skipRaw ? JSON.parse(skipRaw) : {}
        if (skips.date === today && (skips.count ?? 0) >= MAX_DAILY_SKIPS)
          return
      } catch {
        /* ignore */
      }

      try {
        const did = await getDeviceId()
        const myOrders = await getMyOrders({ data: { device_id: did } })
        const hasCompleted = myOrders.some((o) => o.status === 'completed')
        if (hasCompleted) {
          setFeedbackOpen(true)
        }
      } catch (err) {
        console.error('Failed to check orders for feedback:', err)
      }
    }
    check()
  }, [FEEDBACK_DONE_KEY])

  // Table session state (from QR scan) — intentionally starts null to avoid SSR/client hydration mismatch
  const [tableSession, setTableSession] = useState<TableSession | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      setTableSession(raw ? JSON.parse(raw) : null)
    } catch {
      setTableSession(null)
    }
  }, [])

  const [query, setQuery] = useState('')
  const activeFilters = useMemo(
    () => new Set((search.tags ? search.tags.split(',') : []) as FilterTag[]),
    [search.tags],
  )
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [navOpen, setNavOpen] = useState(false)
  const [billOpen, setBillOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [isCalling, setIsCalling] = useState(false)
  const { count, total } = useCart()
  const [previewMedia, setPreviewMedia] = useState<{
    items: string[]
    name: string
    index: number
  } | null>(null)
  // Layout toggle — 'list' (default) or 'grid'
  const [layout, setLayout] = useState<'list' | 'grid'>(initialLayout)

  const toggleLayout = () => {
    setLayout((prev) => {
      const next = prev === 'list' ? 'grid' : 'list'
      localStorage.setItem('menu_layout', next)
      // Set cookie for SSR (expires in 1 year)
      document.cookie = `menu_layout=${next};path=/;max-age=${60 * 60 * 24 * 365}`
      return next
    })
  }

  const handleCallWaiter = async () => {
    // Determine table number: prefer URL param, fall back to session label (parse digit)
    const tableNum = table
      ? Number(table)
      : tableSession
        ? parseInt(tableSession.tableLabel.replace(/\D/g, ''), 10) || 1
        : null

    if (tableNum === null) return

    const maxTables = info?.max_tables ?? 999
    if (isNaN(tableNum) || tableNum < 1 || tableNum > maxTables) {
      toast(t('verify_error')) // Generic error if table invalid
      return
    }

    // Local device rate-limit check (fast fail)
    if (isRateLimitedLocally(tableNum)) {
      toast(t('waiter_already_on_way'), { duration: 5000 })
      return
    }

    try {
      setIsCalling(true)
      const did = await getDeviceId()
      const lbl = tableSession ? tableSession.tableLabel : `Table ${tableNum}`
      await callWaiter({
        data: { table_label: lbl, device_id: did },
      })
      recordWaiterCall(tableNum)
      toast(t('waiter_calling_toast').replace('{tableLabel}', lbl), {
        duration: 5000,
      })
    } catch (e: any) {
      const raw: string = e.message || ''
      const isRateLimit = raw.toLowerCase().includes('already on their way')
      const errMsg = isRateLimit
        ? t('waiter_already_on_way')
        : raw || t('error_general')
      toast(errMsg)
    } finally {
      setIsCalling(false)
    }
  }

  // Verify QR token from URL on mount
  useEffect(() => {
    if (!qrToken) return
    // Skip if session already matches this token
    if (tableSession?.token === qrToken) return
    verifyTableToken({ data: { token: qrToken } })
      .then((result) => {
        const session: TableSession = {
          token: qrToken,
          tableId: result.id,
          tableLabel: result.label,
        }
        localStorage.setItem(SESSION_KEY, JSON.stringify(session))
        setTableSession(session)
        toast.success(`Dining at ${result.label} — welcome!`, {
          duration: 4000,
        })
        navigate({ search: (p) => ({ ...p, t: undefined }), replace: true })

        // Fire-and-forget: record the QR scan for analytics
        getDeviceId().then((did) => {
          recordQrScan({
            data: {
              table_id: result.id,
              table_label: result.label,
              device_id: did,
            },
          }).catch(() => {
            /* silently ignore in production */
          })
        })
      })
      .catch(() => {
        // Token invalid — clear any stale session
        localStorage.removeItem(SESSION_KEY)
        setTableSession(null)
        toast.error(t('invalid_qr'))
      })
  }, [qrToken])

  useEffect(() => {
    if (!activeCat && categories[0]) setActiveCat(categories[0].id)
  }, [categories, activeCat])

  const toggleFilter = (tag: FilterTag) => {
    const next = new Set(activeFilters)
    if (next.has(tag)) next.delete(tag)
    else next.add(tag)

    navigate({
      search: (prev) => ({
        ...prev,
        tags: next.size > 0 ? Array.from(next).join(',') : undefined,
      }),
      replace: true,
    })
  }

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase()
    return categories.map((c) => ({
      cat: c,
      items: liveItems.filter((i) => {
        if (i.category_id !== c.id) return false
        if (activeFilters.size > 0) {
          const isMatch = Array.from(activeFilters).every((f) => {
            if (f === 'special') return i.is_special || i.is_featured
            if (f === 'veg') return i.is_vegetarian
            if (f === 'fasting') return i.is_fasting
            if (f === 'spicy') return i.is_spicy

            // Dynamic Dietary Tags mapping label -> id
            const tags = ((i as any).dietary as string[]) || []
            const tagObj = ((info as any)?.dietary_tags as any[])?.find(
              (tg) => tg.label === f,
            )
            return tagObj && tags.includes(tagObj.id)
          })
          if (!isMatch) return false
        }
        return (
          q === '' ||
          i.name.toLowerCase().includes(q) ||
          (i.name_am ?? '').toLowerCase().includes(q) ||
          (i.description ?? '').toLowerCase().includes(q)
        )
      }),
    }))
  }, [categories, liveItems, query, activeFilters, info])

  const featured = liveItems
    .filter((i) => {
      if (!i.is_featured || !i.is_available) return false
      if (activeFilters.size > 0) {
        const isMatch = Array.from(activeFilters).every((f) => {
          if (f === 'special') return i.is_special || i.is_featured
          if (f === 'veg') return i.is_vegetarian
          if (f === 'fasting') return i.is_fasting
          if (f === 'spicy') return i.is_spicy

          // Dynamic Dietary Tags mapping label -> id
          const tags = ((i as any).dietary as string[]) || []
          const tagObj = ((info as any)?.dietary_tags as any[])?.find(
            (tg) => tg.label === f,
          )
          return tagObj && tags.includes(tagObj.id)
        })
        if (!isMatch) return false
      }
      return true
    })
    .slice(0, 6)

  const scrollTo = (id: string) => {
    setActiveCat(id)
    setNavOpen(false)
    const el = document.getElementById(`cat-${id}`)
    if (el) {
      const headerOffset = 160
      const elementPosition = el.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' })
    }
  }

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      {/* Decorative Background Watermark */}
      <div
        className="pointer-events-none fixed right-0 top-[20%] -z-10 h-[80vw] w-[80vw] max-h-[1000px] max-w-[1000px] translate-x-[20%] opacity-[0.03] mix-blend-overlay dark:opacity-[0.05]"
        style={{
          backgroundImage: `url(${logoGray})`,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          transform: 'rotate(-10deg)',
          filter: 'grayscale(100%)',
        }}
      />
      {/* Global Promo Banner */}
      {info?.promo_banner_active &&
        (info?.promo_banner_text || (info as any)?.promo_banner_text_am) && (
          <button
            onClick={(e) => {
              const itemId = (info as any).promo_banner_item_id
              if (itemId) {
                const el = document.getElementById(`item-${itemId}`)
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  el.classList.add(
                    'border-primary',
                    'scale-[1.02]',
                    'shadow-[0_0_15px_rgba(234,88,12,0.3)]',
                  )
                  setTimeout(() => {
                    el.classList.remove(
                      'border-primary',
                      'scale-[1.02]',
                      'shadow-[0_0_15px_rgba(234,88,12,0.3)]',
                    )
                  }, 2000)
                }
              } else if (info.promo_banner_url) {
                window.open(info.promo_banner_url, '_blank')
              }
            }}
            className="flex min-h-[40px] w-full cursor-pointer items-center justify-center bg-primary px-4 py-2 text-center text-xs font-bold uppercase leading-none tracking-widest text-primary-foreground hover:opacity-90"
          >
            <span className="translate-y-[0.5px]">
              {dt(info as any, 'promo_banner_text')}
            </span>
            {(info.promo_banner_url || (info as any).promo_banner_item_id) && (
              <ChevronDown className="ml-1 h-3 w-3 shrink-0 translate-y-[0.5px]" />
            )}
          </button>
        )}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-lg">
        <div className="mx-auto flex h-20 max-w-3xl items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <img
              src={logo}
              alt="Origin"
              className="h-14 w-14 rounded-full bg-white p-1.5 shadow-sm"
            />
            <div className="flex flex-col leading-tight">
              <span className="font-display text-xl text-primary">
                {info?.name ?? t('origin')}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {dt(info, 'tagline') || t('fearless_flavor')}
              </span>
            </div>
            {/* Table Badge and Waiter Action */}
            {table && (
              <div className="hidden items-center gap-2 border-l border-border pl-4 md:flex">
                <span className="rounded-full bg-primary/10 px-3 py-1 font-display text-sm text-primary">
                  {t('table')} {table}
                </span>
                <button
                  onClick={handleCallWaiter}
                  disabled={isCalling}
                  className="rounded-full bg-secondary/80 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-secondary-foreground transition hover:bg-secondary disabled:opacity-50"
                >
                  {isCalling ? t('calling') : t('call_waiter')}
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === 'en' ? 'am' : 'en')}
              className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground transition hover:border-primary hover:text-primary"
              aria-label="Toggle language"
            >
              {lang === 'en' ? 'አማ' : 'EN'}
            </button>
            <ThemeToggle />
            <button
              onClick={() => setNavOpen((v) => !v)}
              className="rounded-md border border-border p-1.5 text-primary md:hidden"
              aria-label="Toggle menu"
            >
              {navOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <MenuIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* QR Dine-in Session Banner — constrained to page width like the rest */}
        {tableSession ? (
          <div className="border-t border-primary/20 bg-primary/5 px-4 py-2">
            <div className="mx-auto flex max-w-3xl items-center justify-between md:px-4">
              <span className="font-display text-sm text-primary">
                {tableSession.tableLabel}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCallWaiter}
                  disabled={isCalling}
                  className="flex items-center gap-1.5 rounded-full bg-secondary/80 px-3 py-1 text-xs font-bold uppercase tracking-wider text-secondary-foreground transition hover:bg-secondary disabled:opacity-50"
                >
                  <Bell className="h-3 w-3" />
                  {isCalling ? t('calling') : t('call_waiter')}
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem(SESSION_KEY)
                    setTableSession(null)
                    toast(t('session_cleared'))
                  }}
                  className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                >
                  {t('leave')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          table && (
            <div className="border-t border-border bg-card/60 px-4 py-2">
              <div className="mx-auto flex max-w-3xl items-center justify-between md:hidden">
                <span className="font-display text-sm text-primary">
                  {t('table')} {table}
                </span>
                <button
                  onClick={handleCallWaiter}
                  disabled={isCalling}
                  className="rounded-full bg-secondary/80 px-4 py-1 text-xs font-bold uppercase tracking-wider text-secondary-foreground transition hover:bg-secondary disabled:opacity-50"
                >
                  {isCalling ? t('calling') : t('call_waiter')}
                </button>
              </div>
            </div>
          )
        )}

        <div className="border-t border-border">
          <div className="mx-auto max-w-3xl">
            <ScrollFade direction="horizontal">
              <div className="scrollbar-none flex gap-2 overflow-x-auto px-4 py-2">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => scrollTo(c.id)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                      activeCat === c.id
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                    }`}
                  >
                    {dt(c, 'name')}
                  </button>
                ))}
              </div>
            </ScrollFade>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-32 pt-6">
        {/* Hero */}
        <section className="relative mb-6 overflow-hidden rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          {/* Decorative Hero Background Skew */}
          <div className="absolute -right-10 -top-10 h-48 w-48 opacity-[0.04] dark:opacity-[0.08] rotate-12 scale-150 pointer-events-none transition-transform duration-1000 ease-out hover:rotate-6">
            <img
              src={logoGray}
              alt=""
              className="object-contain h-full w-full"
            />
          </div>
          <h1 className="relative z-10 font-display text-5xl tracking-widest text-primary drop-shadow-sm">
            {isReturning ? t('welcome_back') : t('welcome')}
          </h1>
          <p className="relative z-10 mt-3 text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
            {isReturning
              ? t('returning_subtitle') ||
                "Ready for your favorites? Here's what you loved last time."
              : dt(info, 'hero_text') || t('tagline')}
          </p>
        </section>

        {/* Your Favorites (CRM Lite) */}
        {favorites.length > 0 && query === '' && (
          <section className="mb-8">
            <SectionTitle
              label={t('your_favorites')}
              icon={<Heart className="h-3.5 w-3.5 fill-primary" />}
            />
            <ScrollFade direction="horizontal" className="-mx-4 mt-3">
              <div className="scrollbar-none flex gap-3 overflow-x-auto px-4">
                {favorites.map((i) => (
                  <FeaturedCard
                    key={`fav-${i.id}`}
                    item={i}
                    onPreview={setPreviewMedia}
                  />
                ))}
              </div>
            </ScrollFade>
          </section>
        )}

        {/* Search + Layout Toggle */}
        <div className="relative mb-4 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search_placeholder')}
              className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm text-foreground outline-none transition focus:border-primary"
            />
          </div>
          <button
            onClick={toggleLayout}
            aria-label={layout === 'list' ? t('layout_grid') : t('layout_list')}
            title={layout === 'list' ? t('layout_grid') : t('layout_list')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition hover:border-primary hover:text-primary"
          >
            {layout === 'list' ? (
              <LayoutGrid className="h-5 w-5" />
            ) : (
              <LayoutList className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Tag Filters */}
        <div className="scrollbar-none sticky top-32 z-30 -mx-4 mb-8 flex gap-2 overflow-x-auto px-4 py-1 backdrop-blur-md shadow-sm [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)]">
          <button
            onClick={() => toggleFilter('special')}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider transition ${
              activeFilters.has('special')
                ? 'border-yellow-400 bg-yellow-400/15 text-yellow-600 dark:border-yellow-500/50 dark:text-yellow-400'
                : 'border-border bg-card text-muted-foreground hover:border-yellow-400 hover:text-yellow-600 dark:hover:border-yellow-500/50 dark:hover:text-yellow-400'
            }`}
          >
            <Star
              className={`h-3.5 w-3.5 ${activeFilters.has('special') ? 'fill-current' : ''}`}
            />{' '}
            {t('todays_special')}
          </button>
          <button
            onClick={() => toggleFilter('veg')}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider transition ${
              activeFilters.has('veg')
                ? 'border-success bg-success/15 text-success'
                : 'border-border bg-card text-muted-foreground hover:border-success hover:text-success'
            }`}
          >
            <Leaf className="h-3.5 w-3.5" /> {t('veg')}
          </button>
          <button
            onClick={() => toggleFilter('fasting')}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider transition ${
              activeFilters.has('fasting')
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-primary'
            }`}
          >
            <Clock className="h-3.5 w-3.5" /> {t('fasting')}
          </button>
          <button
            onClick={() => toggleFilter('spicy')}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider transition ${
              activeFilters.has('spicy')
                ? 'border-destructive bg-destructive/15 text-destructive'
                : 'border-border bg-card text-muted-foreground hover:border-destructive hover:text-destructive'
            }`}
          >
            <Flame className="h-3.5 w-3.5" /> {t('spicy')}
          </button>
          {((info as any)?.dietary_tags as any[])?.map((tag) => (
            <button
              key={tag.id}
              onClick={() => toggleFilter(tag.label)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider transition ${
                activeFilters.has(tag.label)
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-primary'
              }`}
            >
              {dt(tag, 'label')}
            </button>
          ))}
        </div>

        {/* Featured */}
        {featured.length > 0 && query === '' && (
          <section className="mb-8">
            <SectionTitle
              label={t('chefs_picks')}
              icon={<Sparkles className="h-3 w-3" />}
            />
            <ScrollFade direction="horizontal" className="-mx-4 mt-3">
              <div className="scrollbar-none flex gap-3 overflow-x-auto px-4">
                {featured.map((i) => (
                  <FeaturedCard
                    key={i.id}
                    item={i}
                    onPreview={setPreviewMedia}
                  />
                ))}
              </div>
            </ScrollFade>
          </section>
        )}

        {/* Empty State */}
        {liveItems.length === 0 && query === '' && (
          <div className="py-12 text-center text-muted-foreground">
            <UtensilsCrossed className="mx-auto h-12 w-12 opacity-20 mb-4" />
            <p className="text-lg font-medium">{t('no_items')}</p>
            <p className="text-sm mt-2">{t('check_back_later')}</p>
          </div>
        )}

        {/* Categories */}
        {grouped.map(({ cat, items: list }) =>
          list.length === 0 &&
          (query !== '' || activeFilters.size > 0) ? null : (
            <section
              key={cat.id}
              id={`cat-${cat.id}`}
              className="mb-8 scroll-mt-32"
            >
              <SectionTitle label={dt(cat, 'name')} />
              <div
                className={`mt-3 ${
                  layout === 'grid'
                    ? 'grid grid-cols-2 gap-3 sm:grid-cols-3'
                    : 'space-y-3'
                }`}
              >
                {list.length === 0 ? (
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <p className="text-sm text-muted-foreground col-span-full">
                      {t('no_items_in_cat')}
                    </p>
                  </div>
                ) : (
                  list.map((i) => (
                    <ItemCard
                      key={i.id}
                      item={i}
                      restaurantInfo={info}
                      onPreview={setPreviewMedia}
                      layout={layout}
                    />
                  ))
                )}
              </div>
            </section>
          ),
        )}

        {grouped.every(({ items: l }) => l.length === 0) &&
          (query !== '' || activeFilters.size > 0) && (
            <p className="mt-12 text-center text-sm text-muted-foreground">
              {t('no_matching_items')}
            </p>
          )}
      </main>

      {/* Footer */}
      <footer className="bg-card m-4 md:m-8 rounded-xl">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="font-display text-lg text-primary">
                {t('visit_us')}
              </h3>
              {info?.address && (
                <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{info.address}</span>
                </p>
              )}
              {info?.phone && (
                <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4 text-primary" />
                  <a href={`tel:${info.phone}`} className="hover:text-primary">
                    {info.phone}
                  </a>
                </p>
              )}
              {info?.map_url && (
                <a
                  href={info.map_url}
                  target="_blank"
                  rel="noreferrer"
                  className="my-3 inline-flex text-xs font-semibold uppercase tracking-wider text-primary hover:underline"
                >
                  {t('open_in_maps')} →
                </a>
              )}
              {info?.map_embed_url && (
                <div className="overflow-hidden rounded-xl border border-border bg-muted/20">
                  <iframe
                    src={info.map_embed_url}
                    width="100%"
                    height="200"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="invert-0 grayscale-[0.5] contrast-[1.2] dark:invert dark:grayscale-[0.8]"
                  />
                </div>
              )}
            </div>
            <div>
              <h3 className="font-display text-lg text-primary">
                {t('opening_hours')}
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {(Array.isArray(info?.hours)
                  ? (info!.hours as Array<{ day: string; hours: string }>)
                  : []
                ).map((h, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-4"
                  >
                    <span className="flex items-center gap-2">
                      <Clock className="h-3 w-3 text-primary" />
                      {h.day}
                    </span>
                    <span>{h.hours}</span>
                  </li>
                ))}
              </ul>

              {/* Extras (Wifi + Payments) */}
              {(info?.wifi_password ||
                (Array.isArray(info?.payment_methods) &&
                  info!.payment_methods.length > 0)) && (
                <div className="mt-6 border-t border-border pt-4">
                  {info.wifi_password && (
                    <div className="mb-4">
                      <h4 className="font-display text-sm uppercase tracking-wider text-primary">
                        {t('wifi')}
                      </h4>
                      <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                        <Wifi className="h-4 w-4 text-primary" />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(
                              info.wifi_password || '',
                            )
                            toast.success(t('copied'))
                          }}
                          className="flex items-center gap-1.5 hover:opacity-80 transition active:scale-95 cursor-copy"
                          title="Copy to clipboard"
                        >
                          <span className="select-all rounded bg-muted px-2 py-0.5 font-mono">
                            {info.wifi_password}
                          </span>
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  )}
                  {Array.isArray(info?.payment_methods) &&
                    info!.payment_methods.length > 0 && (
                      <div>
                        <h4 className="font-display text-sm uppercase tracking-wider text-primary">
                          {t('payment_methods')}
                        </h4>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {info.payment_methods.map((pm: any, idx: number) => (
                            <div
                              key={idx}
                              className="flex min-w-[80px] flex-col items-center gap-1 rounded-lg border border-border bg-muted/30 p-2"
                            >
                              {pm.icon_url && (
                                <img
                                  src={optimizeImage(pm.icon_url, 100)}
                                  alt={pm.provider}
                                  className="h-6 w-6 rounded bg-white object-contain"
                                />
                              )}
                              <span className="text-[10px] font-bold text-foreground">
                                {pm.provider}
                              </span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    pm.account || '',
                                  )
                                  toast.success(t('copied'))
                                }}
                                className="flex w-full cursor-copy items-center justify-center gap-1 hover:opacity-80 transition active:scale-95"
                                title="Copy account number"
                              >
                                <span className="select-all text-[9px] text-muted-foreground">
                                  {pm.account}
                                </span>
                                <Copy className="h-2 w-2 text-muted-foreground" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center gap-4 border-t border-border pt-6">
            <div className="flex items-center gap-6">
              {info?.instagram_url && (
                <a
                  href={info.instagram_url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram"
                  className="text-muted-foreground transition hover:text-primary hover:scale-110 active:scale-95"
                >
                  <Instagram className="h-5 w-5" />
                </a>
              )}
              {info?.tiktok_url && (
                <a
                  href={info.tiktok_url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="TikTok"
                  className="text-muted-foreground transition hover:text-primary hover:scale-110 active:scale-95"
                >
                  <TikTokIcon />
                </a>
              )}
              {(info as any)?.facebook_url && (
                <a
                  href={(info as any).facebook_url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Facebook"
                  className="text-muted-foreground transition hover:text-[#1877F2] hover:scale-110 active:scale-95"
                >
                  <Facebook className="h-5 w-5" />
                </a>
              )}
              {(info as any)?.telegram_url && (
                <a
                  href={(info as any).telegram_url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Telegram"
                  className="text-muted-foreground transition hover:text-[#0088cc] hover:scale-110 active:scale-95"
                >
                  <Send className="h-5 w-5" />
                </a>
              )}
              {(info as any)?.whatsapp_url && (
                <a
                  href={(info as any).whatsapp_url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="WhatsApp"
                  className="text-muted-foreground transition hover:text-[#25D366] hover:scale-110 active:scale-95"
                >
                  <MessageCircle className="h-5 w-5" />
                </a>
              )}
              {(info as any)?.youtube_url && (
                <a
                  href={(info as any).youtube_url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="YouTube"
                  className="text-muted-foreground transition hover:text-[#FF0000] hover:scale-110 active:scale-95"
                >
                  <Youtube className="h-5 w-5" />
                </a>
              )}
            </div>
            <p className="text-center text-[11px] uppercase tracking-widest text-muted-foreground">
              © {new Date().getFullYear()} {info?.name ?? 'Origin'} ·{' '}
              {t('all_rights_reserved')}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {t('crafted_by')}{' '}
              <a
                href="https://kidusportfoloio.netlify.app/"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground hover:text-primary"
              >
                {' '}
                Kidus{' '}
              </a>
            </p>
          </div>
        </div>
      </footer>

      {/* Cart Bar */}
      {count > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-lg">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm">
              <ShoppingBag className="h-4 w-4 text-primary" />
              <span className="font-semibold">
                {count === 1
                  ? t('cart_item_single').replace('{count}', count.toString())
                  : t('cart_items').replace('{count}', count.toString())}
              </span>
            </div>
            <button
              onClick={() => setBillOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-glow transition hover:opacity-90"
            >
              <span>{t('view_bill')}</span>
              <span className="font-display text-base">
                {formatBirr(total)} {t('currency')}
              </span>
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating action row: Loyalty + Ask AI — both sit above cart bar when visible */}
      <div
        className={`fixed z-40 flex items-center gap-2 transition-all duration-300 ${
          count > 0 ? 'bottom-20' : 'bottom-3 md:bottom-5'
        } right-4`}
      >
        {deviceId && <LoyaltyFloatingButton deviceId={deviceId} />}
        <button
          onClick={() => setAiOpen(true)}
          className="group flex items-center gap-2 rounded-full border border-primary/30 bg-card/90 px-4 py-2.5 text-sm font-semibold text-primary shadow-lg backdrop-blur-sm transition hover:bg-primary hover:text-primary-foreground"
        >
          <Sparkles className="h-4 w-4 transition group-hover:rotate-12" />
          <span>{t('ask_ai')}</span>
        </button>
      </div>

      {/* Bill Drawer */}
      <BillDrawer
        open={billOpen}
        onClose={() => setBillOpen(false)}
        info={info}
        categories={categories}
        tableSession={tableSession}
      />

      {/* AI Drawer */}
      <AIChatDrawer
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        items={liveItems}
        lang={lang}
      />

      {/* Media Previewer Modal */}
      {previewMedia && (
        <div
          className="fixed inset-0 z-200 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
          onClick={() => setPreviewMedia(null)}
        >
          <div
            className="animate-in zoom-in-95 duration-200 flex w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex items-center justify-center bg-black/5 max-h-[80vh] overflow-hidden group">
              {getMediaType(previewMedia.items[previewMedia.index]) ===
              'video' ? (
                <video
                  key={previewMedia.items[previewMedia.index]}
                  src={previewMedia.items[previewMedia.index]}
                  className="max-h-[80vh] w-full object-contain"
                  autoPlay
                  muted
                  loop
                  playsInline
                  controls
                />
              ) : (
                <img
                  src={previewMedia.items[previewMedia.index]}
                  alt={previewMedia.name}
                  className="max-h-[80vh] w-full object-contain"
                />
              )}

              {/* Navigation Arrows */}
              {previewMedia.items.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setPreviewMedia((pm) =>
                        pm
                          ? {
                              ...pm,
                              index:
                                (pm.index - 1 + pm.items.length) %
                                pm.items.length,
                            }
                          : null,
                      )
                    }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setPreviewMedia((pm) =>
                        pm
                          ? {
                              ...pm,
                              index: (pm.index + 1) % pm.items.length,
                            }
                          : null,
                      )
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center justify-between px-5 py-4 shrink-0 border-t border-border bg-card">
              <div className="min-w-0">
                <p className="font-display text-base text-foreground truncate">
                  {previewMedia.name}
                </p>
                {previewMedia.items.length > 1 && (
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                    {previewMedia.index + 1} / {previewMedia.items.length}
                  </p>
                )}
              </div>
              <button
                onClick={() => setPreviewMedia(null)}
                className="ml-4 rounded-full bg-muted p-2 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Feedback Modal */}
      <FeedbackModal
        open={feedbackOpen}
        onClose={handleFeedbackSkip}
        onSubmit={async (rating, comment) => {
          setSubmittingFeedback(true)
          try {
            const did = await getDeviceId()
            await submitFeedback({
              data: {
                rating,
                comment,
                device_id: did,
                table_id: tableSession?.tableId || null,
                table_label: tableSession?.tableLabel || null,
              },
            })
            localStorage.setItem(FEEDBACK_DONE_KEY, new Date().toDateString())
            setFeedbackOpen(false)
            toast.success(t('feedback_thanks'))
          } catch (err: any) {
            const msg = err.message || ''
            if (msg.includes('invalid_type')) {
              toast.error(
                t('feedback_error_invalid') || 'Please check your rating.',
              )
            } else {
              toast.error(
                t('feedback_error') ||
                  'Failed to submit feedback. Please try again.',
              )
            }
          } finally {
            setSubmittingFeedback(false)
          }
        }}
        loading={submittingFeedback}
      />
    </div>
  )
}

function SectionTitle({
  label,
  icon,
}: {
  label: string
  icon?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-5 w-1 rounded bg-primary" />
      <h2 className="font-display text-xl uppercase tracking-widest text-primary">
        {label}
      </h2>
      {icon && <span className="text-primary">{icon}</span>}
    </div>
  )
}

function ItemCard({
  item,
  restaurantInfo,
  onPreview,
  layout = 'list',
}: {
  item: MenuItem
  restaurantInfo: any
  onPreview: (p: { items: string[]; name: string; index: number }) => void
  layout?: 'list' | 'grid'
}) {
  const { t, dt } = useTranslation()
  const name = dt(item, 'name')
  const desc = dt(item, 'description')
  const unavailable = !item.is_available
  const [imgLoaded, setImgLoaded] = useState(false)
  const { add, decrement, items: cartItems } = useCart()
  const cartItem = cartItems.find((i) => i.id === item.id)
  const qty = cartItem?.qty ?? 0
  const mediaType = item.image_url ? getMediaType(item.image_url) : 'image'

  // ---- Grid Layout ----
  if (layout === 'grid') {
    return (
      <article
        id={`item-${item.id}`}
        className={`flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card transition-all duration-500 ${
          unavailable ? 'opacity-50' : 'hover:border-primary/40'
        }`}
      >
        {/* Media */}
        <div className="relative aspect-4/3 w-full overflow-hidden bg-muted">
          {Array.isArray(item.gallery) && item.gallery.length > 0 ? (
            <MediaSlideshow
              media={item.gallery as string[]}
              aspectRatio="h-full w-full"
              onMediaClick={(url: string) =>
                onPreview({
                  items: item.gallery as string[],
                  name,
                  index: (item.gallery as string[]).indexOf(url),
                })
              }
            />
          ) : item.image_url ? (
            mediaType === 'video' ? (
              <video
                src={item.image_url}
                className="h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                onClick={() =>
                  onPreview({ items: [item.image_url!], name, index: 0 })
                }
              />
            ) : (
              <>
                {!imgLoaded && (
                  <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
                )}
                <img
                  src={optimizeImage(item.image_url, 400)}
                  alt={name}
                  loading="lazy"
                  onLoad={() => setImgLoaded(true)}
                  onClick={() =>
                    onPreview({ items: [item.image_url!], name, index: 0 })
                  }
                  className={`h-full w-full cursor-pointer object-cover transition-opacity duration-300 hover:opacity-80 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                />
              </>
            )
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="font-display text-3xl text-primary/30">
                {name[0]?.toUpperCase()}
              </span>
            </div>
          )}
          {item.is_special && (
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-yellow-400/90 px-2 py-0.5 text-[9px] font-black text-yellow-900 shadow">
              <Star className="h-2.5 w-2.5 fill-current" />
              {t('item_special_badge')}
            </span>
          )}
        </div>
        {/* Body */}
        <div className="flex flex-1 flex-col justify-between p-2.5">
          <div>
            <h3 className="text-xs font-semibold leading-tight text-foreground line-clamp-2">
              {name}
            </h3>
            <div className="mt-1 font-display text-sm text-primary">
              {formatBirr(Number(item.price))}{' '}
              <span className="text-[9px]">{t('currency')}</span>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="flex flex-wrap gap-1">
              {item.is_vegetarian && (
                <Tag tone="success">
                  <Leaf className="h-2.5 w-2.5" />
                </Tag>
              )}
              {item.is_fasting && <Tag tone="success">{t('fasting')}</Tag>}
              {item.is_spicy && (
                <Tag tone="primary">
                  <Flame className="h-2.5 w-2.5" />
                </Tag>
              )}
              {/* Dietary Tags */}
              {Array.isArray((item as any).dietary) &&
                ((item as any).dietary as string[]).map((tagId) => {
                  const tag = (
                    (restaurantInfo as any)?.dietary_tags as any[]
                  )?.find((tg) => tg.id === tagId)
                  if (!tag) return null

                  const label = dt(tag, 'label')
                  return (
                    <Tag key={tagId} tone="primary">
                      {label}
                    </Tag>
                  )
                })}
              {unavailable && <Tag tone="muted">{t('out_of_stock')}</Tag>}
            </div>
            {!unavailable && (
              <div className="flex shrink-0 items-center gap-1">
                {qty > 0 && (
                  <>
                    <button
                      onClick={() => decrement(item.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-3.5 text-center text-xs font-bold">
                      {qty}
                    </span>
                  </>
                )}
                <button
                  onClick={() =>
                    add({
                      id: item.id,
                      name,
                      price: Number(item.price),
                      category_id: item.category_id || undefined,
                      tags: [
                        item.is_vegetarian ? 'veg' : '',
                        item.is_fasting ? 'fasting' : '',
                        item.is_spicy ? 'spicy' : '',
                      ].filter(Boolean),
                    })
                  }
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 active:scale-95"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </article>
    )
  }

  // ---- Default List Layout ----
  return (
    <article
      id={`item-${item.id}`}
      className={`flex gap-3 overflow-hidden rounded-xl border border-border bg-card p-3 shadow-card transition-all duration-500 ${
        unavailable ? 'opacity-50' : 'hover:border-primary/40'
      }`}
    >
      {Array.isArray(item.gallery) && item.gallery.length > 0 ? (
        <MediaSlideshow
          media={item.gallery as string[]}
          aspectRatio="h-20 w-20 shrink-0"
          className="rounded-lg"
          onMediaClick={(url: string) =>
            onPreview({
              items: item.gallery as string[],
              name,
              index: (item.gallery as string[]).indexOf(url),
            })
          }
        />
      ) : item.image_url ? (
        <div className="relative h-20 w-20 shrink-0">
          {mediaType === 'video' ? (
            <video
              src={item.image_url}
              className="h-20 w-20 cursor-pointer rounded-lg object-cover"
              autoPlay
              muted
              loop
              playsInline
              onClick={() =>
                onPreview({ items: [item.image_url!], name, index: 0 })
              }
            />
          ) : (
            <>
              {!imgLoaded && (
                <Skeleton className="absolute inset-0 h-20 w-20 rounded-lg" />
              )}
              <img
                src={optimizeImage(item.image_url, 200)}
                alt={name}
                loading="lazy"
                onLoad={() => setImgLoaded(true)}
                onClick={() =>
                  onPreview({ items: [item.image_url!], name, index: 0 })
                }
                className={`h-20 w-20 cursor-pointer rounded-lg object-cover transition-opacity duration-300 hover:opacity-80 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
              />
            </>
          )}
        </div>
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-muted">
          <span className="font-display text-2xl text-primary/50">
            {name[0]?.toUpperCase()}
          </span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {name}
            </h3>
            {desc && (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {desc}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <div className="font-display text-base text-primary">
              {formatBirr(Number(item.price))}{' '}
              <span className="text-[10px]">{t('currency')}</span>
            </div>
          </div>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {item.is_special && (
              <span className="flex items-center gap-1 rounded bg-yellow-400/15 border border-yellow-400/50 px-1.5 py-0.5 text-[10px] font-bold text-yellow-600 dark:text-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.2)]">
                <Star className="h-2.5 w-2.5 fill-current" />
                {t('item_special_badge')}
              </span>
            )}
            {unavailable && <Tag tone="muted">{t('out_of_stock')}</Tag>}
            {item.is_vegetarian && (
              <Tag tone="success">
                <Leaf className="h-2.5 w-2.5" /> {t('veg')}
              </Tag>
            )}
            {item.is_fasting && <Tag tone="success">{t('fasting')}</Tag>}
            {item.is_spicy && (
              <Tag tone="primary">
                <Flame className="h-2.5 w-2.5" /> {t('spicy')}
              </Tag>
            )}
            {/* Dietary Tags */}
            {Array.isArray((item as any).dietary) &&
              ((item as any).dietary as string[]).map((tagId) => {
                const tag = (
                  (restaurantInfo as any)?.dietary_tags as any[]
                )?.find((tg) => tg.id === tagId)
                if (!tag) return null
                return (
                  <Tag key={tagId} tone="primary">
                    {dt(tag, 'label')}
                  </Tag>
                )
              })}
          </div>
          {!unavailable && (
            <div className="flex shrink-0 items-center gap-1">
              {qty > 0 && (
                <>
                  <button
                    aria-label="Decrease quantity"
                    title="Decrease quantity"
                    onClick={() => decrement(item.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-primary hover:text-primary"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-4 text-center text-xs font-bold">
                    {qty}
                  </span>
                </>
              )}
              <button
                aria-label="Add to cart"
                title="Add to cart"
                onClick={() =>
                  add({
                    id: item.id,
                    name,
                    price: Number(item.price),
                    category_id: item.category_id || undefined,
                    tags: [
                      item.is_vegetarian ? 'veg' : '',
                      item.is_fasting ? 'fasting' : '',
                      item.is_spicy ? 'spicy' : '',
                    ].filter(Boolean),
                  })
                }
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:opacity-90 active:scale-95"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function FeaturedCard({
  item,
  onPreview,
}: {
  item: MenuItem
  onPreview: (p: { items: string[]; name: string; index: number }) => void
}) {
  const { dt, t } = useTranslation()
  const name = dt(item, 'name')
  const [imgLoaded, setImgLoaded] = useState(false)
  const { add, decrement, items: cartItems } = useCart()
  const cartItem = cartItems.find((i) => i.id === item.id)
  const qty = cartItem?.qty ?? 0

  const scrollToItem = () => {
    const el = document.getElementById(`item-${item.id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.remove('border-border')
      el.classList.add(
        'border-primary',
        'scale-[1.02]',
        'shadow-[0_0_15px_rgba(234,88,12,0.3)]',
      )
      setTimeout(() => {
        el.classList.add('border-border')
        el.classList.remove(
          'border-primary',
          'scale-[1.02]',
          'shadow-[0_0_15px_rgba(234,88,12,0.3)]',
        )
      }, 1500)
    }
  }

  return (
    <div className="relative w-44 shrink-0 overflow-hidden rounded-xl border border-border bg-card shadow-card transition hover:border-primary">
      {/* Image area — long press/click opens preview, tap scrolls */}
      <button onClick={scrollToItem} className="w-full text-left">
        {Array.isArray(item.gallery) && item.gallery.length > 0 ? (
          <MediaSlideshow
            media={item.gallery as string[]}
            aspectRatio="h-28 w-full"
            autoPlayInterval={4000}
            onMediaClick={(url: string) =>
              onPreview({
                items: item.gallery as string[],
                name,
                index: (item.gallery as string[]).indexOf(url),
              })
            }
          />
        ) : item.image_url ? (
          <div className="relative h-28 w-full overflow-hidden">
            {getMediaType(item.image_url) === 'video' ? (
              <video
                src={item.image_url}
                className="h-28 w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
              />
            ) : (
              <>
                {!imgLoaded && (
                  <Skeleton className="absolute inset-0 h-28 w-full rounded-none" />
                )}
                <img
                  src={optimizeImage(item.image_url, 300)}
                  alt={name}
                  onLoad={() => setImgLoaded(true)}
                  className={`h-28 w-full object-cover transition-opacity duration-300 hover:opacity-80 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                />
              </>
            )}
          </div>
        ) : (
          <div className="flex h-28 items-center justify-center bg-muted">
            <span className="font-display text-3xl text-primary/50">
              {name[0]?.toUpperCase()}
            </span>
          </div>
        )}
        <div className="p-2.5 pb-1">
          <p className="truncate text-xs font-semibold">{name}</p>
          <p className="mt-0.5 font-display text-sm text-primary">
            {formatBirr(Number(item.price))}{' '}
            <span className="text-[9px]">{t('currency')}</span>
          </p>
        </div>
      </button>
      {/* Cart controls */}
      <div className="flex items-center justify-end gap-1 px-2 pb-2">
        {qty > 0 && (
          <>
            <button
              aria-label="Decrease quantity"
              title="Decrease quantity"
              onClick={() => decrement(item.id)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-primary hover:text-primary"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-4 text-center text-xs font-bold">{qty}</span>
          </>
        )}
        <button
          aria-label="Add to cart"
          title="Add to cart"
          onClick={() => add({ id: item.id, name, price: Number(item.price) })}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 active:scale-95"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function Tag({
  tone,
  children,
}: {
  tone: 'primary' | 'success' | 'muted'
  children: React.ReactNode
}) {
  const tones = {
    primary: 'bg-primary/15 text-primary',
    success: 'bg-success/15 text-success',
    muted: 'bg-destructive/15 text-destructive',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.1Z" />
    </svg>
  )
}

function BillDrawer({
  onClose,
  open,
  info,
  categories,
  tableSession,
}: {
  onClose: () => void
  open: boolean
  info?: any
  categories: Category[]
  tableSession?: { token: string; tableId: string; tableLabel: string } | null
}) {
  const { lang, t } = useTranslation()
  const {
    items,
    increment,
    decrement,
    remove,
    updateCustomizations,
    clear,
    total,
  } = useCart()
  const [isOrdering, setIsOrdering] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)

  const scPct = info?.service_charge_pct ?? 0
  const scAmt = (total * scPct) / 100
  const grandTotal = total + scAmt

  const handlePlaceOrder = async () => {
    if (!tableSession || items.length === 0) return
    setIsOrdering(true)
    try {
      const deviceId = await getDeviceId()
      await placeOrder({
        data: {
          table_id: tableSession.tableId,
          table_label: tableSession.tableLabel,
          items: items.map((i) => ({
            id: i.id,
            name: i.name,
            qty: i.qty,
            price: i.price,
            notes: i.notes,
            customNote: i.customNote,
          })),
          device_id: deviceId,
        },
      })
      clear()
      onClose()
      toast.success(t('order_sent_waiter_confirm'))
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsOrdering(false)
    }
  }

  return (
    <>
      {scanOpen && (
        <QRScannerModal
          onClose={() => setScanOpen(false)}
          onSession={(session) => {
            if (tableSession?.token === session.token) {
              toast(t('already_connected'))
            } else {
              localStorage.setItem(
                'origin_table_session',
                JSON.stringify(session),
              )
              toast.success(
                t('welcome_to_table').replace(
                  '{tableLabel}',
                  session.tableLabel,
                ),
              )
            }
            setScanOpen(false)
          }}
        />
      )}
      <Drawer.Root open={open} onOpenChange={(v) => !v && onClose()}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-60 mt-24 flex max-h-[90vh] flex-col rounded-t-[20px] bg-card shadow-2xl outline-none">
            {/* Handle */}
            <div className="mx-auto mt-4 mb-2 h-1.5 w-12 shrink-0 rounded-full bg-border" />

            <div className="flex flex-col flex-1 overflow-hidden px-4 pb-12 pt-2">
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-border pb-3">
                <Drawer.Title className="font-display text-lg uppercase tracking-widest text-primary">
                  {t('your_bill')}
                </Drawer.Title>
                <div className="flex items-center gap-2">
                  {items.length > 0 && (
                    <button
                      onClick={clear}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                      {t('clear')}
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="rounded-md p-1 text-muted-foreground transition hover:text-foreground"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="relative mt-2 flex min-h-0 flex-1 flex-col overflow-hidden">
                {items.length === 0 ? (
                  <div className="flex h-40 flex-col items-center justify-center gap-3 text-muted-foreground opacity-50">
                    <Utensils className="h-8 w-8" />
                    <p className="text-sm font-medium">{t('cart_empty')}</p>
                  </div>
                ) : (
                  <ScrollFade
                    fadeSize={40}
                    direction="vertical"
                    className="flex-1 flex flex-col"
                  >
                    <ul className="h-full space-y-4 overflow-y-auto px-1 pr-4 custom-scrollbar">
                      {items.map((item) => (
                        <li
                          key={`${item.id}-${(item.notes ?? []).join(',')}`}
                          className="flex flex-col py-3 space-y-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {item.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatBirr(item.price)} {t('currency')} ×{' '}
                                {item.qty}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <button
                                onClick={() => decrement(item.id, item.notes)}
                                className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-primary hover:text-primary"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-5 text-center text-sm font-bold">
                                {item.qty}
                              </span>
                              <button
                                onClick={() => increment(item.id, item.notes)}
                                className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => remove(item.id, item.notes)}
                                className="ml-1 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                            <div className="w-20 shrink-0 text-right font-display text-sm text-primary">
                              {formatBirr(item.price * item.qty)}
                            </div>
                          </div>

                          {/* Quick Notes Chips */}
                          <div className="flex flex-wrap gap-2">
                            {(() => {
                              const cat = categories?.find(
                                (c: any) => c.id === item.category_id,
                              )
                              const searchStr = (
                                (cat?.name || '') + (item.name || '')
                              ).toLowerCase()

                              const isDrink =
                                searchStr.includes('drink') ||
                                searchStr.includes('beverag') ||
                                searchStr.includes('soft') ||
                                searchStr.includes('tea') ||
                                searchStr.includes('coffe') ||
                                searchStr.includes('juice') ||
                                searchStr.includes('smoothie') ||
                                searchStr.includes('wine') ||
                                searchStr.includes('beer') ||
                                searchStr.includes('cocktail') ||
                                searchStr.includes('water') ||
                                searchStr.includes('milk')

                              const options = isDrink
                                ? [
                                    'No Ice',
                                    'Extra Cold',
                                    'With Lemon',
                                    'Take-away',
                                  ]
                                : [
                                    ...(item.tags?.includes('spicy') ||
                                    searchStr.includes('pizza') ||
                                    searchStr.includes('burger')
                                      ? ['Extra Spicy', 'Mild']
                                      : []),
                                    ...(searchStr.includes('burger') ||
                                    searchStr.includes('sandwich')
                                      ? ['No Lettuce', 'No Tomato']
                                      : []),
                                    'No Onions',
                                    'No Salt',
                                    'Take-away',
                                  ]

                              return options.map((opt) => {
                                const active = item.notes?.includes(opt)
                                return (
                                  <button
                                    key={opt}
                                    onClick={() => {
                                      const next = active
                                        ? (item.notes ?? []).filter(
                                            (n) => n !== opt,
                                          )
                                        : [...(item.notes ?? []), opt]
                                      updateCustomizations(
                                        item.id,
                                        item.notes,
                                        item.customNote,
                                        next,
                                        item.customNote || '',
                                      )
                                    }}
                                    className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
                                      active
                                        ? 'border-primary bg-primary text-primary-foreground'
                                        : 'border-border bg-muted/20 text-muted-foreground hover:border-primary/50 hover:text-primary'
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                )
                              })
                            })()}
                          </div>

                          {/* Custom Note Input */}
                          <div className="mt-3">
                            <input
                              type="text"
                              placeholder={t('ingredients_placeholder')}
                              value={item.customNote || ''}
                              onChange={(e) => {
                                updateCustomizations(
                                  item.id,
                                  item.notes,
                                  item.customNote,
                                  item.notes || [],
                                  e.target.value,
                                )
                              }}
                              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white placeholder:text-white/20 transition-all focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </ScrollFade>
                )}
              </div>

              {/* Footer */}
              {items.length > 0 && (
                <div className="mt-4 border-t border-border pt-4">
                  <div className="flex flex-col gap-1.5 pb-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t('subtotal')}</span>
                      <span>
                        {formatBirr(total)}{' '}
                        <span className="text-[10px]">{t('currency')}</span>
                      </span>
                    </div>
                    {scPct > 0 && (
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {t('service_charge')} ({scPct}%)
                        </span>
                        <span>
                          {formatBirr(scAmt)}{' '}
                          <span className="text-[10px]">{t('currency')}</span>
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t border-border/50 pt-2">
                    <span className="text-sm font-bold text-primary uppercase tracking-wider">
                      {t('total')}
                    </span>
                    <span className="font-display text-2xl text-primary">
                      {formatBirr(grandTotal)}{' '}
                      <span className="text-sm">{t('currency')}</span>
                    </span>
                  </div>
                  {tableSession ? (
                    <button
                      onClick={handlePlaceOrder}
                      disabled={isOrdering}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                    >
                      {isOrdering ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UtensilsCrossed className="h-4 w-4" />
                      )}
                      {t('place_order')}
                    </button>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <p className="text-center text-[11px] text-muted-foreground">
                        {t('scan_qr_to_order')}
                      </p>
                      <button
                        onClick={() => setScanOpen(true)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/50 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5"
                      >
                        <ScanLine className="h-4 w-4" />
                        {t('scan_qr_button')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  )
}

function FeedbackModal({
  open,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (rating: number, comment: string) => Promise<void>
  loading: boolean
}) {
  const { t } = useTranslation()
  const [rating, setRating] = useState(0) // supports .5 increments
  const [comment, setComment] = useState('')
  const [hovered, setHovered] = useState(0) // supports .5 increments

  if (!open) return null

  const handleStarClick = (
    e: React.MouseEvent<HTMLButtonElement>,
    star: number,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const isHalf = x < rect.width / 2
    setRating(isHalf ? star - 0.5 : star)
  }

  const handleStarHover = (
    e: React.MouseEvent<HTMLButtonElement>,
    star: number,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const isHalf = x < rect.width / 2
    setHovered(isHalf ? star - 0.5 : star)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-sm rounded-[24px] border border-white/10 bg-card p-8 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Star className="h-8 w-8 fill-primary/20" />
          </div>
          <h2 className="font-display text-2xl tracking-tight text-foreground">
            {t('rate_experience')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('feedback_desc') || 'We value your input to serve you better.'}
          </p>
        </div>

        {/* Stars — onMouseLeave on container so gaps don't lose hover state */}
        <div
          className="my-8 flex justify-center gap-2"
          onMouseLeave={() => setHovered(0)}
        >
          {[1, 2, 3, 4, 5].map((s) => {
            const active = hovered || rating
            const isFull = active >= s
            const isHalf = !isFull && active >= s - 0.5 && active > 0
            return (
              <button
                key={s}
                onMouseMove={(e) => handleStarHover(e, s)}
                onClick={(e) => handleStarClick(e, s)}
                className="group relative transition-transform active:scale-90"
                style={{ cursor: 'pointer' }}
              >
                {/* Base empty star */}
                <Star className="h-10 w-10 text-muted-foreground/20 transition-colors duration-150" />
                {/* Half fill */}
                {isHalf && (
                  <div className="pointer-events-none absolute inset-0 overflow-hidden w-1/2">
                    <Star className="h-10 w-10 fill-amber-400 text-amber-500" />
                  </div>
                )}
                {/* Full fill */}
                {isFull && (
                  <div className="pointer-events-none absolute inset-0">
                    <Star className="h-10 w-10 fill-amber-400 text-amber-500 transition-colors duration-150" />
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Rating label — always occupies height so layout never shifts */}
        <div className="h-5 -mt-4 mb-4 flex items-center justify-center">
          {(hovered || rating) > 0 && (
            <p className="text-xs font-semibold text-primary tracking-wider">
              {(hovered || rating).toFixed(1)} / 5.0
            </p>
          )}
        </div>

        <div className="space-y-4">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('leave_comment')}
            rows={3}
            className="w-full min-h-[80px] max-h-[160px] resize-y rounded-xl border border-border bg-muted/30 p-3 text-sm outline-none transition focus:border-primary/50"
          />

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-border py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground transition hover:bg-muted/50"
            >
              {t('skip')}
            </button>
            <button
              onClick={() => rating > 0 && onSubmit(rating, comment)}
              disabled={rating === 0 || loading}
              className="flex-1 relative flex items-center justify-center gap-2 rounded-xl bg-primary py-3 px-2 text-xs font-bold uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin shrink-0" />
              ) : (
                <Send className="h-5 w-5 shrink-0" />
              )}
              {t('submit_feedback')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MenuSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-lg">
        <div className="mx-auto flex h-20 max-w-3xl items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-7 w-10 rounded-md" />
          </div>
        </div>
        <div className="border-t border-border">
          <div className="mx-auto max-w-3xl overflow-hidden px-4 py-2">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-7 w-20 shrink-0 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-32 pt-6">
        <Skeleton className="mb-6 h-[120px] w-full rounded-2xl" />
        <Skeleton className="mb-6 h-11 w-full rounded-xl" />

        <div className="space-y-8">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-8 w-40" />
              <div className="grid gap-4">
                {[1, 2, 3].map((j) => (
                  <Skeleton key={j} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

// ─── QR Scanner Modal ─────────────────────────────────────────────────────────

type ScanSession = { token: string; tableId: string; tableLabel: string }

function QRScannerModal({
  onClose,
  onSession,
}: {
  onClose: () => void
  onSession: (s: ScanSession) => void
}) {
  const { t } = useTranslation()
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const scannerRef = React.useRef<any>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function startScanner() {
      try {
        const QrScanner = (await import('qr-scanner')).default
        if (!videoRef.current || cancelled) return
        if (scannerRef.current) scannerRef.current.destroy()

        const scanner = new QrScanner(
          videoRef.current,
          async (result: any) => {
            const text: string =
              typeof result === 'string' ? result : result.data
            try {
              const url = new URL(text)
              const token = url.searchParams.get('t')
              if (!token) {
                setScanError(t('invalid_qr'))
                return
              }
              scanner.stop()
              setVerifying(true)
              const session = await verifyTableToken({ data: { token } })
              if (!cancelled)
                onSession({
                  token,
                  tableId: session.id,
                  tableLabel: session.label,
                })
            } catch {
              setScanError(t('verify_error'))
              setVerifying(false)
              scanner.start()
            }
          },
          { highlightScanRegion: true, highlightCodeOutline: true },
        )
        await scanner.start()
        scannerRef.current = scanner
      } catch {
        if (!cancelled) setScanError(t('camera_denied'))
      }
    }

    startScanner()
    return () => {
      cancelled = true
      scannerRef.current?.destroy()
      scannerRef.current = null
    }
  }, [])

  return (
    <div className="fixed inset-0 z-100 flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="font-display text-base uppercase tracking-wider text-primary">
            {t('scan_qr_title')}
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {t('scan_qr_subtitle')}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          muted
          playsInline
        />

        {/* Crosshair frame */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-60 w-60">
            <div className="absolute left-0 top-0 h-8 w-8 rounded-tl-lg border-l-4 border-t-4 border-primary" />
            <div className="absolute right-0 top-0 h-8 w-8 rounded-tr-lg border-r-4 border-t-4 border-primary" />
            <div className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-lg border-b-4 border-l-4 border-primary" />
            <div className="absolute bottom-0 right-0 h-8 w-8 rounded-br-lg border-b-4 border-r-4 border-primary" />
          </div>
        </div>

        {verifying && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-white">
            <Loader2 className="h-10 w-10 animate-spin" />
            <p className="text-sm font-semibold">{t('verifying_table')}</p>
          </div>
        )}

        {scanError && (
          <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-destructive/90 px-4 py-3 text-sm text-white">
            {scanError}
            <button
              onClick={() => setScanError(null)}
              className="ml-2 underline opacity-80"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
