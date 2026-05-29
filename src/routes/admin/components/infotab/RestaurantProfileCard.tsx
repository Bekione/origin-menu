import { useTranslation } from '@/lib/i18n'
import { Field, inputCls } from '../FormPrimitives'

interface RestaurantProfileCardProps {
  form: any
  setForm: (form: any) => void
}

export function RestaurantProfileCard({
  form,
  setForm,
}: RestaurantProfileCardProps) {
  const { t } = useTranslation()

  const updateField = (field: string, value: string | number) => {
    let finalValue = value
    if (
      field === 'map_embed_url' &&
      typeof value === 'string' &&
      value.includes('<iframe')
    ) {
      const match = value.match(/src="([^"]+)"/)
      if (match) finalValue = match[1]
    }
    setForm({ ...form, [field]: finalValue })
  }

  return (
    <div className="grid gap-4 rounded-xl border border-border bg-card p-6 sm:grid-cols-2 shadow-sm transition-all hover:border-primary/20">
      <Field label={t('restaurant_name')}>
        <input
          required
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
          className={inputCls}
        />
      </Field>
      <Field label={t('tagline_label')}>
        <input
          value={form.tagline}
          onChange={(e) => updateField('tagline', e.target.value)}
          className={inputCls}
        />
      </Field>
      <Field label={t('address_label')}>
        <input
          value={form.address}
          onChange={(e) => updateField('address', e.target.value)}
          className={inputCls}
        />
      </Field>
      <Field label={t('phone_label')}>
        <input
          value={form.phone}
          onChange={(e) => updateField('phone', e.target.value)}
          className={inputCls}
        />
      </Field>
      <Field label={t('instagram_label')}>
        <input
          value={form.instagram_url}
          onChange={(e) => updateField('instagram_url', e.target.value)}
          className={inputCls}
        />
      </Field>
      <Field label={t('tiktok_label')}>
        <input
          value={form.tiktok_url}
          onChange={(e) => updateField('tiktok_url', e.target.value)}
          className={inputCls}
        />
      </Field>
      <Field label={t('facebook_label')}>
        <input
          value={form.facebook_url}
          onChange={(e) => updateField('facebook_url', e.target.value)}
          className={inputCls}
        />
      </Field>
      <Field label={t('telegram_label')}>
        <input
          value={form.telegram_url}
          onChange={(e) => updateField('telegram_url', e.target.value)}
          className={inputCls}
        />
      </Field>
      <Field label={t('whatsapp_label')}>
        <input
          value={form.whatsapp_url}
          onChange={(e) => updateField('whatsapp_url', e.target.value)}
          className={inputCls}
        />
      </Field>
      <Field label={t('youtube_label')}>
        <input
          value={form.youtube_url}
          onChange={(e) => updateField('youtube_url', e.target.value)}
          className={inputCls}
        />
      </Field>
      <Field label={t('google_maps_label')}>
        <input
          value={form.map_url}
          onChange={(e) => updateField('map_url', e.target.value)}
          className={inputCls}
        />
      </Field>
      <Field label={t('google_maps_embed_label')}>
        <input
          value={form.map_embed_url}
          onChange={(e) => updateField('map_embed_url', e.target.value)}
          className={inputCls}
        />
      </Field>
    </div>
  )
}
