import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useServerFn } from '@tanstack/react-start'
import { authClient } from '#/lib/auth-client'
import { getAuthSession } from '@/server/auth-helpers'
import {
  getMenuData,
  upsertMenuItem,
  deleteMenuItem,
  toggleAvailability,
  upsertCategory,
  deleteCategory,
  updateRestaurantInfo,
  uploadItemImage,
  reorderMenuItems,
  reorderCategories,
  type Category,
  type MenuItem,
  type RestaurantInfo,
  type MenuData,
} from '@/server/menu.functions'
import {
  getWaiterCalls,
  acknowledgeCall,
  getTables,
  upsertTable,
  regenerateTableToken,
  deleteTable,
  getTableOrders,
  updateOrderStatus,
  type WaiterCall,
  type RestaurantTable,
  type TableOrder,
} from '@/server/table.functions'
import {
  setStaffPin,
  getActiveStaffSessions,
  revokeStaffSession,
} from '@/server/staff.functions'
import {
  LogOut,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Upload,
  Check,
  X,
  MapPin,
  UtensilsCrossed,
  Layers,
  Store,
  GripVertical,
  Bell,
  QrCode,
  RefreshCw,
  ClipboardList,
  ChefHat,
  Download,
  Printer,
  ExternalLink,
} from 'lucide-react'
import logo from '@/assets/origin-logo.jpg'
import { Skeleton } from '@/components/ui/skeleton'
import { ThemeToggle } from '@/components/ThemeToggle'
import { supabaseBrowser } from '@/integrations/supabase/client.browser'
import ScrollFade from '#/components/ScrollFade'
import { optimizeImage, compressImageFile } from '@/lib/image'
import qrLogo from '@/assets/origin-logo-qr-svg.svg'
import { useTranslation } from '@/lib/i18n'

type TabValue = 'items' | 'categories' | 'info' | 'tables' | 'orders' | 'staff'

type AdminSearch = {
  tab?: TabValue
}

export const Route = createFileRoute('/admin')({
  validateSearch: (search: Record<string, unknown>): AdminSearch => {
    const t = search.tab as string
    return {
      tab: [
        'items',
        'categories',
        'info',
        'tables',
        'orders',
        'staff',
      ].includes(t)
        ? (t as TabValue)
        : undefined,
    }
  },
  beforeLoad: async () => {
    let session = null
    try {
      session = await getAuthSession()
    } catch {
      // Ignore network/rpc errors and fallback gracefully
    }
    if (!session?.user) {
      throw redirect({ to: '/login' })
    }
  },
  loader: () => getMenuData(),
  component: AdminPage,
  pendingComponent: AdminSkeleton,
  pendingMs: 0,
})

// Synthesize a simple beep/alert sound using Web Audio API
function playNotification() {
  try {
    const ctx = new (
      window.AudioContext || (window as any).webkitAudioContext
    )()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.5)
  } catch {}
}

