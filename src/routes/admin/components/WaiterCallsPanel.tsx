import { Bell, X, Loader2, Check } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import type { WaiterCall } from '@/server/table.functions'

interface WaiterCallsPanelProps {
  calls: WaiterCall[]
  pendingCount: number
  onClose: () => void
  onAcknowledge: (id: string) => Promise<void>
  acknowledgingId: string | null
}

export function WaiterCallsPanel({
  calls,
  pendingCount,
  onClose,
  onAcknowledge,
  acknowledgingId,
}: WaiterCallsPanelProps) {
  const { t } = useTranslation()

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="flex-1 bg-black/40 backdrop-blur-sm" />
      <div
        className="flex h-full w-full max-w-sm flex-col border-l border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
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
        <div className="flex-1 overflow-y-auto">
          {calls.length === 0 ? (
            <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
              {t('no_calls')}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {calls.map((call) => {
                const isPending = call.status === 'pending'
                const diff = Math.floor(
                  (Date.now() - new Date(call.created_at).getTime()) / 1000,
                )
                const timeAgoStr =
                  diff < 5
                    ? t('just_now')
                    : diff < 60
                      ? t('seconds_ago').replace('{count}', diff.toString())
                      : diff < 3600
                        ? t('minutes_ago').replace(
                            '{count}',
                            Math.floor(diff / 60).toString(),
                          )
                        : t('hours_ago').replace(
                            '{count}',
                            Math.floor(diff / 3600).toString(),
                          )

                return (
                  <li
                    key={call.id}
                    className={`flex items-center justify-between gap-3 px-4 py-3 ${isPending ? 'bg-destructive/5' : ''}`}
                  >
                    <div>
                      <p
                        className={`text-sm font-semibold ${isPending ? 'text-foreground' : 'text-muted-foreground'}`}
                      >
                        {call.table_label}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {timeAgoStr}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isPending ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                          {t('status_pending')}
                        </span>
                      ) : (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {t('done')}
                        </span>
                      )}
                      {isPending && (
                        <button
                          onClick={() => onAcknowledge(call.id)}
                          disabled={acknowledgingId === call.id}
                          className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                        >
                          {acknowledgingId === call.id ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />{' '}
                              {t('wait_dots')}
                            </>
                          ) : (
                            <>
                              <Check className="h-3 w-3" /> {t('ok')}
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
