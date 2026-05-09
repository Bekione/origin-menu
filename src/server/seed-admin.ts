/**
 * Seeds the admin account into the better-auth database on first run.
 * Called from a server function — runs once and is idempotent.
 */
import { createServerFn } from '@tanstack/react-start'
import { auth } from '#/lib/auth'

export const seedAdminAccount = createServerFn({ method: 'POST' }).handler(
  async () => {
    const email = process.env.ADMIN_EMAIL
    const password = process.env.ADMIN_PASSWORD

    if (!email || !password) {
      throw new Error(
        'ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment variables',
      )
    }

    try {
      // Try to create the admin user — better-auth will throw if email already exists
      await auth.api.signUpEmail({
        body: {
          email,
          password,
          name: 'Origin Admin',
        },
      })
      console.log('[seed] Admin account created:', email)
      return { created: true }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      // User already exists is fine — idempotent
      if (
        message.toLowerCase().includes('exist') ||
        message.toLowerCase().includes('already')
      ) {
        console.log('[seed] Admin account already exists, skipping.')
        return { created: false }
      }
      throw err
    }
  },
)
