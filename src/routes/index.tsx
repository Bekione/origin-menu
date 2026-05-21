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
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  ChevronUp,
  Wifi,
  ChevronRight,
  Copy,
  Star,
  Loader2,
  ScanLine,
  Bell,
} from 'lucide-react'
import {
  getMenuData,
  type MenuData,
  type MenuItem,
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
} from '@/server/table.functions'
import { CartProvider, useCart } from '@/components/CartProvider'
import {
  getDeviceId,
  isRateLimitedLocally,
  recordWaiterCall,
} from '@/lib/device-fingerprint'
import { AIChatDrawer } from '@/components/AIChatDrawer'
import { Drawer } from 'vaul'
import { optimizeImage } from '@/lib/image'
import { supabaseBrowser } from '@/integrations/supabase/client.browser'

type SearchOptions = {
  table?: number
  t?: string // QR table token
  tags?: string
}

export const Route = createFileRoute('/')({
  loader: () => getMenuData(),
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
import type { Lang } from '@/lib/translations'

type FilterTag = 'special' | 'veg' | 'fasting' | 'spicy'

function formatBirr(n: number) {
  return new Intl.NumberFormat('en-US').format(n)
}

function MenuPage() {
  const { categories, items, info } = Route.useLoaderData() as MenuData

  return (
    <CartProvider>
      <MenuPageInner categories={categories} items={items} info={info} />
    </CartProvider>
  )
}

function MenuPageInner({ categories, items: initialItems, info }: MenuData) {
  const { lang, setLang, t, dt } = useTranslation()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const table = search.table
  const qrToken = search.t
  type TableSession = { token: string; tableId: string; tableLabel: string }
  const SESSION_KEY = 'origin_table_session'

  // Live items state — updated in real-time from Supabase
  const [liveItems, setLiveItems] = useState<MenuItem[]>(initialItems)

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
    return () => {
      supabaseBrowser.removeChannel(channel)
    }
  }, [])

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
  const [previewImage, setPreviewImage] = useState<{
    url: string
    name: string
  } | null>(null)

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
      toast(
        lang === 'am'
          ? `የጠረጴዛ ቁጥር ከ ${maxTables} መብለጥ አይችልም`
          : `Table number cannot exceed ${maxTables}`,
      )
      return
    }

    // Local device rate-limit check (fast fail)
    if (isRateLimitedLocally(tableNum)) {
      toast(
        lang === 'am'
          ? 'አስተናጋጅ ወደ ጠረጴዛዎ ተጠርቷል። ትንሽ ይጠብቁ።'
          : 'A waiter is already on the way — please wait a moment.',
        { duration: 5000 },
      )
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
      toast(
        lang === 'am'
          ? 'አስተናጋጅ ወደ ጠረጴዛዎ እየመጣ ነው'
          : 'A waiter is on their way to your table!',
        { duration: 5000 },
      )
    } catch (e: any) {
      const raw: string = e.message || ''
      const isRateLimit = raw.toLowerCase().includes('already on their way')
      const errMsg = isRateLimit
        ? lang === 'am'
          ? 'አስተናጋጅ ወደ ጠረጴዛዎ ተጠርቷል። ትንሽ ይጠብቁ።'
          : 'A waiter is already on the way — please wait a moment.'
        : raw || (lang === 'am' ? 'ስህተት ተፈጥሯል' : 'Something went wrong')
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
      })
      .catch(() => {
        // Token invalid — clear any stale session
        localStorage.removeItem(SESSION_KEY)
        setTableSession(null)
        toast.error(
          'Invalid QR code — please scan the QR code on your table again.',
        )
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
          if (activeFilters.has('special') && !i.is_special) return false
          if (activeFilters.has('veg') && !i.is_vegetarian) return false
          if (activeFilters.has('fasting') && !i.is_fasting) return false
          if (activeFilters.has('spicy') && !i.is_spicy) return false
        }
        return (
          q === '' ||
          i.name.toLowerCase().includes(q) ||
          (i.name_am ?? '').toLowerCase().includes(q) ||
          (i.description ?? '').toLowerCase().includes(q)
        )
      }),
    }))
  }, [categories, liveItems, query, activeFilters])

  const featured = liveItems
    .filter((i) => {
      if (!i.is_featured || !i.is_available) return false
      if (activeFilters.size > 0) {
        if (activeFilters.has('special') && !i.is_special) return false
        if (activeFilters.has('veg') && !i.is_vegetarian) return false
        if (activeFilters.has('fasting') && !i.is_fasting) return false
        if (activeFilters.has('spicy') && !i.is_spicy) return false
      }
      return true
    })
    .slice(0, 6)

  const scrollTo = (id: string) => {
    setActiveCat(id)
    setNavOpen(false)
    document
      .getElementById(`cat-${id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
      {info?.promo_banner_active && info?.promo_banner_text && (
        <a
          href={info.promo_banner_url || '#'}
          target={info.promo_banner_url ? '_blank' : undefined}
          className="flex w-full cursor-pointer items-center justify-center bg-primary px-4 py-2 text-center text-xs font-bold uppercase tracking-widest text-primary-foreground hover:opacity-90"
        >
          <span>{info.promo_banner_text}</span>
          {info.promo_banner_url && (
            <ChevronRight className="ml-1 h-3 w-3 shrink-0" />
          )}
        </a>
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
            {t('welcome')}
          </h1>
          <p className="relative z-10 mt-3 text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
            {dt(info, 'hero_text') || t('tagline')}
          </p>
        </section>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search_placeholder')}
            className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm text-foreground outline-none transition focus:border-primary"
          />
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
            {lang === 'am' ? 'የዛሬ ልዩ' : "Today's Special"}
          </button>
          <button
            onClick={() => toggleFilter('veg')}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider transition ${
              activeFilters.has('veg')
                ? 'border-success bg-success/15 text-success'
                : 'border-border bg-card text-muted-foreground hover:border-success hover:text-success'
            }`}
          >
            <Leaf className="h-3.5 w-3.5" />{' '}
            {lang === 'am' ? 'የፆም/አትክልት' : 'Veg'}
          </button>
          <button
            onClick={() => toggleFilter('fasting')}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider transition ${
              activeFilters.has('fasting')
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-primary'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />{' '}
            {lang === 'am' ? 'ለፆም' : 'Fasting'}
          </button>
          <button
            onClick={() => toggleFilter('spicy')}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider transition ${
              activeFilters.has('spicy')
                ? 'border-destructive bg-destructive/15 text-destructive'
                : 'border-border bg-card text-muted-foreground hover:border-destructive hover:text-destructive'
            }`}
          >
            <Flame className="h-3.5 w-3.5" /> {lang === 'am' ? 'ቅመም' : 'Spicy'}
          </button>
        </div>

        {/* Featured */}
        {featured.length > 0 && query === '' && (
          <section className="mb-8">
            <SectionTitle
              label={lang === 'am' ? 'የቤቱ ምርጥ' : "Chef's Picks"}
              icon={<Sparkles className="h-3 w-3" />}
            />
            <ScrollFade direction="horizontal" className="-mx-4 mt-3">
              <div className="scrollbar-none flex gap-3 overflow-x-auto px-4">
                {featured.map((i) => (
                  <FeaturedCard
                    key={i.id}
                    item={i}
                    lang={lang}
                    onPreview={setPreviewImage}
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
              <div className="mt-3 space-y-3">
                {list.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {lang === 'am' ? 'ምንም የሚታይ ምግብ የለም።' : 'No items yet.'}
                  </p>
                ) : (
                  list.map((i) => (
                    <ItemCard
                      key={i.id}
                      item={i}
                      lang={lang}
                      onPreview={setPreviewImage}
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
              {lang === 'am' ? 'ምንም ውጤት የለም።' : 'No matching items.'}
            </p>
          )}
      </main>

      {/* Footer */}
      <footer className="bg-card m-4 md:m-8 rounded-xl">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="font-display text-lg text-primary">
                {lang === 'am' ? 'ጎብኙን' : 'Visit Us'}
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
                  className="mt-3 inline-flex text-xs font-semibold uppercase tracking-wider text-primary hover:underline"
                >
                  {lang === 'am' ? 'በካርታ ላይ →' : 'Open in Maps →'}
                </a>
              )}
            </div>
            <div>
              <h3 className="font-display text-lg text-primary">
                {lang === 'am' ? 'የሥራ ሰዓት' : 'Hours'}
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
                        {lang === 'am' ? 'ዋይፋይ' : 'Wi-Fi'}
                      </h4>
                      <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                        <Wifi className="h-4 w-4 text-primary" />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(
                              info.wifi_password || '',
                            )
                            toast.success(
                              lang === 'am' ? 'ኮፒ ተደርጓል' : 'Copied!',
                            )
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
                          {lang === 'am' ? 'የመክፈያ ዘዴዎች' : 'Payment Methods'}
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
                                  toast.success(
                                    lang === 'am' ? 'ኮፒ ተደርጓል' : 'Copied!',
                                  )
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
            <div className="flex items-center gap-4">
              {info?.instagram_url && (
                <a
                  href={info.instagram_url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram"
                  className="text-muted-foreground transition hover:text-primary"
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
                  className="text-muted-foreground transition hover:text-primary"
                >
                  <TikTokIcon />
                </a>
              )}
            </div>
            <p className="text-center text-[11px] uppercase tracking-widest text-muted-foreground">
              © {new Date().getFullYear()} {info?.name ?? 'Origin'} · All Rights
              Reserved
            </p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Crafted by{' '}
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
                {count} item{count !== 1 ? 's' : ''}
              </span>
            </div>
            <button
              onClick={() => setBillOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-glow transition hover:opacity-90"
            >
              <span>{t('view_bill')}</span>
              <span className="font-display text-base">
                {formatBirr(total)} ETB
              </span>
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Ask AI floating button — sits above cart bar if visible */}
      <div
        className={`fixed z-40 transition-all duration-300 ${
          count > 0 ? 'bottom-20' : 'bottom-3 md:bottom-5'
        } right-4`}
      >
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
        tableSession={tableSession}
        setTableSession={setTableSession}
      />

      {/* AI Drawer */}
      <AIChatDrawer
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        items={liveItems}
        lang={lang}
      />

      {/* Image Previewer Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-200 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="animate-in zoom-in-95 duration-200 flex w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewImage.url}
              alt={previewImage.name}
              className="h-auto w-full object-cover"
            />
            <div className="flex items-center justify-between px-5 py-4">
              <p className="font-display text-base text-foreground">
                {previewImage.name}
              </p>
              <button
                onClick={() => setPreviewImage(null)}
                className="rounded-full border border-border p-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
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
  lang,
  onPreview,
}: {
  item: MenuItem
  lang: Lang
  onPreview: (p: { url: string; name: string }) => void
}) {
  const name = lang === 'am' ? (item.name_am ?? item.name) : item.name
  const desc =
    lang === 'am' ? (item.description_am ?? item.description) : item.description
  const unavailable = !item.is_available
  const [imgLoaded, setImgLoaded] = useState(false)
  const { add, decrement, items: cartItems } = useCart()
  const cartItem = cartItems.find((i) => i.id === item.id)
  const qty = cartItem?.qty ?? 0

  return (
    <article
      id={`item-${item.id}`}
      className={`flex gap-3 overflow-hidden rounded-xl border border-border bg-card p-3 shadow-card transition-all duration-500 ${
        unavailable ? 'opacity-50' : 'hover:border-primary/40'
      }`}
    >
      {item.image_url ? (
        <div className="relative h-20 w-20 shrink-0">
          {!imgLoaded && (
            <Skeleton className="absolute inset-0 h-20 w-20 rounded-lg" />
          )}
          <img
            src={optimizeImage(item.image_url, 200)}
            alt={name}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onClick={() => onPreview({ url: item.image_url!, name })}
            className={`h-20 w-20 cursor-pointer rounded-lg object-cover transition-opacity duration-300 hover:opacity-80 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
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
              <span className="text-[10px]">ETB</span>
            </div>
          </div>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {item.is_special && (
              <span className="flex items-center gap-1 rounded bg-yellow-400/15 border border-yellow-400/50 px-1.5 py-0.5 text-[10px] font-bold text-yellow-600 dark:text-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.2)]">
                <Star className="h-2.5 w-2.5 fill-current" />
                {lang === 'am' ? 'ልዩ' : 'Special'}
              </span>
            )}
            {unavailable && (
              <Tag tone="muted">{lang === 'am' ? 'አልቆ' : 'Sold out'}</Tag>
            )}
            {item.is_vegetarian && (
              <Tag tone="success">
                <Leaf className="h-2.5 w-2.5" />{' '}
                {lang === 'am' ? 'አትክልት' : 'Veg'}
              </Tag>
            )}
            {item.is_fasting && (
              <Tag tone="success">{lang === 'am' ? 'ጾም' : 'Fasting'}</Tag>
            )}
            {item.is_spicy && (
              <Tag tone="primary">
                <Flame className="h-2.5 w-2.5" />{' '}
                {lang === 'am' ? 'ቅመማማ' : 'Spicy'}
              </Tag>
            )}
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
                  add({ id: item.id, name, price: Number(item.price) })
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
  lang,
  onPreview,
}: {
  item: MenuItem
  lang: Lang
  onPreview: (p: { url: string; name: string }) => void
}) {
  const name = lang === 'am' ? (item.name_am ?? item.name) : item.name
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
        {item.image_url ? (
          <div className="relative h-28 w-full">
            {!imgLoaded && (
              <Skeleton className="absolute inset-0 h-28 w-full rounded-none" />
            )}
            <img
              src={optimizeImage(item.image_url, 300)}
              alt={name}
              onLoad={() => setImgLoaded(true)}
              className={`h-28 w-full object-cover transition-opacity duration-300 hover:opacity-80 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
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
            <span className="text-[9px]">ETB</span>
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
  tableSession,
  setTableSession,
}: {
  onClose: () => void
  open: boolean
  info?: any
  tableSession?: { token: string; tableId: string; tableLabel: string } | null
  setTableSession: (session: any) => void
}) {
  const { lang, t, dt } = useTranslation()
  const { items, increment, decrement, remove, clear, total } = useCart()
  const [isOrdering, setIsOrdering] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)

  const scPct = info?.service_charge_pct ?? 0
  const scAmt = (total * scPct) / 100
  const grandTotal = total + scAmt

  const handlePlaceOrder = async () => {
    if (!tableSession || items.length === 0) return
    setIsOrdering(true)
    try {
      const deviceId = await import('@/lib/device-fingerprint').then((m) =>
        m.getDeviceId(),
      )
      await placeOrder({
        data: {
          table_id: tableSession.tableId,
          table_label: tableSession.tableLabel,
          items: items.map((i) => ({
            id: i.id,
            name: i.name,
            qty: i.qty,
            price: i.price,
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

            <div className="flex flex-col flex-1 overflow-y-auto px-4 pb-12 pt-2">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border pb-3">
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

              {/* Item list */}
              <div className="max-h-[50vh] overflow-y-auto py-2">
                {items.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {lang === 'am' ? 'ምናሌ ባዶ ነው' : 'Your cart is empty'}
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {item.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatBirr(item.price)} ETB × {item.qty}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            onClick={() => decrement(item.id)}
                            className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-primary hover:text-primary"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-5 text-center text-sm font-bold">
                            {item.qty}
                          </span>
                          <button
                            onClick={() => increment(item.id)}
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => remove(item.id)}
                            className="ml-1 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="w-20 shrink-0 text-right font-display text-sm text-primary">
                          {formatBirr(item.price * item.qty)}
                        </div>
                      </li>
                    ))}
                  </ul>
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
                        <span className="text-[10px]">ETB</span>
                      </span>
                    </div>
                    {scPct > 0 && (
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {t('service_charge')} ({scPct}%)
                        </span>
                        <span>
                          {formatBirr(scAmt)}{' '}
                          <span className="text-[10px]">ETB</span>
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
                      <span className="text-sm">ETB</span>
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
    <div className="fixed inset-0 z-[100] flex flex-col bg-background">
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
