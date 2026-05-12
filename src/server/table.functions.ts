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

/** Public — anyone can call a waiter (no auth needed) */
export const callWaiter = createServerFn({ method: 'POST' })
  .inputValidator((d) =>
    z
      .object({
        table_number: z.number().int().min(1),
        device_id: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    // 1. Fetch dynamic max_tables from restaurant_info
    const { data: info } = await supabaseAdmin
      .from('restaurant_info')
      .select('max_tables')
      .limit(1)
      .maybeSingle()

    const maxTables = info?.max_tables ?? 999
    if (data.table_number > maxTables) {
      throw new Error(`Table number cannot exceed ${maxTables}`)
    }

    // 2. Guard: Check if THIS DEVICE has already called recently
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
      // If a pending call exists from less than 10 minutes ago, prevent another call
      if (now - callTime < 10 * 60 * 1000) {
        throw new Error('A waiter is already on their way to your table.')
      }
    }

    // 3. Insert the new call
    const { error } = await supabaseAdmin.from('waiter_calls').insert({
      table_number: data.table_number,
      device_id: data.device_id,
      status: 'pending',
    })

    if (error) throw new Error(error.message)
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
    return data ?? []
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
    return { ok: true }
  })

export type WaiterCall = {
  id: string
  table_number: number
  status: string
  created_at: string
}
