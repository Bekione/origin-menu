import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'

async function checkAuth() {
  const request = getRequest()
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) throw new Error('Unauthorized')
  return session
}

export type WaiterCall = {
  id: string
  table_number: number
  table_label?: string
  status: 'pending' | 'acknowledged' | 'rejected' | 'resolved' | 'dismissed'
  device_id: string
  created_at: string
}

/** Public — anyone can call a waiter (no auth needed) */
export const callWaiter = createServerFn({ method: 'POST' })
  .inputValidator((d) =>
    z
      .object({
        table_label: z.string().min(1),
        device_id: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { data: existing } = await supabaseAdmin
      .from('waiter_calls')
      .select('created_at')
      .eq('device_id', data.device_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      const callTime = new Date(existing.created_at).getTime()
      const now = Date.now()
      if (now - callTime < 10 * 60 * 1000) {
        throw new Error('A waiter is already on their way to your table.')
      }
    }

    const { data: newCall, error } = await supabaseAdmin
      .from('waiter_calls')
      .insert({
        table_number: 1,
        table_label: data.table_label,
        device_id: data.device_id,
        status: 'pending',
      } as any)
      .select('*')
      .single()

    if (error) throw new Error(error.message)

    await supabaseAdmin.channel('origin-realtime').send({
      type: 'broadcast',
      event: 'new_call',
      payload: newCall,
    })

    return { ok: true }
  })

/** Admin — get all pending/recent calls */
export const getWaiterCalls = createServerFn({ method: 'GET' }).handler(
  async () => {
    await checkAuth()
    const { data, error } = await supabaseAdmin
      .from('waiter_calls')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw new Error(error.message)
    return (data ?? []) as WaiterCall[]
  },
)

/** Admin — acknowledge a call */
export const acknowledgeCall = createServerFn({ method: 'POST' })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await checkAuth()
    const { error } = await supabaseAdmin
      .from('waiter_calls')
      .update({ status: 'acknowledged' })
      .eq('id', data.id)
    if (error) throw new Error(error.message)

    // Broadcast for instant KDS/Admin sync
    await supabaseAdmin.channel('origin-realtime').send({
      type: 'broadcast',
      event: 'call_acknowledged',
      payload: { id: data.id },
    })

    return { ok: true }
  })

/** Admin — dismiss/reject a waiter call */
export const dismissCall = createServerFn({ method: 'POST' })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await checkAuth()
    const { error } = await supabaseAdmin
      .from('waiter_calls')
      .update({ status: 'rejected' })
      .eq('id', data.id)
    if (error) throw new Error(error.message)

    // Broadcast for instant KDS/Admin sync
    await supabaseAdmin.channel('origin-realtime').send({
      type: 'broadcast',
      event: 'call_rejected',
      payload: { id: data.id },
    })

    return { ok: true }
  })

// ─── Restaurant Tables ────────────────────────────────────────────────────────

/** Public — verify a table token from QR code */
export const verifyTableToken = createServerFn({ method: 'POST' })
  .inputValidator((d) => z.object({ token: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { data: table, error } = await supabaseAdmin
      .from('restaurant_tables')
      .select('id, label, is_active')
      .eq('token', data.token)
      .maybeSingle()

    if (error || !table) throw new Error('Invalid QR code')
    if (!table.is_active) throw new Error('This table is currently inactive')
    return { id: table.id, label: table.label }
  })

/** Public — record a QR scan event (fire-and-forget, no auth) */
export const recordQrScan = createServerFn({ method: 'POST' })
  .inputValidator((d) =>
    z
      .object({
        table_id: z.string().uuid().optional(),
        table_label: z.string().optional(),
        device_id: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from('qr_scans').insert({
      table_id: data.table_id ?? null,
      table_label: data.table_label ?? null,
      device_id: data.device_id,
    } as any)

    if (error) {
      console.error('Supabase QR Scan Insert Error:', error)
      throw new Error(error.message)
    }

    // Fallback/Proactive: also broadcast the scan to the dashboard channel
    // This works even if postgres_changes is blocked by RLS or replication settings
    await supabaseAdmin.channel('origin-qr-scans-live').send({
      type: 'broadcast',
      event: 'new_scan',
      payload: { table_id: data.table_id, device_id: data.device_id },
    })

    return { ok: true }
  })

/** Admin — list all tables */
export const getTables = createServerFn({ method: 'GET' }).handler(async () => {
  await checkAuth()
  const { data, error } = await supabaseAdmin
    .from('restaurant_tables')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
})

/** Admin — create or rename a table */
export const upsertTable = createServerFn({ method: 'POST' })
  .inputValidator((d) =>
    z
      .object({ id: z.string().uuid().optional(), label: z.string().min(1) })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await checkAuth()
    if (data.id) {
      const { error } = await supabaseAdmin
        .from('restaurant_tables')
        .update({ label: data.label })
        .eq('id', data.id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await supabaseAdmin
        .from('restaurant_tables')
        .insert({ label: data.label })
      if (error) throw new Error(error.message)
    }
    return { ok: true }
  })

/** Admin — rotate the token for a table (invalidates old QR code) */
export const regenerateTableToken = createServerFn({ method: 'POST' })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await checkAuth()
    const newToken = crypto.randomUUID()
    const { error: updateError } = await supabaseAdmin
      .from('restaurant_tables')
      .update({ token: newToken })
      .eq('id', data.id)
    if (updateError) throw new Error(updateError.message)
    return { ok: true, token: newToken }
  })

