import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/lib/auth'

export const Route = createFileRoute('/api/seed-admin')({
  server: {
    handlers: {
      POST: async () => {
        const email = process.env.ADMIN_EMAIL
        const password = process.env.ADMIN_PASSWORD

        if (!email || !password) {
          return new Response(
            JSON.stringify({
              error: 'Missing ADMIN_EMAIL or ADMIN_PASSWORD env vars',
            }),
            { status: 500 },
          )
        }

        try {
          await auth.api.signUpEmail({
            body: { email, password, name: 'Origin Admin' },
          })
          return new Response(
            JSON.stringify({ ok: true, message: `Admin created: ${email}` }),
            { status: 200 },
          )
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          if (
            msg.toLowerCase().includes('exist') ||
            msg.toLowerCase().includes('already') ||
            msg.toLowerCase().includes('unique')
          ) {
            return new Response(
              JSON.stringify({ ok: true, message: 'Admin already exists' }),
              { status: 200 },
            )
          }
          return new Response(JSON.stringify({ error: msg }), { status: 500 })
        }
      },
    },
  },
})
