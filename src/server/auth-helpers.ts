import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'

/**
 * Server-side session check — reads request cookies properly.
 * Use this in route `beforeLoad` for server-side protection.
 */
export const getAuthSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })
    return session ?? null
  },
)
