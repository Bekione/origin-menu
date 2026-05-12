import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
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
} from 'lucide-react'
import {
  getMenuData,
  type MenuData,
  type MenuItem,
} from '@/server/menu.functions'
import logo from '@/assets/origin-logo.jpg'
import ScrollFade from '@/components/ScrollFade'
import { Skeleton } from '@/components/ui/skeleton'
import { ThemeToggle } from '@/components/ThemeToggle'
import { CartProvider, useCart } from '@/components/CartProvider'

export const Route = createFileRoute('/')({
  loader: () => getMenuData(),
  component: MenuPage,
  pendingComponent: MenuSkeleton,
  pendingMs: 0,
})

type Lang = 'en' | 'am'

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

function MenuPageInner({ categories, items, info }: MenuData) {
  const [lang, setLang] = useState<Lang>('en')
  const [query, setQuery] = useState('')
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [navOpen, setNavOpen] = useState(false)
  const [billOpen, setBillOpen] = useState(false)
  const { count, total } = useCart()

  useEffect(() => {
    if (!activeCat && categories[0]) setActiveCat(categories[0].id)
  }, [categories, activeCat])

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase()
    return categories.map((c) => ({
      cat: c,
      items: items.filter(
        (i) =>
          i.category_id === c.id &&
          (q === '' ||
            i.name.toLowerCase().includes(q) ||
            (i.name_am ?? '').toLowerCase().includes(q) ||
            (i.description ?? '').toLowerCase().includes(q)),
      ),
    }))
  }, [categories, items, query])

  const featured = items
    .filter((i) => i.is_featured && i.is_available)
    .slice(0, 6)

  const scrollTo = (id: string) => {
    setActiveCat(id)
    setNavOpen(false)
    document
      .getElementById(`cat-${id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen bg-background">
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
                {info?.name ?? 'ORIGIN'}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {info?.tagline ?? 'Fearless Flavor.'}
              </span>
            </div>
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
                    {lang === 'am' ? (c.name_am ?? c.name) : c.name}
                  </button>
                ))}
              </div>
            </ScrollFade>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-32 pt-6">
        {/* Hero */}
        <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-card p-6 text-center shadow-card">
          <h1 className="font-display text-4xl tracking-widest text-primary">
            {lang === 'am' ? 'እንኳን ደህና መጡ' : 'Welcome to Origin'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {lang === 'am'
              ? 'ደፋር ጣዕም — በትኩስ ምግብና በፍቅር ይዘጋጅ'
              : 'Fearless flavor, served fresh. Browse the menu and order with your server.'}
          </p>
        </section>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={lang === 'am' ? 'ምግብ ይፈልጉ…' : 'Search the menu…'}
            className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm text-foreground outline-none transition focus:border-primary"
          />
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
                  <FeaturedCard key={i.id} item={i} lang={lang} />
                ))}
              </div>
            </ScrollFade>
          </section>
        )}

        {/* Empty State */}
        {items.length === 0 && query === '' && (
          <div className="py-12 text-center text-muted-foreground">
            <UtensilsCrossed className="mx-auto h-12 w-12 opacity-20 mb-4" />
            <p className="text-lg font-medium">
              {lang === 'am' ? 'ምንም ምግቦች አልተገኙም።' : 'No menu items available.'}
            </p>
            <p className="text-sm mt-2">
              {lang === 'am'
                ? 'እባክዎ ቆየት ብለው ይሞክሩ።'
                : 'Check back later when items are added.'}
            </p>
          </div>
        )}

        {/* Categories */}
        {grouped.map(({ cat, items: list }) =>
          list.length === 0 && query !== '' ? null : (
            <section
              key={cat.id}
              id={`cat-${cat.id}`}
              className="mb-8 scroll-mt-32"
            >
              <SectionTitle
                label={lang === 'am' ? (cat.name_am ?? cat.name) : cat.name}
              />
              <div className="mt-3 space-y-3">
                {list.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {lang === 'am' ? 'ምንም የሚታይ ምግብ የለም።' : 'No items yet.'}
                  </p>
                ) : (
                  list.map((i) => <ItemCard key={i.id} item={i} lang={lang} />)
                )}
              </div>
            </section>
          ),
        )}

        {grouped.every(({ items: l }) => l.length === 0) && query !== '' && (
          <p className="mt-12 text-center text-sm text-muted-foreground">
            {lang === 'am' ? 'ምንም ውጤት የለም።' : 'No matching items.'}
          </p>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
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
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
              Crafted by{' '}
              <a
                href="https://kidusportfoloio.netlify.app/"
                target="_blank"
                rel="noreferrer"
                className="hover:text-primary"
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
              <span>View Bill</span>
              <span className="font-display text-base">
                {formatBirr(total)} ETB
              </span>
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bill Drawer */}
      {billOpen && (
        <BillDrawer lang={lang} onClose={() => setBillOpen(false)} />
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

function ItemCard({ item, lang }: { item: MenuItem; lang: Lang }) {
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
            src={item.image_url}
            alt={name}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            className={`h-20 w-20 rounded-lg object-cover transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
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
                    onClick={() => decrement(item.id)}
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-primary hover:text-primary"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-4 text-center text-xs font-bold">
                    {qty}
                  </span>
                </>
              )}
              <button
                onClick={() =>
                  add({ id: item.id, name, price: Number(item.price) })
                }
                className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:opacity-90 active:scale-95"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function FeaturedCard({ item, lang }: { item: MenuItem; lang: Lang }) {
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
      {/* Image area — click scrolls to item */}
      <button onClick={scrollToItem} className="w-full text-left">
        {item.image_url ? (
          <div className="relative h-28 w-full">
            {!imgLoaded && (
              <Skeleton className="absolute inset-0 h-28 w-full rounded-none" />
            )}
            <img
              src={item.image_url}
              alt={name}
              onLoad={() => setImgLoaded(true)}
              className={`h-28 w-full object-cover transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
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
              onClick={() => decrement(item.id)}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-primary hover:text-primary"
            >
              <Minus className="h-2.5 w-2.5" />
            </button>
            <span className="w-4 text-center text-xs font-bold">{qty}</span>
          </>
        )}
        <button
          onClick={() => add({ id: item.id, name, price: Number(item.price) })}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 active:scale-95"
        >
          <Plus className="h-2.5 w-2.5" />
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

function BillDrawer({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const { items, increment, decrement, remove, clear, total } = useCart()
  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={onClose}>
      {/* Backdrop */}
      <div className="flex-1 bg-black/60 backdrop-blur-sm" />
      {/* Drawer */}
      <div
        className="w-full rounded-t-2xl border-t border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-display text-lg uppercase tracking-widest text-primary">
            {lang === 'am' ? 'ሒሳብ' : 'Your Bill'}
          </h2>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                onClick={clear}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
                {lang === 'am' ? 'አጽዳ' : 'Clear'}
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
        <div className="max-h-[50vh] overflow-y-auto px-4 py-2">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {lang === 'am' ? 'ምናሌ ባዶ ነው' : 'Your cart is empty'}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
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
          <div className="border-t border-border px-4 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground uppercase tracking-wider">
                {lang === 'am' ? 'ጠቅላላ' : 'Total'}
              </span>
              <span className="font-display text-2xl text-primary">
                {formatBirr(total)} <span className="text-sm">ETB</span>
              </span>
            </div>
            <p className="mt-1 text-center text-[10px] text-muted-foreground">
              {lang === 'am'
                ? 'ክፍያ ወደ አስተናጋጅ ያሳዩ'
                : 'Show this bill to your waiter to pay'}
            </p>
          </div>
        )}
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
