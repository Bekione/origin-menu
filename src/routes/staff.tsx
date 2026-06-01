import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getAuthSession } from '@/server/auth-helpers'
import {
  getTableOrders,
  updateOrderStatus,
  getWaiterCalls,
  acknowledgeCall,
  dismissCall,
  type TableOrder,
  type WaiterCall,
} from '@/server/table.functions'
import {
  getMenuData,
  toggleAvailability,
  type MenuItem,
} from '@/server/menu.functions'
import { authClient } from '#/lib/auth-client'
import { supabaseBrowser } from '@/integrations/supabase/client.browser'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Skeleton } from '@/components/ui/skeleton'
import logo from '@/assets/origin-logo.jpg'
import grayLogo from '@/assets/origin-logo-gray.png'
import ScrollFade from '@/components/ScrollFade'
import { EightyBoard } from '#/components/EightyBoard'
import {
  Bell,
  Check,
  ChefHat,
  ClipboardList,
  Loader2,
  LogOut,
  X,
  Utensils,
  Plus,
  RefreshCw,
} from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import { LiveTimeAgo } from '@/lib/date-utils'
import { sendDesktopNotification } from '@/lib/desktop-utils'

// ── Route guard ────────────────────────────────────────────────────────────────
export const Route = createFileRoute('/staff')({
  beforeLoad: async () => {
    const session = await getAuthSession()
    if (!session?.user) throw redirect({ to: '/staff-login' })
    const role = (session.user as any).role
    if (role === 'admin') throw redirect({ to: '/admin' })
    if (role !== 'staff') throw redirect({ to: '/staff-login' })
  },
  component: StaffPage,
})

// ── Notification sound ─────────────────────────────────────────────────────────
function playKDSAlert() {
  // Respect admin-configured KDS sound settings
  if (localStorage.getItem('admin_kds_sound_enabled') === 'false') return
  const volumePct = Number(localStorage.getItem('admin_kds_volume') || '32')
  const masterVolume = volumePct / 100

  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  const masterGain = ctx.createGain()
  masterGain.gain.value = masterVolume
  masterGain.connect(ctx.destination)
  const now = ctx.currentTime
  function createTone(
    freq: number,
    delay: number,
    duration: number,
    volume: number,
  ) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const filter = ctx.createBiquadFilter()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now + delay)
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(3200, now + delay)
    gain.gain.setValueAtTime(0.001, now + delay)
    gain.gain.exponentialRampToValueAtTime(volume, now + delay + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + duration)
    osc.connect(filter)
    filter.connect(gain)
    gain.connect(masterGain)
    osc.start(now + delay)
    osc.stop(now + delay + duration + 0.2)
  }
  createTone(880, 0.0, 1.2, 0.45)
  createTone(1109, 0.0, 1.1, 0.38)
  createTone(1320, 0.05, 0.95, 0.3)
  setTimeout(() => {
    createTone(987.8, 0, 0.8, 0.22)
    createTone(1244.5, 0.02, 0.7, 0.18)
  }, 220)
}