/** Admin — soft-delete (deactivate) a table */
export const deleteTable = createServerFn({ method: 'POST' })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await checkAuth()
    const { error } = await supabaseAdmin
      .from('restaurant_tables')
      .delete()
      .eq('id', data.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

// ─── Table Orders ─────────────────────────────────────────────────────────────

const OrderItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  name_am: z.string().nullable().optional(),
  qty: z.number().int().min(1),
  price: z.number(),
})

/** Public — place an order from the menu */
export const placeOrder = createServerFn({ method: 'POST' })
  .inputValidator((d) =>
    z
      .object({
        table_id: z.string().uuid(),
        table_label: z.string(),
        items: z.array(OrderItemSchema).min(1).max(20),
        note: z.string().max(300).optional(),
        device_id: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { data: recent } = await supabaseAdmin
      .from('table_orders')
      .select('created_at')
      .eq('device_id', data.device_id)
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (recent) {
      const elapsed = Date.now() - new Date(recent.created_at).getTime()
      if (elapsed < 5 * 60 * 1000) {
        throw new Error(
          'You already have an active order. Please wait for it to be accepted before ordering again.',
        )
      }
    }

    const { data: menuItems, error: menuErr } = await supabaseAdmin
      .from('menu_items')
      .select('id, name, name_am, price, is_available')
      .in(
        'id',
        data.items.map((i) => i.id),
      )

    if (menuErr) throw new Error(menuErr.message)

    const unavailable = (menuItems ?? []).filter((m) => !m.is_available)
    if (unavailable.length > 0) {
      const names = unavailable.map((m) => m.name).join(', ')
      throw new Error(
        `Sorry, the following items are currently not available: ${names}`,
      )
    }

    const menuMap = new Map((menuItems ?? []).map((m) => [m.id, m]))
    const enrichedItems = data.items.map((cartItem) => {
      const match = menuMap.get(cartItem.id)
      return {
        id: cartItem.id,
        name: match?.name || cartItem.name,
        name_am: match?.name_am || null,
        qty: cartItem.qty,
        price: match?.price ?? cartItem.price,
      }
    })

    const total_amount = enrichedItems.reduce(
      (acc, it) => acc + (it.price || 0) * (it.qty || 0),
      0,
    )

    const { data: newOrder, error } = await supabaseAdmin
      .from('table_orders')
      .insert({
        table_id: data.table_id,
        table_label: data.table_label,
        items: enrichedItems,
        total_amount,
        note: data.note ?? null,
        device_id: data.device_id,
        status: 'pending',
      } as any)
      .select('id, created_at')
      .single()

    if (error) throw new Error(error.message)

    const { data: fullOrder } = await supabaseAdmin
      .from('table_orders')
      .select('*')
      .eq('id', newOrder.id)
      .single()

    await supabaseAdmin.channel('origin-realtime').send({
      type: 'broadcast',
      event: 'new_order',
      payload: fullOrder,
    })

    return { ok: true }
  })

/** Admin — get all orders (Paginated) */
export const getTableOrders = createServerFn({ method: 'GET' })
  .inputValidator((d) =>
    z
      .object({
        offset: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(100).default(20),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data }) => {
    await checkAuth()
    const { offset = 0, limit = 20 } = data ?? {}

    const { data: orders, error } = await supabaseAdmin
      .from('table_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw new Error(error.message)
    return (orders ?? []) as TableOrder[]
  })

/** Admin/Staff — update order status (with guard against double-processing) */
export const updateOrderStatus = createServerFn({ method: 'POST' })
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(['accepted', 'rejected', 'completed']),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await checkAuth()

    // Guard: fetch current status before updating
    const { data: current, error: fetchErr } = await supabaseAdmin
      .from('table_orders')
      .select('status')
      .eq('id', data.id)
      .single()

    if (fetchErr || !current) throw new Error('Order not found')

    // Prevent acting on already-finalized orders
    if (['rejected', 'completed'].includes(current.status)) {
      throw new Error(
        `This order has already been ${current.status}. No changes were made.`,
      )
    }

    // Prevent re-accepting an already accepted order
    if (current.status === 'accepted' && data.status === 'accepted') {
      throw new Error('This order is already being prepared.')
    }

    const { error } = await supabaseAdmin
      .from('table_orders')
      .update({ status: data.status })
      .eq('id', data.id)
    if (error) throw new Error(error.message)

    const { data: fullOrder } = await supabaseAdmin
      .from('table_orders')
      .select('*')
      .eq('id', data.id)
      .single()

    // Broadcast to all connected clients (Admin + KDS)
    await supabaseAdmin.channel('origin-realtime').send({
      type: 'broadcast',
      event: 'order_status_updated',
      payload: fullOrder,
    })

    return { ok: true }
  })

export type RestaurantTable = {
  id: string
  label: string
  token: string
  is_active: boolean
  created_at: string
}

export type TableOrder = {
  id: string
  table_id: string
  table_label: string
  items: Array<{
    id: string
    name: string
    name_am?: string | null
    qty: number
    price: number
  }>
  note: string | null
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | string
  total_amount?: number
  device_id: string
  created_at: string
}