function AdminPage() {
  const { lang, t, dt } = useTranslation()
  const initial = Route.useLoaderData() as MenuData
  const [data, setData] = useState<MenuData>(initial)
  const searchParams = Route.useSearch()
  const tab = searchParams.tab || 'items'
  const navigate = Route.useNavigate()
  const setTab = (t: TabValue) =>
    navigate({ search: { tab: t }, replace: true })
  const [calls, setCalls] = useState<WaiterCall[]>([])
  const [callsOpen, setCallsOpen] = useState(false)
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [pendingOrderCount, setPendingOrderCount] = useState(0)
  const channelRef = useRef<ReturnType<typeof supabaseBrowser.channel> | null>(
    null,
  )
  const ordersChannelRef = useRef<ReturnType<
    typeof supabaseBrowser.channel
  > | null>(null)

  // Load initial pending calls
  useEffect(() => {
    getWaiterCalls().then((data) => setCalls(data as WaiterCall[]))
    getTableOrders().then((data) => {
      const orders = (data as any[]) || []
      setPendingOrderCount(orders.filter((o) => o.status === 'pending').length)
    })
  }, [])

  // Supabase Realtime — Combined Channel for all Admin notifications
  useEffect(() => {
    const channel = supabaseBrowser
      .channel('admin-realtime')
      // 1. Waiter Calls INSERT
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'waiter_calls' },
        (payload) => {
          const newCall = payload.new as WaiterCall
          setCalls((prev) => [newCall, ...prev])
          playNotification()
          toast('🔔 ' + newCall.table_label + ' is calling for a waiter!', {
            duration: 8000,
            action: { label: 'View', onClick: () => setCallsOpen(true) },
          })
        },
      )
      // 2. Waiter Calls UPDATE
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'waiter_calls' },
        (payload) => {
          const updated = payload.new as WaiterCall
          setCalls((prev) =>
            prev.map((c) => (c.id === updated.id ? updated : c)),
          )
        },
      )
      // 3. Table Orders INSERT
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'table_orders' },
        (payload) => {
          const order = payload.new as any
          setPendingOrderCount((n) => n + 1)
          playNotification()
          window.dispatchEvent(new CustomEvent('reload-orders'))
          toast(`🍽️ New order from ${order.table_label}!`, {
            duration: 10000,
            action: {
              label: 'View Orders',
              onClick: () =>
                navigate({ search: { tab: 'orders' }, replace: true }),
            },
          })
        },
      )
      // 4. Table Orders UPDATE
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'table_orders' },
        (payload) => {
          const order = payload.new as any
          if (order.status !== 'pending') {
            setPendingOrderCount((n) => Math.max(0, n - 1))
          }
          window.dispatchEvent(new CustomEvent('reload-orders'))
        },
      )
      .subscribe((status, err) => {
        if (err) console.error('[Realtime] Subscription Error:', err)
        else console.log('[Realtime] Combined Status:', status)
      })

    channelRef.current = channel
    return () => {
      supabaseBrowser.removeChannel(channel)
    }
  }, [navigate])

  // Broadcast channel — receives direct server-sent events from placeOrder()
  // This bypasses postgres_changes entirely, no RLS/grants/pub needed
  useEffect(() => {
    const bc = supabaseBrowser
      .channel('admin-orders')
      .on('broadcast', { event: 'new_order' }, (payload) => {
        const order = payload.payload as any
        console.log('[Broadcast] new_order received:', order)
        setPendingOrderCount((n) => n + 1)
        playNotification()
        window.dispatchEvent(new CustomEvent('reload-orders'))
        toast(`🍽️ New order from ${order.table_label}!`, {
          duration: 10000,
          action: {
            label: 'View Orders',
            onClick: () =>
              navigate({ search: { tab: 'orders' }, replace: true }),
          },
        })
      })
      .subscribe((status, err) => {
        if (err) console.error('[Broadcast] Error:', err)
        else console.log('[Broadcast] admin-orders status:', status)
      })

    ordersChannelRef.current = bc
    return () => {
      supabaseBrowser.removeChannel(bc)
    }
  }, [navigate])

  const handleAcknowledge = async (id: string) => {
    setAcknowledgingId(id)
    try {
      await acknowledgeCall({ data: { id } })
      // Optimistic update — Realtime UPDATE event will also confirm
      setCalls((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'acknowledged' } : c)),
      )
    } finally {
      setAcknowledgingId(null)
    }
  }

  const pendingCount = calls.filter((c) => c.status === 'pending').length

  const refresh = async () => {
    const fresh = await getMenuData()
    setData(fresh)
  }

  const logout = async () => {
    setLoggingOut(true)
    try {
      await authClient.signOut()
      navigate({ to: '/login' })
    } catch {
      setLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-y-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt=""
              className="h-9 w-9 rounded-full bg-white p-1"
            />
            <div>
              <h1 className="font-display text-xl sm:text-2xl text-primary leading-none">
                CONSOLE
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Origin Admin
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Waiter Call Bell */}
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
            <ThemeToggle />
            <button
              disabled={loggingOut}
              onClick={logout}
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
              active={tab === 'orders'}
              onClick={() => {
                setTab('orders')
                setPendingOrderCount(0)
              }}
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
              active={tab === 'staff'}
              onClick={() => setTab('staff')}
              icon={<ChefHat className="h-4" />}
            >
              {t('admin_staff')}
            </TabButton>
            <TabButton
              active={tab === 'info'}
              onClick={() => setTab('info')}
              icon={<QrCode className="h-4" />}
            >
              {t('admin_info')}
            </TabButton>
          </div>
        </ScrollFade>
      </header>

      {/* Waiter Calls Panel */}
      {callsOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          onClick={() => setCallsOpen(false)}
        >
          <div className="flex-1 bg-black/40 backdrop-blur-sm" />
          <div
            className="flex h-full w-full max-w-sm flex-col border-l border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <h2 className="font-display text-sm uppercase tracking-widest text-primary">
                  Waiter Calls
                </h2>
                {pendingCount > 0 && (
                  <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-white">
                    {pendingCount} pending
                  </span>
                )}
              </div>
              <button
                onClick={() => setCallsOpen(false)}
                className="rounded-md p-1 text-muted-foreground transition hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {calls.length === 0 ? (
                <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
                  No waiter calls yet
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {calls.map((call) => {
                    const isPending = call.status === 'pending'
                    const timeAgo = (() => {
                      const diff = Math.floor(
                        (Date.now() - new Date(call.created_at).getTime()) /
                          1000,
                      )
                      if (diff < 60) return `${diff}s ago`
                      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
                      return `${Math.floor(diff / 3600)}h ago`
                    })()
                    return (
                      <li
                        key={call.id}
                        className={`flex items-center justify-between gap-3 px-4 py-3 ${
                          isPending ? 'bg-destructive/5' : ''
                        }`}
                      >
                        <div>
                          <p
                            className={`text-sm font-semibold ${
                              isPending
                                ? 'text-foreground'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {call.table_label}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {timeAgo}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isPending ? (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                              Pending
                            </span>
                          ) : (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              Done
                            </span>
                          )}
                          {isPending && (
                            <button
                              onClick={() => handleAcknowledge(call.id)}
                              disabled={acknowledgingId === call.id}
                              className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                            >
                              {acknowledgingId === call.id ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />{' '}
                                  Wait...
                                </>
                              ) : (
                                <>
                                  <Check className="h-3 w-3" /> OK
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 py-8">
        {tab === 'items' && <ItemsTab data={data} onChange={refresh} />}
        {tab === 'categories' && (
          <CategoriesTab data={data} onChange={refresh} />
        )}
        {tab === 'info' && <InfoTab info={data.info} onChange={refresh} />}
        {/* Tables + Orders: always mounted, hidden when not active to preserve data across tab switches */}
        <div className={tab === 'tables' ? undefined : 'hidden'}>
          <TablesTab />
        </div>
        <div className={tab === 'orders' ? undefined : 'hidden'}>
          <OrdersTab />
        </div>
      </main>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  className,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (active && ref.current) {
      ref.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      })
    }
  }, [active])

  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition ${className} ${active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
    >
      {icon} {children}
    </button>
  )
}

/* ------------------------ ITEMS TAB ------------------------ */
function ItemsTab({
  data,
  onChange,
}: {
  data: MenuData
  onChange: () => void
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [localItems, setLocalItems] = useState(data.items)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const reorder = useServerFn(reorderMenuItems)

  useEffect(() => {
    setLocalItems(data.items)
  }, [data.items])

  const onDragStart = (id: string, e: React.DragEvent) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
  }
  const onDragOver = (id: string, e: React.DragEvent) => {
    e.preventDefault()
    if (!draggedId || draggedId === id) return
    const draggedItem = localItems.find((i) => i.id === draggedId)
    const targetItem = localItems.find((i) => i.id === id)
    if (
      !draggedItem ||
      !targetItem ||
      draggedItem.category_id !== targetItem.category_id
    )
      return

    const newList = [...localItems]
    const draggedIdx = newList.findIndex((i) => i.id === draggedId)
    const targetIdx = newList.findIndex((i) => i.id === id)
    const [moved] = newList.splice(draggedIdx, 1)
    newList.splice(targetIdx, 0, moved)

    const catItems = newList.filter(
      (i) => i.category_id === targetItem.category_id,
    )
    catItems.forEach((itm, idx) => {
      const gIdx = newList.findIndex((gi) => gi.id === itm.id)
      newList[gIdx] = { ...newList[gIdx], sort_order: idx }
    })
    setLocalItems(newList)
  }
  const onDrop = async () => {
    const item = localItems.find((i) => i.id === draggedId)
    setDraggedId(null)
    if (item) {
      try {
        const catItems = localItems.filter(
          (i) => i.category_id === item.category_id,
        )
        await reorder({
          data: {
            updates: catItems.map((i) => ({
              id: i.id,
              sort_order: i.sort_order,
            })),
          },
        })
        onChange()
      } catch (err: any) {
        toast.error('Reorder failed', {
          description: err?.message || 'Check your internet connection.',
        })
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl uppercase tracking-wider text-foreground">
          {t('admin_menu')}
        </h2>
        <button
          onClick={() => {
            setEditing(null)
            setShowForm(true)
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> {t('add_item')}
        </button>
      </div>

      {showForm && (
        <ItemForm
          item={editing}
          categories={data.categories}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false)
            onChange()
          }}
        />
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="divide-y divide-border">
          {localItems.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No items yet — add your first one above.
            </p>
          )}
          {data.categories.map((cat) => {
            const list = localItems
              .filter((i) => i.category_id === cat.id)
              .sort((a, b) => a.sort_order - b.sort_order)
            if (list.length === 0) return null
            return (
              <div key={cat.id}>
                <div className="bg-muted/30 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-primary">
                  {cat.name}
                </div>
                {list.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onEdit={() => {
                      setEditing(item)
                      setShowForm(true)
                    }}
                    onChanged={onChange}
                    onDragStart={(e) => onDragStart(item.id, e)}
                    onDragOver={(e) => onDragOver(item.id, e)}
                    onDrop={onDrop}
                    isDragging={draggedId === item.id}
                  />
                ))}
              </div>
            )
          })}
          {/* uncategorised */}
          {(() => {
            const orphan = localItems
              .filter(
                (i) =>
                  !i.category_id ||
                  !data.categories.find((c) => c.id === i.category_id),
              )
              .sort((a, b) => a.sort_order - b.sort_order)
            if (orphan.length === 0) return null
            return (
              <div>
                <div className="bg-muted/30 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Uncategorized
                </div>
                {orphan.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onEdit={() => {
                      setEditing(item)
                      setShowForm(true)
                    }}
                    onChanged={onChange}
                    onDragStart={(e) => onDragStart(item.id, e)}
                    onDragOver={(e) => onDragOver(item.id, e)}
                    onDrop={onDrop}
                    isDragging={draggedId === item.id}
                  />
                ))}
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

function ItemRow({
  item,
  onEdit,
  onChanged,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
}: {
  item: MenuItem
  onEdit: () => void
  onChanged: () => void
  onDragStart?: (e: any) => void
  onDragOver?: (e: any) => void
  onDrop?: () => void
  isDragging?: boolean
}) {
  const toggle = useServerFn(toggleAvailability)
  const del = useServerFn(deleteMenuItem)
  const [busy, setBusy] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  const handleToggle = async () => {
    setBusy(true)
    try {
      await toggle({
        data: { id: item.id, is_available: !item.is_available },
      })
      onChanged()
    } catch (err: any) {
      toast.error('Failed to toggle item', {
        description: !navigator.onLine
          ? 'No internet connection'
          : err?.message || 'Unexpected error',
      })
    } finally {
      setBusy(false)
    }
  }
  const handleDelete = async () => {
    setBusy(true)
    try {
      await del({ data: { id: item.id } })
      onChanged()
      toast.success('Item deleted')
    } catch (err: any) {
      toast.error('Failed to delete item', {
        description: !navigator.onLine
          ? 'No internet connection'
          : err?.message || 'Unexpected error',
      })
    } finally {
      setBusy(false)
      setShowConfirm(false)
    }
  }

  return (
    <>
      <div
        className={`flex items-center gap-3 px-4 py-3 ${isDragging ? 'opacity-50 bg-muted/20' : ''}`}
        draggable={!!onDragStart}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDrop}
      >
        <GripVertical
          className={`h-4 w-4 shrink-0 text-muted-foreground/40 ${onDragStart ? 'cursor-grab active:cursor-grabbing hover:text-primary' : ''}`}
        />
        {item.image_url ? (
          <div className="relative h-10 w-10 shrink-0">
            {!imgLoaded && (
              <Skeleton className="absolute inset-0 h-10 w-10 rounded" />
            )}
            <img
              src={optimizeImage(item.image_url, 150)}
              alt=""
              onLoad={() => setImgLoaded(true)}
              className={`h-10 w-10 shrink-0 rounded object-cover transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
          </div>
        ) : (
          <div className="h-10 w-10 shrink-0 rounded bg-muted" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{item.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="truncate text-xs text-muted-foreground">
              {Number(item.price)} ETB
            </p>
            {item.is_featured && (
              <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                Chef's Pick
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleToggle}
          disabled={busy}
          className={`rounded flex w-10 justify-center px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${item.is_available ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : item.is_available ? (
            'IN'
          ) : (
            'OUT'
          )}
        </button>
        <button
          onClick={onEdit}
          className="rounded border border-border p-1.5 text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setShowConfirm(true)}
          disabled={busy}
          className="rounded border border-border p-1.5 text-muted-foreground hover:border-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {showConfirm && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-background/80 px-4 backdrop-blur-xs"
          onPointerDown={() => setShowConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center shadow-2xl"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Trash2 className="mx-auto mb-4 h-10 w-10 text-destructive/80" />
            <h3 className="font-display text-xl text-foreground">
              Delete Item
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete "{item.name}"? This action cannot
              be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-md border border-border px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-muted"
              >
                Cancel
              </button>
              <button
                disabled={busy}
                onClick={handleDelete}
                className="flex-1 flex items-center justify-center gap-2 rounded-md bg-destructive px-4 py-2 text-xs font-bold uppercase tracking-wider text-destructive-foreground hover:opacity-90 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ItemForm({
  item,
  categories,
  onClose,
  onSaved,
}: {
  item: MenuItem | null
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: item?.name ?? '',
    name_am: item?.name_am ?? '',
    description: item?.description ?? '',
    description_am: item?.description_am ?? '',
    category_id: item?.category_id ?? categories[0]?.id ?? '',
    price: String(item?.price ?? ''),
    image_url: item?.image_url ?? '',
    is_available: item?.is_available ?? true,
    is_vegetarian: item?.is_vegetarian ?? false,
    is_spicy: item?.is_spicy ?? false,
    is_fasting: item?.is_fasting ?? false,
    is_featured: item?.is_featured ?? false,
    is_special: item?.is_special ?? false,
    sort_order: item?.sort_order ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const upsert = useServerFn(upsertMenuItem)
  const upload = useServerFn(uploadItemImage)

  const onFile = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      setError('Image must be under 4MB')
      return
    }
    setUploading(true)
    setError('')
    try {
      const base64 = await compressImageFile(file, 800, 0.8)

      const res = await upload({
        data: {
          filename: file.name.replace(/\.[^/.]+$/, '') + '.webp',
          contentType: 'image/webp',
          base64,
        },
      })
      setForm((f) => ({ ...f, image_url: res.url }))
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed')
      toast.error('Image upload failed', {
        description: !navigator.onLine
          ? 'No internet connection'
          : (e?.message ?? 'Unexpected error'),
      })
    } finally {
      setUploading(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await upsert({
        data: {
          id: item?.id,
          category_id: form.category_id || null,
          name: form.name.trim(),
          name_am: form.name_am.trim() || null,
          description: form.description.trim() || null,
          description_am: form.description_am.trim() || null,
          price: Number(form.price) || 0,
          image_url: form.image_url || null,
          is_available: form.is_available,
          is_vegetarian: form.is_vegetarian,
          is_spicy: form.is_spicy,
          is_fasting: form.is_fasting,
          is_featured: form.is_featured,
          is_special: form.is_special,
          sort_order: form.sort_order,
        },
      })
      onSaved()
      toast.success(item ? 'Item updated' : 'Item added')
    } catch (e: any) {
      setError(e?.message ?? 'Save failed')
      toast.error('Failed to save item', {
        description: !navigator.onLine
          ? 'No internet connection'
          : (e?.message ?? 'Unexpected error'),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 px-4 py-12 backdrop-blur-sm sm:items-center sm:py-8"
      onPointerDown={onClose}
    >
      <div
        className="w-full max-w-2xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <form
          onSubmit={submit}
          className="rounded-xl border border-primary/40 bg-card p-5 shadow-2xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg uppercase tracking-wider text-primary">
              {item ? 'Edit Item' : 'Add New Item'}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name (English)">
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Name (አማርኛ)">
              <input
                value={form.name_am}
                onChange={(e) => setForm({ ...form, name_am: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Description (English)">
              <input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className={inputCls}
                placeholder="Ingredients / notes"
              />
            </Field>
            <Field label="Description (አማርኛ)">
              <input
                value={form.description_am}
                onChange={(e) =>
                  setForm({ ...form, description_am: e.target.value })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Category">
              <select
                value={form.category_id ?? ''}
                onChange={(e) =>
                  setForm({ ...form, category_id: e.target.value })
                }
                className={inputCls}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Price (ETB)">
              <input
                required
                type="number"
                min="0"
                step="1"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Photo
            </label>
            <div className="flex items-center gap-3">
              {form.image_url ? (
                <img
                  src={optimizeImage(form.image_url, 150)}
                  alt=""
                  className="h-16 w-16 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
                  <Upload className="h-5 w-5" />
                </div>
              )}
              <label className="cursor-pointer rounded-md border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:border-primary hover:text-primary">
                {uploading
                  ? 'Uploading…'
                  : form.image_url
                    ? 'Replace'
                    : 'Upload'}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) onFile(f)
                  }}
                />
              </label>
              {form.image_url && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, image_url: '' })}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Toggle
              label="Available"
              value={form.is_available}
              onChange={(v) => setForm({ ...form, is_available: v })}
            />
            <Toggle
              label="Featured"
              value={form.is_featured}
              onChange={(v) => setForm({ ...form, is_featured: v })}
            />
            <Toggle
              label="Today's Special"
              value={form.is_special}
              onChange={(v) => setForm({ ...form, is_special: v })}
            />
            <Toggle
              label="Vegetarian"
              value={form.is_vegetarian}
              onChange={(v) => setForm({ ...form, is_vegetarian: v })}
            />
            <Toggle
              label="Spicy"
              value={form.is_spicy}
              onChange={(v) => setForm({ ...form, is_spicy: v })}
            />
            <Toggle
              label="Fasting (ጾም)"
              value={form.is_fasting}
              onChange={(v) => setForm({ ...form, is_fasting: v })}
            />
          </div>

          {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {item ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputCls =
  'h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary'

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${value ? 'bg-primary' : 'bg-muted-foreground/40'}`}
      />{' '}
      {label}
    </button>
  )
}

/* ------------------------ CATEGORIES TAB ------------------------ */
function CategoriesTab({
  data,
  onChange,
}: {
  data: MenuData
  onChange: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [nameAm, setNameAm] = useState('')
  const [busy, setBusy] = useState(false)
  const upsert = useServerFn(upsertCategory)
  const del = useServerFn(deleteCategory)
  const reorder = useServerFn(reorderCategories)
  const [localCats, setLocalCats] = useState(data.categories)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  useEffect(() => {
    setLocalCats(data.categories)
  }, [data.categories])

  const onDragStart = (id: string, e: React.DragEvent) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
  }
  const onDragOver = (id: string, e: React.DragEvent) => {
    e.preventDefault()
    if (!draggedId || draggedId === id) return
    const newList = [...localCats]
    const draggedIdx = newList.findIndex((c) => c.id === draggedId)
    const targetIdx = newList.findIndex((c) => c.id === id)
    const [moved] = newList.splice(draggedIdx, 1)
    newList.splice(targetIdx, 0, moved)
    newList.forEach((c, idx) => (c.sort_order = idx))
    setLocalCats(newList)
  }
  const onDrop = async () => {
    setDraggedId(null)
    try {
      await reorder({
        data: {
          updates: localCats.map((c) => ({
            id: c.id,
            sort_order: c.sort_order,
          })),
        },
      })
      onChange()
    } catch (err: any) {
      toast.error('Reorder failed', {
        description: !navigator.onLine
          ? 'No internet connection'
          : err?.message || 'Unexpected error',
      })
    }
  }

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    try {
      await upsert({
        data: {
          name: name.trim(),
          name_am: nameAm.trim() || null,
          sort_order: data.categories.length + 1,
        },
      })
      setName('')
      setNameAm('')
      onChange()
      toast.success('Category added')
    } catch (err: any) {
      toast.error('Failed to add category', {
        description: !navigator.onLine
          ? 'No internet connection'
          : err?.message || 'Unexpected error',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="font-display text-xl uppercase tracking-wider">
        {t('admin_categories')}
      </h2>
      <form
        onSubmit={add}
        className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_1fr_auto]"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Category name"
          className={inputCls}
        />
        <input
          value={nameAm}
          onChange={(e) => setNameAm(e.target.value)}
          placeholder="Amharic (optional)"
          className={inputCls}
        />
        <button
          disabled={busy || !name.trim()}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </form>

      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {localCats.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No categories yet — add your first one above.
          </p>
        ) : (
          localCats
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((c) => (
              <CategoryRow
                key={c.id}
                cat={c}
                itemCount={
                  data.items.filter((i) => i.category_id === c.id).length
                }
                onDragStart={(e) => onDragStart(c.id, e)}
                onDragOver={(e) => onDragOver(c.id, e)}
                onDrop={onDrop}
                isDragging={draggedId === c.id}
                onSave={async (n, na, so) => {
                  try {
                    await upsert({
                      data: {
                        id: c.id,
                        name: n,
                        name_am: na || null,
                        sort_order: so,
                      },
                    })
                    onChange()
                    toast.success('Category saved')
                  } catch (err: any) {
                    toast.error('Failed to save category', {
                      description: !navigator.onLine
                        ? 'No internet connection'
                        : err?.message || 'Unexpected error',
                    })
                  }
                }}
                onDelete={async () => {
                  try {
                    await del({ data: { id: c.id } })
                    onChange()
                    toast.success('Category deleted')
                  } catch (err: any) {
                    toast.error('Failed to delete category', {
                      description: !navigator.onLine
                        ? 'No internet connection'
                        : err?.message || 'Unexpected error',
                    })
                  }
                }}
              />
            ))
        )}
      </div>
    </div>
  )
}

function CategoryRow({
  cat,
  itemCount,
  onSave,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
}: {
  cat: Category
  itemCount: number
  onSave: (n: string, na: string, so: number) => Promise<void>
  onDelete: () => Promise<void>
  onDragStart?: (e: any) => void
  onDragOver?: (e: any) => void
  onDrop?: () => void
  isDragging?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [n, setN] = useState(cat.name)
  const [na, setNa] = useState(cat.name_am ?? '')
  const [so, setSo] = useState(cat.sort_order)
  const [busy, setBusy] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  if (editing) {
    return (
      <div className="grid gap-2 p-3 sm:grid-cols-[1fr_1fr_80px_auto]">
        <input
          value={n}
          onChange={(e) => setN(e.target.value)}
          className={inputCls}
        />
        <input
          value={na}
          onChange={(e) => setNa(e.target.value)}
          className={inputCls}
        />
        <input
          type="number"
          value={so}
          onChange={(e) => setSo(Number(e.target.value))}
          className={inputCls}
        />
        <div className="flex gap-1">
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await onSave(n, na, so)
              setBusy(false)
              setEditing(false)
            }}
            className="rounded bg-primary p-2 text-primary-foreground"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded border border-border p-2"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        className={`flex items-center gap-3 p-3 ${isDragging ? 'opacity-50 bg-muted/20' : ''}`}
        draggable={!!onDragStart}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDrop}
      >
        <GripVertical
          className={`h-4 w-4 shrink-0 text-muted-foreground/40 ${onDragStart ? 'cursor-grab active:cursor-grabbing hover:text-primary' : ''}`}
        />
        <span className="w-8 text-center text-xs text-muted-foreground">
          {cat.sort_order}
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold">{cat.name}</p>
          <p className="text-xs text-muted-foreground">
            {cat.name_am ?? '—'} · {itemCount} item{itemCount !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="rounded border border-border p-1.5 text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setShowConfirm(true)}
          className="rounded border border-border p-1.5 text-muted-foreground hover:border-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {showConfirm && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-background/80 px-4 backdrop-blur-sm"
          onPointerDown={() => setShowConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center shadow-2xl"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Trash2 className="mx-auto mb-4 h-10 w-10 text-destructive/80" />
            <h3 className="font-display text-xl text-foreground">
              Delete Category
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete "{cat.name}"? The {itemCount}{' '}
              items inside it will also be deleted. This cannot be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-md border border-border px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-muted"
              >
                Cancel
              </button>
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await onDelete()
                  } finally {
                    setBusy(false)
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2 rounded-md bg-destructive px-4 py-2 text-xs font-bold uppercase tracking-wider text-destructive-foreground hover:opacity-90 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ------------------------ INFO TAB ------------------------ */
function InfoTab({
  info,
  onChange,
}: {
  info: RestaurantInfo | null
  onChange: () => void
}) {
  const { t } = useTranslation()
  const initialHours = Array.isArray(info?.hours)
    ? (info!.hours as Array<{ day: string; hours: string }>)
    : []
  const [form, setForm] = useState({
    name: info?.name ?? 'ORIGIN',
    tagline: info?.tagline ?? '',
    address: info?.address ?? '',
    phone: info?.phone ?? '',
    instagram_url: info?.instagram_url ?? '',
    tiktok_url: info?.tiktok_url ?? '',
    map_url: info?.map_url ?? '',
    map_embed_url: info?.map_embed_url ?? '',
    max_tables: info?.max_tables ?? 999,
    wifi_password: info?.wifi_password ?? '',
    service_charge_pct: info?.service_charge_pct ?? 0,
    promo_banner_active: info?.promo_banner_active ?? false,
    promo_banner_text: info?.promo_banner_text ?? '',
    promo_banner_url: info?.promo_banner_url ?? '',
    payment_methods: Array.isArray(info?.payment_methods)
      ? (info!.payment_methods as any[])
      : [],
    hours: initialHours.length
      ? initialHours
      : [{ day: 'Mon–Fri', hours: '10:00 – 22:00' }],
  })
  const [saving, setSaving] = useState(false)
  const [pinValue, setPinValue] = useState('')
  const [pinSaving, setPinSaving] = useState(false)
  const [pinMsg, setPinMsg] = useState('')

  const [sessions, setSessions] = useState<any[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)

  const fetchSessions = () => {
    setLoadingSessions(true)
    getActiveStaffSessions().then((s) => {
      setSessions(s)
      setLoadingSessions(false)
    })
  }

  useEffect(() => {
    fetchSessions()
  }, [])
  const [uploadingImageIdx, setUploadingImageIdx] = useState<number | null>(
    null,
  )
  const [dragItemIndex, setDragItemIndex] = useState<number | null>(null)
  const [dragOverItemIndex, setDragOverItemIndex] = useState<number | null>(
    null,
  )
  const [showConfirm, setShowConfirm] = useState<{
    type: 'hours' | 'payment' | 'revoke-session'
    index: number
    sessionId?: string
    title: string
  } | null>(null)
  const [msg, setMsg] = useState('')
  const update = useServerFn(updateRestaurantInfo)
  const upload = useServerFn(uploadItemImage)

  const onPaymentImageUpload = async (index: number, file: File) => {
    if (file.size > 2 * 1024 * 1024)
      return toast.error('Image must be under 2MB')
    setUploadingImageIdx(index)
    try {
      const base64 = await compressImageFile(file, 400, 0.8)
      const res = await upload({
        data: {
          filename: file.name.replace(/\.[^/.]+$/, '') + '.webp',
          contentType: 'image/webp',
          base64,
        },
      })

      setForm((prev) => {
        const m = [...prev.payment_methods]
        m[index] = { ...m[index], icon_url: res.url }
        return { ...prev, payment_methods: m }
      })
    } catch (e: any) {
      toast.error('Upload failed')
    } finally {
      setUploadingImageIdx(null)
    }
  }

  const handleSortPayments = () => {
    if (
      dragItemIndex === null ||
      dragOverItemIndex === null ||
      dragItemIndex === dragOverItemIndex
    ) {
      setDragItemIndex(null)
      setDragOverItemIndex(null)
      return
    }
    const currentList = [...form.payment_methods]
    const draggedItemContent = currentList.splice(dragItemIndex, 1)[0]
    currentList.splice(dragOverItemIndex, 0, draggedItemContent)

    setForm({ ...form, payment_methods: currentList })
    setDragItemIndex(null)
    setDragOverItemIndex(null)
  }

  const formatUA = (ua: string) => {
    if (!ua) return 'Unknown Device'

    // Detect OS
    const isIPhone = /iPhone/.test(ua)
    const isIPad = /iPad/.test(ua)
    const isAndroid = /Android/.test(ua)
    const isMac = /Macintosh/.test(ua) && !isIPhone && !isIPad
    const isWindows = /Windows NT/.test(ua)
    const isLinux = /Linux/.test(ua) && !isAndroid

    const os = isIPhone
      ? 'iPhone'
      : isIPad
        ? 'iPad'
        : isAndroid
          ? 'Android'
          : isWindows
            ? 'Windows'
            : isMac
              ? 'macOS'
              : isLinux
                ? 'Linux'
                : 'Device'

    // Detect Browser
    const isEdge = /Edg\//.test(ua)
    const isChrome = /Chrome\//.test(ua) && !isEdge
    const isFirefox = /Firefox\//.test(ua)
    const isSafari = /Safari\//.test(ua) && !isChrome && !isEdge
    const isCriOS = /CriOS\//.test(ua)

    const browser = isEdge
      ? 'Edge'
      : isChrome || isCriOS
        ? 'Chrome'
        : isFirefox
          ? 'Firefox'
          : isSafari
            ? 'Safari'
            : 'Browser'

    return `${browser} on ${os}`
  }

  const handleConfirmDelete = async () => {
    if (!showConfirm) return
    const { type, index } = showConfirm
    if (type === 'hours') {
      setForm((prev) => ({
        ...prev,
        hours: prev.hours.filter((_, j) => j !== index),
      }))
    } else if (type === 'revoke-session') {
      const sid = showConfirm.sessionId
      if (sid) {
        try {
          await revokeStaffSession({ data: { id: sid } })
          fetchSessions()
          toast.success('Device logged out')
        } catch (err: any) {
          toast.error(err.message || 'Failed to revoke session')
        }
      }
    } else {
      setForm((prev) => ({
        ...prev,
        payment_methods: prev.payment_methods.filter((_, j) => j !== index),
      }))
    }
    setShowConfirm(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMsg('')
    try {
      await update({ data: { ...form } })
      setMsg('Saved')
      onChange()
      toast.success('Restaurant info saved')
    } catch (e: any) {
      setMsg(e?.message ?? 'Failed')
      toast.error('Failed to save info', {
        description: !navigator.onLine
          ? 'No internet connection'
          : (e?.message ?? 'Unexpected error'),
      })
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(''), 2500)
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-8 pb-32">
      <div className="space-y-4">
        <h2 className="font-display text-xl uppercase tracking-wider text-foreground">
          {t('restaurant_info')}
        </h2>
      </div>
      <div className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
        <Field label="Restaurant Name">
          <input
            required
            className={inputCls}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Tagline">
          <input
            className={inputCls}
            value={form.tagline}
            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
          />
        </Field>
        <Field label="Address">
          <input
            className={inputCls}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <input
            className={inputCls}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </Field>
        <Field label="Instagram URL">
          <input
            className={inputCls}
            value={form.instagram_url}
            onChange={(e) =>
              setForm({ ...form, instagram_url: e.target.value })
            }
            placeholder="https://instagram.com/…"
          />
        </Field>
        <Field label="TikTok URL">
          <input
            className={inputCls}
            value={form.tiktok_url}
            onChange={(e) => setForm({ ...form, tiktok_url: e.target.value })}
            placeholder="https://tiktok.com/@…"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Google Maps URL">
            <div className="flex gap-2">
              <MapPin className="mt-2.5 h-4 w-4 shrink-0 text-primary" />
              <input
                className={inputCls}
                value={form.map_url}
                onChange={(e) => setForm({ ...form, map_url: e.target.value })}
                placeholder="https://maps.google.com/?q=…"
              />
            </div>
          </Field>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm uppercase tracking-wider">
            Opening Hours
          </h3>
          <button
            type="button"
            onClick={() =>
              setForm({
                ...form,
                hours: [...form.hours, { day: '', hours: '' }],
              })
            }
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
          >
            <Plus className="h-3 w-3" /> Add row
          </button>
        </div>
        <div className="space-y-2">
          {form.hours.map((h, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                className={inputCls}
                value={h.day}
                placeholder="Mon–Fri"
                onChange={(e) => {
                  const a = [...form.hours]
                  a[i] = { ...a[i], day: e.target.value }
                  setForm({ ...form, hours: a })
                }}
              />
              <input
                className={inputCls}
                value={h.hours}
                placeholder="10:00 – 22:00"
                onChange={(e) => {
                  const a = [...form.hours]
                  a[i] = { ...a[i], hours: e.target.value }
                  setForm({ ...form, hours: a })
                }}
              />
              <button
                type="button"
                onClick={() =>
                  setShowConfirm({
                    type: 'hours',
                    index: i,
                    title: 'Remove these hours?',
                  })
                }
                className="rounded border border-border p-2 text-muted-foreground hover:border-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 font-display text-sm uppercase tracking-wider text-primary">
            Promotional Banner
          </h3>
          <div className="space-y-4">
            <Toggle
              label="Enable Promotional Banner on Public Menu"
              value={form.promo_banner_active}
              onChange={(v) => setForm({ ...form, promo_banner_active: v })}
            />
            <Field label="Banner Announcement (e.g. '10% off Friday!')">
              <input
                className={inputCls}
                value={form.promo_banner_text}
                onChange={(e) =>
                  setForm({ ...form, promo_banner_text: e.target.value })
                }
                placeholder="Text goes here..."
              />
            </Field>
            <Field label="Banner Redirect URL (Optional)">
              <input
                className={inputCls}
                value={form.promo_banner_url}
                onChange={(e) =>
                  setForm({ ...form, promo_banner_url: e.target.value })
                }
                placeholder="https://..."
              />
            </Field>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 font-display text-sm uppercase tracking-wider text-primary">
            Store Utilities
          </h3>
          <div className="space-y-4">
            <Field label="Wi-Fi Password for Guests">
              <input
                className={inputCls}
                value={form.wifi_password}
                onChange={(e) =>
                  setForm({ ...form, wifi_password: e.target.value })
                }
                placeholder="FreeWifi_123"
              />
            </Field>
            <Field label="Service Charge (%)">
              <input
                type="number"
                min={0}
                max={100}
                className={inputCls}
                value={form.service_charge_pct}
                onChange={(e) =>
                  setForm({
                    ...form,
                    service_charge_pct: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm uppercase tracking-wider">
            Payment Methods
          </h3>
          <button
            type="button"
            onClick={() =>
              setForm({
                ...form,
                payment_methods: [
                  ...form.payment_methods,
                  { provider: '', account: '', icon_url: '' },
                ],
              })
            }
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
          >
            <Plus className="h-3 w-3" /> Add Method
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {form.payment_methods.map((method, i) => (
            <div
              key={i}
              draggable
              onDragStart={() => setDragItemIndex(i)}
              onDragEnter={() => setDragOverItemIndex(i)}
              onDragEnd={handleSortPayments}
              onDragOver={(e) => e.preventDefault()}
              className={`flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4 transition-all ${
                dragOverItemIndex === i
                  ? 'ring-2 ring-primary bg-primary/5 opacity-80'
                  : ''
              } ${dragItemIndex === i ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <GripVertical
                  className={`h-4 w-4 shrink-0 text-muted-foreground/40 cursor-grab active:cursor-grabbing hover:text-primary`}
                />
                {method.icon_url ? (
                  <img
                    src={optimizeImage(method.icon_url, 150)}
                    className="h-10 w-16 rounded object-contain shadow-sm bg-white"
                    alt="Payment icon"
                  />
                ) : uploadingImageIdx === i ? (
                  <div className="flex h-10 w-16 items-center justify-center rounded border border-dashed border-border bg-muted">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <label className="flex h-10 w-16 cursor-pointer items-center justify-center rounded border border-dashed border-border bg-muted transition hover:bg-muted/80">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          onPaymentImageUpload(i, e.target.files[0])
                        }
                      }}
                    />
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </label>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setShowConfirm({
                      type: 'payment',
                      index: i,
                      title: 'Delete this payment method?',
                    })
                  }
                  className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <input
                className={inputCls}
                value={method.provider}
                placeholder="Provider (e.g. Telebirr)"
                onChange={(e) => {
                  const m = [...form.payment_methods]
                  m[i] = { ...m[i], provider: e.target.value }
                  setForm({ ...form, payment_methods: m })
                }}
              />
              <input
                className={inputCls}
                value={method.account}
                placeholder="Account / Phone / Detail"
                onChange={(e) => {
                  const m = [...form.payment_methods]
                  m[i] = { ...m[i], account: e.target.value }
                  setForm({ ...form, payment_methods: m })
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Staff PIN ── */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-5">
        <div>
          <h3 className="font-display text-sm uppercase tracking-wider">
            Staff PIN
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Set the 4-digit PIN that staff use to log in to the Kitchen Display
            (Staff Console).
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="password"
            maxLength={4}
            pattern="\d{4}"
            placeholder={t('pin_placeholder')}
            value={pinValue}
            onChange={(e) =>
              setPinValue(e.target.value.replace(/\D/g, '').slice(0, 4))
            }
            className={
              inputCls + ' w-36 tracking-[0.5em] text-center font-bold'
            }
          />
          <button
            type="button"
            disabled={pinValue.length !== 4 || pinSaving}
            onClick={async () => {
              setPinSaving(true)
              try {
                await setStaffPin({ data: { pin: pinValue } })
                setPinMsg('PIN updated!')
                setPinValue('')
                toast.success('Staff PIN updated')
              } catch (err: any) {
                setPinMsg(err.message || 'Failed')
                toast.error('Failed to update PIN')
              } finally {
                setPinSaving(false)
                setTimeout(() => setPinMsg(''), 3000)
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-xs font-bold uppercase whitespace-nowrap tracking-wider text-primary-foreground disabled:opacity-50"
          >
            {pinSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            {t('set_pin')}
          </button>
          {pinMsg && (
            <span className="self-center text-xs text-muted-foreground">
              {pinMsg}
            </span>
          )}
        </div>
      </div>

      {/* ── Active Staff Sessions ── */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-sm uppercase tracking-wider">
              {t('active_kds')}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('active_kds_desc')}
            </p>
          </div>
          <button
            type="button"
            onClick={fetchSessions}
            className="rounded-md border border-border p-2 hover:bg-muted"
            title="Refresh sessions"
          >
            <RefreshCw
              className={`h-4 w-4 ${loadingSessions ? 'animate-spin' : ''}`}
            />
          </button>
        </div>

        <div className="space-y-2 mt-4">
          {sessions.length === 0 && !loadingSessions ? (
            <p className="text-xs text-muted-foreground italic">
              {t('no_sessions')}
            </p>
          ) : (
            sessions.map((s) => {
              const loginDate = s.createdAt
                ? new Date(s.createdAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : null

              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-background p-3 gap-3"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-xs font-semibold text-foreground">
                      {formatUA(s.userAgent || '')}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0 border border-border/50">
                        {s.ipAddress || 'No IP'}
                      </span>
                      {loginDate && (
                        <span className="text-[10px] text-muted-foreground">
                          · {loginDate}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirm({
                        type: 'revoke-session',
                        index: -1,
                        sessionId: s.id,
                        title: 'Force-logout this KDS device?',
                      })
                    }
                    className="shrink-0 rounded bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive hover:text-white transition-colors"
                  >
                    {t('revoke')}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        <button
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Save Info
        </button>
      </div>

      {showConfirm && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-background/80 px-4 backdrop-blur-xs"
          onPointerDown={() => setShowConfirm(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center shadow-2xl"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Trash2 className="mx-auto mb-4 h-10 w-10 text-destructive/80" />
            <h3 className="font-display text-xl text-foreground">
              {showConfirm.type === 'hours'
                ? t('remove_hours')
                : showConfirm.type === 'revoke-session'
                  ? t('logout_device')
                  : t('delete_payment')}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {showConfirm.title}
              {showConfirm.type !== 'revoke-session' &&
                ' This action is local until you save.'}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowConfirm(null)}
                className="flex-1 rounded-md border border-border px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 flex items-center justify-center gap-2 rounded-md bg-destructive px-4 py-2 text-xs font-bold uppercase tracking-wider text-destructive-foreground hover:opacity-90"
              >
                {showConfirm.type === 'revoke-session'
                  ? 'Force Logout'
                  : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
function AdminSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-2 w-16" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>
        <div className="mx-auto flex max-w-5xl gap-1 px-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-32 rounded-t-md" />
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>

        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </main>
    </div>
  )
}

function ConfirmationModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  busy,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <h3 className="mb-2 font-display text-lg text-foreground">{title}</h3>
        <p className="mb-6 text-sm text-muted-foreground">{description}</p>
        <div className="flex justify-end gap-3">
          <button
            autoFocus
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-xl bg-destructive px-5 py-2.5 text-sm font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Tables Tab ───────────────────────────────────────────────────────────────

function TablesTab() {
  const { t } = useTranslation()
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState<{
    id: string
    label: string
  } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [previewQR, setPreviewQR] = useState<{
    url: string
    label: string
  } | null>(null)

  const fetchTables = async () => {
    setLoading(true)
    try {
      const data = await getTables()
      setTables((data as RestaurantTable[]) || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTables()
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLabel.trim()) return
    setBusyId('new')
    try {
      await upsertTable({ data: { label: newLabel.trim() } })
      setNewLabel('')
      setAdding(false)
      await fetchTables()
      toast.success('Table created!')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const handleRename = async (id: string) => {
    if (!editLabel.trim()) return
    setBusyId(id)
    try {
      await upsertTable({ data: { id, label: editLabel.trim() } })
      setEditingId(null)
      await fetchTables()
      toast.success('Table renamed!')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const handleRegenerate = async (id: string, label: string) => {
    setBusyId(id)
    try {
      await regenerateTableToken({ data: { id } })
      await fetchTables()
      toast.success(`QR code regenerated for ${label}`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (id: string) => {
    setBusyId(id)
    try {
      await deleteTable({ data: { id } })
      setShowConfirm(null)
      await fetchTables()
      toast.success('Table deleted')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const downloadQR = async (table: RestaurantTable) => {
    const url = `${window.location.origin}/?t=${table.token}`
    const QRCode = (await import('qrcode')).default
    const dataUrl = await QRCode.toDataURL(url, {
      width: 600,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `qr-${table.label.replace(/\s+/g, '-').toLowerCase()}.png`
    a.click()
    toast.success(`QR code downloaded for ${table.label}`)
  }

  const buildQRWithLogo = async (token: string): Promise<string> => {
    const QRCode = (await import('qrcode')).default
    const canvas = document.createElement('canvas')
    await QRCode.toCanvas(canvas, `${window.location.origin}/?t=${token}`, {
      width: 500,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    })

    return new Promise((resolve) => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(canvas.toDataURL('image/png'))
      const img = new Image()
      img.src = qrLogo
      img.onload = () => {
        const centerSize = canvas.width * 0.22
        const centerXY = (canvas.width - centerSize) / 2
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.roundRect(
          centerXY - 4,
          centerXY - 4,
          centerSize + 8,
          centerSize + 8,
          8,
        )
        ctx.fill()
        ctx.drawImage(img, centerXY, centerXY, centerSize, centerSize)
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = () => resolve(canvas.toDataURL('image/png'))
    })
  }

  const buildQRDataUrl = async (token: string) => buildQRWithLogo(token)

  const handlePrintAll = async () => {
    setIsPrinting(true)
    try {
      const items = await Promise.all(
        tables.map(async (t) => ({
          label: t.label,
          dataUrl: await buildQRWithLogo(t.token),
        })),
      )

      const iframe = document.createElement('iframe')
      iframe.style.display = 'none'
      document.body.appendChild(iframe)
      const doc = iframe.contentWindow?.document
      if (!doc) return
      doc.write(`
        <html><head><title>Print QR</title>
        <style>
          body { font-family: sans-serif; margin: 0; background: #fff; }
          .grid { display: flex; flex-wrap: wrap; gap: 24px; padding: 24px; justify-content: flex-start; }
          .card { text-align: center; border: 1px solid #ddd; border-radius: 12px; padding: 16px; width: 160px; break-inside: avoid; }
          .card img { width: 140px; height: 140px; }
          .card p { margin: 8px 0 0; font-weight: 700; font-size: 16px; color: #000; }
          @media print { 
              @page { margin: 10mm } 
              .card { border: 1px solid #ccc; }
          }
        </style></head><body>
        <div class="grid">${items
          .map(
            (i) => `
          <div class="card"><img src="${i.dataUrl}" /><p>${i.label}</p></div>`,
          )
          .join('')}
        </div></body></html>
      `)
      doc.close()

      setTimeout(() => {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
        setTimeout(() => document.body.removeChild(iframe), 3000)
      }, 500)
    } finally {
      setTimeout(() => setIsPrinting(false), 800)
    }
  }

  const handleDownloadAll = async () => {
    setIsDownloading(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF()

      const margin = 20
      const qrSize = 50
      const cols = 3
      const gapX = (210 - margin * 2 - qrSize * cols) / (cols - 1)
      const gapY = 25

      let x = margin
      let y = margin
      let row = 0
      let col = 0

      for (let i = 0; i < tables.length; i++) {
        const t = tables[i]
        const dataUrl = await buildQRWithLogo(t.token)

        if (y + qrSize + 10 > 297 - margin) {
          doc.addPage()
          x = margin
          y = margin
          row = 0
          col = 0
        }

        doc.addImage(dataUrl, 'PNG', x, y, qrSize, qrSize)
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text(t.label, x + qrSize / 2, y + qrSize + 6, { align: 'center' })

        col++
        if (col >= cols) {
          col = 0
          row++
          x = margin
          y = margin + row * (qrSize + gapY)
        } else {
          x += qrSize + gapX
        }
      }

      doc.save('origin-table-qr-codes.pdf')
      toast.success('Downloaded all QR codes as PDF!')
    } catch (err) {
      toast.error('Failed to generate PDF')
    } finally {
      setIsDownloading(false)
    }
  }

  const inputCls =
    'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none'

  return (
    <div className="space-y-4">
      <ConfirmationModal
        open={!!showConfirm}
        title="Delete Table"
        description={`Are you sure you want to delete "${showConfirm?.label}"? This will break any existing QR codes.`}
        confirmLabel="Delete"
        onConfirm={() => showConfirm && handleDelete(showConfirm.id)}
        onCancel={() => setShowConfirm(null)}
        busy={busyId === showConfirm?.id}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg uppercase tracking-wider text-primary">
            Tables
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Each table gets a unique QR code. Print and place on the table.
          </p>
        </div>
        <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
          {tables.length > 0 && (
            <>
              <button
                onClick={handlePrintAll}
                disabled={isPrinting}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
              >
                {isPrinting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Printer className="h-3.5 w-3.5" />
                )}
                Print All
              </button>
              <button
                onClick={handleDownloadAll}
                disabled={isDownloading}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
              >
                {isDownloading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Download All
              </button>
            </>
          )}
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Add Table
          </button>
        </div>
      </div>

      {adding && (
        <form
          onSubmit={handleAdd}
          className="flex items-center gap-2 rounded-xl border border-primary/40 bg-card p-4"
        >
          <input
            autoFocus
            required
            className={inputCls}
            placeholder='e.g. "Table 1" or "VIP 2"'
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          <button
            type="submit"
            disabled={busyId === 'new'}
            className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busyId === 'new' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false)
              setNewLabel('')
            }}
            className="rounded-md p-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </form>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : tables.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <QrCode className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No tables yet. Add your first table above.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
          {tables.map((table) => (
            <TableRow
              key={table.id}
              table={table}
              busyId={busyId}
              editingId={editingId}
              editLabel={editLabel}
              setEditLabel={setEditLabel}
              setEditingId={setEditingId}
              handleRename={handleRename}
              handleRegenerate={handleRegenerate}
              downloadQR={downloadQR}
              setShowConfirm={setShowConfirm}
              buildQRDataUrl={buildQRDataUrl}
              setPreviewQR={setPreviewQR}
            />
          ))}
        </div>
      )}

      {previewQR && (
        <div
          className="fixed inset-0 z-200 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setPreviewQR(null)}
        >
          <div
            className="animate-in zoom-in-95 duration-200 flex w-full max-w-sm flex-col items-center rounded-2xl bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewQR.url}
              alt={`QR Code for ${previewQR.label}`}
              className="h-auto w-full rounded-xl border border-border"
            />
            <p className="mt-4 font-display text-xl text-foreground font-semibold">
              {previewQR.label}
            </p>
            <button
              onClick={() => setPreviewQR(null)}
              className="mt-5 w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function TableRow({
  table,
  busyId,
  editingId,
  editLabel,
  setEditLabel,
  setEditingId,
  handleRename,
  handleRegenerate,
  downloadQR,
  setShowConfirm,
  buildQRDataUrl,
  setPreviewQR,
}: {
  table: RestaurantTable
  busyId: string | null
  editingId: string | null
  editLabel: string
  setEditLabel: (v: string) => void
  setEditingId: (v: string | null) => void
  handleRename: (id: string) => void
  handleRegenerate: (id: string, label: string) => void
  downloadQR: (t: RestaurantTable) => void
  setShowConfirm: (v: { id: string; label: string } | null) => void
  buildQRDataUrl: (token: string) => Promise<string>
  setPreviewQR: (v: { url: string; label: string } | null) => void
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    buildQRDataUrl(table.token).then(setQrDataUrl)
  }, [table.token])

  return (
    <div className="flex flex-wrap items-start gap-3 px-4 py-3">
      {/* Inline QR preview */}
      <div className="shrink-0">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={`QR for ${table.label}`}
            className="h-16 w-16 cursor-pointer rounded-lg border border-border object-contain transition hover:opacity-80"
            onClick={() => setPreviewQR({ url: qrDataUrl, label: table.label })}
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 pt-1">
        {editingId === table.id ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              className="rounded border border-border bg-background px-2 py-1 text-sm focus:border-primary focus:outline-none"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename(table.id)
                if (e.key === 'Escape') setEditingId(null)
              }}
            />
            <button
              onClick={() => handleRename(table.id)}
              disabled={busyId === table.id}
              className="rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busyId === table.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                'Save'
              )}
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <p className="text-sm font-semibold">{table.label}</p>
        )}
        <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
          ?t={table.token.slice(0, 16)}…
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 pt-1">
        <button
          title="Download QR Code"
          onClick={() => downloadQR(table)}
          className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary"
        >
          <Download className="h-3.5 w-3.5" /> QR
        </button>
        <button
          title="Rename"
          onClick={() => {
            setEditingId(table.id)
            setEditLabel(table.label)
          }}
          className="rounded-md border border-border p-1.5 text-muted-foreground hover:border-primary hover:text-primary"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          title="Regenerate token — invalidates old QR"
          disabled={busyId === table.id}
          onClick={() => handleRegenerate(table.id, table.label)}
          className="rounded-md border border-border p-1.5 text-muted-foreground hover:border-amber-500 hover:text-amber-500 disabled:opacity-50"
        >
          {busyId === table.id ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          title="Delete table"
          onClick={() => setShowConfirm({ id: table.id, label: table.label })}
          className="rounded-md border border-border p-1.5 text-muted-foreground hover:border-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Orders Tab ───────────────────────────────────────────────────────────────

function OrdersTab() {
  const [orders, setOrders] = useState<TableOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [doneLimit, setDoneLimit] = useState(20)
  const [doneLoadingMore, setDoneLoadingMore] = useState(false)

  const fetchOrders = async () => {
    try {
      const data = await getTableOrders()
      setOrders((data as TableOrder[]) || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 8000)
    const handleReload = () => fetchOrders()
    window.addEventListener('reload-orders', handleReload)
    return () => {
      clearInterval(interval)
      window.removeEventListener('reload-orders', handleReload)
    }
  }, [])

  const handleStatus = async (
    id: string,
    status: 'accepted' | 'rejected' | 'completed',
  ) => {
    setBusyId(id)
    try {
      await updateOrderStatus({ data: { id, status } })
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)))
      if (status === 'accepted')
        toast.success('Order accepted — send to kitchen!')
      if (status === 'rejected') toast('Order rejected')
      if (status === 'completed') toast.success('Order marked complete')
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

  const timeAgo = (ts: string) => {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    return `${Math.floor(diff / 3600)}h ago`
  }

  function OrderCard({ order }: { order: TableOrder }) {
    const isPending = order.status === 'pending'
    const isAccepted = order.status === 'accepted'
    const busy = busyId === order.id

    return (
      <div
        className={`rounded-xl border bg-card p-4 transition-all w-full inline-block break-inside-avoid mb-3 ${
          isPending
            ? 'border-primary/60 shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]'
            : isAccepted
              ? 'border-green-500/40 bg-green-500/5'
              : 'border-border opacity-60'
        }`}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {isPending ? (
              <ChefHat className="h-4 w-4 text-primary" />
            ) : isAccepted ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <X className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="font-display text-sm font-semibold uppercase tracking-wider">
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
              {order.status}
            </span>
          </div>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {timeAgo(order.created_at)}
          </span>
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
              disabled={busy}
              onClick={() => handleStatus(order.id, 'accepted')}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Accept
            </button>
            <button
              disabled={busy}
              onClick={() => handleStatus(order.id, 'rejected')}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" /> Reject
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
            Mark Completed
          </button>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-sm uppercase tracking-wider text-primary">
          <ChefHat className="h-4 w-4" />
          Pending Orders
          {pending.length > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
              {pending.length}
            </span>
          )}
        </h2>
        {pending.length === 0 ? (
          <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
            No pending orders
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
            <Check className="h-4 w-4" /> In Kitchen
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
            <ClipboardList className="h-4 w-4" /> Completed / Rejected
          </h2>
          <div className="columns-1 sm:columns-2 gap-3 opacity-70">
            {done.slice(0, doneLimit).map((o) => (
              <OrderCard key={o.id} order={o} />
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
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-60"
            >
              {doneLoadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>Load More ({done.length - doneLimit} remaining)</>
              )}
            </button>
          )}
        </section>
      )}
    </div>
  )
}
