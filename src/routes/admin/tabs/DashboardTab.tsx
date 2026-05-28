import { useEffect, useState, useMemo } from 'react'
import {
  TrendingUp,
  ShoppingBag,
  Wallet,
  Flame,
  X,
  Check,
  Users,
  Activity,
  BarChart3,
  Layout,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { supabaseBrowser } from '@/integrations/supabase/client.browser'

import { useTranslation } from '@/lib/i18n'

import {
  getDashboardKPIs,
  getDashboardTrends,
  getDashboardTopStats,
  getOutOfStockItems,
  type DashboardKPIs,
  type DashboardTrends,
  type TopStats,
} from '@/server/admin.functions'
import { Skeleton } from '@/components/ui/skeleton'

type OutOfStockItem = { id: string; name: string; name_am: string | null }

export function DashboardTab() {
  const { t, dt } = useTranslation()

  const [kpis, setKpis] = useState<DashboardKPIs | null>(null)
  const [trends, setTrends] = useState<DashboardTrends | null>(null)
  const [topStats, setTopStats] = useState<TopStats | null>(null)
  const [outOfStock, setOutOfStock] = useState<OutOfStockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<'7' | '30'>('7')

  const fetchAll = async () => {
    // Fire all requests in parallel and handle them independently
    getDashboardKPIs().then(setKpis).catch(console.error)
    getDashboardTrends().then(setTrends).catch(console.error)
    getDashboardTopStats().then(setTopStats).catch(console.error)
    getOutOfStockItems()
      .then((os) => setOutOfStock(os as OutOfStockItem[]))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  // Fetch on mount
  useEffect(() => {
    fetchAll()
  }, [])

  // Real-time listeners and patching
  useEffect(() => {
    const handleReload = () => fetchAll()

    // Listen for real-time events across different channels
    // We use a unique name here to avoid conflict with useAdminRealtime hook
    const realtimeChannel = supabaseBrowser
      .channel('origin-dashboard-patching')
      .on('broadcast', { event: 'new_order' }, ({ payload }) => {
        // Instant patch for KPIs
        setKpis((prev) => {
          if (!prev) return prev
          const newOrder = payload
          const newRevenue =
            newOrder.status === 'accepted' || newOrder.status === 'completed'
              ? prev.todayRevenue + Number(newOrder.total_amount || 0)
              : prev.todayRevenue

          return {
            ...prev,
            todayOrders: prev.todayOrders + 1,
            todayRevenue: newRevenue,
            avgOrderValue:
              prev.todayOrders + 1 > 0
                ? (prev.todayRevenue + Number(newOrder.total_amount || 0)) /
                  (prev.todayOrders + 1)
                : 0,
          }
        })
        // Also refresh top stats in background since they require complex tallying
        getDashboardTopStats().then(setTopStats)
      })
      .on('broadcast', { event: 'order_status_updated' }, ({ payload }) => {
        // If an order was accepted, update revenue
        if (payload.status === 'accepted') {
          setKpis((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              todayRevenue:
                prev.todayRevenue + Number(payload.total_amount || 0),
            }
          })
        }
      })
      .subscribe()

    const notificationsChannel = supabaseBrowser
      .channel('origin-notifications')
      .on('broadcast', { event: 'reload-menu' }, () => handleReload())
      .subscribe()

    window.addEventListener('reload-orders', handleReload)
    window.addEventListener('reload-menu', handleReload)
    window.addEventListener('currency-changed', handleReload)

    return () => {
      supabaseBrowser.removeChannel(realtimeChannel)
      supabaseBrowser.removeChannel(notificationsChannel)
      window.removeEventListener('reload-orders', handleReload)
      window.removeEventListener('reload-menu', handleReload)
      window.removeEventListener('currency-changed', handleReload)
    }
  }, [])

  const kpiData = [
    {
      icon: ShoppingBag,
      label: t('today_orders'),
      value: kpis?.todayOrders ?? 0,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      icon: TrendingUp,
      label: t('today_revenue'),
      value: `${kpis?.todayRevenue.toLocaleString() ?? 0} ${t('currency')}`,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      icon: Users,
      label: t('today_customers'),
      value: kpis?.todayCustomers ?? 0,
      color: 'text-violet-500',
      bg: 'bg-violet-500/10',
    },
    {
      icon: Wallet,
      label: t('avg_order_value'),
      value: `${Math.round(kpis?.avgOrderValue ?? 0).toLocaleString()} ${t('currency')}`,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
  ]

  // Refine the background for the first KPI
  kpiData[0].bg = 'bg-blue-500/10'

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

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {!kpis
          ? [1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-32 w-full animate-pulse rounded-2xl border border-border bg-card/40 backdrop-blur-xl p-6"
              >
                <Skeleton className="h-4 w-24 mb-4" />
                <Skeleton className="h-8 w-32" />
              </div>
            ))
          : kpiData.map(({ icon: Icon, label, value, color, bg }) => (
              <div
                key={label}
                className="group relative overflow-hidden rounded-2xl border border-white/5 bg-card/40 backdrop-blur-md p-6 shadow-xl transition-all hover:border-white/10 hover:shadow-2xl"
              >
                <div
                  className={`absolute -right-12 -top-12 h-48 w-36 rounded-full ${bg} opacity-20 blur-3xl transition-all duration-700 group-hover:scale-150 group-hover:opacity-40`}
                />
                <div
                  className={`absolute -right-8 -top-8 h-32 w-32 rounded-full ${bg} opacity-10 blur-2xl transition-all duration-500 group-hover:translate-x-4`}
                />
                <div className="relative z-10 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
                      <Icon className={`h-5 w-5 ${color}`} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">
                      {label}
                    </span>
                  </div>
                  <p className="font-display text-2xl font-black tracking-tighter text-foreground">
                    {value}
                  </p>
                </div>
              </div>
            ))}
      </div>

      {/* Sales Trend Chart Section */}
      <div className="rounded-3xl border border-white/5 bg-card/30 backdrop-blur-xl p-8 shadow-2xl overflow-hidden relative group transition-all hover:border-white/10">
        <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-transparent opacity-50" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h3 className="font-display text-sm uppercase tracking-widest text-foreground">
                {t('revenue_trend')}
              </h3>
            </div>
            <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/70">
              {t('weekly_perf')}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center rounded-xl bg-white/5 border border-white/10 p-1">
              <button
                onClick={() => setRange('7')}
                className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all focus:outline-none focus:ring-0 ${
                  range === '7'
                    ? 'bg-primary text-primary-foreground shadow-lg'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('seven_days')}
              </button>
              <button
                onClick={() => setRange('30')}
                className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all focus:outline-none focus:ring-0 ${
                  range === '30'
                    ? 'bg-primary text-primary-foreground shadow-lg'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('thirty_days')}
              </button>
            </div>
          </div>
        </div>

        <div className="relative h-64 w-full [&_svg]:outline-none [&_.recharts-wrapper]:outline-none">
          {!trends ? (
            <Skeleton className="h-full w-full rounded-2xl" />
          ) : (
            <div className="relative h-full w-full">
              <InteractiveChart
                data={
                  range === '7' ? trends?.weekly || [] : trends?.monthly || []
                }
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
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
              {t('item_special_badge')}
            </div>
          </div>

          <div className="space-y-3">
            {!topStats ? (
              [1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))
            ) : !topStats?.items.length ? (
              <div className="flex flex-col items-center justify-center py-10 opacity-40">
                <ShoppingBag className="h-10 w-10 mb-2" />
                <p className="text-sm">{t('no_orders_yet')}</p>
              </div>
            ) : (
              topStats.items.map((item, idx) => (
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

        {/* Top Tables Widget */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layout className="h-5 w-5 text-blue-500" />
              <h3 className="font-display text-xs uppercase tracking-widest text-foreground">
                {t('top_tables')}
              </h3>
            </div>
            <div className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-500">
              {t('live_data')}
            </div>
          </div>

          <div className="space-y-3">
            {!topStats ? (
              [1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))
            ) : !topStats?.tables.length ? (
              <div className="flex flex-col items-center justify-center py-10 opacity-40">
                <Activity className="h-10 w-10 mb-2" />
                <p className="text-sm">{t('no_orders_yet')}</p>
              </div>
            ) : (
              topStats.tables.map((table, idx) => (
                <div
                  key={table.label}
                  className="flex items-center justify-between rounded-xl bg-blue-500/5 p-4 transition-colors hover:bg-blue-500/10 border border-transparent hover:border-blue-500/20"
                >
                  <div className="flex items-center gap-4">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/10 text-[10px] font-black text-blue-600 border border-blue-500/20">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      {table.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-foreground">
                      {table.count}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      {t('admin_orders')}
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
                {t('eighty_board')}
              </h3>
            </div>
            {outOfStock.length ? (
              <div className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                {outOfStock.length} {t('items')}
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            {loading && outOfStock.length === 0 ? (
              [1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))
            ) : !outOfStock.length ? (
              <div className="flex flex-col items-center justify-center py-10 opacity-40">
                <Check className="h-10 w-10 mb-2 text-emerald-500" />
                <p className="text-sm">{t('in_stock_all')}</p>
              </div>
            ) : (
              outOfStock.map((item) => (
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
                    {t('out')}
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

function InteractiveChart({
  data,
}: {
  data: Array<{ date: string; amount: number }>
}) {
  const { t } = useTranslation()
  const chartData = useMemo(() => {
    if (data.length === 0) return []
    const now = new Date().setHours(0, 0, 0, 0)

    return data.map((d) => {
      const dateObj = new Date(d.date)
      const isToday = dateObj.getTime() === now
      return {
        ...d,
        formattedDate: dateObj.toLocaleDateString(undefined, {
          weekday: data.length > 7 ? undefined : 'short',
          day: 'numeric',
          month: data.length > 7 ? 'short' : undefined,
        }),
        isToday,
      }
    })
  }, [data])

  if (data.length === 0) return null

  return (
    <div
      style={{ width: '100%', height: '100%', outline: 'none' }}
      tabIndex={-1}
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        style={{ outline: 'none' }}
      >
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          style={{ outline: 'none', border: 'none' }}
        >
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="hsl(25, 95%, 53%)"
                stopOpacity={0.4}
              />
              <stop
                offset="95%"
                stopColor="hsl(25, 95%, 53%)"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.05)"
          />
          <XAxis
            dataKey="formattedDate"
            axisLine={false}
            tickLine={false}
            tick={{
              fontSize: 9,
              fill: 'rgba(156, 163, 175, 0.8)',
              fontWeight: 700,
            }}
            dy={10}
            interval={data.length > 7 ? 4 : 0}
            minTickGap={20}
          />
          <YAxis hide domain={[0, 'auto']} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(23, 23, 23, 0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(12px)',
              fontSize: '11px',
              color: '#fff',
              padding: '12px',
            }}
            itemStyle={{ color: 'hsl(var(--primary))', fontWeight: '900' }}
            labelStyle={{
              color: 'rgba(156, 163, 175, 0.9)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontWeight: '900',
              fontSize: '9px',
            }}
            cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
            formatter={(value: any) => [
              `${Number(value).toLocaleString()} ${t('currency')}`,
              t('revenue_trend'),
            ]}
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="hsl(25, 95%, 53%)"
            strokeWidth={4}
            fillOpacity={1}
            fill="url(#colorRevenue)"
            animationDuration={300}
            activeDot={{
              r: 6,
              fill: 'hsl(25, 95%, 53%)',
              stroke: '#fff',
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
