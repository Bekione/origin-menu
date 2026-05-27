import { createServerFn } from '@tanstack/react-start'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'
import { auth } from '#/lib/auth'

async function checkAdminAuth() {
  const request = getRequest()
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user || (session.user as any).role !== 'admin') {
    throw new Error('Unauthorized')
  }
  return session
}

export type DashboardStats = {
  todayRevenue: number
  todayOrders: number
  avgOrderValue: number
  topItems: Array<{ name: string; qty: number }>
  topTables: Array<{ label: string; count: number }>
  outOfStockItems: Array<{ id: string; name: string; name_am: string | null }>

  salesTrend: Array<{ date: string; amount: number }>
  todayCustomers: number
}

export const getDashboardStats = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ isMonth: z.boolean() }))
  .handler(async ({ data: { isMonth } }) => {
    await checkAdminAuth()

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    // 1. Fetch today's orders
    const { data: orders, error } = await supabaseAdmin
      .from('table_orders')
      .select('items, status, table_label')
      .gte('created_at', todayISO)

    if (error) throw new Error(error.message)

    let todayRevenue = 0
    let todayOrders = 0
    const itemTally: Record<string, number> = {}
    const tableTally: Record<string, number> = {}

    orders?.forEach((order) => {
      const items = (order.items as any[]) || []
      const isPaid = order.status === 'completed' || order.status === 'accepted'

      todayOrders++

      if (order.table_label) {
        tableTally[order.table_label] = (tableTally[order.table_label] || 0) + 1
      }

      items.forEach((item: any) => {
        if (isPaid) {
          todayRevenue += (item.price || 0) * (item.qty || 0)
        }
        const name = item.name || 'Unknown'
        itemTally[name] = (itemTally[name] || 0) + (item.qty || 0)
      })
    })

    const avgOrderValue = todayOrders > 0 ? todayRevenue / todayOrders : 0
    const topItems = Object.entries(itemTally)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)

    const topTables = Object.entries(tableTally)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const { data: outOfStock } = await supabaseAdmin
      .from('menu_items')
      .select('id, name, name_am')
      .eq('is_available', false)

    // 2. Fetch Sales Trend (Last 7 or 30 Days)
    const rangeDays = isMonth ? 30 : 7
    const rangeStart = new Date()
    rangeStart.setDate(rangeStart.getDate() - rangeDays)
    rangeStart.setHours(0, 0, 0, 0)

    const { data: trendOrders } = await supabaseAdmin
      .from('table_orders')
      .select('created_at, items, status')
      .gte('created_at', rangeStart.toISOString())
      .in('status', ['accepted', 'completed'])

    const trendMap: Record<string, number> = {}
    for (let i = 0; i < rangeDays; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      trendMap[d.toISOString().split('T')[0]] = 0
    }

    trendOrders?.forEach((o) => {
      const date = o.created_at.split('T')[0]
      if (trendMap[date] !== undefined) {
        const items = (o.items as any[]) || []
        const total = items.reduce(
          (acc, it) => acc + (it.price || 0) * (it.qty || 0),
          0,
        )
        trendMap[date] += total
      }
    })

    const salesTrend = Object.entries(trendMap)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const { data: dailyUnique } = await supabaseAdmin
      .from('table_orders')
      .select('device_id')
      .gte('created_at', todayISO)

    const uniqueDevices = new Set(dailyUnique?.map((o) => o.device_id))

    return {
      todayRevenue,
      todayOrders,
      avgOrderValue,
      topItems,
      topTables,
      outOfStockItems: outOfStock || [],
      salesTrend,
      todayCustomers: uniqueDevices.size,
    } as DashboardStats
  })

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
