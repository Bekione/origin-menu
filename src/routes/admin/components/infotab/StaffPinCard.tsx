import { Loader2, Check } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import { inputCls } from '../FormPrimitives'

interface StaffPinCardProps {
  pinValue: string
  setPinValue: (val: string) => void
  pinSaving: boolean
  pinMsg: string
  onSetPin: () => Promise<void>
}

export function StaffPinCard({
  pinValue,
  setPinValue,
  pinSaving,
  pinMsg,
  onSetPin,
}: StaffPinCardProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/20">
      <div>
        <h3 className="font-display text-sm uppercase tracking-widest text-foreground">
          {t('staff_pin_title')}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          {t('staff_pin_desc')}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="password"
          maxLength={4}
          pattern="\d{4}"
          placeholder="0000"
          value={pinValue}
          onChange={(e) =>
            setPinValue(e.target.value.replace(/\D/g, '').slice(0, 4))
          }
          className={
            inputCls +
            ' w-36 tracking-[0.5em] text-center font-black bg-muted/30 focus:bg-background transition-all'
          }
        />
        <button
          type="button"
          disabled={pinValue.length !== 4 || pinSaving}
          onClick={onSetPin}
          className="group inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50 active:scale-95 shadow-sm shadow-primary/20"
        >
          {pinSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
          )}
          {t('set_pin')}
        </button>
        {pinMsg && (
          <span className="text-[10px] font-bold text-muted-foreground animate-in fade-in slide-in-from-left-2 uppercase tracking-wider">
            {pinMsg}
          </span>
        )}
      </div>
    </div>
  )
}
