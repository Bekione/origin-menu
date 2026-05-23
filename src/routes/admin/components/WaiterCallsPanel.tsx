import { Bell, X, Loader2, Check } from 'lucide-react'
import ScrollFade from '#/components/ScrollFade'
import { useTranslation } from '@/lib/i18n'
import type { WaiterCall } from '@/server/table.functions'
import { LiveTimeAgo } from '@/lib/date-utils'
import { Skeleton } from '@/components/ui/skeleton'

interface WaiterCallsPanelProps {
  calls: WaiterCall[]
  loading: boolean
  pendingCount: number
  onClose: () => void
  onAcknowledge: (id: string) => Promise<void>
  acknowledgingId: string | null
  onDismiss: (id: string) => Promise<void>
  dismissingId: string | null
}

export function WaiterCallsPanel({
  calls,
  loading,
  pendingCount,
  onClose,
  onAcknowledge,
  acknowledgingId,
  onDismiss,
  dismissingId,
}: WaiterCallsPanelProps) {
  const { t } = useTranslation()

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="flex-1 bg-black/40 backdrop-blur-sm" />
      <div
        className="flex h-full w-full max-w-sm flex-col border-l border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm uppercase tracking-widest text-primary">
              {t('waiter_calls')}
            </h2>
            {pendingCount > 0 && (
              <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-white">
                {t('pending_badge').replace('{count}', pendingCount.toString())}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable call list */}
        <div className="relative flex-1 overflow-hidden">
          <ScrollFade direction="vertical" className="h-full">
            <div className="h-full overflow-y-auto p-3">
              {loading ? (
                <div className="flex flex-col gap-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="flex h-20 w-full animate-pulse flex-col gap-2 rounded-xl border border-border bg-muted/20 p-4"
                    >
                      <div className="flex justify-between">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-12 rounded-full" />
                      </div>
                      <Skeleton className="h-3 w-16" />
                    </div>
                  ))}
                </div>
              ) : calls.length === 0 ? (
                <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
                  {t('no_calls')}
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {calls.map((call) => {
                    const isPending = call.status === 'pending'
                    const isRejected = call.status === 'rejected'

                    return (
                      <li
                        key={call.id}
                        className={`flex flex-col gap-3 rounded-xl border px-4 py-3 transition-colors ${
                          isPending
                            ? 'border-primary/30 bg-primary/5 shadow-sm shadow-primary/5'
                            : isRejected
                              ? 'border-destructive/20 bg-destructive/10 grayscale-50 opacity-80'
                              : 'border-border bg-muted/30'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-sm font-semibold truncate ${
                                isPending
                                  ? 'text-foreground'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {call.table_label || t('table') + ' ' + call.table_number}
                            </p>
                            <LiveTimeAgo
                              ts={call.created_at}
                              className="mt-0.5 block text-[10px] text-muted-foreground"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            {isPending ? (
                              <span className="inline-flex rounded-full bg-primary/20 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                                {t('status_pending')}
                              </span>
                            ) : isRejected ? (
                              <span className="inline-flex rounded-full bg-destructive/20 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-destructive">
                                {t('status_rejected')}
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-muted-foreground/20 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                {t('done')}
                              </span>
                            )}
                          </div>
                        </div>

                        {isPending && (
                          <div className="flex items-center gap-2">
                            {/* Reject Button */}
                            <button
                              onClick={() => onDismiss(call.id)}
                              disabled={
                                dismissingId === call.id ||
                                acknowledgingId === call.id
                              }
                              className="group flex flex-1 items-center justify-center gap-2 rounded-md border border-border bg-card py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-destructive hover:text-destructive disabled:opacity-50"
                            >
                              {dismissingId === call.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <>
                                  <X className="h-3.5 w-3.5" />
                                  <span>{t('reject')}</span>
                                </>
                              )}
                            </button>

                            {/* Accept Button */}
                            <button
                              onClick={() => onAcknowledge(call.id)}
                              disabled={
                                acknowledgingId === call.id ||
                                dismissingId === call.id
                              }
                              className="group flex flex-1 items-center justify-center gap-2 rounded-md bg-primary py-1.5 text-xs font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                            >
                              {acknowledgingId === call.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <>
                                  <Check className="h-3.5 w-3.5" />
                                  <span>{t('ok')}</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </ScrollFade>
        </div>
      </div>
    </div>
  )
}
