import { Plus, X, Tag as TagIcon, Hash } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import { Field, inputCls } from '../FormPrimitives'

interface DietaryTag {
  id: string
  label: string
  label_am?: string
}

interface DietaryTagsCardProps {
  form: {
    dietary_tags: DietaryTag[]
  }
  setForm: React.Dispatch<React.SetStateAction<any>>
}

export function DietaryTagsCard({ form, setForm }: DietaryTagsCardProps) {
  const { t } = useTranslation()

  const addTag = () => {
    // Generate a clean ID from the name if possible, or just a timestamp
    const id = `tag_${Date.now()}`
    setForm((prev: any) => ({
      ...prev,
      dietary_tags: [...prev.dietary_tags, { id, label: '', label_am: '' }],
    }))
  }

  const removeTag = (id: string) => {
    setForm((prev: any) => ({
      ...prev,
      dietary_tags: prev.dietary_tags.filter(
        (tag: DietaryTag) => tag.id !== id,
      ),
    }))
  }

  const updateTag = (id: string, field: keyof DietaryTag, value: string) => {
    setForm((prev: any) => ({
      ...prev,
      dietary_tags: prev.dietary_tags.map((tag: DietaryTag) =>
        tag.id === id ? { ...tag, [field]: value } : tag,
      ),
    }))
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/20">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <TagIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight">
              {t('dietary_allergens')}
            </h3>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mt-0.5">
              Manage custom filters
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={addTag}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all hover:bg-primary/20 hover:scale-105 active:scale-95"
          title="Add New Tag"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {form.dietary_tags.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-border/50 rounded-2xl bg-muted/5">
            <Hash className="h-10 w-10 text-muted-foreground/20 mb-3" />
            <p className="text-xs text-muted-foreground font-medium">
              No dietary tags defined yet.
            </p>
            <button
              type="button"
              onClick={addTag}
              className="mt-3 text-xs font-bold text-primary hover:underline uppercase tracking-wider"
            >
              Add Your First Tag
            </button>
          </div>
        ) : (
          form.dietary_tags.map((tag) => (
            <div
              key={tag.id}
              className="group relative flex flex-col gap-4 p-5 rounded-2xl border border-border/50 bg-card/50 transition-all hover:border-primary/30 hover:shadow-md"
            >
              <div className="space-y-3">
                <Field label={t('label_en')}>
                  <input
                    placeholder="e.g. Vegan"
                    value={tag.label}
                    onChange={(e) => updateTag(tag.id, 'label', e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label={t('label_am')}>
                  <input
                    placeholder="ቪጋን"
                    value={tag.label_am || ''}
                    onChange={(e) =>
                      updateTag(tag.id, 'label_am', e.target.value)
                    }
                    className={inputCls}
                  />
                </Field>
              </div>
              <button
                type="button"
                onClick={() => removeTag(tag.id)}
                className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-destructive shadow-lg text-white opacity-0 transition-all group-hover:opacity-100 hover:scale-110 active:scale-90 flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
