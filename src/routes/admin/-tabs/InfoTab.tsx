import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { useServerFn } from '@tanstack/react-start'
import { Loader2, Check } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import { compressImageFile } from '@/lib/image'
import {
  updateRestaurantInfo,
  uploadItemImage,
  type RestaurantInfo,
  type MenuItem,
} from '@/server/menu.functions'
import {
  setStaffPin,
  getActiveStaffSessions,
  revokeStaffSession,
} from '@/server/staff.functions'

import { RestaurantProfileCard } from '../-components/infotab/RestaurantProfileCard'
import { PromoBannerCard } from '../-components/infotab/PromoBannerCard'
import { StoreUtilitiesCard } from '../-components/infotab/StoreUtilitiesCard'
import { PaymentMethodsCard } from '../-components/infotab/PaymentMethodsCard'
import { StaffPinCard } from '../-components/infotab/StaffPinCard'
import { ActiveSessionsCard } from '../-components/infotab/ActiveSessionsCard'
import { DietaryTagsCard } from '../-components/infotab/DietaryTagsCard'
import { ConfirmationModal } from '../-components/ConfirmationModal'

export function InfoTab({
  info,
  items,
  onChange,
}: {
  info: RestaurantInfo | null
  items: MenuItem[]
  onChange: () => void
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    name: info?.name ?? 'ORIGIN',
    tagline: info?.tagline ?? '',
    address: info?.address ?? '',
    phone: info?.phone ?? '',
    instagram_url: info?.instagram_url ?? '',
    tiktok_url: info?.tiktok_url ?? '',
    map_url: info?.map_url ?? '',
    map_embed_url: info?.map_embed_url ?? '',
    max_tables: info?.max_tables ?? 999,
    wifi_password: info?.wifi_password ?? '',
    service_charge_pct: info?.service_charge_pct ?? 0,
    promo_banner_active: (info as any)?.promo_banner_active ?? false,
    promo_banner_text: (info as any)?.promo_banner_text ?? '',
    promo_banner_text_am: (info as any)?.promo_banner_text_am ?? '',
    promo_banner_url: (info as any)?.promo_banner_url ?? '',
    promo_banner_item_id: (info as any)?.promo_banner_item_id ?? null,
    payment_methods: Array.isArray(info?.payment_methods)
      ? (info!.payment_methods as any[])
      : [],
    hours: Array.isArray(info?.hours)
      ? (info!.hours as any[])
      : [{ day: 'Mon–Fri', hours: '10:00 – 22:00' }],
    dietary_tags: Array.isArray((info as any)?.dietary_tags)
      ? ((info as any)!.dietary_tags as any[])
      : [],
  })

  // Sync form if info data is refreshed from server
  useEffect(() => {
    if (info) {
      setForm({
        name: info.name ?? 'ORIGIN',
        tagline: info.tagline ?? '',
        address: info.address ?? '',
        phone: info.phone ?? '',
        instagram_url: info.instagram_url ?? '',
        tiktok_url: info.tiktok_url ?? '',
        map_url: info.map_url ?? '',
        map_embed_url: info.map_embed_url ?? '',
        max_tables: info.max_tables ?? 999,
        wifi_password: info.wifi_password ?? '',
        service_charge_pct: info.service_charge_pct ?? 0,
        promo_banner_active: (info as any).promo_banner_active ?? false,
        promo_banner_text: (info as any).promo_banner_text ?? '',
        promo_banner_text_am: (info as any).promo_banner_text_am ?? '',
        promo_banner_url: (info as any).promo_banner_url ?? '',
        promo_banner_item_id: (info as any).promo_banner_item_id ?? null,
        payment_methods: Array.isArray(info.payment_methods)
          ? (info.payment_methods as any[])
          : [],
        hours: Array.isArray(info.hours)
          ? (info.hours as any[])
          : [{ day: 'Mon–Fri', hours: '10:00 – 22:00' }],
        dietary_tags: Array.isArray((info as any).dietary_tags)
          ? ((info as any).dietary_tags as any[])
          : [],
      })
    }
  }, [info])

  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [pinValue, setPinValue] = useState('')
  const [pinSaving, setPinSaving] = useState(false)
  const [pinMsg, setPinMsg] = useState('')
  const [sessions, setSessions] = useState<any[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [uploadingImageIdx, setUploadingImageIdx] = useState<number | null>(
    null,
  )

  const [dragItemIndex, setDragItemIndex] = useState<number | null>(null)
  const [dragOverItemIndex, setDragOverItemIndex] = useState<number | null>(
    null,
  )

  const [showConfirm, setShowConfirm] = useState<{
    type: 'hours' | 'payment' | 'revoke-session'
    index: number
    sessionId?: string
  } | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const update = useServerFn(updateRestaurantInfo)
  const upload = useServerFn(uploadItemImage)

  const fetchSessions = useCallback(() => {
    setLoadingSessions(true)
    getActiveStaffSessions().then((s) => {
      setSessions(s)
      setLoadingSessions(false)
    })
  }, [])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const onPaymentImageUpload = async (
    index: number,
    file: File,
  ): Promise<void> => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB')
      return
    }
    setUploadingImageIdx(index)
    try {
      const base64 = await compressImageFile(file, 400, 0.8)
      const res = await upload({
        data: {
          filename: file.name.replace(/\.[^/.]+$/, '') + '.webp',
          contentType: 'image/webp',
          base64,
        },
      })
      setForm((prev) => {
        const m = [...prev.payment_methods]
        m[index] = { ...m[index], icon_url: res.url }
        return { ...prev, payment_methods: m }
      })
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploadingImageIdx(null)
    }
  }

  const handleSortPayments = () => {
    if (
      dragItemIndex === null ||
      dragOverItemIndex === null ||
      dragItemIndex === dragOverItemIndex
    ) {
      setDragItemIndex(null)
      setDragOverItemIndex(null)
      return
    }
    const currentList = [...form.payment_methods]
    const draggedItemContent = currentList.splice(dragItemIndex, 1)[0]
    currentList.splice(dragOverItemIndex, 0, draggedItemContent)
    setForm({ ...form, payment_methods: currentList })
    setDragItemIndex(null)
    setDragOverItemIndex(null)
  }

  const onSetPin = async () => {
    setPinSaving(true)
    try {
      await setStaffPin({ data: { pin: pinValue } })
      setPinMsg(t('pin_updated'))
      setPinValue('')
      toast.success(t('staff_pin_updated'))
    } catch (err: any) {
      setPinMsg(err.message || t('failed'))
      toast.error(t('failed_update_pin'))
    } finally {
      setPinSaving(false)
      setTimeout(() => setPinMsg(''), 3000)
    }
  }

  const onConfirmAction = async () => {
    if (!showConfirm) return
    const { type, index, sessionId } = showConfirm

    if (type === 'hours') {
      setForm((prev) => ({
        ...prev,
        hours: prev.hours.filter((_, j) => j !== index),
      }))
    } else if (type === 'payment') {
      setForm((prev) => ({
        ...prev,
        payment_methods: prev.payment_methods.filter((_, j) => j !== index),
      }))
    } else if (type === 'revoke-session' && sessionId) {
      setConfirmBusy(true)
      try {
        await revokeStaffSession({ data: { id: sessionId } })
        fetchSessions()
        toast.success('Device logged out')
        setShowConfirm(null)
      } catch (err: any) {
        toast.error(err.message || 'Failed to revoke session')
      } finally {
        setConfirmBusy(false)
      }
      return
    }
    setShowConfirm(null)
  }

  const isDirty =
    JSON.stringify(form) !==
    JSON.stringify({
      name: info?.name ?? 'ORIGIN',
      tagline: info?.tagline ?? '',
      address: info?.address ?? '',
      phone: info?.phone ?? '',
      instagram_url: info?.instagram_url ?? '',
      tiktok_url: info?.tiktok_url ?? '',
      map_url: info?.map_url ?? '',
      map_embed_url: info?.map_embed_url ?? '',
      max_tables: info?.max_tables ?? 999,
      wifi_password: info?.wifi_password ?? '',
      service_charge_pct: info?.service_charge_pct ?? 0,
      promo_banner_active: (info as any)?.promo_banner_active ?? false,
      promo_banner_text: (info as any)?.promo_banner_text ?? '',
      promo_banner_text_am: (info as any)?.promo_banner_text_am ?? '',
      promo_banner_url: (info as any)?.promo_banner_url ?? '',
      promo_banner_item_id: (info as any)?.promo_banner_item_id ?? null,
      payment_methods: Array.isArray(info?.payment_methods)
        ? (info!.payment_methods as any[])
        : [],
      hours: Array.isArray(info?.hours)
        ? (info!.hours as any[])
        : [{ day: 'Mon–Fri', hours: '10:00 – 22:00' }],
      dietary_tags: Array.isArray((info as any)?.dietary_tags)
        ? ((info as any)!.dietary_tags as any[])
        : [],
    })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isDirty) return
    setSaving(true)
    setMsg('')
    try {
      await update({ data: { ...form } })
      setMsg('Saved')
      onChange()
      toast.success('Restaurant info saved')
    } catch (e: any) {
      setMsg(e?.message ?? 'Failed')
      toast.error('Failed to save info')
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(''), 2500)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto max-w-4xl space-y-12 pb-32 animate-in fade-in duration-700"
    >
      <RestaurantProfileCard form={form} setForm={setForm} />
      <PromoBannerCard form={form} setForm={setForm} items={items} />

      <DietaryTagsCard form={form} setForm={setForm} />

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-8">
          <StoreUtilitiesCard
            form={form}
            setForm={setForm}
            onRequestDeleteHours={(i) =>
              setShowConfirm({ type: 'hours', index: i })
            }
          />
          <PaymentMethodsCard
            form={form}
            setForm={setForm}
            onRequestDeletePayment={(i) =>
              setShowConfirm({ type: 'payment', index: i })
            }
            onPaymentImageUpload={onPaymentImageUpload}
            uploadingImageIdx={uploadingImageIdx}
            dragItemIndex={dragItemIndex}
            setDragItemIndex={setDragItemIndex}
            dragOverItemIndex={dragOverItemIndex}
            setDragOverItemIndex={setDragOverItemIndex}
            onSortPayments={handleSortPayments}
          />
        </div>
        <div className="space-y-8">
          <StaffPinCard
            pinValue={pinValue}
            setPinValue={setPinValue}
            pinSaving={pinSaving}
            pinMsg={pinMsg}
            onSetPin={onSetPin}
          />
          <ActiveSessionsCard
            sessions={sessions}
            loadingSessions={loadingSessions}
            onFetchSessions={fetchSessions}
            onRequestRevokeSession={(sid) =>
              setShowConfirm({
                type: 'revoke-session',
                index: -1,
                sessionId: sid,
              })
            }
          />
        </div>
      </div>

      <div className="fixed bottom-8 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-[2.5rem] border border-border bg-card/80 p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-8 duration-500">
        {msg && (
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap pl-4">
            {msg}
          </span>
        )}
        <button
          disabled={saving || !isDirty}
          className="inline-flex items-center gap-2 rounded-3xl bg-primary px-10 py-3.5 text-[11px] font-black uppercase tracking-widest text-primary-foreground transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 whitespace-nowrap shadow-lg shadow-primary/20"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {t('save_info')}
        </button>
      </div>

      <ConfirmationModal
        open={!!showConfirm}
        title={
          showConfirm?.type === 'revoke-session'
            ? t('logout_device')
            : t('delete')
        }
        description={
          showConfirm?.type === 'revoke-session'
            ? t('force_logout_title')
            : t('delete_confirm_desc').replace('{name}', 'this item')
        }
        onConfirm={onConfirmAction}
        onCancel={() => setShowConfirm(null)}
        busy={confirmBusy}
      />
    </form>
  )
}
