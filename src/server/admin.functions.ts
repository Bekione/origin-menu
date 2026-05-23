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

export type DashboardStats = {
  todayRevenue: number
  todayOrders: number
  avgOrderValue: number
  topItems: Array<{ name: string; qty: number }>
  outOfStockItems: Array<{ id: string; name: string; name_am: string | null }>
}

export const getDashboardStats = createServerFn({ method: 'GET' }).handler(
  async () => {
    await checkAdminAuth()

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    // 1. Fetch today's orders
    const { data: orders, error } = await supabaseAdmin
      .from('table_orders')
      .select('items, status')
      .gte('created_at', todayISO)

    if (error) throw new Error(error.message)

    let todayRevenue = 0
    let todayOrders = 0
    const itemTally: Record<string, number> = {}

    orders?.forEach((order) => {
      const items = (order.items as any[]) || []
      const isPaid = order.status === 'completed' || order.status === 'accepted'

      todayOrders++

      items.forEach((item: any) => {
        if (isPaid) {
          todayRevenue += (item.price || 0) * (item.qty || 0)
        }

        // Tally top items (volume-based)
        const name = item.name || 'Unknown'
        itemTally[name] = (itemTally[name] || 0) + (item.qty || 0)
      })
    })

    const avgOrderValue = todayOrders > 0 ? todayRevenue / todayOrders : 0

    const topItems = Object.entries(itemTally)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)

    const { data: outOfStock } = await supabaseAdmin
      .from('menu_items')
      .select('id, name, name_am')
      .eq('is_available', false)

    return {
      todayRevenue,
      todayOrders,
      avgOrderValue,
      topItems,
      outOfStockItems: outOfStock || [],
    } as DashboardStats
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
