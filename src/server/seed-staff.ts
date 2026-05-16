/**
 * Seeds the shared staff account into the better-auth database.
 * Same pattern as seed-admin.ts — idempotent, safe to call multiple times.
 * Uses STAFF_ACCOUNT_EMAIL / STAFF_ACCOUNT_PASSWORD from env.
 *
 * After running this, set role = 'staff' via SQL (see below).
 */
import { createServerFn } from '@tanstack/react-start'
import { auth } from '#/lib/auth'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

export const seedStaffAccount = createServerFn({ method: 'POST' }).handler(
  async () => {
    const email = process.env.STAFF_ACCOUNT_EMAIL
    const password = process.env.STAFF_ACCOUNT_PASSWORD

    if (!email || !password) {
      throw new Error(
        'STAFF_ACCOUNT_EMAIL and STAFF_ACCOUNT_PASSWORD must be set in env vars',
      )
    }

    let userId: string | null = null

    try {
      const res = await auth.api.signUpEmail({
        body: {
          email,
          password,
          name: 'Origin Staff',
        },
      })
      userId = (res as any)?.user?.id ?? null
      console.log('[seed] Staff account created:', email)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (
        message.toLowerCase().includes('exist') ||
        message.toLowerCase().includes('already')
      ) {
        console.log('[seed] Staff account already exists, updating role...')
        // Look up user id from the user table directly
        const { data } = await supabaseAdmin
          .from('user')
          .select('id')
          .eq('email', email)
          .maybeSingle()
        userId = data?.id ?? null
      } else {
        throw err
      }
    }

    // Ensure role is set to 'staff'
    if (userId) {
      await supabaseAdmin
        .from('user')
        .update({ role: 'staff' } as any)
        .eq('id', userId)
      console.log('[seed] Role set to "staff" for:', email)
    }

    return { ok: true }
  },
)
