import { Megaphone, Link as LinkIcon, Box } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import { Field, inputCls } from '../FormPrimitives'
import { PremiumSelect } from '@/components/ui/PremiumSelect'
import type { MenuItem } from '@/server/menu.functions'

interface PromoBannerCardProps {
  form: any
  setForm: (form: any) => void
  items: MenuItem[]
}

export function PromoBannerCard({
  form,
  setForm,
  items,
}: PromoBannerCardProps) {
  const { t, dt } = useTranslation()

  const updateField = (field: string, value: any) => {
    setForm({ ...form, [field]: value })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/20">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-sm uppercase tracking-widest text-foreground">
              {t('promo_banner_title')}
            </h3>
            <p className="text-[10px] tracking-wider text-muted-foreground">
              {t('promo_banner_desc')}
            </p>
          </div>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={form.promo_banner_active}
            onChange={(e) =>
              updateField('promo_banner_active', e.target.checked)
            }
          />
          <div className="peer h-6 w-11 rounded-full bg-muted transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white" />
        </label>
      </div>

      <div
        className={`space-y-6 transition-all duration-300 ${form.promo_banner_active ? 'opacity-100' : 'pointer-events-none opacity-40'}`}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('promo_banner_text_en')}>
            <input
              value={form.promo_banner_text || ''}
              onChange={(e) => updateField('promo_banner_text', e.target.value)}
              placeholder="e.g. 20% Off All Burgers!"
              className={inputCls}
            />
          </Field>
          <Field label={t('promo_banner_text_am')}>
            <input
              value={form.promo_banner_text_am || ''}
              onChange={(e) =>
                updateField('promo_banner_text_am', e.target.value)
              }
              placeholder="e.g. ቅናሽ 20%"
              className={inputCls}
            />
          </Field>
        </div>

        <div className="rounded-lg bg-muted/30 p-4">
          <h4 className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {t('banner_action_type')}
          </h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div
              onClick={() => updateField('promo_banner_item_id', null)}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-all ${!form.promo_banner_item_id ? 'border-primary bg-primary/5' : 'border-transparent bg-background hover:bg-muted'}`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${!form.promo_banner_item_id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                <LinkIcon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <span className="block text-xs font-bold">
                  {t('external_url')}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {t('link_to_any_website')}
                </span>
              </div>
            </div>

            <div
              onClick={() => {
                if (items.length > 0)
                  updateField('promo_banner_item_id', items[0].id)
              }}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-all ${form.promo_banner_item_id ? 'border-primary bg-primary/5' : 'border-transparent bg-background hover:bg-muted'}`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${form.promo_banner_item_id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                <Box className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <span className="block text-xs font-bold">
                  {t('menu_item_link')}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {t('link_to_specific_dish')}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border/50">
            {form.promo_banner_item_id ? (
              <PremiumSelect
                label={t('select_item')}
                value={form.promo_banner_item_id}
                onChange={(val) => updateField('promo_banner_item_id', val)}
                options={items.map((item) => ({
                  id: item.id,
                  label: dt(item, 'name'),
                }))}
              />
            ) : (
              <Field label={t('external_url')}>
                <input
                  value={form.promo_banner_url || ''}
                  onChange={(e) =>
                    updateField('promo_banner_url', e.target.value)
                  }
                  placeholder="https://instagram.com/..."
                  className={inputCls}
                />
              </Field>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
