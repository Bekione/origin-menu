import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { authClient } from '#/lib/auth-client'
import { getAuthSession } from '@/server/auth-helpers'
import { getMenuData, type MenuData } from '@/server/menu.functions'
import {
  getWaiterCalls,
  acknowledgeCall,
  getTableOrders,
  type WaiterCall,
} from '@/server/table.functions'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminRealtime } from './hooks/useAdminRealtime'
import { AdminHeader } from './components/AdminHeader'
import { WaiterCallsPanel } from './components/WaiterCallsPanel'

// Tab imports
import { ItemsTab } from './tabs/ItemsTab'
import { CategoriesTab } from './tabs/CategoriesTab'
import { InfoTab } from './tabs/InfoTab'
import { TablesTab } from './tabs/TablesTab'
import { OrdersTab } from './tabs/OrdersTab'
import { DashboardTab } from './tabs/DashboardTab'
import { SettingsTab } from './tabs/SettingsTab'

// ─── Route types ──────────────────────────────────────────────────────────────

type TabValue =
  | 'dashboard'
  | 'items'
  | 'categories'
  | 'info'
  | 'tables'
  | 'orders'
  | 'settings'

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

// ─── AdminPage ────────────────────────────────────────────────────────────────

function AdminPage() {
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

  // Load initial state
  useEffect(() => {
    getWaiterCalls().then((data) => setCalls(data as WaiterCall[]))
    getTableOrders().then((data) => {
      const orders = (data as any[]) || []
      setPendingOrderCount(orders.filter((o) => o.status === 'pending').length)
    })
  }, [])

  // Hook up realtime
  useAdminRealtime({ setCalls, setPendingOrderCount, setCallsOpen })

  const handleAcknowledge = async (id: string) => {
    setAcknowledgingId(id)
    try {
      await acknowledgeCall({ data: { id } })
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
          pendingCount={pendingCount}
          onClose={() => setCallsOpen(false)}
          onAcknowledge={handleAcknowledge}
          acknowledgingId={acknowledgingId}
        />
      )}

      {/* ── Tab Content ── */}
      <main className="mx-auto max-w-5xl px-4 py-8">
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'items' && <ItemsTab data={data} onChange={refresh} />}
        {tab === 'categories' && (
          <CategoriesTab data={data} onChange={refresh} />
        )}
        {tab === 'info' && <InfoTab info={data.info} onChange={refresh} />}
        {tab === 'settings' && <SettingsTab />}
        {/* Tables + Orders: always mounted, hidden when not active, to preserve data across tab switches */}
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

// ─── Loading skeleton ─────────────────────────────────────────────────────────

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
