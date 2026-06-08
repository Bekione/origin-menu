import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, X, ChefHat, Loader2, ClipboardList } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useTranslation } from '@/lib/i18n'
import { LiveTimeAgo } from '@/lib/date-utils'
import {
  getTableOrders,
  updateOrderStatus,
  type TableOrder,
} from '@/server/table.functions'

export function OrdersTab() {
  const { t } = useTranslation()
  const [orders, setOrders] = useState<TableOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [doneLoadingMore, setDoneLoadingMore] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState(() => {
    if (typeof window === 'undefined') return 'Live'
    return localStorage.getItem('admin_refresh_interval') || 'Live'
  })
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const LIMIT = 20

  const fetchOrders = async (isLoadMore = false, silent = false) => {
    if (isLoadMore) setDoneLoadingMore(true)
    else if (!silent) setLoading(true)

    try {
      const currentOffset = isLoadMore ? offset + LIMIT : 0
      const data = await getTableOrders({
        data: { offset: currentOffset, limit: LIMIT },
      })
      const newOrders = (data as TableOrder[]) || []

      if (isLoadMore) {
        setOrders((prev) => [...prev, ...newOrders])
        setOffset(currentOffset)
      } else {
        setOrders(newOrders)
        setOffset(0)
      }

      if (newOrders.length < LIMIT) setHasMore(false)
      else setHasMore(true)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      if (!silent) setLoading(false)
      setDoneLoadingMore(false)
    }
  }

  useEffect(() => {
    fetchOrders()

    // Watch for localStorage changes (settings tab updates)
    const handleSettingsChange = () => {
      setRefreshInterval(
        localStorage.getItem('admin_refresh_interval') || 'Live',
      )
    }
    window.addEventListener('storage', handleSettingsChange)
    window.addEventListener('settings-changed', handleSettingsChange)

    let interval: any
    if (refreshInterval !== 'Live' && refreshInterval !== 'Off') {
      const ms = refreshInterval === '1m' ? 60000 : 300000
      interval = setInterval(() => fetchOrders(false, true), ms)
    }

    const handleReload = () => fetchOrders(false, true)
    window.addEventListener('reload-orders', handleReload)

    return () => {
      if (interval) clearInterval(interval)
      window.removeEventListener('reload-orders', handleReload)
      window.removeEventListener('storage', handleSettingsChange)
      window.removeEventListener('settings-changed', handleSettingsChange)
    }
  }, [refreshInterval])

  const handleStatus = async (
    id: string,
    status: 'accepted' | 'rejected' | 'completed',
  ) => {
    setBusyId(id)
    try {
      await updateOrderStatus({ data: { id, status } })

      // Update local state ONLY after server success
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)))

      // Silently refresh other tabs (Dashboard, etc.) without affecting this tab's skeleton
      window.dispatchEvent(new CustomEvent('reload-orders'))

      if (status === 'accepted') toast.success(t('order_accepted_toast'))
      if (status === 'rejected') toast(t('order_rejected_toast'))
      if (status === 'completed') toast.success(t('order_completed_toast'))
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const pending = orders.filter((o) => o.status === 'pending')
  const accepted = orders.filter((o) => o.status === 'accepted')
  const done = orders.filter((o) =>
    ['rejected', 'completed'].includes(o.status),
  )

  function OrderCard({ order }: { order: TableOrder }) {
    const { t, dt } = useTranslation()
    const isPending = order.status === 'pending'
    const isAccepted = order.status === 'accepted'
    const busy = busyId === order.id

    return (
      <div
        className={`rounded-xl border bg-card transition-all w-full inline-block break-inside-avoid mb-3 p-4 ${
          isPending
            ? 'border-primary/60 shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]'
            : isAccepted
              ? 'border-green-500/40 bg-green-500/5'
              : 'border-border opacity-60'
        }`}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            {isPending ? (
              <ChefHat className="text-primary h-4 w-4" />
            ) : isAccepted ? (
              <Check className="text-green-500 h-4 w-4" />
            ) : (
              <X className="text-muted-foreground h-4 w-4" />
            )}
            <span className="font-display font-semibold uppercase tracking-wider text-sm">
              {order.table_label}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                isPending
                  ? 'bg-primary/10 text-primary'
                  : isAccepted
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {order.status === 'pending'
                ? t('status_pending')
                : order.status === 'accepted'
                  ? t('status_preparing')
                  : order.status === 'completed'
                    ? t('status_completed')
                    : t('status_rejected')}
            </span>
          </div>
          <span className="shrink-0 text-muted-foreground text-[11px]">
            <LiveTimeAgo ts={order.created_at} />
          </span>
        </div>

        <ul className="mb-3 space-y-1">
          {order.items.map((item, i) => (
            <li key={i} className="flex items-center justify-between text-sm">
              <span className="truncate mr-4">
                <span className="mr-2 font-bold text-primary">×{item.qty}</span>
                {dt(item, 'name')}
              </span>
              <span className="text-muted-foreground whitespace-nowrap">
                {(item.qty * item.price).toLocaleString()} {t('currency')}
              </span>
            </li>
          ))}
        </ul>

        {order.note && (
          <p className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs italic text-muted-foreground mb-3">
            "{order.note}"
          </p>
        )}

        {isPending && (
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => handleStatus(order.id, 'accepted')}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {t('accept')}
            </button>
            <button
              disabled={busy}
              onClick={() => handleStatus(order.id, 'rejected')}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" /> {t('reject')}
            </button>
          </div>
        )}

        {isAccepted && (
          <button
            disabled={busy}
            onClick={() => handleStatus(order.id, 'completed')}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-green-500/40 px-3 py-2 text-xs font-semibold text-green-600 hover:bg-green-500/10 dark:text-green-400 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            {t('mark_completed')}
          </button>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <section>
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="columns-1 sm:columns-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl mb-3" />
            ))}
          </div>
        </section>
        <section>
          <Skeleton className="h-6 w-48 mb-4 opacity-50" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 opacity-30">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-sm uppercase tracking-wider text-primary">
          <ChefHat className="h-4 w-4" />
          {t('pending_orders_title')}
          {pending.length > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
              {pending.length}
            </span>
          )}
        </h2>
        {pending.length === 0 ? (
          <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
            {t('no_pending_orders')}
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 gap-3">
            {pending.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        )}
      </section>

      {accepted.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-sm uppercase tracking-wider text-green-600 dark:text-green-400">
            <Check className="h-4 w-4" /> {t('in_kitchen_title')}
          </h2>
          <div className="columns-1 sm:columns-2 gap-3">
            {accepted.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-sm uppercase tracking-wider text-muted-foreground">
            <ClipboardList className="h-4 w-4" />{' '}
            {t('completed_rejected_title')}
          </h2>
          <div className="columns-1 sm:columns-2 gap-3 opacity-70">
            {done.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
          {hasMore && (
            <button
              onClick={() => fetchOrders(true)}
              disabled={doneLoadingMore}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 text-sm font-bold uppercase tracking-widest text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-60"
            >
              {doneLoadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('loading')}
                </>
              ) : (
                t('load_more')
              )}
            </button>
          )}
          {!hasMore && done.length > 0 && (
            <div className="mt-8 flex flex-col items-center justify-center gap-2 opacity-30">
              <div className="h-px w-24 bg-border" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em]">
                {t('no_more_orders')}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
