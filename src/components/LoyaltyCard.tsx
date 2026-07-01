import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap,
  Gift,
  CheckCircle2,
  X,
  Loader2,
  Ticket,
  Stamp,
  PartyPopper,
} from 'lucide-react'
import { useServerFn } from '@tanstack/react-start'
import {
  getLoyaltyStatus,
  requestRewardRedemption,
} from '@/server/loyalty.functions'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import ScrollFade from './ScrollFade'
import { supabaseBrowser } from '@/integrations/supabase/client.browser'

// This component renders the pill button inline — parent controls positioning
export function LoyaltyFloatingButton({ deviceId }: { deviceId: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<any>(null)

  const fetchStatus = useServerFn(getLoyaltyStatus)

  const loadData = async () => {
    try {
      const res = await fetchStatus({ data: { device_id: deviceId } })
      if (res.active) setData(res)
      else setData(null)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 10000)
    return () => clearInterval(interval)
  }, [deviceId])

  if (!data?.active) return null

  const { card, program } = data
  const stamps = card.current_stamps
  const rewards = card.rewards_available
  const total = program.stamps_required

  return (
    <>
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(true)}
        className="fixed left-4 flex h-10 items-center gap-2 rounded-full bg-primary pl-1.5 pr-4 shadow-lg shadow-primary/30"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
          <Gift className="h-4 w-4 text-white" />
        </div>
        <div className="flex flex-col items-start leading-none">
          <span className="text-[8px] font-black uppercase tracking-wider text-white/70">
            {t('loyalty_program')}
          </span>
          <span className="text-[11px] font-black text-white leading-tight">
            {rewards > 0
              ? t('reward_ready')
              : `${stamps}/${total} ${t('stamps')}`}
          </span>
        </div>

        {rewards > 0 && (
          <div className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white"></span>
          </div>
        )}
      </motion.button>

      <AnimatePresence mode="wait">
        {open && (
          <LoyaltyModal
            data={data}
            deviceId={deviceId}
            onClose={() => setOpen(false)}
            onRefresh={loadData}
          />
        )}
      </AnimatePresence>
    </>
  )
}