// ── Main page ─────────────────────────────────────────────────────────────────
function StaffPage() {
  const { lang, setLang, t } = useTranslation()
  const navigate = Route.useNavigate()
  const [orders, setOrders] = useState<TableOrder[]>([])
  const [calls, setCalls] = useState<WaiterCall[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [busyStatus, setBusyStatus] = useState<string | null>(null)
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const [ackId, setAckId] = useState<string | null>(null)
  const [rejId, setRejId] = useState<string | null>(null)
  const [eightyOpen, setEightyOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const LIMIT = 20

  const handleFetchOrders = async (isLoadMore = false) => {
    if (isLoadMore) setIsFetchingMore(true)
    // else we don't set ordersLoading(true) if it's already loaded to avoid flicker

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
    } finally {
      if (isLoadMore) setIsFetchingMore(false)
      setOrdersLoading(false)
    }
  }

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (data?.session?.id) setCurrentSessionId(data.session.id)
    })

    handleFetchOrders()
    getWaiterCalls().then((d) => setCalls((d as WaiterCall[]) || []))
  }, [])

  // Realtime
  useEffect(() => {
    const channel = supabaseBrowser
      .channel('origin-realtime')
      // Waiter calls: postgres_changes works (table is in realtime publication)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'waiter_calls' },
        (p: any) => {
          const call = p.new as WaiterCall
          setCalls((prev) => {
            if (prev.find((c) => c.id === call.id)) return prev
            return [call, ...prev]
          })
          playKDSAlert()
          toast(
            t('waiter_calling_toast').replace(
              '{tableLabel}',
              call.table_label ?? '',
            ),
            { duration: 10000 },
          )
          sendDesktopNotification(
            t('waiter_calling_toast').replace(
              '{tableLabel}',
              call.table_label ?? '',
            ),
          )
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'waiter_calls' },
        (p: any) => {
          const call = p.new as WaiterCall
          setCalls((prev) =>
            prev.map((c) =>
              c.id === call.id ? { ...c, status: call.status } : c,
            ),
          )
        },
      )
      // Orders: use broadcasts only (table_orders may not be in realtime publication)
      .on('broadcast', { event: 'new_order' }, (p: any) => {
        const order = p.payload as TableOrder
        if (!order?.id) return
        setOrders((prev) => {
          if (prev.find((o) => o.id === order.id)) return prev
          return [order, ...prev]
        })
        playKDSAlert()
        toast(
          t('new_order_toast').replace(
            '{tableLabel}',
            (order as any).table_label ?? '',
          ),
          { duration: 10000 },
        )
        sendDesktopNotification(
          t('new_order_toast').replace(
            '{tableLabel}',
            (order as any).table_label ?? '',
          ),
          `${t('total')}: ${order.total_amount ?? 0} ETB`,
        )
      })
      .on('broadcast', { event: 'order_status_updated' }, (p: any) => {
        const order = p.payload as TableOrder
        if (!order?.id) return
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? { ...o, ...order } : o)),
        )
      })
      .on('broadcast', { event: 'session_revoked' }, async (p: any) => {
        const { id } = p.payload
        if (currentSessionId === id || !currentSessionId) {
          const { data } = await authClient.getSession()
          if (data?.session?.id === id || !data?.session) {
            await authClient.signOut()
            navigate({ to: '/staff-login' })
            toast.info('Session revoked by admin')
          }
        }
      })
      .subscribe()

    return () => {
      supabaseBrowser.removeChannel(channel)
    }
  }, [t, navigate, currentSessionId])

  const handleStatus = async (id: string, status: string) => {
    setBusyId(id)
    setBusyStatus(status)
    try {
      await updateOrderStatus({ data: { id, status: status as any } })
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)))
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBusyId(null)
      setBusyStatus(null)
    }
  }

  const handleAcknowledge = async (id: string) => {
    setAckId(id)
    try {
      await acknowledgeCall({ data: { id } })
      setCalls((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'acknowledged' } : c)),
      )
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setAckId(null)
    }
  }

  const handleRejectCall = async (id: string) => {
    setRejId(id)
    try {
      await dismissCall({ data: { id } })
      setCalls((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'rejected' } : c)),
      )
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setRejId(null)
    }
  }

  const handleLock = async () => {
    setLoggingOut(true)
    try {
      await authClient.signOut()
      navigate({ to: '/staff-login' })
    } catch {
      setLoggingOut(false)
    }
  }

  const pending = orders.filter((o) => o.status === 'pending')
  const accepted = orders.filter((o) => o.status === 'accepted')
  const done = orders.filter((o) =>
    ['rejected', 'completed'].includes(o.status),
  )

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background">
      <header className="relative z-10 shrink-0 border-b border-border bg-card/60 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="Origin"
              className="h-8 w-8 rounded-full bg-white p-0.5"
            />
            <div>
              <span className="font-display text-lg text-primary">ORIGIN</span>
              <span className="ml-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                KDS
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEightyOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:border-primary hover:text-primary"
            >
              {t('eighty_board')}
            </button>
            <button
              onClick={() => setLang(lang === 'en' ? 'am' : 'en')}
              className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground transition hover:border-primary hover:text-primary"
            >
              {lang === 'en' ? 'አማ' : 'EN'}
            </button>
            <ThemeToggle />
            <button
              onClick={handleLock}
              disabled={loggingOut}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-50"
            >
              {loggingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{t('lock')}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="relative flex-1 min-h-0">
          <div className="absolute inset-0 flex flex-col">
            <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center opacity-[0.03]">
              <img
                src={grayLogo}
                alt=""
                className="w-1/2 max-w-[50vmin] grayscale filter"
              />
            </div>
            <ScrollFade fadeSize={40} direction="vertical" className="flex-1">
              <main className="h-full overflow-y-auto p-4 custom-scrollbar">
                {ordersLoading ? (
                  <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <Skeleton
                        key={i}
                        className="mb-3 h-40 w-full rounded-2xl"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <section>
                      <div className="flex h-14 items-center gap-3 border-b border-border bg-muted/30 px-4">
                        <ChefHat className="h-5 w-5 text-primary" />
                        <h1 className="font-display text-xl tracking-widest text-foreground">
                          {t('kds_title')}
                        </h1>
                      </div>
                      <h2 className="my-3 flex items-center gap-2 font-display text-sm uppercase tracking-wider text-primary">
                        <ChefHat className="h-4 w-4" /> {t('status_pending')}
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                          {pending.length}
                        </span>
                      </h2>
                      {pending.length > 0 ? (
                        <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
                          {pending.map((o) => (
                            <KDSOrderCard
                              key={o.id}
                              order={o}
                              busyStatus={busyId === o.id ? busyStatus : null}
                              onStatus={handleStatus}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="flex h-32 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/5 text-muted-foreground opacity-50">
                          <ChefHat className="h-8 w-8" />
                          <span className="text-sm font-medium">
                            {t('no_pending_orders')}
                          </span>
                        </div>
                      )}
                    </section>

                    {accepted.length > 0 && (
                      <section>
                        <h2 className="mb-3 flex items-center gap-2 font-display text-sm uppercase tracking-wider text-green-600 dark:text-green-400">
                          <Check className="h-4 w-4" /> {t('status_preparing')}
                        </h2>
                        <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
                          {accepted.map((o) => (
                            <KDSOrderCard
                              key={o.id}
                              order={o}
                              busyStatus={busyId === o.id ? busyStatus : null}
                              onStatus={handleStatus}
                            />
                          ))}
                        </div>
                      </section>
                    )}

                    {done.length > 0 && (
                      <section>
                        <h2 className="mb-3 flex items-center gap-2 font-display text-sm uppercase tracking-wider text-muted-foreground">
                          <ClipboardList className="h-4 w-4" /> {t('done')}
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                            {done.length}
                          </span>
                        </h2>
                        <div className="columns-1 gap-3 opacity-50 sm:columns-2 lg:columns-3">
                          {done.map((o) => (
                            <KDSOrderCard
                              key={o.id}
                              order={o}
                              busyStatus={busyId === o.id ? busyStatus : null}
                              onStatus={handleStatus}
                            />
                          ))}
                        </div>
                        {hasMore && (
                          <div className="mt-4 flex justify-center pb-4">
                            <button
                              disabled={isFetchingMore}
                              onClick={() => handleFetchOrders(true)}
                              className="group flex w-full max-w-xs items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/40 py-4 text-sm font-black uppercase tracking-[0.2em] text-muted-foreground transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-primary active:scale-[0.98] disabled:opacity-50"
                            >
                              {isFetchingMore ? (
                                <>
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                  {t('loading')}
                                </>
                              ) : (
                                <>
                                  <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
                                  {t('load_more')}
                                </>
                              )}
                            </button>
                          </div>
                        )}
                        {!hasMore && done.length > 0 && (
                          <div className="mt-8 flex flex-col items-center justify-center gap-2 opacity-30 pb-4">
                            <div className="h-px w-24 bg-border" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em]">
                              {t('no_more_orders')}
                            </p>
                          </div>
                        )}
                      </section>
                    )}
                  </div>
                )}
              </main>
            </ScrollFade>
          </div>
        </div>

        <div className="flex h-64 shrink-0 flex-col border-t border-border bg-card/40 lg:h-auto lg:w-64 lg:border-l lg:border-t-0 min-h-0">
          <div className="flex-none p-4 pb-2">
            <div className="flex items-center gap-2 px-1">
              <Bell className="h-4 w-4 animate-pulse text-primary" />
              <h2 className="font-display text-lg tracking-widest text-foreground">
                {t('waiter_calls')}
              </h2>
            </div>
          </div>
          <ScrollFade fadeSize={40} direction="vertical" className="flex-1">
            <div className="h-full space-y-2 overflow-y-auto px-4 pb-4">
              {ordersLoading ? (
                [1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))
              ) : calls.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 pb-12 text-muted-foreground opacity-50">
                  <Bell className="h-8 w-8 opacity-40" />
                  <p className="text-xs font-medium">{t('clear_for_now')}</p>
                </div>
              ) : (
                calls.map((c) => (
                  <div
                    key={c.id}
                    className={`rounded-xl border p-3 transition-all ${c.status === 'pending' ? 'border-destructive/50 bg-destructive/5 shadow-sm' : 'border-border opacity-50'}`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-display text-sm font-bold tracking-tight text-foreground">
                        {c.table_label}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${c.status === 'pending' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}
                      >
                        {c.status === 'pending'
                          ? t('status_pending')
                          : c.status === 'acknowledged'
                            ? t('acknowledged')
                            : t('status_rejected')}
                      </span>
                    </div>
                    <LiveTimeAgo
                      ts={c.created_at}
                      className="mb-2 block text-[11px] text-muted-foreground"
                    />
                    {c.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAcknowledge(c.id)}
                          disabled={ackId === c.id || rejId === c.id}
                          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-secondary px-2 py-1.5 text-xs font-semibold hover:bg-secondary/80 disabled:opacity-50"
                        >
                          {ackId === c.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}{' '}
                          {t('ack')}
                        </button>
                        <button
                          onClick={() => handleRejectCall(c.id)}
                          disabled={ackId === c.id || rejId === c.id}
                          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                        >
                          {rejId === c.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}{' '}
                          {t('dismiss')}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollFade>
        </div>
      </div>

      {eightyOpen && <EightyBoard onClose={() => setEightyOpen(false)} />}
    </div>
  )
}

function KDSOrderCard({
  order,
  busyStatus,
  onStatus,
}: {
  order: TableOrder
  busyStatus: string | null
  onStatus: (id: string, s: string) => void
}) {
  const { t, dt } = useTranslation()
  const isPending = order.status === 'pending'
  const isAccepted = order.status === 'accepted'
  return (
    <div
      className={`mb-3 inline-block w-full break-inside-avoid rounded-2xl border bg-card p-4 shadow-sm transition-all ${busyStatus ? 'opacity-50' : ''}`}
    >
      <div className="mb-3 flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <Utensils className="h-4 w-4 text-primary" />
          <span className="font-display text-sm font-bold tracking-tight text-foreground">
            {order.table_label}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${isPending ? 'bg-destructive/10 text-destructive' : isAccepted ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}
          >
            {order.status === 'pending'
              ? t('status_pending')
              : order.status === 'accepted'
                ? t('status_accepted')
                : order.status === 'completed'
                  ? t('status_completed')
                  : t('status_rejected')}
          </span>
        </div>
        <LiveTimeAgo
          ts={order.created_at}
          className="text-[11px] text-muted-foreground"
        />
      </div>
      <ul className="mb-3 space-y-1">
        {order.items.map((item, i) => (
          <li key={i} className="flex items-center justify-between text-sm">
            <span>
              <span className="mr-2 font-bold text-primary">×{item.qty}</span>
              {dt(item, 'name')}
            </span>
            <span className="text-muted-foreground">
              {(item.qty * item.price).toLocaleString()} {t('currency')}
            </span>
          </li>
        ))}
      </ul>
      {order.note && (
        <p className="mb-3 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs italic text-muted-foreground mr-auto">
          {order.note}
        </p>
      )}
      {(isPending || order.status === 'pending') && (
        <div className="flex gap-2">
          <button
            disabled={!!busyStatus}
            onClick={() => onStatus(order.id, 'accepted')}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {busyStatus === 'accepted' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}{' '}
            {t('accept')}
          </button>
          <button
            disabled={!!busyStatus}
            onClick={() => onStatus(order.id, 'rejected')}
            className="flex items-center justify-center gap-1 w-16 rounded-lg border border-border px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-60"
          >
            {busyStatus === 'rejected' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </button>
        </div>
      )}
      {(isAccepted || order.status === 'accepted') && (
        <button
          disabled={!!busyStatus}
          onClick={() => onStatus(order.id, 'completed')}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-green-500/40 px-3 py-2.5 text-sm font-bold text-green-600 hover:bg-green-500/10 disabled:opacity-60"
        >
          {busyStatus === 'completed' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}{' '}
          {t('mark_done')}
        </button>
      )}
    </div>
  )
}
