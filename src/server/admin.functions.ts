import { createServerFn } from '@tanstack/react-start'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'

async function checkAdminAuth() {
  const request = getRequest()
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user || (session.user as any).role !== 'admin') {
    throw new Error('Unauthorized')
  }
  return session
}

export type DashboardKPIs = {
  todayRevenue: number
  todayOrders: number
  avgOrderValue: number
  todayCustomers: number
}

export type SalesTrend = Array<{ date: string; amount: number }>

export type DashboardTrends = {
  weekly: SalesTrend
  monthly: SalesTrend
}

export type TopStats = {
  items: Array<{ name: string; qty: number }>
  tables: Array<{ label: string; count: number }>
}

/** 1. Fast KPIs (Today) */
export const getDashboardKPIs = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DashboardKPIs> => {
    await checkAdminAuth()
    const todayISO = new Date().toISOString().split('T')[0] + 'T00:00:00Z'

    const { data: orders, error } = await supabaseAdmin
      .from('table_orders')
      .select('total_amount, status, device_id')
      .gte('created_at', todayISO)

    if (error) throw new Error(error.message)

    let todayRevenue = 0
    let todayOrders = 0
    const devices = new Set<string>()

    orders?.forEach((o: any) => {
      todayOrders++
      if (o.device_id) devices.add(o.device_id)
      if (o.status === 'completed' || o.status === 'accepted') {
        todayRevenue += Number(o.total_amount || 0)
      }
    })

    return {
      todayRevenue,
      todayOrders,
      avgOrderValue: todayOrders > 0 ? todayRevenue / todayOrders : 0,
      todayCustomers: devices.size,
    }
  },
)

/** 2. Trends (7d & 30d) - Zero JSONB parsing */
export const getDashboardTrends = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DashboardTrends> => {
    await checkAdminAuth()
    const rangeStart = new Date()
    rangeStart.setDate(rangeStart.getDate() - 30)
    const rangeISO = rangeStart.toISOString().split('T')[0] + 'T00:00:00Z'

    const { data: trendOrders, error } = await supabaseAdmin
      .from('table_orders')
      .select('created_at, total_amount')
      .gte('created_at', rangeISO)
      .in('status', ['accepted', 'completed'])

    if (error) throw new Error(error.message)

    const trendMap: Record<string, number> = {}
    for (let i = 0; i < 30; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      trendMap[d.toISOString().split('T')[0]] = 0
    }

    trendOrders?.forEach((o: any) => {
      const date = o.created_at.split('T')[0]
      if (trendMap[date] !== undefined) {
        trendMap[date] += Number(o.total_amount || 0)
      }
    })

    const allData = Object.entries(trendMap)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return {
      monthly: allData,
      weekly: allData.slice(-7),
    }
  },
)

/** 3. Top Stats (Requires parsing today's items) */
export const getDashboardTopStats = createServerFn({ method: 'GET' }).handler(
  async (): Promise<TopStats> => {
    await checkAdminAuth()
    const todayISO = new Date().toISOString().split('T')[0] + 'T00:00:00Z'

    const { data: orders, error } = await supabaseAdmin
      .from('table_orders')
      .select('items, table_label')
      .gte('created_at', todayISO)

    if (error) throw new Error(error.message)

    const itemTally: Record<string, number> = {}
    const tableTally: Record<string, number> = {}

    orders?.forEach((o) => {
      if (o.table_label) {
        tableTally[o.table_label] = (tableTally[o.table_label] || 0) + 1
      }
      const items = (o.items as any[]) || []
      items.forEach((it) => {
        const name = it.name || 'Unknown'
        itemTally[name] = (itemTally[name] || 0) + (it.qty || 0)
      })
    })

    return {
      items: Object.entries(itemTally)
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5),
      tables: Object.entries(tableTally)
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    }
  },
)

/** 4. Out of Stock (Static) */
export const getOutOfStockItems = createServerFn({ method: 'GET' }).handler(
  async () => {
    await checkAdminAuth()
    const { data, error } = await supabaseAdmin
      .from('menu_items')
      .select('id, name, name_am')
      .eq('is_available', false)

    if (error) throw new Error(error.message)
    return data || []
  },
)

export const getPendingOrderCount = createServerFn({
  method: 'GET',
}).handler(async () => {
  await checkAdminAuth()
  const { count, error } = await supabaseAdmin
    .from('table_orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  if (error) throw new Error(error.message)
  return count || 0
})
