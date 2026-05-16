import { betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { admin } from 'better-auth/plugins'
import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required for Supabase pooler
})

export const auth = betterAuth({
  database: pool,
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    tanstackStartCookies(),
    admin({
      // Default admin role is 'admin'. We also recognise 'staff' as a valid role.
      // 'user' is the framework default — we don't use it.
      adminRoles: ['admin'],
      defaultRole: 'admin',
    }),
  ],
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL,
})
