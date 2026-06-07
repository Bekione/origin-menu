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

export const submitFeedback = createServerFn({ method: 'POST' })
  .inputValidator((d) =>
    z
      .object({
        table_id: z.string().uuid().nullable().optional(),
        table_label: z.string().max(100).nullable().optional(),
        rating: z.number().min(1).max(5),
        comment: z.string().max(1000).nullable().optional(),
        device_id: z.string().max(200).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from('feedback').insert({
      table_id: data.table_id ?? null,
      table_label: data.table_label ?? null,
      rating: data.rating,
      comment: data.comment ?? null,
      device_id: data.device_id ?? null,
    } as any)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const getFeedback = createServerFn({ method: 'GET' })
  .inputValidator((d) =>
    z
      .object({
        offset: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(100).default(10),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data }) => {
    await checkAuth()
    const { offset = 0, limit = 10 } = data ?? {}
    const from = offset
    const to = offset + limit - 1

    const {
      data: rows,
      error,
      count,
    } = await supabaseAdmin
      .from('feedback')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw new Error(error.message)
    return { rows: rows ?? [], total: count ?? 0 }
  })

export const getFeedbackSummary = createServerFn({ method: 'GET' }).handler(
  async () => {
    await checkAuth()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data, error } = await supabaseAdmin
      .from('feedback')
      .select('rating, created_at')

    if (error) throw new Error(error.message)

    const all = data ?? []
    const todayRows = all.filter((r) => new Date(r.created_at) >= today)

    const avg = (rows: typeof all) =>
      rows.length
        ? Math.round(
            (rows.reduce((s, r) => s + Number(r.rating), 0) / rows.length) * 10,
          ) / 10
        : null

    return {
      avg_all: avg(all),
      avg_today: avg(todayRows),
      count_all: all.length,
      count_today: todayRows.length,
    }
  },
)
