import { Loader2, Download, CheckCircle2, AlertCircle } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

export interface UpdateInfo {
  version: string
  notes?: string
}

export type UpdateStatus =
  | 'idle'
  | 'downloading'
  | 'installing'
  | 'restarting'
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
    if (!bytes) return '0.0 MB'
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
              {t('version_available', { version: info.version })}
            </p>
          </div>
        </div>

        <div className="p-6">
          {status === 'idle' && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-muted/30 p-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {t('release_notes')}
                </span>
                <p className="mt-2 text-sm text-foreground/80 leading-relaxed font-medium">
                  {info.notes || t('default_release_notes')}
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onCancel}
                  className="flex-1 rounded-xl border border-border bg-background py-3 text-sm font-bold uppercase tracking-widest text-muted-foreground hover:bg-muted transition-colors"
                >
                  {t('later')}
                </button>
                <button
                  onClick={onUpdate}
                  className="flex-2 rounded-xl bg-primary py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  {t('update_now')}
                </button>
              </div>
            </div>
          )}

          {status !== 'idle' && status !== 'error' && (
            <div className="space-y-6 py-4 text-center">
              <div className="flex justify-center">
                {status === 'restarting' ? (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                    <CheckCircle2 className="h-10 w-10 animate-in zoom-in duration-500" />
                  </div>
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Loader2 className="h-10 w-10 animate-spin" />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="font-display text-lg">
                  {status === 'downloading' && t('downloading_update')}
                  {status === 'installing' && t('installing_update')}
                  {status === 'restarting' && t('restarting_app')}
                </h4>

                <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`absolute inset-y-0 left-0 bg-primary transition-all duration-500 ${
                      isIndeterminate ? 'w-1/3 animate-pulse' : ''
                    }`}
                    style={{
                      width: isIndeterminate ? undefined : `${progress}%`,
                    }}
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  <span>
                    {status === 'downloading' &&
                      !isIndeterminate &&
                      t('progress_complete', {
                        progress: Math.round(progress),
                      })}
                    {status === 'downloading' &&
                      isIndeterminate &&
                      t('downloading')}
                    {status === 'installing' && t('please_wait')}
                    {status === 'restarting' && t('restarting_in_a_moment')}
                  </span>
                  {status === 'downloading' && (
                    <span>
                      {formatMB(downloadedBytes)}{' '}
                      {totalSizeBytes > 0
                        ? `/ ${formatMB(totalSizeBytes)}`
                        : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

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
