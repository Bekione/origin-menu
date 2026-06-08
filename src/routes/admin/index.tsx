import { createFileRoute, redirect } from '@tanstack/react-router'
import { useCallback, useEffect, useState, memo } from 'react'
import { authClient } from '#/lib/auth-client'
import { getAuthSession } from '@/server/auth-helpers'
import { getMenuData, type MenuData } from '@/server/menu.functions'
import {
  getWaiterCalls,
  acknowledgeCall,
  dismissCall,
  getTableOrders,
  type WaiterCall,
} from '@/server/table.functions'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminRealtime } from './-hooks/useAdminRealtime'
import { AdminHeader } from './-components/AdminHeader'
import { WaiterCallsPanel } from './-components/WaiterCallsPanel'

// Tab imports
import { ItemsTab } from './-tabs/ItemsTab'
import { CategoriesTab } from './-tabs/CategoriesTab'
import { InfoTab } from './-tabs/InfoTab'
import { TablesTab } from './-tabs/TablesTab'
import { OrdersTab } from './-tabs/OrdersTab'
import { DashboardTab } from './-tabs/DashboardTab'
import { SettingsTab } from './-tabs/SettingsTab'
import { FeedbackTab } from './-tabs/FeedbackTab'
import { LoyaltyTab } from './-tabs/LoyaltyTab'

const MemoDashboardTab = memo(DashboardTab)
const MemoItemsTab = memo(ItemsTab)
const MemoCategoriesTab = memo(CategoriesTab)
const MemoInfoTab = memo(InfoTab)
const MemoSettingsTab = memo(SettingsTab)
const MemoTablesTab = memo(TablesTab)
const MemoOrdersTab = memo(OrdersTab)
const MemoFeedbackTab = memo(FeedbackTab)
const MemoLoyaltyTab = memo(LoyaltyTab)

// ─── Route types ──────────────────────────────────────────────────────────────

type TabValue =
  | 'dashboard'
  | 'items'
  | 'categories'
  | 'info'
  | 'tables'
  | 'orders'
  | 'settings'
  | 'feedback'
  | 'loyalty'

type AdminSearch = { tab?: TabValue }

// ─── Route definition ─────────────────────────────────────────────────────────

export const Route = createFileRoute('/admin/')({
  validateSearch: (search: Record<string, unknown>): AdminSearch => {
    const t = search.tab as string
    return {
      tab: [
        'dashboard',
        'items',
        'categories',
        'info',
        'tables',
        'orders',
        'settings',
        'feedback',
        'loyalty',
      ].includes(t)
        ? (t as TabValue)
        : undefined,
    }
  },
  beforeLoad: async ({ cause }) => {
    // Only check auth on initial page load, not on search param changes (tab switches)
    if (cause !== 'enter') return
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
  staleTime: 1000 * 60 * 5, // 5 minutes cache
  shouldReload: false,
  component: AdminPage,
  pendingComponent: AdminSkeleton,
  pendingMs: 0,
})

// ─── AdminPage ────────────────────────────────────────────────────────────────

function AdminPage() {
  const initial = Route.useLoaderData() as MenuData
  const [data, setData] = useState<MenuData>(initial)
  const searchParams = Route.useSearch()
  const tab = searchParams.tab || 'dashboard'
  const navigate = Route.useNavigate()
  const setTab = useCallback(
    (t: TabValue) => navigate({ search: { tab: t }, replace: true }),
    [navigate],
  )

  const [calls, setCalls] = useState<WaiterCall[]>([])
  const [callsLoading, setCallsLoading] = useState(true)
  const [callsOpen, setCallsOpen] = useState(false)
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null)
  const [dismissingId, setDismissingId] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [pendingOrderCount, setPendingOrderCount] = useState(0)

  // Load initial state
  useEffect(() => {
    setCallsLoading(true)
    getWaiterCalls()
      .then((data) => setCalls(data as WaiterCall[]))
      .finally(() => setCallsLoading(false))
    getTableOrders().then((data) => {
      const orders = (data as any[]) || []
      setPendingOrderCount(orders.filter((o) => o.status === 'pending').length)
    })
  }, [])

  // Hook up realtime
  useAdminRealtime({ setCalls, setPendingOrderCount, setCallsOpen })

  const handleAcknowledge = useCallback(async (id: string) => {
    setAcknowledgingId(id)
    try {
      await acknowledgeCall({ data: { id } })
      setCalls((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'acknowledged' } : c)),
      )
    } finally {
      setAcknowledgingId(null)
    }
  }, [])

  const handleDismiss = useCallback(async (id: string) => {
    setDismissingId(id)
    try {
      await dismissCall({ data: { id } })
      setCalls((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'rejected' } : c)),
      )
    } finally {
      setDismissingId(null)
    }
  }, [])

  const pendingCount = calls.filter((c) => c.status === 'pending').length
  const refresh = useCallback(async () => {
    const fresh = await getMenuData()
    setData(fresh)
  }, [])
  const logout = useCallback(async () => {
    setLoggingOut(true)
    try {
      await authClient.signOut()
      navigate({ to: '/login' })
    } catch {
      setLoggingOut(false)
    }
  }, [navigate])

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader
        tab={tab}
        setTab={setTab}
        pendingCount={pendingCount}
        pendingOrderCount={pendingOrderCount}
        callsOpen={callsOpen}
        setCallsOpen={setCallsOpen}
        loggingOut={loggingOut}
        onLogout={logout}
      />

      {callsOpen && (
        <WaiterCallsPanel
          calls={calls}
          loading={callsLoading}
          pendingCount={pendingCount}
          onClose={() => setCallsOpen(false)}
          onAcknowledge={handleAcknowledge}
          acknowledgingId={acknowledgingId}
          onDismiss={handleDismiss}
          dismissingId={dismissingId}
        />
      )}

      {/* ── Tab Content ── */}
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className={tab === 'dashboard' ? undefined : 'hidden'}>
          <MemoDashboardTab />
        </div>
        <div className={tab === 'items' ? undefined : 'hidden'}>
          <MemoItemsTab data={data} onChange={refresh} />
        </div>
        <div className={tab === 'categories' ? undefined : 'hidden'}>
          <MemoCategoriesTab data={data} onChange={refresh} />
        </div>
        <div className={tab === 'info' ? undefined : 'hidden'}>
          <MemoInfoTab info={data.info} onChange={refresh} />
        </div>
        <div className={tab === 'tables' ? undefined : 'hidden'}>
          <MemoTablesTab />
        </div>
        <div className={tab === 'orders' ? undefined : 'hidden'}>
          <MemoOrdersTab />
        </div>
        <div className={tab === 'settings' ? undefined : 'hidden'}>
          <MemoSettingsTab />
        </div>
        <div className={tab === 'feedback' ? undefined : 'hidden'}>
          <MemoFeedbackTab />
        </div>
        <div className={tab === 'loyalty' ? undefined : 'hidden'}>
          <MemoLoyaltyTab />
        </div>
      </main>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function AdminSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-2 w-20 opacity-50" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>
        <div className="mx-auto flex max-w-5xl gap-1 px-4 overflow-x-auto no-scrollbar">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-10 w-24 min-w-[90px] rounded-t-md" />
          ))}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8">
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-4 w-64 opacity-50" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      </main>
    </div>
  )
}
