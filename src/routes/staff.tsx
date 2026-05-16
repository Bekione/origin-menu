import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getAuthSession } from '@/server/auth-helpers'
import {
  getTableOrders,
  updateOrderStatus,
  getWaiterCalls,
  acknowledgeCall,
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
import {
  Bell,
  Check,
  ChefHat,
  ClipboardList,
  Loader2,
  LogOut,
  ToggleLeft,
  ToggleRight,
  X,
  Utensils,
} from 'lucide-react'

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
// Synthesize a clean bell/chime sound using Web Audio API
// macOS Style
function playKDSAlert() {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()

  const masterGain = ctx.createGain()
  masterGain.gain.value = 0.32
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

    // Gentle low-pass filter for softness
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(3200, now + delay)

    // Fast but smooth attack + natural decay
    gain.gain.setValueAtTime(0.001, now + delay)
    gain.gain.exponentialRampToValueAtTime(volume, now + delay + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + duration)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(masterGain)

    osc.start(now + delay)
    osc.stop(now + delay + duration + 0.2)
  }

  // Main macOS-like tones
  createTone(880, 0.0, 1.2, 0.45) // A5
  createTone(1109, 0.0, 1.1, 0.38) // C#6
  createTone(1320, 0.05, 0.95, 0.3) // E6

  // Higher sparkle (decays faster)
  createTone(1760, 0.03, 0.65, 0.18) // A6
  createTone(2200, 0.08, 0.55, 0.12) // C#7

  // Very subtle second hit (classic macOS double feel)
  setTimeout(() => {
    createTone(987.8, 0, 0.8, 0.22) // B5
    createTone(1244.5, 0.02, 0.7, 0.18) // D#6
  }, 220)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(ts: string) {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)

  if (diff < 5) return 'just now'
  if (diff < 60) return `${diff}s ago`

  const minutes = Math.floor(diff / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`

  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks}w ago`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`

  const years = Math.floor(days / 365)
  return `${years}y ago`
}

function LiveTimeAgo({ ts, className }: { ts: string; className?: string }) {
  const [ago, setAgo] = useState(() => timeAgo(ts))

  useEffect(() => {
    const update = () => setAgo(timeAgo(ts))

    update()

    // Update frequency based on age
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)

    let interval = 1000 // default: every second

    if (diff >= 60) interval = 30 * 1000 // every 30s
    if (diff >= 3600) interval = 60 * 1000 // every 1m
    if (diff >= 86400) interval = 60 * 60 * 1000 // every 1h

    const id = setInterval(update, interval)

    return () => clearInterval(id)
  }, [ts])

  return <span className={className}>{ago}</span>
}

// ── Main page ─────────────────────────────────────────────────────────────────
function StaffPage() {
  const navigate = Route.useNavigate()
  const [orders, setOrders] = useState<TableOrder[]>([])
  const [calls, setCalls] = useState<WaiterCall[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [busyStatus, setBusyStatus] = useState<string | null>(null)
  const [ackId, setAckId] = useState<string | null>(null)
  const [rejId, setRejId] = useState<string | null>(null)
  const [eightyOpen, setEightyOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [doneLimit, setDoneLimit] = useState(20)
  const [doneLoadingMore, setDoneLoadingMore] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabaseBrowser.channel> | null>(
    null,
  )

  // Initial fetch
  useEffect(() => {
    Promise.all([
      getTableOrders().then((d) => setOrders((d as TableOrder[]) || [])),
      getWaiterCalls().then((d) => setCalls((d as WaiterCall[]) || [])),
    ]).finally(() => setOrdersLoading(false))
  }, [])

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabaseBrowser
      .channel('kds-realtime')
      // Waiter calls
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'waiter_calls' },
        (p) => {
          const c = p.new as WaiterCall
          setCalls((prev) => [c, ...prev])
          playKDSAlert()
          toast(`🔔 ${c.table_label} is calling!`, { duration: 10000 })
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'waiter_calls' },
        (p) => {
          const updated = p.new as WaiterCall
          setCalls((prev) =>
            prev.map((c) => (c.id === updated.id ? updated : c)),
          )
        },
      )
      // Broadcast orders
      .subscribe()

    const bc = supabaseBrowser
      .channel('admin-orders')
      .on('broadcast', { event: 'new_order' }, (payload) => {
        const order = payload.payload as TableOrder
        setOrders((prev) => [order as any, ...prev])
        playKDSAlert()
        toast(`🍽️ New order from ${(order as any).table_label}!`, {
          duration: 10000,
        })
      })
      .subscribe()

    channelRef.current = channel
    return () => {
      supabaseBrowser.removeChannel(channel)
      supabaseBrowser.removeChannel(bc)
    }
  }, [])

  const handleStatus = async (
    id: string,
    status:
      | 'pending'
      | 'accepted'
      | 'rejected'
      | 'completed'
      | 'in-kitchen'
      | 'ready'
      | 'delivered'
      | string,
  ) => {
    setBusyId(id)
    setBusyStatus(status)
    try {
      await updateOrderStatus({ data: { id, status } })
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
      await acknowledgeCall({ data: { id, action: 'acknowledged' } as any })
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
      await updateOrderStatus({ data: { id, status: 'rejected' } as any })
    } catch {}
    setCalls((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'rejected' } : c)),
    )
    setRejId(null)
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
  const pendingCalls = calls.filter((c) => c.status === 'pending')

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background">
      {/* ── Header ── */}
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
              86 Board
            </button>
            <ThemeToggle />
            <button
              onClick={handleLock}
              disabled={loggingOut}
              title="Lock screen"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-50"
            >
              {loggingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Lock</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Body: Orders + Calls ── */}
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Orders Board */}
        <div className="relative flex-1 min-h-0">
          <div className="absolute inset-0 flex flex-col">
            {/* Background Logo Overlay for Orders Pane */}
            <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center opacity-[0.03]">
              <img
                src={grayLogo}
                alt=""
                className="w-1/2 max-w-[50vmin] grayscale filter"
              />
            </div>
            <ScrollFade
              fadeSize={40}
              direction="vertical"
              className="flex flex-col flex-1 min-h-0"
            >
              <main className="flex-1 overflow-y-auto p-4 custom-scrollbar">
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
                    {/* Pending */}
                    <section>
                      <h2 className="mb-3 flex items-center gap-2 font-display text-sm uppercase tracking-wider text-primary">
                        <ChefHat className="h-4 w-4" /> Pending
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
                          <div className="relative rounded-full bg-muted/20 p-3">
                            <ChefHat className="h-8 w-8" />
                            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-10 text-5xl">
                              /
                            </span>
                          </div>
                          <span className="text-sm font-medium">
                            No pending orders
                          </span>
                        </div>
                      )}
                    </section>

                    {/* In Kitchen */}
                    {accepted.length > 0 && (
                      <section>
                        <h2 className="mb-3 flex items-center gap-2 font-display text-sm uppercase tracking-wider text-green-600 dark:text-green-400">
                          <Check className="h-4 w-4" /> In Kitchen
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

                    {/* Completed */}
                    {done.length > 0 && (
                      <section>
                        <h2 className="mb-3 flex items-center gap-2 font-display text-sm uppercase tracking-wider text-muted-foreground">
                          <ClipboardList className="h-4 w-4" /> Done
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                            {done.length}
                          </span>
                        </h2>
                        <div className="columns-1 gap-3 opacity-50 sm:columns-2 lg:columns-3">
                          {done.slice(0, doneLimit).map((o) => (
                            <KDSOrderCard
                              key={o.id}
                              order={o}
                              busyStatus={busyId === o.id ? busyStatus : null}
                              onStatus={handleStatus}
                            />
                          ))}
                        </div>
                        {doneLimit < done.length && (
                          <button
                            onClick={() => {
                              setDoneLoadingMore(true)
                              setTimeout(() => {
                                setDoneLimit((l) => l + 20)
                                setDoneLoadingMore(false)
                              }, 300)
                            }}
                            disabled={doneLoadingMore}
                            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-60"
                          >
                            {doneLoadingMore ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading...
                              </>
                            ) : (
                              <>
                                Load More ({done.length - doneLimit} remaining)
                              </>
                            )}
                          </button>
                        )}
                      </section>
                    )}

                    {pending.length === 0 &&
                      accepted.length === 0 &&
                      done.length === 0 && (
                        <div className="flex h-48 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-muted/5 text-muted-foreground">
                          <div className="rounded-full bg-muted/30 p-4">
                            <Utensils className="h-10 w-10 opacity-40" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold">No orders yet</p>
                            <p className="text-xs opacity-60">
                              Waiting for the first table to order…
                            </p>
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </main>
            </ScrollFade>
          </div>
        </div>

        {/* Waiter Calls Sidebar */}
        <div className="flex h-64 shrink-0 flex-col border-t border-border bg-card/40 lg:h-auto lg:w-64 lg:border-l lg:border-t-0 min-h-0">
          <div className="flex-none p-4 pb-2">
            <h2 className="flex items-center gap-2 font-display text-sm uppercase tracking-wider text-foreground">
              <Bell
                className={`h-4 w-4 ${pendingCalls.length > 0 ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`}
              />
              Waiter Calls
              {pendingCalls.length > 0 && (
                <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-white">
                  {pendingCalls.length}
                </span>
              )}
            </h2>
          </div>
          <ScrollFade
            fadeSize={40}
            direction="vertical"
            className="flex flex-col flex-1 min-h-0"
          >
            <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-4">
              {ordersLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-xl" />
                  ))}
                </div>
              ) : calls.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 pb-12 text-muted-foreground opacity-50">
                  <div className="rounded-full bg-muted/20 p-3">
                    <Bell className="h-8 w-8 opacity-40" />
                  </div>
                  <p className="text-xs font-medium">Clear for now</p>
                </div>
              ) : (
                calls.map((c) => (
                  <div
                    key={c.id}
                    className={`rounded-xl border p-3 transition-all ${
                      c.status === 'pending'
                        ? 'border-destructive/50 bg-destructive/5'
                        : 'border-border opacity-50'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-display text-sm font-bold tracking-tight text-foreground">
                        {c.table_label}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          c.status === 'pending'
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {c.status}
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
                          )}
                          Ack
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
                          )}
                          Dismiss
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

      {/* 86 Board Modal */}
      <EightyBoardModal
        isOpen={eightyOpen}
        onClose={() => setEightyOpen(false)}
      />
    </div>
  )
}

