import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useServerFn } from '@tanstack/react-start'
import {
  Plus,
  Trash2,
  Loader2,
  Check,
  RefreshCw,
  GripVertical,
} from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import { optimizeImage, compressImageFile } from '@/lib/image'
import { Field, Toggle, inputCls } from '../components/FormPrimitives'
import {
  updateRestaurantInfo,
  uploadItemImage,
  type RestaurantInfo,
} from '@/server/menu.functions'
import {
  setStaffPin,
  getActiveStaffSessions,
  revokeStaffSession,
} from '@/server/staff.functions'

export function InfoTab({
  info,
  onChange,
}: {
  info: RestaurantInfo | null
  onChange: () => void
}) {
  const { t } = useTranslation()
  const initialHours = Array.isArray(info?.hours)
    ? (info!.hours as Array<{ day: string; hours: string }>)
    : []
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
    promo_banner_active: info?.promo_banner_active ?? false,
    promo_banner_text: info?.promo_banner_text ?? '',
    promo_banner_url: info?.promo_banner_url ?? '',
    payment_methods: Array.isArray(info?.payment_methods)
      ? (info!.payment_methods as any[])
      : [],
    hours: initialHours.length
      ? initialHours
      : [{ day: 'Mon–Fri', hours: '10:00 – 22:00' }],
  })
  const [saving, setSaving] = useState(false)
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
    title: string
  } | null>(null)
  const [msg, setMsg] = useState('')
  const update = useServerFn(updateRestaurantInfo)
  const upload = useServerFn(uploadItemImage)

  const fetchSessions = () => {
    setLoadingSessions(true)
    getActiveStaffSessions().then((s) => {
      setSessions(s)
      setLoadingSessions(false)
    })
  }
  useEffect(() => {
    fetchSessions()
  }, [])

  const onPaymentImageUpload = async (index: number, file: File) => {
    if (file.size > 2 * 1024 * 1024)
      return toast.error('Image must be under 2MB')
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

  const handleConfirmDelete = async () => {
    if (!showConfirm) return
    const { type, index } = showConfirm
    if (type === 'hours') {
      setForm((prev) => ({
        ...prev,
        hours: prev.hours.filter((_, j) => j !== index),
      }))
    } else if (type === 'revoke-session') {
      const sid = showConfirm.sessionId
      if (sid) {
        try {
          await revokeStaffSession({ data: { id: sid } })
          fetchSessions()
          toast.success('Device logged out')
        } catch (err: any) {
          toast.error(err.message || 'Failed to revoke session')
        }
      }
    } else {
      setForm((prev) => ({
        ...prev,
        payment_methods: prev.payment_methods.filter((_, j) => j !== index),
      }))
    }
    setShowConfirm(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMsg('')
    try {
      await update({ data: { ...form } })
      setMsg('Saved')
      onChange()
      toast.success('Restaurant info saved')
    } catch (e: any) {
      setMsg(e?.message ?? 'Failed')
      toast.error('Failed to save info', {
        description: !navigator.onLine
          ? 'No internet connection'
          : (e?.message ?? 'Unexpected error'),
      })
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(''), 2500)
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-8 pb-32">
      <div className="space-y-4">
        <h2 className="font-display text-xl uppercase tracking-wider text-foreground">
          {t('restaurant_info')}
        </h2>
      </div>
      <div className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
        <Field label={t('restaurant_name')}>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label={t('tagline_label')}>
          <input
            value={form.tagline}
            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label={t('address_label')}>
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label={t('phone_label')}>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label={t('instagram_label')}>
          <input
            value={form.instagram_url}
            onChange={(e) =>
              setForm({ ...form, instagram_url: e.target.value })
            }
            className={inputCls}
          />
        </Field>
        <Field label={t('tiktok_label')}>
          <input
            value={form.tiktok_url}
            onChange={(e) => setForm({ ...form, tiktok_url: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label={t('google_maps_label')}>
          <input
            value={form.map_url}
            onChange={(e) => setForm({ ...form, map_url: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label={t('google_maps_embed_label')}>
          <input
            value={form.map_embed_url}
            onChange={(e) =>
              setForm({ ...form, map_embed_url: e.target.value })
            }
            className={inputCls}
          />
        </Field>
        <Field label={t('max_tables_label')}>
          <input
            type="number"
            value={form.max_tables}
            onChange={(e) =>
              setForm({ ...form, max_tables: Number(e.target.value) })
            }
            className={inputCls}
          />
        </Field>
        <Field label={t('wifi_password_label')}>
          <input
            value={form.wifi_password}
            onChange={(e) =>
              setForm({ ...form, wifi_password: e.target.value })
            }
            className={inputCls}
          />
        </Field>
        <Field label={t('service_charge_label')}>
          <input
            type="number"
            step="0.1"
            value={form.service_charge_pct}
            onChange={(e) =>
              setForm({ ...form, service_charge_pct: Number(e.target.value) })
            }
            className={inputCls}
          />
        </Field>
      </div>

      {/* Opening Hours */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm uppercase tracking-wider">
            {t('opening_hours')}
          </h3>
          <button
            type="button"
            onClick={() =>
              setForm({
                ...form,
                hours: [...form.hours, { day: '', hours: '' }],
              })
            }
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
          >
            <Plus className="h-3 w-3" /> {t('add_row')}
          </button>
        </div>
        <div className="space-y-2">
          {form.hours.map((h, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                className={inputCls}
                value={h.day}
                placeholder={t('mon_fri_placeholder')}
                onChange={(e) => {
                  const a = [...form.hours]
                  a[i] = { ...a[i], day: e.target.value }
                  setForm({ ...form, hours: a })
                }}
              />
              <input
                className={inputCls}
                value={h.hours}
                placeholder={t('hours_placeholder')}
                onChange={(e) => {
                  const a = [...form.hours]
                  a[i] = { ...a[i], hours: e.target.value }
                  setForm({ ...form, hours: a })
                }}
              />
              <button
                type="button"
                onClick={() =>
                  setShowConfirm({
                    type: 'hours',
                    index: i,
                    title: t('remove_hours_confirm'),
                  })
                }
                className="rounded border border-border p-2 text-muted-foreground hover:border-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Promo + Store Utilities */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 font-display text-sm uppercase tracking-wider text-primary">
            {t('promo_banner_title')}
          </h3>
          <div className="space-y-4">
            <Toggle
              label={t('promo_banner_enable')}
              value={form.promo_banner_active}
              onChange={(v) => setForm({ ...form, promo_banner_active: v })}
            />
            <Field label={t('promo_banner_announcement')}>
              <input
                className={inputCls}
                value={form.promo_banner_text}
                onChange={(e) =>
                  setForm({ ...form, promo_banner_text: e.target.value })
                }
                placeholder={t('ingredients_placeholder')}
              />
            </Field>
            <Field label={t('promo_banner_url_label')}>
              <input
                className={inputCls}
                value={form.promo_banner_url}
                onChange={(e) =>
                  setForm({ ...form, promo_banner_url: e.target.value })
                }
                placeholder="https://..."
              />
            </Field>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 font-display text-sm uppercase tracking-wider text-primary">
            {t('store_utilities')}
          </h3>
          <div className="space-y-4">
            <Field label={t('wifi_password_label')}>
              <input
                className={inputCls}
                value={form.wifi_password}
                onChange={(e) =>
                  setForm({ ...form, wifi_password: e.target.value })
                }
                placeholder="FreeWifi_123"
              />
            </Field>
            <Field label={t('service_charge_label')}>
              <input
                type="number"
                min={0}
                max={100}
                className={inputCls}
                value={form.service_charge_pct}
                onChange={(e) =>
                  setForm({
                    ...form,
                    service_charge_pct: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm uppercase tracking-wider">
            {t('payment_methods')}
          </h3>
          <button
            type="button"
            onClick={() =>
              setForm({
                ...form,
                payment_methods: [
                  ...form.payment_methods,
                  { provider: '', account: '', icon_url: '' },
                ],
              })
            }
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
          >
            <Plus className="h-3 w-3" /> {t('add_payment_method')}
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {form.payment_methods.map((method, i) => (
            <div
              key={i}
              draggable
              onDragStart={() => setDragItemIndex(i)}
              onDragEnter={() => setDragOverItemIndex(i)}
              onDragEnd={handleSortPayments}
              onDragOver={(e) => e.preventDefault()}
              className={`flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4 transition-all ${dragOverItemIndex === i ? 'ring-2 ring-primary bg-primary/5 opacity-80' : ''} ${dragItemIndex === i ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40 cursor-grab active:cursor-grabbing hover:text-primary" />
                {method.icon_url ? (
                  <img
                    src={optimizeImage(method.icon_url, 150)}
                    className="h-10 w-16 rounded object-contain shadow-sm bg-white"
                    alt="Payment icon"
                  />
                ) : uploadingImageIdx === i ? (
                  <div className="flex h-10 w-16 items-center justify-center rounded border border-dashed border-border bg-muted">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <label className="flex h-10 w-16 cursor-pointer items-center justify-center rounded border border-dashed border-border bg-muted transition hover:bg-muted/80">
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
                <button
                  type="button"
                  onClick={() =>
                    setShowConfirm({
                      type: 'payment',
                      index: i,
                      title: t('delete_payment_confirm'),
                    })
                  }
                  className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <input
                className={inputCls}
                value={method.provider}
                placeholder="Provider (e.g. Telebirr)"
                onChange={(e) => {
                  const m = [...form.payment_methods]
                  m[i] = { ...m[i], provider: e.target.value }
                  setForm({ ...form, payment_methods: m })
                }}
              />
              <input
                className={inputCls}
                value={method.account}
                placeholder="Account / Phone / Detail"
                onChange={(e) => {
                  const m = [...form.payment_methods]
                  m[i] = { ...m[i], account: e.target.value }
                  setForm({ ...form, payment_methods: m })
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Staff PIN */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-5">
        <div>
          <h3 className="font-display text-sm uppercase tracking-wider">
            {t('staff_pin_title')}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('staff_pin_desc')}
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="password"
            maxLength={4}
            pattern="\d{4}"
            placeholder={t('pin_placeholder')}
            value={pinValue}
            onChange={(e) =>
              setPinValue(e.target.value.replace(/\D/g, '').slice(0, 4))
            }
            className={
              inputCls + ' w-36 tracking-[0.5em] text-center font-bold'
            }
          />
          <button
            type="button"
            disabled={pinValue.length !== 4 || pinSaving}
            onClick={async () => {
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
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-xs font-bold uppercase whitespace-nowrap tracking-wider text-primary-foreground disabled:opacity-50"
          >
            {pinSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            {t('set_pin')}
          </button>
          {pinMsg && (
            <span className="self-center text-xs text-muted-foreground">
              {pinMsg}
            </span>
          )}
        </div>
      </div>

      {/* Active Staff Sessions */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-sm uppercase tracking-wider">
              {t('active_kds')}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('active_kds_desc')}
            </p>
          </div>
          <button
            type="button"
            onClick={fetchSessions}
            className="rounded-md border border-border p-2 hover:bg-muted"
            title="Refresh sessions"
          >
            <RefreshCw
              className={`h-4 w-4 ${loadingSessions ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
        <div className="space-y-2 mt-4">
          {sessions.length === 0 && !loadingSessions ? (
            <p className="text-xs text-muted-foreground italic">
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
                  className="flex items-center justify-between rounded-lg border border-border bg-background p-3 gap-3"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-xs font-semibold text-foreground">
                      {formatUA(s.userAgent || '')}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0 border border-border/50">
                        {s.ipAddress || 'No IP'}
                      </span>
                      {loginDate && (
                        <span className="text-[10px] text-muted-foreground">
                          · {loginDate}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirm({
                        type: 'revoke-session',
                        index: -1,
                        sessionId: s.id,
                        title: t('force_logout_title'),
                      })
                    }
                    className="shrink-0 rounded bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive hover:text-white transition-colors"
                  >
                    {t('revoke')}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        <button
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          {t('save_info')}
        </button>
      </div>

      {showConfirm && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-background/80 px-4 backdrop-blur-xs"
          onPointerDown={() => setShowConfirm(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center shadow-2xl"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Trash2 className="mx-auto mb-4 h-10 w-10 text-destructive/80" />
            <h3 className="font-display text-xl text-foreground">
              {showConfirm.type === 'hours'
                ? t('remove_hours')
                : showConfirm.type === 'revoke-session'
                  ? t('logout_device')
                  : t('delete_payment')}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {showConfirm.title}
              {showConfirm.type !== 'revoke-session' && t('local_action_note')}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowConfirm(null)}
                className="flex-1 rounded-md border border-border px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-muted"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 flex items-center justify-center gap-2 rounded-md bg-destructive px-4 py-2 text-xs font-bold uppercase tracking-wider text-destructive-foreground hover:opacity-90"
              >
                {showConfirm.type === 'revoke-session'
                  ? t('force_logout')
                  : t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
