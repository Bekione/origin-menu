import { useEffect, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import {
  MessageSquare,
  Star,
  Calendar,
  User,
  Hash,
  Loader2,
} from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import { getFeedback } from '@/server/feedback.functions'
import { format } from 'date-fns'
import { Skeleton } from '@/components/ui/skeleton'

export function FeedbackTab() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const LIMIT = 10

  const fetchData = useServerFn(getFeedback)

  const load = async (isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true)
    else setLoading(true)

    try {
      const currentOffset = isLoadMore ? offset + LIMIT : 0
      const res = await fetchData({
        data: { offset: currentOffset, limit: LIMIT },
      })
      const newRows = res.rows || []

      if (isLoadMore) {
        setRows((prev) => [...prev, ...newRows])
        setOffset(currentOffset)
      } else {
        setRows(newRows)
        setOffset(0)
      }

      setTotal(res.total)
      setHasMore(newRows.length >= LIMIT)
    } catch (err) {
      console.error('Failed to load feedback:', err)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => {
          const isFull = rating >= s
          const isHalf = !isFull && rating >= s - 0.5
          return (
            <div key={s} className="relative h-4 w-4">
              <Star className="h-4 w-4 text-muted-foreground/30" />
              {isHalf && (
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: '50%' }}
                >
                  <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                </div>
              )}
              {isFull && (
                <div className="absolute inset-0">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="font-display text-2xl uppercase tracking-wider text-primary">
          {t('feedback')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('total_items')}: {total}
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <FeedbackSkeleton key={i} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/30 text-center p-8">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageSquare className="h-8 w-8" />
          </div>
          <p className="font-sans text-sm font-medium text-muted-foreground">
            {t('no_feedback_yet')}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4">
            {rows.map((item) => (
              <div
                key={item.id}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {renderStars(Number(item.rating))}
                      <span className="text-sm font-bold text-foreground/80">
                        {item.rating}/5
                      </span>
                    </div>

                    {item.comment ? (
                      <p className="text-[15px] leading-relaxed text-foreground/90">
                        "{item.comment}"
                      </p>
                    ) : (
                      <p className="text-sm italic text-muted-foreground">
                        No comment left.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground sm:flex-col sm:items-end sm:gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(item.created_at), 'MMM d, h:mm a')}
                    </div>
                    {item.table_label && (
                      <div className="flex items-center gap-1.5 text-primary/80">
                        <Hash className="h-3 w-3" />
                        {t('feedback_from_table').replace(
                          '{table}',
                          item.table_label,
                        )}
                      </div>
                    )}
                    {item.device_id && (
                      <div className="flex items-center gap-1.5 opacity-60">
                        <User className="h-3 w-3" />
                        {item.device_id.slice(0, 8)}...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <button
              onClick={() => load(true)}
              disabled={loadingMore}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 text-sm font-bold uppercase tracking-widest text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-60"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('loading')}
                </>
              ) : (
                t('load_more')
              )}
            </button>
          )}

          {!hasMore && rows.length > 0 && total > LIMIT && (
            <div className="flex flex-col items-center justify-center gap-2 opacity-30 pt-4">
              <div className="h-px w-24 bg-border" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em]">
                No more feedback
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FeedbackSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-4 w-4 rounded-full" />
              ))}
            </div>
            <Skeleton className="h-4 w-10" />
          </div>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="space-y-2">
          <Skeleton className="ml-auto h-3 w-24" />
          <Skeleton className="ml-auto h-3 w-20" />
          <Skeleton className="ml-auto h-3 w-32" />
        </div>
      </div>
    </div>
  )
}