// ── Order Card ────────────────────────────────────────────────────────────────
function KDSOrderCard({
  order,
  busyStatus,
  onStatus,
}: {
  order: TableOrder
  busyStatus: string | null
  onStatus: (id: string, s: 'accepted' | 'rejected' | 'completed') => void
}) {
  const isPending = order.status === 'pending'
  const isAccepted = order.status === 'accepted'
  return (
    <div
      className={`mb-3 inline-block w-full break-inside-avoid rounded-2xl border bg-card p-4 shadow-sm transition-all ${busyStatus ? 'opacity-50' : ''}`}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <Utensils className="h-4 w-4 text-primary" />
          <span className="font-display text-sm font-bold tracking-tight text-foreground">
            {order.table_label}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              isPending
                ? 'bg-destructive/10 text-destructive'
                : isAccepted
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
            }`}
          >
            {order.status}
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
              {item.name}
            </span>
            <span className="text-muted-foreground">
              {(item.qty * item.price).toLocaleString()} ETB
            </span>
          </li>
        ))}
      </ul>

      {order.note && (
        <p className="mb-3 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs italic text-muted-foreground">
          "{order.note}"
        </p>
      )}

      {isPending && (
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
            )}
            Accept
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

      {isAccepted && (
        <button
          disabled={!!busyStatus}
          onClick={() => onStatus(order.id, 'completed')}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-green-500/40 px-3 py-2.5 text-sm font-bold text-green-600 hover:bg-green-500/10 disabled:opacity-60"
        >
          {busyStatus === 'completed' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Mark Done
        </button>
      )}
    </div>
  )
}

// ── 86 Board Modal ────────────────────────────────────────────────────────────
function EightyBoardModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingIds, setTogglingIds] = useState<string[]>([])

  useEffect(() => {
    getMenuData().then((d) => {
      setItems(d.items)
      setLoading(false)
    })
  }, [])

  const handleToggle = async (item: MenuItem) => {
    setTogglingIds((prev) => [...prev, item.id])
    try {
      await toggleAvailability({
        data: { id: item.id, is_available: !item.is_available },
      })
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, is_available: !i.is_available } : i,
        ),
      )
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setTogglingIds((prev) => prev.filter((id) => id !== item.id))
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 items-center justify-center bg-black/70 p-4 backdrop-blur-sm transition-opacity duration-200 ${isOpen ? 'flex opacity-100' : 'pointer-events-none opacity-0'}`}
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-display text-xl text-primary">86 Board</h2>
            <p className="text-xs text-muted-foreground">
              Toggle item availability in real time
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Item List */}
        <ScrollFade
          fadeSize={40}
          direction="vertical"
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-all ${
                      item.is_available
                        ? 'border-border bg-card'
                        : 'border-destructive/30 bg-destructive/5 opacity-60'
                    }`}
                  >
                    <span
                      className={`text-sm font-medium ${!item.is_available ? 'line-through text-muted-foreground' : ''}`}
                    >
                      {item.name}
                    </span>
                    <button
                      onClick={() => handleToggle(item)}
                      disabled={togglingIds.includes(item.id)}
                      className="flex items-center gap-3 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50 w-32 border border-border/50 hover:border-primary/50"
                    >
                      {togglingIds.includes(item.id) ? (
                        <div className="flex w-full justify-center">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="flex w-full items-center gap-2">
                          <div className="flex w-6 justify-center">
                            {item.is_available ? (
                              <ToggleRight className="h-6 w-6 text-green-500" />
                            ) : (
                              <ToggleLeft className="h-6 w-6 text-destructive" />
                            )}
                          </div>
                          <span
                            className={`text-[10px] font-black uppercase tracking-wider ${item.is_available ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}
                          >
                            {item.is_available ? 'In Stock' : "86'd"}
                          </span>
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </ScrollFade>
      </div>
    </div>
  )
}
