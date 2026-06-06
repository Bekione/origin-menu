import { getRequest } from '@tanstack/react-start/server'
import { createServerFn } from '@tanstack/react-start'

export const getLanguageFromCookie = createServerFn({ method: 'GET' }).handler(
  async () => {
    const req = getRequest()
    const cookie = req.headers.get('cookie')
    if (cookie?.includes('origin_app_lang=am')) {
      return 'am' as const
    }
    if (cookie?.includes('origin_app_lang=en')) {
      return 'en' as const
    }
    return undefined
  },
)

export const getLayoutFromCookie = createServerFn({ method: 'GET' }).handler(
  async () => {
    const req = getRequest()
    const cookie = req.headers.get('cookie')
    if (cookie?.includes('menu_layout=grid')) return 'grid' as const
    return 'list' as const
  },
)

export const getServerData = createServerFn({ method: 'GET' }).handler(
  async () => {
    const [lang, layout] = await Promise.all([
      getLanguageFromCookie(),
      getLayoutFromCookie(),
    ])
    return { lang, layout }
  },
)
