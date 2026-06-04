import { Loader2, Download, CheckCircle2, AlertCircle } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import ScrollFade from './ScrollFade'

export interface UpdateInfo {
  version: string
  notes?: string
}

export type UpdateStatus =
  | 'idle'
  | 'downloading'
  | 'installing'
  | 'restarting'
  | 'complete'
  | 'error'

export function UpdaterModal({
  open,
  info,
  progress,
  status,
  downloadedBytes = 0,
  totalSizeBytes = 0,
  onUpdate,
  onCancel,
}: {
  open: boolean
  info: UpdateInfo | null
  progress: number
  status: UpdateStatus
  downloadedBytes?: number
  totalSizeBytes?: number
  onUpdate: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  if (!open || !info) return null

  const formatMB = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0.0 MB'
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const isIndeterminate = status === 'downloading' && totalSizeBytes === 0

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-card shadow-2xl shadow-black/50">
        <div className="relative h-32 bg-linear-to-br from-primary/20 to-primary/5 p-6 flex items-end">
          <div className="absolute right-6 top-6 opacity-10">
            <Download className="h-20 w-20" />
          </div>
          <div>
            <h3 className="font-display text-2xl text-foreground leading-none">
              {t('software_update')}
            </h3>
            <p className="mt-1.5 text-[10px] font-black uppercase tracking-widest text-primary">
              {status === 'complete'
                ? t('version_installed', { version: info.version })
                : t('version_available', { version: info.version })}
            </p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* 1. IDLE STATE: Offer the update */}
          {status === 'idle' && (
            <div className="space-y-4">
              <div className="space-y-2 text-left">
                <span className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 px-1">
                  {t('release_notes')}
                </span>
                <ScrollFade
                  direction="vertical"
                  fadeSize={30}
                  className="rounded-2xl bg-muted/30"
                >
                  <div className="p-4 max-h-[200px] overflow-y-auto scrollbar-none">
                    <p className="whitespace-pre-wrap text-sm text-foreground/80 leading-relaxed font-medium">
                      {info.notes || t('default_release_notes')}
                    </p>
                  </div>
                </ScrollFade>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={onCancel}
                  className="flex-1 rounded-xl bg-muted py-3 text-sm font-bold uppercase tracking-widest text-muted-foreground transition-all hover:bg-muted/80 active:scale-95"
                >
                  {t('later')}
                </button>
                <button
                  onClick={onUpdate}
                  className="flex-3 rounded-xl bg-primary py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
                >
                  {t('update_now')}
                </button>
              </div>
            </div>
          )}

          {/* 2. PROGRESS STATES: Download & Install */}
          {(status === 'downloading' || status === 'installing') && (
            <div className="space-y-6 py-2">
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <span>
                    {status === 'downloading'
                      ? t('downloading_update')
                      : t('installing_update')}
                  </span>
                  {!isIndeterminate && (
                    <span>
                      {t('progress_complete', {
                        progress: Math.round(progress),
                      })}
                    </span>
                  )}
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/50">
                  {isIndeterminate ? (
                    <div
                      className="absolute inset-y-0 left-0 w-1/3 bg-linear-to-r from-transparent via-primary to-transparent animate-[shimmer_1.5s_infinite]"
                      style={{ transform: 'skewX(-20deg)' }}
                    />
                  ) : (
                    <div
                      className="absolute inset-y-0 left-0 bg-primary transition-all duration-1000 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                <span className="truncate max-w-[60%] animate-pulse">
                  {status === 'downloading'
                    ? t('please_wait')
                    : t('installing')}
                </span>
                {status === 'downloading' && downloadedBytes > 0 && (
                  <span className="text-nowrap ml-2">
                    {formatMB(downloadedBytes)}{' '}
                    {totalSizeBytes > 0 ? `/ ${formatMB(totalSizeBytes)}` : ''}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 3. RESTARTING STATE: Post-install transition */}
          {status === 'restarting' && (
            <div className="space-y-6 py-4 text-center">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Loader2 className="h-10 w-10 animate-spin" />
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-display text-lg tracking-wide animate-pulse">
                  {t('restarting_app')}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {t('restarting_in_a_moment')}
                </p>
              </div>
            </div>
          )}

          {/* 4. COMPLETE STATE: Success message & What's New */}
          {status === 'complete' && (
            <div className="space-y-6 py-4 text-center">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 className="h-10 w-10 animate-in zoom-in duration-500" />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="font-display text-xl">
                    {t('update_success')}
                  </h4>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest font-black mt-1">
                    v{info.version}
                  </p>
                </div>
                {info.notes && (
                  <div className="space-y-2 text-left">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 px-1">
                      {t('release_notes')}
                    </span>
                    <ScrollFade
                      direction="vertical"
                      fadeSize={30}
                      className="rounded-2xl bg-muted/30"
                    >
                      <div className="p-4 max-h-[160px] overflow-y-auto scrollbar-none">
                        <p className="whitespace-pre-wrap text-sm text-foreground/80 leading-relaxed font-medium">
                          {info.notes}
                        </p>
                      </div>
                    </ScrollFade>
                  </div>
                )}
              </div>
              <button
                onClick={onCancel}
                className="w-full rounded-xl bg-primary py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                {t('close')}
              </button>
            </div>
          )}

          {/* 5. ERROR STATE: Troubleshooting */}
          {status === 'error' && (
            <div className="space-y-6 py-4 text-center">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertCircle className="h-10 w-10" />
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-display text-lg text-destructive">
                  {t('download_failed')}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {t('download_failed_desc')}
                </p>
              </div>
              <button
                onClick={onCancel}
                className="w-full rounded-xl bg-muted py-3 text-sm font-bold uppercase tracking-widest"
              >
                {t('close')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
