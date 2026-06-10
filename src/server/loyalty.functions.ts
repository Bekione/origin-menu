import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'

async function checkAuth() {
  const request = getRequest()
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) throw new Error('Unauthorized')
  return session
}

const getDb = async () => {
  const { supabaseAdmin } =
    await import('@/integrations/supabase/client.server')
  return supabaseAdmin
}

/** Public — Get loyalty status for a device */
export const getLoyaltyStatus = createServerFn({ method: 'GET' })
  .inputValidator((d) => z.object({ device_id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    // 1. Get active program
    const supabaseAdmin = await getDb()
    const { data: program, error: progErr } = await supabaseAdmin
      .from('loyalty_programs')
      .select('*')
      .eq('is_active', true)
      .single()

    if (progErr || !program) return { active: false }

    // 2. Get/Create card for this device
    let { data: card } = await supabaseAdmin
      .from('loyalty_cards')
      .select('*')
      .eq('device_id', data.device_id)
      .eq('program_id', program.id)
      .maybeSingle()

    if (!card) {
      const { data: newCard, error: createErr } = await supabaseAdmin
        .from('loyalty_cards')
        .insert({
          device_id: data.device_id,
          program_id: program.id,
          current_stamps: 0,
          rewards_available: 0,
        })
        .select()
        .single()

      if (createErr) throw new Error(createErr.message)
      card = newCard
    }

    return {
      active: true,
      program,
      card,
    }
  })

/** Public — Request a reward claim (waiter must acknowledge) */
export const requestRewardRedemption = createServerFn({ method: 'POST' })
  .inputValidator((d) =>
    z.object({ device_id: z.string(), program_id: z.string() }).parse(d),
  )
  .handler(async ({ data }) => {
    // This just broadcasts that a user is ready to redeem.
    // The actual deduction happens in verifyAndFulfillReward (Admin)
    const supabaseAdmin = await getDb()
    await supabaseAdmin.channel('origin-realtime').send({
      type: 'broadcast',
      event: 'reward_redemption_requested',
      payload: { device_id: data.device_id, program_id: data.program_id },
    })
    return { ok: true }
  })

/** Admin — Get loyalty settings */
export const getLoyaltySettings = createServerFn({ method: 'GET' }).handler(
  async () => {
    await checkAuth()
    const supabaseAdmin = await getDb()
    const { data, error } = await supabaseAdmin
      .from('loyalty_programs')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  },
)

/** Admin — Update loyalty settings */
export const updateLoyaltySettings = createServerFn({ method: 'POST' })
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1),
        name_am: z.string().min(1).optional(),
        stamps_required: z.number().int().min(1),
        reward_description: z.string().min(1),
        reward_description_am: z.string().min(1).optional(),
        is_active: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await checkAuth()
    const supabaseAdmin = await getDb()

    if (data.id) {
      const { error } = await supabaseAdmin
        .from('loyalty_programs')
        .update({
          name: data.name,
          name_am: data.name_am,
          stamps_required: data.stamps_required,
          reward_description: data.reward_description,
          reward_description_am: data.reward_description_am,
          is_active: data.is_active,
        })
        .eq('id', data.id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await supabaseAdmin.from('loyalty_programs').insert({
        name: data.name,
        name_am: data.name_am,
        stamps_required: data.stamps_required,
        reward_description: data.reward_description,
        reward_description_am: data.reward_description_am,
        is_active: data.is_active ?? true,
      })
      if (error) throw new Error(error.message)
    }

    return { ok: true }
  })

/** Admin/System — Internal function to issue a stamp */
export async function issueStamp(deviceId: string, _orderId: string) {
  try {
    // 1. Get active program
    const supabaseAdmin = await getDb()
    const { data: program } = await supabaseAdmin
      .from('loyalty_programs')
      .select('id, stamps_required')
      .eq('is_active', true)
      .single()

    if (!program) return

    // 2. Get card
    let { data: card } = await supabaseAdmin
      .from('loyalty_cards')
      .select('*')
      .eq('device_id', deviceId)
      .eq('program_id', program.id)
      .maybeSingle()

    if (!card) {
      const { data: newCard } = await supabaseAdmin
        .from('loyalty_cards')
        .insert({
          device_id: deviceId,
          program_id: program.id,
          current_stamps: 0,
          rewards_available: 0,
        })
        .select()
        .single()
      card = newCard
    }

    if (!card) return

    // 3. Update stamps
    let newStamps = card.current_stamps + 1
    let newRewards = card.rewards_available

    if (newStamps >= program.stamps_required) {
      newStamps = 0
      newRewards += 1
    }

    await supabaseAdmin
      .from('loyalty_cards')
      .update({
        current_stamps: newStamps,
        rewards_available: newRewards,
        last_stamp_at: new Date().toISOString(),
      } as any)
      .eq('id', card.id)
  } catch (err) {
    console.error('Error issuing stamp:', err)
  }
}

/** Admin — Verify and fulfill a reward redemption */
export const redeemRewardWithCode = createServerFn({ method: 'POST' })
  .inputValidator((d) =>
    z.object({ code: z.string().length(4), program_id: z.string() }).parse(d),
  )
  .handler(async ({ data }) => {
    await checkAuth()
    const supabaseAdmin = await getDb()

    // 1. Find all cards with rewards available for this program
    const { data: cards, error } = await supabaseAdmin
      .from('loyalty_cards')
      .select('*')
      .eq('program_id', data.program_id)
      .gt('rewards_available', 0)

    if (error) throw new Error(error.message)

    // 2. Match based on the suffix (the code is the last 4 chars of device_id)
    const match = cards?.find((c) =>
      c.device_id.toUpperCase().endsWith(data.code.toUpperCase()),
    )

    if (!match) {
      throw new Error('No active reward request found for this code.')
    }

    // 3. Fulfill the reward
    const { error: updateErr } = await supabaseAdmin
      .from('loyalty_cards')
      .update({
        rewards_available: match.rewards_available - 1,
      })
      .eq('id', match.id)

    if (updateErr) throw new Error(updateErr.message)

    // 4. Broadcast for instant guest sync
    await supabaseAdmin.channel('origin-realtime').send({
      type: 'broadcast',
      event: 'reward_redemption_confirmed',
      payload: { device_id: match.device_id },
    })

    return { ok: true, device_id: match.device_id }
  })
