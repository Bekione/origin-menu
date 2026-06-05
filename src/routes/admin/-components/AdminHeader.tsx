import { Link } from '@tanstack/react-router'
import {
  Bell,
  ExternalLink,
  Loader2,
  LogOut,
  UtensilsCrossed,
  Layers,
  Store,
  QrCode,
  ClipboardList,
  BarChart3,
  Settings,
} from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import ScrollFade from '#/components/ScrollFade'
import { useTranslation } from '@/lib/i18n'
import { TabButton } from './TabButton'
import logo from '@/assets/origin-logo-admin.png'

interface AdminHeaderProps {
  tab: string
  setTab: (t: any) => void
  pendingCount: number
  pendingOrderCount: number
  callsOpen: boolean
  setCallsOpen: (v: boolean | ((v: boolean) => boolean)) => void
  loggingOut: boolean
  onLogout: () => void
}

export function AdminHeader({
  tab,
  setTab,
  pendingCount,
  pendingOrderCount,
  setCallsOpen,
  loggingOut,
  onLogout,
}: AdminHeaderProps) {
  const { lang, setLang, t } = useTranslation()

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-y-4 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm border border-white/10">
            <img src={logo} alt="Origin" className="h-8 w-8 object-contain" />
          </div>
          <div>
            <h1 className="font-display text-xl sm:text-2xl text-primary leading-none">
              CONSOLE
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Origin Admin
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 ml-auto sm:ml-0">
          <button
            onClick={() => setCallsOpen((v) => !v)}
            className="relative rounded-md border border-border p-1.5 text-muted-foreground transition hover:border-primary hover:text-primary"
            aria-label="Waiter calls"
          >
            <Bell className="h-4 w-4" />
            {pendingCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </button>
          <Link
            to="/"
            search={{ table: undefined }}
            title="View App Menu"
            className="flex items-center justify-center rounded-md border border-border p-1.5 text-muted-foreground transition hover:border-primary hover:text-primary"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
          <button
            onClick={() => setLang(lang === 'en' ? 'am' : 'en')}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground transition hover:border-primary hover:text-primary"
            aria-label="Toggle language"
          >
            {lang === 'en' ? 'አማ' : 'EN'}
          </button>
          <ThemeToggle />
          <button
            disabled={loggingOut}
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:border-destructive hover:text-destructive whitespace-nowrap disabled:opacity-50"
          >
            {loggingOut ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LogOut className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">
              {loggingOut ? t('logging_out') : t('logout')}
            </span>
          </button>
        </div>
      </div>
      <ScrollFade direction="horizontal">
        <div className="mx-auto flex max-w-5xl gap-1 px-4 overflow-x-auto scrollbar-none snap-x snap-mandatory">
          <TabButton
            active={tab === 'dashboard'}
            onClick={() => setTab('dashboard')}
            icon={<BarChart3 className="h-4" />}
          >
            Dashboard
          </TabButton>
          <TabButton
            active={tab === 'orders'}
            onClick={() => setTab('orders')}
            icon={<ClipboardList className="h-4" />}
          >
            {t('admin_orders')}
            {pendingOrderCount > 0 && (
              <span className="ml-1.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white shadow-sm">
                {pendingOrderCount > 9 ? '9+' : pendingOrderCount}
              </span>
            )}
          </TabButton>
          <TabButton
            active={tab === 'items'}
            onClick={() => setTab('items')}
            icon={<UtensilsCrossed className="h-4" />}
          >
            {t('admin_menu')}
          </TabButton>
          <TabButton
            active={tab === 'categories'}
            onClick={() => setTab('categories')}
            icon={<Layers className="h-4" />}
          >
            {t('admin_categories')}
          </TabButton>
          <TabButton
            active={tab === 'tables'}
            onClick={() => setTab('tables')}
            icon={<Store className="h-4" />}
          >
            {t('admin_tables')}
          </TabButton>
          <TabButton
            active={tab === 'info'}
            onClick={() => setTab('info')}
            icon={<QrCode className="h-4" />}
          >
            {t('admin_info')}
          </TabButton>
          <TabButton
            active={tab === 'settings'}
            onClick={() => setTab('settings')}
            icon={<Settings className="h-4" />}
          >
            Settings
          </TabButton>
        </div>
      </ScrollFade>
    </header>
  )
}
