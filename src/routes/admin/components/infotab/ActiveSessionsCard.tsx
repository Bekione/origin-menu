import { RefreshCw } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

interface ActiveSessionsCardProps {
  sessions: any[]
  loadingSessions: boolean
  onFetchSessions: () => void
  onRequestRevokeSession: (sessionId: string) => void
}

export function ActiveSessionsCard({
  sessions,
  loadingSessions,
  onFetchSessions,
  onRequestRevokeSession,
}: ActiveSessionsCardProps) {
  const { t } = useTranslation()

  const formatUA = (ua: string) => {
    if (!ua) return 'Unknown Device'
    const isIPhone = /iPhone/.test(ua),
      isIPad = /iPad/.test(ua),
      isAndroid = /Android/.test(ua)
    const isMac = /Macintosh/.test(ua) && !isIPhone && !isIPad
    const isWindows = /Windows NT/.test(ua),
      isLinux = /Linux/.test(ua) && !isAndroid
    const os = isIPhone
      ? 'iPhone'
      : isIPad
        ? 'iPad'
        : isAndroid
          ? 'Android'
          : isWindows
            ? 'Windows'
            : isMac
              ? 'macOS'
              : isLinux
                ? 'Linux'
                : 'Device'
    const isEdge = /Edg\//.test(ua),
      isChrome = /Chrome\//.test(ua) && !isEdge
    const isFirefox = /Firefox\//.test(ua),
      isSafari = /Safari\//.test(ua) && !isChrome && !isEdge
    const isCriOS = /CriOS\//.test(ua)
    const browser = isEdge
      ? 'Edge'
      : isChrome || isCriOS
        ? 'Chrome'
        : isFirefox
          ? 'Firefox'
          : isSafari
            ? 'Safari'
            : 'Browser'
    return `${browser} on ${os}`
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/20">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm uppercase tracking-widest text-foreground">
            {t('active_kds')}
          </h3>
          <p className="mt-1 text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
            {t('active_kds_desc')}
          </p>
        </div>
        <button
          type="button"
          onClick={onFetchSessions}
          className="rounded-xl border border-border p-2.5 transition-all hover:bg-muted active:scale-95"
          title="Refresh sessions"
        >
          <RefreshCw
            className={`h-4 w-4 text-muted-foreground ${loadingSessions ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {sessions.length === 0 && !loadingSessions ? (
          <p className="py-4 text-center text-xs italic text-muted-foreground opacity-60">
            {t('no_sessions')}
          </p>
        ) : (
          sessions.map((s) => {
            const loginDate = s.createdAt
              ? new Date(s.createdAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : null
            return (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-border bg-background p-4 gap-4 transition-all hover:border-primary/10"
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-xs font-black uppercase tracking-wider text-foreground truncate">
                    {formatUA(s.userAgent || '')}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] font-bold bg-muted px-2 py-0.5 rounded text-muted-foreground shrink-0 border border-border/50">
                      {s.ipAddress || 'No IP'}
                    </span>
                    {loginDate && (
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                        · {loginDate}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRequestRevokeSession(s.id)}
                  className="shrink-0 rounded-lg bg-destructive/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-destructive hover:bg-destructive hover:text-white transition-all active:scale-95"
                >
                  {t('revoke')}
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
