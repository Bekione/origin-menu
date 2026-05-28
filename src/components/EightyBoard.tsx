import { useState, useEffect, useRef } from 'react'
import { X, Check, AlertCircle, RefreshCw } from 'lucide-react'
import { useServerFn } from '@tanstack/react-start'
import { supabaseBrowser } from '@/integrations/supabase/client.browser'
import { useTranslation } from '@/lib/i18n'
import ScrollFade from './ScrollFade'
import { getMenuData, toggleAvailability } from '@/server/menu.functions'

interface Item {
  id: string
  name: string
  name_am: string | null
  is_available: boolean
}

interface EightyBoardProps {
  onClose: () => void
}

// Module-level cache so data persists across modal opens/closes
let cachedItems: Item[] | null = null

export function EightyBoard({ onClose }: EightyBoardProps) {
  const { t, dt } = useTranslation()
  const [items, setItems] = useState<Item[]>(cachedItems ?? [])
  const [loading, setLoading] = useState(cachedItems === null) // only show skeleton on very first load
  const [error, setError] = useState<string | null>(null)
  const [busyIds, setBusyIds] = useState<string[]>([])
  const hasFetched = useRef(false)

  const fetchMenu = useServerFn(getMenuData)

  const fetchItems = async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true)
    setError(null)
    try {
      const data = await fetchMenu()
      const fetched = (data.items as Item[]) || []
      cachedItems = fetched
      setItems(fetched)
    } catch (fetchErr: any) {
      console.error('[EightyBoard] fetch error:', fetchErr)
      setError(fetchErr.message || 'Failed to load menu items')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true
      // If no cache, do first fetch with skeleton
      fetchItems(cachedItems === null)
    }

    const channel = supabaseBrowser
      .channel('eighty-board-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items' },
        () => fetchItems(false), // silent background refresh — no skeleton
      )
      .subscribe()

    return () => {
      supabaseBrowser.removeChannel(channel)
    }
  }, [])

  const handleToggle = async (id: string, current: boolean) => {
    setBusyIds((prev) => [...prev, id])
    // Optimistically update the local state and cache
    const updated = (prev: Item[]) =>
      prev.map((item) =>
        item.id === id ? { ...item, is_available: !current } : item,
      )
    setItems((prev) => {
      const next = updated(prev)
      cachedItems = next
      return next
    })
    try {
      await toggleAvailability({
        data: { id, is_available: !current },
      })
      // Broadcast to admin dashboard to refresh 86'd items stat
      await supabaseBrowser.channel('origin-notifications').send({
        type: 'broadcast',
        event: 'reload-menu',
        payload: { id },
      })
    } catch (err: any) {
      console.error('[EightyBoard] toggle error:', err)
      // Revert optimistic update on failure
      const reverted = (prev: Item[]) =>
        prev.map((item) =>
          item.id === id ? { ...item, is_available: current } : item,
        )
      setItems((prev) => {
        const next = reverted(prev)
        cachedItems = next
        return next
      })
    } finally {
      setBusyIds((prev) => prev.filter((bid) => bid !== id))
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-6">
          <div>
            <h2 className="font-display text-lg uppercase tracking-widest text-orange-600 dark:text-orange-400">
              {t('eighty_board')}
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t('eighty_board_subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchItems(false)}
              className="rounded-full p-2 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded-full p-2 hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <ScrollFade fadeSize={40} direction="vertical" className="flex-1">
          <div className="max-h-[60vh] min-h-[120px] overflow-y-auto p-4 space-y-2 thin-scrollbar">
            {loading ? (
              [1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-14 w-full animate-pulse rounded-2xl bg-muted/30"
                />
              ))
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-10 text-destructive gap-2">
                <AlertCircle className="h-8 w-8 opacity-60" />
                <p className="text-xs font-bold text-center">{error}</p>
                <button
                  onClick={() => fetchItems(true)}
                  className="mt-2 rounded-lg border border-destructive/30 px-4 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10"
                >
                  {t('try_again')}
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 opacity-40 gap-2">
                <Check className="h-8 w-8 text-emerald-500" />
                <p className="text-xs font-bold">{t('in_stock_all')}</p>
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  disabled={busyIds.includes(item.id)}
                  onClick={() => handleToggle(item.id, item.is_available)}
                  className={`flex w-full items-center justify-between rounded-2xl border p-4 transition-all active:scale-[0.98] focus:outline-none ${
                    item.is_available
                      ? 'border-border bg-muted/10 hover:bg-muted/20'
                      : 'border-destructive/20 bg-destructive/5 hover:bg-destructive/10'
                  } ${busyIds.includes(item.id) ? 'opacity-50' : ''}`}
                >
                  <span
                    className={`text-sm font-bold ${item.is_available ? 'text-foreground' : 'text-destructive'}`}
                  >
                    {dt(item, 'name')}
                  </span>
                  <div
                    className={`flex items-center gap-2 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-widest ${
                      item.is_available
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    {busyIds.includes(item.id) ? (
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : item.is_available ? (
                      <>
                        <Check className="h-3 w-3" />
                        {t('in')}
                      </>
                    ) : (
                      <>
                        <X className="h-3 w-3" />
                        {t('out')}
                      </>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollFade>
      </div>
    </div>
  )
}
