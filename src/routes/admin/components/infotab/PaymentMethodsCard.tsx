import { Plus, Trash2, Loader2, GripVertical } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import { inputCls } from '../FormPrimitives'
import { optimizeImage } from '@/lib/image'

interface PaymentMethodsCardProps {
  form: any
  setForm: (form: any) => void
  onRequestDeletePayment: (index: number) => void
  onPaymentImageUpload: (index: number, file: File) => Promise<void>
  uploadingImageIdx: number | null
  dragItemIndex: number | null
  setDragItemIndex: (index: number | null) => void
  dragOverItemIndex: number | null
  setDragOverItemIndex: (index: number | null) => void
  onSortPayments: () => void
}

export function PaymentMethodsCard({
  form,
  setForm,
  onRequestDeletePayment,
  onPaymentImageUpload,
  uploadingImageIdx,
  dragItemIndex,
  setDragItemIndex,
  dragOverItemIndex,
  setDragOverItemIndex,
  onSortPayments,
}: PaymentMethodsCardProps) {
  const { t } = useTranslation()

  const updateMethod = (index: number, field: string, value: string) => {
    const m = [...form.payment_methods]
    m[index] = { ...m[index], [field]: value }
    setForm({ ...form, payment_methods: m })
  }

  const addPaymentMethod = () => {
    setForm({
      ...form,
      payment_methods: [
        ...form.payment_methods,
        { provider: '', account: '', icon_url: '' },
      ],
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/20">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="font-display text-sm uppercase tracking-widest text-foreground">
          {t('payment_methods')}
        </h3>
        <button
          type="button"
          onClick={addPaymentMethod}
          className="group inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-primary transition hover:bg-primary/20"
        >
          <Plus className="h-3 w-3 transition-transform group-hover:rotate-90" />
          {t('add_payment_method')}
        </button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {form.payment_methods.map((method: any, i: number) => (
          <div
            key={i}
            draggable
            onDragStart={() => setDragItemIndex(i)}
            onDragEnter={() => setDragOverItemIndex(i)}
            onDragEnd={onSortPayments}
            onDragOver={(e) => e.preventDefault()}
            className={`group flex flex-col gap-4 rounded-2xl border border-border bg-muted/20 p-5 transition-all
              ${dragOverItemIndex === i ? 'ring-2 ring-primary bg-primary/5 opacity-80 scale-[1.02]' : 'hover:bg-muted/30'} 
              ${dragItemIndex === i ? 'opacity-50' : ''} shadow-sm`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/30 cursor-grab active:cursor-grabbing hover:text-primary transition-colors" />
                {method.icon_url ? (
                  <img
                    src={optimizeImage(method.icon_url, 150)}
                    className="h-10 w-16 rounded-lg object-contain shadow-sm bg-white p-1 border border-border"
                    alt="Payment icon"
                  />
                ) : uploadingImageIdx === i ? (
                  <div className="flex h-10 w-16 items-center justify-center rounded-lg border border-dashed border-border bg-muted">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <label className="flex h-10 w-16 cursor-pointer items-center justify-center rounded-lg border border-dashed border-border bg-muted transition hover:bg-muted/80 hover:border-primary/50 group-hover:scale-105">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0])
                          onPaymentImageUpload(i, e.target.files[0])
                      }}
                    />
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </label>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRequestDeletePayment(i)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive active:scale-90"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                className={inputCls}
                value={method.provider}
                placeholder="Provider (e.g. Telebirr)"
                onChange={(e) => updateMethod(i, 'provider', e.target.value)}
              />
              <input
                className={inputCls}
                value={method.account}
                placeholder="Account / Phone / Detail"
                onChange={(e) => updateMethod(i, 'account', e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>

      {form.payment_methods.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center opacity-40">
          <p className="text-xs font-bold uppercase tracking-widest">
            {t('no_items')}
          </p>
        </div>
      )}
    </div>
  )
}
