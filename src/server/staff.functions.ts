import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'

async function checkAdminAuth() {
  const request = getRequest()
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) throw new Error('Unauthorized')
  if ((session.user as any).role !== 'admin') throw new Error('Forbidden')
  return session
}

/**
 * Admin sets or updates the staff PIN.
 * We store: salt:sha256(pin + salt) as a hex string.
 * This ensures the hash is environment-independent and portable.
 */
async function hashPin(pin: string, salt?: string): Promise<string> {
  const finalSalt = salt || Math.random().toString(36).substring(2, 18)
  const data = new TextEncoder().encode(pin + finalSalt)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${finalSalt}:${hash}`
}

export const setStaffPin = createServerFn({ method: 'POST' })
  .inputValidator((d) =>
    z
      .object({
        pin: z
          .string()
          .length(4)
          .regex(/^\d{4}$/),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await checkAdminAuth()
    const storedValue = await hashPin(data.pin)
    // Update the first (and only) restaurant_info row
    const { error } = await supabaseAdmin
      .from('restaurant_info')
      .update({ staff_pin_hash: storedValue } as any)
      .gte('id', '00000000-0000-0000-0000-000000000000') // update all rows (should be 1)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

/**
 * Called from the staff-login PIN pad. If correct, signs in as the shared staff account.
 */
export const verifyStaffPin = createServerFn({ method: 'POST' })
  .inputValidator((d) =>
    z
      .object({
        pin: z
          .string()
          .length(4)
          .regex(/^\d{4}$/),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    // 1. Fetch the stored value (salt:hash)
    const { data: info, error } = await supabaseAdmin
      .from('restaurant_info')
      .select('staff_pin_hash')
      .limit(1)
      .maybeSingle()

    if (error || !info) throw new Error('Restaurant not configured')
    const storedValue = (info as any).staff_pin_hash as string | null
    if (!storedValue || !storedValue.includes(':'))
      throw new Error('Staff PIN not configured. Ask the manager to set one.')

    // 2. Extract salt and verify
    const [salt, storedHash] = storedValue.split(':')
    const inputResult = await hashPin(data.pin, salt)
    const inputHash = inputResult.split(':')[1]

    if (inputHash !== storedHash) throw new Error('Incorrect PIN')

    // 3. Sign in as the shared staff Better Auth account
    const staffEmail = process.env.STAFF_ACCOUNT_EMAIL
    const staffPassword = process.env.STAFF_ACCOUNT_PASSWORD
    if (!staffEmail || !staffPassword) {
      throw new Error('Staff account not configured. Contact admin.')
    }

    const request = getRequest()

    try {
      const response = await auth.api.signInEmail({
        body: { email: staffEmail, password: staffPassword },
        headers: request.headers,
      })

      if (!response || !(response as any).token) {
        console.error(
          '[verifyStaffPin] Better Auth response missing token:',
          response,
        )
        throw new Error(
          'Failed to create staff session. Account may be inactive.',
        )
      }
    } catch (e: any) {
      console.error('[verifyStaffPin] Better Auth sign-in error:', e)
      // Check if it's a specific "Invalid password" from Better Auth
      if (e.message?.toLowerCase().includes('invalid password')) {
        throw new Error(
          'Staff account authentication failed (Better Auth invalid password). Check STAFF_ACCOUNT_PASSWORD env var.',
        )
      }
      throw new Error(e.message || 'Staff account authentication failed.')
    }

    return { ok: true }
  })

export const getActiveStaffSessions = createServerFn({ method: 'GET' }).handler(
  async () => {
    await checkAdminAuth()
    const staffEmail = process.env.STAFF_ACCOUNT_EMAIL
    if (!staffEmail) return []

    // 1. Get staff user ID
    const { data: users } = await supabaseAdmin
      .from('user' as any)
      .select('id')
      .eq('email', staffEmail)
      .limit(1)

    if (!users?.length) return []
    const staffId = (users as any[])[0].id

    // 2. Get active sessions
    const { data: sessions } = await supabaseAdmin
      .from('session' as any)
      .select('id, expiresAt, ipAddress, userAgent, createdAt')
      .eq('userId', staffId)
      .gt('expiresAt', new Date().toISOString())
      .order('createdAt', { ascending: false })

    return (sessions as any[]) ?? []
  },
)

export const revokeStaffSession = createServerFn({ method: 'POST' })
  .inputValidator((d) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await checkAdminAuth()
    const { error } = await supabaseAdmin
      .from('session' as any)
      .delete()
      .eq('id', data.id)
    if (error) throw new Error(error.message)

    // Broadcast session revocation to force logout/lock on KDS
    await supabaseAdmin.channel('origin-realtime').send({
      type: 'broadcast',
      event: 'session_revoked',
      payload: { id: data.id },
    })

    return { ok: true }
  })
