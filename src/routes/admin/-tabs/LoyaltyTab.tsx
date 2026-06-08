import React, { useState, useEffect } from 'react'
import {
  Gift,
  Loader2,
  Ticket,
  AlertCircle,
  Check,
  ShieldCheck,
} from 'lucide-react'
import { useServerFn } from '@tanstack/react-start'
import {
  getLoyaltySettings,
  updateLoyaltySettings,
  redeemRewardWithCode,
} from '@/server/loyalty.functions'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'
import { Field, inputCls, Toggle } from '../-components/FormPrimitives'
import { Skeleton } from '@/components/ui/skeleton'

export function LoyaltyTab() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [program, setProgram] = useState<any>(null)
  const [isDirty, setIsDirty] = useState(false)

  // Redemption state
  const [redemptionCode, setRedemptionCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)

  const fetchSettings = useServerFn(getLoyaltySettings)
  const saveSettings = useServerFn(updateLoyaltySettings)
  const redeemReward = useServerFn(redeemRewardWithCode)

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchSettings()
      const initialProgram = data || {
        name: 'Origin Rewards',
        stamps_required: 10,
        reward_description: 'One Free Drink',
        is_active: true,
      }
      setProgram(initialProgram)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!isDirty || saving) return
    setSaving(true)
    try {
      await saveSettings({ data: program })
      toast.success(t('settings_saved'))
      setIsDirty(false)
    } catch (err) {
      toast.error(t('error_save_settings'))
    } finally {
      setSaving(false)
    }
  }

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (redemptionCode.length !== 4) return
    setRedeeming(true)
    try {
      await redeemReward({
        data: { code: redemptionCode, program_id: program.id },
      })
      toast.success('Reward redeemed successfully!')
      setRedemptionCode('')
    } catch (err: any) {
      toast.error(err.message || 'Invalid code or no active reward.')
    } finally {
      setRedeeming(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-8 animate-in fade-in duration-500">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-64 opacity-50" />
        </div>
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <Skeleton className="h-[400px] w-full rounded-3xl" />
          <div className="space-y-6">
            <Skeleton className="h-[150px] w-full rounded-3xl" />
            <Skeleton className="h-[200px] w-full rounded-3xl" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl uppercase tracking-wider text-primary">
            {t('loyalty_settings')}
          </h2>
          <Toggle
            label={program.is_active ? t('active') : t('inactive')}
            value={program.is_active}
            onChange={(v) => {
              setProgram({ ...program, is_active: v })
              setIsDirty(true)
            }}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {t('loyalty_settings_desc')}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Left Column: Form */}
        <form onSubmit={handleSave} className="space-y-6">
          <div
            className={`rounded-3xl border border-border bg-card p-8 shadow-sm overflow-hidden relative transition-opacity ${!program.is_active ? 'opacity-50 grayscale-[0.5]' : ''}`}
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <Ticket className="h-32 w-32 rotate-12" />
            </div>

            <div className="mb-8 flex items-center gap-4 border-b border-border pb-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Ticket className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-sans text-base font-bold text-foreground">
                  {t('program_config')}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t('program_config_desc')}
                </p>
              </div>
            </div>

            <div className="grid gap-8">
              <Field label={t('program_name')}>
                <input
                  type="text"
                  disabled={!program.is_active}
                  value={program.name}
                  onChange={(e) => {
                    setProgram({ ...program, name: e.target.value })
                    setIsDirty(true)
                  }}
                  className={inputCls}
                  placeholder="e.g. Origin Rewards"
                  required
                />
              </Field>

              <div className="grid gap-6 sm:grid-cols-2">
                <Field label={t('stamps_required')}>
                  <div className="relative">
                    <input
                      type="number"
                      disabled={!program.is_active}
                      value={program.stamps_required}
                      onChange={(e) => {
                        setProgram({
                          ...program,
                          stamps_required: parseInt(e.target.value) || 0,
                        })
                        setIsDirty(true)
                      }}
                      className={`${inputCls} pr-16 `}
                      min="1"
                      max="50"
                      required
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-muted-foreground pointer-events-none">
                      Stamps
                    </div>
                  </div>
                </Field>

                <Field label={t('reward_description')}>
                  <div className="relative">
                    <Gift className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      disabled={!program.is_active}
                      value={program.reward_description}
                      onChange={(e) => {
                        setProgram({
                          ...program,
                          reward_description: e.target.value,
                        })
                        setIsDirty(true)
                      }}
                      className={`${inputCls} pl-10`}
                      placeholder="e.g. Free Main Dish"
                      required
                    />
                  </div>
                </Field>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-4 rounded-2xl bg-amber-500/5 p-5 ring-1 ring-amber-500/20 border border-amber-500/10">
            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-500 shrink-0" />
            <p className="text-xs font-medium text-amber-500/80 leading-relaxed italic">
              Pro-tip: Guests receive stamps automatically on order completion.
              Keep the reward description short and enticing!
            </p>
          </div>
        </form>

        {/* Right Column: Verification & Preview */}
        <div className="space-y-8">
          {/* Redemption Verification Card */}
          <div className="rounded-3xl border border-primary/20 bg-primary/5 p-6 shadow-sm shadow-primary/5 animate-in slide-in-from-right-4 duration-700">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight text-primary">
                  {t('verify_redemption')}
                </h3>
                <p className="text-[10px] font-bold text-primary/60">
                  {t('verify_redemption_desc')}
                </p>
              </div>
            </div>

            <form onSubmit={handleRedeem} className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  maxLength={4}
                  value={redemptionCode}
                  onChange={(e) =>
                    setRedemptionCode(e.target.value.toUpperCase())
                  }
                  placeholder="ENTER 4-DIGIT CODE"
                  className="w-full rounded-2xl border-2 border-primary/20 bg-background/50 py-4 text-center text-xl font-black tracking-[0.5em] text-primary placeholder:text-[10px] placeholder:tracking-widest placeholder:text-muted-foreground/30 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={redeeming || redemptionCode.length !== 4}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-primary/20 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-30"
              >
                {redeeming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Gift className="h-4 w-4" />
                )}
                {t('redeem_reward')}
              </button>
            </form>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2 px-2">
              <div className="h-px flex-1 bg-border" />
              {t('live_preview')}
              <div className="h-px flex-1 bg-border" />
            </h3>

            <div className="flex items-center justify-center p-10 rounded-[40px] border-2 border-dashed border-border bg-card/40 min-h-[220px] shadow-inner">
              <div className="relative flex h-14 items-center gap-3 rounded-full bg-primary p-1.5 pr-5 shadow-2xl shadow-primary/40 opacity-95">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 backdrop-blur-md text-white">
                  <Gift className="h-6 w-6" />
                </div>
                <div className="flex flex-col items-start leading-none text-white">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-0.5">
                    {program.name || 'Program Name'}
                  </span>
                  <span className="text-sm font-black">
                    {t('stamps_count', { count: 0 })}/
                    {t('stamps_count', { count: program.stamps_required })}
                  </span>
                </div>

                {/* Synced Pulse Badge */}
                <div className="absolute -right-1 -top-1 flex h-4 w-4">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-500 shadow-sm border-2 border-white"></span>
                </div>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0">
            <button
              onClick={() => handleSave()}
              disabled={saving || !isDirty}
              className="inline-flex w-full items-center justify-center gap-2 rounded-3xl bg-primary py-4 text-[11px] font-black uppercase tracking-widest text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 whitespace-nowrap shadow-lg shadow-primary/20"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {t('save_settings')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
