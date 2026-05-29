import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import { Field, inputCls } from '../FormPrimitives'

interface StoreUtilitiesCardProps {
  form: any
  setForm: (form: any) => void
  onRequestDeleteHours: (index: number) => void
}

export function StoreUtilitiesCard({
  form,
  setForm,
  onRequestDeleteHours,
}: StoreUtilitiesCardProps) {
  const { t } = useTranslation()

  const updateHours = (index: number, field: string, value: string) => {
    const a = [...form.hours]
    a[index] = { ...a[index], [field]: value }
    setForm({ ...form, hours: a })
  }

  const addHourRow = () => {
    setForm({
      ...form,
      hours: [...form.hours, { day: '', hours: '' }],
    })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/20">
        <h3 className="mb-4 font-display text-sm uppercase tracking-widest text-primary">
          {t('store_utilities')}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('wifi_password_label')}>
            <input
              value={form.wifi_password}
              onChange={(e) =>
                setForm({ ...form, wifi_password: e.target.value })
              }
              className={inputCls}
              placeholder="e.g. FreeWifi_123"
            />
          </Field>
          <Field label={t('service_charge_label')}>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                value={form.service_charge_pct}
                onChange={(e) =>
                  setForm({
                    ...form,
                    service_charge_pct: Number(e.target.value),
                  })
                }
                className={inputCls + ' pr-8'}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                %
              </span>
            </div>
          </Field>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/20">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="font-display text-sm uppercase tracking-widest text-foreground">
            {t('opening_hours')}
          </h3>
          <button
            type="button"
            onClick={addHourRow}
            className="group inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-primary transition hover:bg-primary/20"
          >
            <Plus className="h-3 w-3 transition-transform group-hover:rotate-90" />
            {t('add_row')}
          </button>
        </div>
        <div className="space-y-3">
          {form.hours.map((h: any, i: number) => (
            <div
              key={i}
              className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] animate-in fade-in slide-in-from-right-2 duration-300"
            >
              <input
                className={inputCls}
                value={h.day}
                placeholder={t('mon_fri_placeholder')}
                onChange={(e) => updateHours(i, 'day', e.target.value)}
              />
              <input
                className={inputCls}
                value={h.hours}
                placeholder={t('hours_placeholder')}
                onChange={(e) => updateHours(i, 'hours', e.target.value)}
              />
              <button
                type="button"
                onClick={() => onRequestDeleteHours(i)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:border-destructive hover:bg-destructive/5 hover:text-destructive active:scale-95"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
