import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Check,
  X,
  QrCode,
  RefreshCw,
  Download,
  Printer,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useTranslation } from '@/lib/i18n'
import { ConfirmationModal } from '../components/ConfirmationModal'
import {
  getTables,
  upsertTable,
  regenerateTableToken,
  deleteTable,
  type RestaurantTable,
} from '@/server/table.functions'
import qrLogo from '@/assets/origin-logo-qr-svg.svg'

const tabInputCls =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none'

export function TablesTab() {
  const { t } = useTranslation()
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState<{
    id: string
    label: string
  } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [previewQR, setPreviewQR] = useState<{
    url: string
    label: string
  } | null>(null)

  const fetchTables = async () => {
    setLoading(true)
    try {
      const data = await getTables()
      setTables((data as RestaurantTable[]) || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTables()

    // Manual refresh event
    const handleReload = () => fetchTables()
    window.addEventListener('reload-orders', handleReload)

    return () => {
      window.removeEventListener('reload-orders', handleReload)
    }
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLabel.trim()) return
    setBusyId('new')
    try {
      await upsertTable({ data: { label: newLabel.trim() } })
      setNewLabel('')
      setAdding(false)
      await fetchTables()
      toast.success(t('table_created'))
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const handleRename = async (id: string) => {
    if (!editLabel.trim()) return
    setBusyId(id)
    try {
      await upsertTable({ data: { id, label: editLabel.trim() } })
      setEditingId(null)
      await fetchTables()
      toast.success(t('table_renamed'))
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const handleRegenerate = async (id: string, label: string) => {
    setBusyId(id)
    try {
      await regenerateTableToken({ data: { id } })
      await fetchTables()
      toast.success(t('qr_regenerated').replace('{label}', label))
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (id: string) => {
    setBusyId(id)
    try {
      await deleteTable({ data: { id } })
      setShowConfirm(null)
      await fetchTables()
      toast.success(t('table_deleted'))
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const downloadQR = async (table: RestaurantTable) => {
    const sizeMap: Record<string, number> = {
      Small: 300,
      Medium: 500,
      Large: 800,
    }
    const sizePref = localStorage.getItem('admin_qr_size') || 'Medium'
    const size = sizeMap[sizePref] ?? 500
    const url = `${window.location.origin}/?t=${table.token}`
    const QRCode = (await import('qrcode')).default
    const dataUrl = await QRCode.toDataURL(url, {
      width: size,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `qr-${table.label.replace(/\s+/g, '-').toLowerCase()}.png`
    a.click()
    toast.success(t('qr_downloaded').replace('{label}', table.label))
  }

  const buildQRWithLogo = async (token: string): Promise<string> => {
    const sizeMap: Record<string, number> = {
      Small: 300,
      Medium: 500,
      Large: 800,
    }
    const sizePref = localStorage.getItem('admin_qr_size') || 'Medium'
    const size = sizeMap[sizePref] ?? 500
    const QRCode = (await import('qrcode')).default
    const canvas = document.createElement('canvas')
    await QRCode.toCanvas(canvas, `${window.location.origin}/?t=${token}`, {
      width: size,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    })

    return new Promise((resolve) => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(canvas.toDataURL('image/png'))
      const img = new Image()
      img.src = qrLogo
      img.onload = () => {
        const centerSize = canvas.width * 0.22
        const centerXY = (canvas.width - centerSize) / 2
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.roundRect(
          centerXY - 4,
          centerXY - 4,
          centerSize + 8,
          centerSize + 8,
          8,
        )
        ctx.fill()
        ctx.drawImage(img, centerXY, centerXY, centerSize, centerSize)
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = () => resolve(canvas.toDataURL('image/png'))
    })
  }

  const buildQRDataUrl = async (token: string) => buildQRWithLogo(token)

  const handlePrintAll = async () => {
    setIsPrinting(true)
    const sizePref = localStorage.getItem('admin_qr_size') || 'Medium'
    // Scale print dimensions based on target resolution
    const scaleMap: Record<string, { card: number; img: number }> = {
      Small: { card: 130, img: 110 },
      Medium: { card: 190, img: 170 },
      Large: { card: 280, img: 250 },
    }
    const dims = scaleMap[sizePref] ?? scaleMap.Medium

    try {
      const items = await Promise.all(
        tables.map(async (t) => ({
          label: t.label,
          dataUrl: await buildQRWithLogo(t.token),
        })),
      )

      const iframe = document.createElement('iframe')
      iframe.style.display = 'none'
      document.body.appendChild(iframe)
      const doc = iframe.contentWindow?.document
      if (!doc) return
      doc.write(`
        <html><head><title>Print QR</title>
        <style>
          body { font-family: sans-serif; margin: 0; background: #fff; }
          .grid { display: flex; flex-wrap: wrap; gap: 24px; padding: 24px; justify-content: flex-start; }
          .card { text-align: center; border: 1px solid #ddd; border-radius: 12px; padding: 16px; width: ${dims.card}px; break-inside: avoid; }
          .card img { width: ${dims.img}px; height: ${dims.img}px; }
          .card p { margin: 8px 0 0; font-weight: 700; font-size: 16px; color: #000; }
          @media print { @page { margin: 10mm } .card { border: 1px solid #ccc; } }
        </style></head><body>
        <div class="grid">${items
          .map(
            (i) =>
              `<div class="card"><img src="${i.dataUrl}" /><p>${i.label}</p></div>`,
          )
          .join('')}
        </div></body></html>
      `)
      doc.close()
      setTimeout(() => {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
        setTimeout(() => document.body.removeChild(iframe), 3000)
      }, 500)
    } finally {
      setTimeout(() => setIsPrinting(false), 800)
    }
  }

  const handleDownloadAll = async () => {
    setIsDownloading(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF()
      const margin = 20
      const qrSize = 50
      const cols = 3
      const gapX = (210 - margin * 2 - qrSize * cols) / (cols - 1)
      const gapY = 25
      let x = margin,
        y = margin,
        row = 0,
        col = 0

      for (let i = 0; i < tables.length; i++) {
        const t = tables[i]
        const dataUrl = await buildQRWithLogo(t.token)
        if (y + qrSize + 10 > 297 - margin) {
          doc.addPage()
          x = margin
          y = margin
          row = 0
          col = 0
        }
        doc.addImage(dataUrl, 'PNG', x, y, qrSize, qrSize)
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text(t.label, x + qrSize / 2, y + qrSize + 6, { align: 'center' })
        col++
        if (col >= cols) {
          col = 0
          row++
          x = margin
          y = margin + row * (qrSize + gapY)
        } else {
          x += qrSize + gapX
        }
      }

      doc.save('origin-table-qr-codes.pdf')
      toast.success(t('pdf_downloaded'))
    } catch {
      toast.error(t('pdf_failed'))
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="space-y-4">
      <ConfirmationModal
        open={!!showConfirm}
        title={t('delete_table_title')}
        description={t('delete_table_confirm', {
          label: showConfirm?.label ?? '',
        })}
        confirmLabel={t('delete')}
        onConfirm={() => showConfirm && handleDelete(showConfirm.id)}
        onCancel={() => setShowConfirm(null)}
        busy={busyId === showConfirm?.id}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg uppercase tracking-wider text-primary">
            {t('tables_title')}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('tables_desc')}
          </p>
        </div>
        <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
          {tables.length > 0 && (
            <>
              <button
                onClick={handlePrintAll}
                disabled={isPrinting}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
              >
                {isPrinting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Printer className="h-3.5 w-3.5" />
                )}
                {t('print_all')}
              </button>
              <button
                onClick={handleDownloadAll}
                disabled={isDownloading}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
              >
                {isDownloading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                {t('download_all')}
              </button>
            </>
          )}
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> {t('add_table')}
          </button>
        </div>
      </div>

      {adding && (
        <form
          onSubmit={handleAdd}
          className="flex items-center gap-2 rounded-xl border border-primary/40 bg-card p-4"
        >
          <input
            autoFocus
            required
            className={tabInputCls}
            placeholder={t('table_placeholder')}
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          <button
            type="submit"
            disabled={busyId === 'new'}
            className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busyId === 'new' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            {t('save')}
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false)
              setNewLabel('')
            }}
            className="rounded-md p-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </form>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : tables.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <QrCode className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('no_tables_yet')}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
          {tables.map((table) => (
            <TableRow
              key={table.id}
              table={table}
              busyId={busyId}
              editingId={editingId}
              editLabel={editLabel}
              setEditLabel={setEditLabel}
              setEditingId={setEditingId}
              handleRename={handleRename}
              handleRegenerate={handleRegenerate}
              downloadQR={downloadQR}
              setShowConfirm={setShowConfirm}
              buildQRDataUrl={buildQRDataUrl}
              setPreviewQR={setPreviewQR}
            />
          ))}
        </div>
      )}

      {previewQR && (
        <div
          className="fixed inset-0 z-200 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setPreviewQR(null)}
        >
          <div
            className="animate-in zoom-in-95 duration-200 flex w-full max-w-sm flex-col items-center rounded-2xl bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewQR.url}
              alt={`QR Code for ${previewQR.label}`}
              className="h-auto w-full rounded-xl border border-border"
            />
            <p className="mt-4 font-display text-xl text-foreground font-semibold">
              {previewQR.label}
            </p>
            <button
              onClick={() => setPreviewQR(null)}
              className="mt-5 w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground"
            >
              {t('close_preview')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function TableRow({
  table,
  busyId,
  editingId,
  editLabel,
  setEditLabel,
  setEditingId,
  handleRename,
  handleRegenerate,
  downloadQR,
  setShowConfirm,
  buildQRDataUrl,
  setPreviewQR,
}: {
  table: RestaurantTable
  busyId: string | null
  editingId: string | null
  editLabel: string
  setEditLabel: (v: string) => void
  setEditingId: (v: string | null) => void
  handleRename: (id: string) => void
  handleRegenerate: (id: string, label: string) => void
  downloadQR: (t: RestaurantTable) => void
  setShowConfirm: (v: { id: string; label: string } | null) => void
  buildQRDataUrl: (token: string) => Promise<string>
  setPreviewQR: (v: { url: string; label: string } | null) => void
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const { t } = useTranslation()

  useEffect(() => {
    buildQRDataUrl(table.token).then(setQrDataUrl)
  }, [table.token])

  return (
    <div className="flex items-center gap-3 px-4 py-3 sm:flex-nowrap">
      <div className="shrink-0">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={`QR for ${table.label}`}
            className="h-16 w-16 cursor-pointer rounded-lg border border-border object-contain transition hover:opacity-80"
            onClick={() => setPreviewQR({ url: qrDataUrl, label: table.label })}
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 pt-1">
        {editingId === table.id ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              className="rounded border border-border bg-background px-2 py-1 text-sm focus:border-primary focus:outline-none"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename(table.id)
                if (e.key === 'Escape') setEditingId(null)
              }}
            />
            <button
              onClick={() => handleRename(table.id)}
              disabled={busyId === table.id}
              className="rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busyId === table.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                t('save')
              )}
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <p className="text-sm font-semibold">{table.label}</p>
        )}
        <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
          ?t={table.token.slice(0, 16)}…
        </p>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5 pt-1">
        <button
          title={t('title_download_qr')}
          onClick={() => downloadQR(table)}
          className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="sm:hidden">QR</span>
          <span className="hidden sm:inline">{t('download_qr')}</span>
        </button>
        <button
          title={t('rename')}
          onClick={() => {
            setEditingId(table.id)
            setEditLabel(table.label)
          }}
          className="rounded-md border border-border p-1.5 text-muted-foreground hover:border-primary hover:text-primary"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          title={t('regenerate_qr')}
          disabled={busyId === table.id}
          onClick={() => handleRegenerate(table.id, table.label)}
          className="rounded-md border border-border p-1.5 text-muted-foreground hover:border-amber-500 hover:text-amber-500 disabled:opacity-50"
        >
          {busyId === table.id ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          title="Delete table"
          onClick={() => setShowConfirm({ id: table.id, label: table.label })}
          className="rounded-md border border-border p-1.5 text-muted-foreground hover:border-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