function LoyaltyModal({ data, deviceId, onClose, onRefresh }: any) {
  const { t, dt } = useTranslation()
  const { card, program } = data
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [step, setStep] = useState<'stamps' | 'code' | 'confirmed'>('stamps')

  const requestRedeem = useServerFn(requestRewardRedemption)
  const fetchStatus = useServerFn(getLoyaltyStatus)

  const handleRedeemClick = async () => {
    setIsRedeeming(true)
    try {
      await requestRedeem({
        data: { device_id: deviceId, program_id: program.id },
      })
      setStep('code')
    } catch (err) {
      console.error(err)
    } finally {
      setIsRedeeming(false)
    }
  }

  // Real-time listener for redemption confirmation
  // Server broadcasts on 'origin-realtime' channel — must match here
  useEffect(() => {
    if (step !== 'code') return

    const channel = supabaseBrowser
      .channel('origin-realtime')
      .on('broadcast', { event: 'reward_redemption_confirmed' }, (payload) => {
        if (payload.payload.device_id === deviceId) {
          setStep('confirmed')
        }
      })
      .subscribe()

    return () => {
      supabaseBrowser.removeChannel(channel)
    }
  }, [step, deviceId])

  // Polling fallback: re-fetch every 3s while waiting, in case broadcast is delayed
  useEffect(() => {
    if (step !== 'code') return

    const poll = setInterval(async () => {
      try {
        const res = await fetchStatus({ data: { device_id: deviceId } })
        if (res?.card && res.card.rewards_available < card.rewards_available) {
          setStep('confirmed')
        }
      } catch {
        // ignore poll errors
      }
    }, 3000)

    return () => clearInterval(poll)
  }, [step, deviceId, card.rewards_available])

  const stamps = card.current_stamps
  const totalSlots = program.stamps_required
  const hasReward = card.rewards_available > 0

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
      />

      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="relative w-full max-w-sm rounded-[40px] border border-white/10 bg-[#141414] shadow-2xl shadow-black/60 overflow-hidden"
      >
        <div className="absolute -left-20 -top-20 h-40 w-40 rounded-full bg-primary/15 blur-[60px]" />
        <div className="absolute -right-20 bottom-0 h-40 w-40 rounded-full bg-amber-500/5 blur-[60px]" />

        <div className="relative max-h-[85vh] overflow-y-auto overflow-x-hidden custom-scrollbar px-6 py-8">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Ticket className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold uppercase tracking-tight text-white leading-tight">
                  {dt(program, 'name')}
                </h3>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                  {t('digital_stamp_card')}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/50 transition-all hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Step: Stamp View */}
          {step === 'stamps' && (
            <div className="space-y-4">
              <div className="rounded-3xl bg-white/5 p-5 ring-1 ring-white/10 shadow-inner">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
                    <Gift className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-0.5">
                      {t('next_reward')}
                    </h4>
                    <p className="text-sm font-bold text-white italic leading-relaxed">
                      {dt(program, 'reward_description')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Stamp Grid — only show actually earned stamps */}
              <ScrollFade direction="vertical">
                <div className="grid grid-cols-5 gap-3 max-h-[200px] overflow-y-auto px-2 pt-2 pb-4">
                  {Array.from({ length: totalSlots }).map((_, i) => {
                    const isStamped = i < stamps
                    return (
                      <div
                        key={i}
                        className={cn(
                          'relative flex aspect-square items-center justify-center rounded-2xl border border-solid transition-all duration-500',
                          isStamped
                            ? 'bg-primary shadow-lg shadow-primary/20 border-primary'
                            : 'bg-white/5 border-white/10 opacity-40',
                        )}
                      >
                        {isStamped ? (
                          <motion.div
                            initial={{ scale: 0.5, rotate: -30, opacity: 0 }}
                            animate={{ scale: 1, rotate: 0, opacity: 1 }}
                          >
                            <Stamp className="h-5 w-5 text-white" />
                          </motion.div>
                        ) : (
                          <div className="h-1 w-1 rounded-full bg-white/20" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </ScrollFade>

              {/* Counter label */}
              <div className="text-center">
                <span className="text-xs font-black uppercase tracking-widest text-white/40">
                  {t('stamps_earned_count', { stamps, total: totalSlots })}
                </span>
              </div>

              {/* Action */}
              {hasReward ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/10 p-3 text-emerald-400 ring-1 ring-emerald-500/20 border border-emerald-500/10">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {card.rewards_available} {t('rewards_available')}
                    </span>
                  </div>
                  <button
                    onClick={handleRedeemClick}
                    disabled={isRedeeming}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-primary/20 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-70"
                  >
                    {isRedeeming ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      t('claim_reward')
                    )}
                  </button>
                </div>
              ) : (
                <div className="text-center bg-white/5 py-4 px-4 rounded-2xl border border-white/5 shadow-inner">
                  <p className="text-[11px] font-bold leading-relaxed text-white/30 italic">
                    {t('earn_more_stamps_hint').replace(
                      '{count}',
                      (totalSlots - stamps).toString(),
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step: Show code to waiter */}
          {step === 'code' && (
            <div className="space-y-6 py-2 text-center animate-in zoom-in-95 duration-500">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 ring-8 ring-amber-500/5">
                <Gift className="h-10 w-10 animate-pulse" />
              </div>

              <div className="space-y-1 px-4">
                <h3 className="font-display text-xl font-black uppercase tracking-tight text-white leading-tight">
                  {t('show_to_waiter')}
                </h3>
                <p className="text-xs font-medium leading-relaxed text-white/40">
                  {t('waiter_verification_hint')}
                </p>
              </div>

              <div className="rounded-[32px] border border-dashed border-white/20 bg-white/5 p-4 relative overflow-hidden shadow-inner">
                <div className="absolute inset-0 bg-primary/5 blur-3xl" />
                <div className="relative">
                  <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white/30 block mb-3">
                    {t('redemption_code')}
                  </span>
                  <div className="text-4xl font-black tracking-[0.25em] text-primary drop-shadow-[0_0_15px_rgba(var(--primary-rgb),0.4)]">
                    {deviceId.slice(-4).toUpperCase()}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-white/20">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {t('waiting_confirmation')}
                </span>
              </div>

              <button
                onClick={() => setStep('stamps')}
                className="text-[11px] font-black uppercase tracking-widest text-white/20 transition-all hover:text-white"
              >
                {t('cancel_request')}
              </button>
            </div>
          )}

          {/* Step: Confirmed! */}
          {step === 'confirmed' && (
            <div className="space-y-6 py-2 text-center animate-in zoom-in-95 duration-500">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-8 ring-emerald-500/10 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
                <PartyPopper className="h-12 w-12" />
              </div>

              <div className="space-y-3 px-4">
                <h3 className="font-display text-2xl font-black uppercase tracking-tight text-white mb-1">
                  {t('enjoy_your_reward')}
                </h3>
                <p className="text-sm font-medium leading-relaxed text-white/50">
                  {t('your')}{' '}
                  <span className="font-bold text-emerald-400">
                    {dt(program, 'reward_description')}
                  </span>{' '}
                  {t('reward_confirmed_message')}
                </p>
              </div>

              <button
                onClick={() => {
                  setStep('stamps')
                  onRefresh()
                  onClose()
                  setTimeout(() => {
                    window.dispatchEvent(
                      new CustomEvent('origin:feedback:trigger'),
                    )
                  }, 5000)
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-emerald-500/20 transition-all hover:opacity-90 active:scale-[0.98]"
              >
                <CheckCircle2 className="h-5 w-5" />
                {t('done')}
              </button>
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-center gap-2 opacity-15">
            <Zap className="h-3 w-3 fill-current" />
            <span className="text-[8px] font-black uppercase tracking-[0.3em]">
              {t('powered_by_origin')}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
