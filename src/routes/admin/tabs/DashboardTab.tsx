import { useEffect, useState } from 'react'
import { TrendingUp, ShoppingBag, Wallet, Flame, X, Check } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

import {
  getDashboardStats,
  type DashboardStats,
} from '@/server/admin.functions'
import { Skeleton } from '@/components/ui/skeleton'

export function DashboardTab() {
  const { t, dt } = useTranslation()

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    try {
      const data = await getDashboardStats()
      setStats(data)
    } catch (err) {
      console.error('Failed to fetch dashboard stats', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()

    // Listen for order updates to refresh stats
    const handleReload = () => fetchStats()
    window.addEventListener('reload-orders', handleReload)
    return () => window.removeEventListener('reload-orders', handleReload)
  }, [])

  const kpis = [
    {
      icon: ShoppingBag,
      label: t('today_orders'),
      value: stats?.todayOrders ?? 0,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      icon: TrendingUp,
      label: t('today_revenue'),
      value: `${stats?.todayRevenue.toLocaleString() ?? 0} ${t('currency')}`,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      icon: Wallet,
      label: t('avg_order_value'),
      value: `${Math.round(stats?.avgOrderValue ?? 0).toLocaleString()} ${t('currency')}`,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
  ]

  // Fix the typo in bg for orders
  kpis[0].bg = 'bg-blue-500/10'

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl uppercase tracking-widest text-foreground">
          {t('today_at_a_glance')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('dashboard_desc')}
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? [1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 w-full animate-pulse rounded-2xl border border-border bg-card/40 backdrop-blur-xl p-6"
              >
                <Skeleton className="h-4 w-24 mb-4" />
                <Skeleton className="h-8 w-32" />
              </div>
            ))
          : kpis.map(({ icon: Icon, label, value, color, bg }) => (
              <div
                key={label}
                className="group relative overflow-hidden rounded-2xl border border-white/5 bg-card/40 backdrop-blur-md p-6 shadow-xl transition-all hover:border-white/10 hover:shadow-2xl"
              >
                {/* High-fidelity glass-glow effect */}
                <div
                  className={`absolute -right-12 -top-12 h-48 w-36 rounded-full ${bg} opacity-20 blur-3xl transition-all duration-700 group-hover:scale-150 group-hover:opacity-40`}
                />

                {/* Secondary accent glow */}
                <div
                  className={`absolute -right-8 -top-8 h-32 w-32 rounded-full ${bg} opacity-10 blur-2xl transition-all duration-500 group-hover:translate-x-4`}
                />

                <div className="relative z-10 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 backdrop-blur-sm border border-white/10`}
                    >
                      <Icon className={`h-5 w-5 ${color}`} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">
                      {label}
                    </span>
                  </div>
                  <p className="font-display text-3xl font-black tracking-tighter text-foreground">
                    {value}
                  </p>
                </div>
              </div>
            ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Selling Items */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              <h3 className="font-display text-xs uppercase tracking-widest text-foreground">
                {t('top_items')}
              </h3>
            </div>
            <div className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold text-orange-500">
              {t('todays_special').split(' ')[1] || 'Today'}
            </div>
          </div>

          <div className="space-y-3">
            {loading ? (
              [1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))
            ) : !stats?.topItems.length ? (
              <div className="flex flex-col items-center justify-center py-10 opacity-40">
                <ShoppingBag className="h-10 w-10 mb-2" />
                <p className="text-sm">{t('no_orders_yet')}</p>
              </div>
            ) : (
              stats.topItems.map((item, idx) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between rounded-xl bg-muted/30 p-4 transition-colors hover:bg-muted/50 border border-transparent hover:border-border"
                >
                  <div className="flex items-center gap-4">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground/5 text-[10px] font-black text-muted-foreground border border-border/50">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-foreground">
                      {item.qty}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      {t('items')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 86'd Items (Out of Stock) */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <X className="h-5 w-5 text-destructive" />
              <h3 className="font-display text-xs uppercase tracking-widest text-foreground">
                86'd Items (Out of Stock)
              </h3>
            </div>
            {stats?.outOfStockItems.length ? (
              <div className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                {stats.outOfStockItems.length} {t('items')}
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            {loading ? (
              [1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))
            ) : !stats?.outOfStockItems.length ? (
              <div className="flex flex-col items-center justify-center py-10 opacity-40">
                <Check className="h-10 w-10 mb-2 text-emerald-500" />
                <p className="text-sm">Everything is in stock</p>
              </div>
            ) : (
              stats.outOfStockItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl bg-destructive/5 p-4 border border-destructive/10"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-foreground">
                      {dt(item, 'name')}
                    </span>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-destructive">
                    OUT OF STOCK
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
