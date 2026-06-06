import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useServerFn } from '@tanstack/react-start'
import {
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Upload,
  Check,
  X,
  GripVertical,
  ChefHat,
} from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import { optimizeImage, compressImageFile } from '@/lib/image'
import {
  getMediaType,
  shouldBypassCompression,
  readFileAsBase64,
  VIDEO_MAX_SIZE,
  IMAGE_MAX_SIZE,
} from '@/lib/media'
import { Field, Toggle, inputCls } from '../-components/FormPrimitives'
import { PremiumSelect } from '@/components/ui/PremiumSelect'
import {
  upsertMenuItem,
  deleteMenuItem,
  toggleAvailability,
  uploadItemImage,
  reorderMenuItems,
  type Category,
  type MenuItem,
  type MenuData,
} from '@/server/menu.functions'

export function ItemsTab({
  data,
  onChange,
}: {
  data: MenuData
  onChange: () => void
}) {
  const { t, dt } = useTranslation()
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [localItems, setLocalItems] = useState(data.items)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [showDescriptions, setShowDescriptions] = useState(true)

  useEffect(() => {
    if (showForm) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [showForm])

  useEffect(() => {
    // Read from localStorage only after mount to avoid SSR/client hydration mismatch
    setShowDescriptions(
      localStorage.getItem('app_show_descriptions') !== 'false',
    )

    const handleSettingsChange = () => {
      setShowDescriptions(
        localStorage.getItem('app_show_descriptions') !== 'false',
      )
    }
    window.addEventListener('storage', handleSettingsChange)
    window.addEventListener('settings-changed', handleSettingsChange)
    return () => {
      window.removeEventListener('storage', handleSettingsChange)
      window.removeEventListener('settings-changed', handleSettingsChange)
    }
  }, [])

  const reorder = useServerFn(reorderMenuItems)

  useEffect(() => {
    setLocalItems(data.items)
  }, [data.items])

  const onDragStart = (id: string, e: React.DragEvent) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
  }
  const onDragOver = (id: string, e: React.DragEvent) => {
    e.preventDefault()
    if (!draggedId || draggedId === id) return
    const draggedItem = localItems.find((i) => i.id === draggedId)
    const targetItem = localItems.find((i) => i.id === id)
    if (
      !draggedItem ||
      !targetItem ||
      draggedItem.category_id !== targetItem.category_id
    )
      return

    const newList = [...localItems]
    const draggedIdx = newList.findIndex((i) => i.id === draggedId)
    const targetIdx = newList.findIndex((i) => i.id === id)
    const [moved] = newList.splice(draggedIdx, 1)
    newList.splice(targetIdx, 0, moved)

    const catItems = newList.filter(
      (i) => i.category_id === targetItem.category_id,
    )
    catItems.forEach((itm, idx) => {
      const gIdx = newList.findIndex((gi) => gi.id === itm.id)
      newList[gIdx] = { ...newList[gIdx], sort_order: idx }
    })
    setLocalItems(newList)
  }
  const onDrop = async () => {
    const item = localItems.find((i) => i.id === draggedId)
    setDraggedId(null)
    if (item) {
      try {
        const catItems = localItems.filter(
          (i) => i.category_id === item.category_id,
        )
        await reorder({
          data: {
            updates: catItems.map((i) => ({
              id: i.id,
              sort_order: i.sort_order,
            })),
          },
        })
        onChange()
      } catch (err: any) {
        toast.error('Reorder failed', {
          description: err?.message || 'Check your internet connection.',
        })
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl uppercase tracking-wider text-foreground">
          {t('admin_menu')}
        </h2>
        <button
          onClick={() => {
            setEditing(null)
            setShowForm(true)
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> {t('add_item')}
        </button>
      </div>

      {showForm && (
        <ItemForm
          item={editing}
          categories={data.categories}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false)
            onChange()
          }}
        />
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="divide-y divide-border">
          {localItems.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {t('no_items')}
            </p>
          )}
          {data.categories.map((cat) => {
            const list = localItems
              .filter((i) => i.category_id === cat.id)
              .sort((a, b) => a.sort_order - b.sort_order)
            if (list.length === 0) return null
            return (
              <div key={cat.id}>
                <div className="bg-muted/30 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-primary">
                  {dt(cat, 'name')}
                </div>
                {list.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    showDescription={showDescriptions}
                    onEdit={() => {
                      setEditing(item)
                      setShowForm(true)
                    }}
                    onChanged={onChange}
                    onDragStart={(e) => onDragStart(item.id, e)}
                    onDragOver={(e) => onDragOver(item.id, e)}
                    onDrop={onDrop}
                    isDragging={draggedId === item.id}
                  />
                ))}
              </div>
            )
          })}
          {(() => {
            const orphan = localItems
              .filter(
                (i) =>
                  !i.category_id ||
                  !data.categories.find((c) => c.id === i.category_id),
              )
              .sort((a, b) => a.sort_order - b.sort_order)
            if (orphan.length === 0) return null
            return (
              <div>
                <div className="bg-muted/30 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Uncategorized
                </div>
                {orphan.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    showDescription={showDescriptions}
                    onEdit={() => {
                      setEditing(item)
                      setShowForm(true)
                    }}
                    onChanged={onChange}
                    onDragStart={(e) => onDragStart(item.id, e)}
                    onDragOver={(e) => onDragOver(item.id, e)}
                    onDrop={onDrop}
                    isDragging={draggedId === item.id}
                  />
                ))}
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

function ItemRow({
  item,
  onEdit,
  onChanged,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
  showDescription,
}: {
  item: MenuItem
  onEdit: () => void
  onChanged: () => void
  onDragStart?: (e: any) => void
  onDragOver?: (e: any) => void
  onDrop?: () => void
  isDragging?: boolean
  showDescription?: boolean
}) {
  const { t, dt } = useTranslation()
  const toggle = useServerFn(toggleAvailability)
  const del = useServerFn(deleteMenuItem)
  const [busy, setBusy] = useState(false)
  const [localAvailable, setLocalAvailable] = useState(item.is_available)
  const [showConfirm, setShowConfirm] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  // Sync with prop if it changes externally, but only if we are not in the middle of a toggle operation
  useEffect(() => {
    if (!busy) {
      setLocalAvailable(item.is_available)
    }
  }, [item.is_available, busy])

  const handleToggle = async () => {
    const targetState = !localAvailable
    setLocalAvailable(targetState) // Optimistic update
    setBusy(true)
    try {
      await toggle({ data: { id: item.id, is_available: targetState } })
      onChanged() // Refresh data from server
    } catch (err: any) {
      setLocalAvailable(!targetState) // Rollback on error
      toast.error('Failed to toggle item', {
        description: !navigator.onLine
          ? 'No internet connection'
          : err?.message || 'Unexpected error',
      })
    } finally {
      setBusy(false)
    }
  }
  const handleDelete = async () => {
    setBusy(true)
    try {
      await del({ data: { id: item.id } })
      onChanged()
      toast.success('Item deleted')
    } catch (err: any) {
      toast.error('Failed to delete item', {
        description: !navigator.onLine
          ? 'No internet connection'
          : err?.message || 'Unexpected error',
      })
    } finally {
      setBusy(false)
      setShowConfirm(false)
    }
  }

  return (
    <>
      <div
        className={`flex items-center gap-3 transition-all px-4 py-3 ${isDragging ? 'opacity-50 bg-muted/20' : ''}`}
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <div className="shrink-0 flex items-center">
          <GripVertical className="h-3.5 w-3.5 cursor-grab text-muted-foreground/30 active:cursor-grabbing" />
          <div className="ml-2 overflow-hidden rounded-lg bg-muted border border-border shrink-0 transition-all h-14 w-14">
            {item.image_url ? (
              getMediaType(item.image_url) === 'video' ? (
                <video
                  src={item.image_url}
                  className="h-full w-full object-cover"
                  muted
                  autoPlay
                  loop
                  playsInline
                />
              ) : (
                <img
                  src={item.image_url}
                  className={`h-full w-full object-cover transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                  onLoad={() => setImgLoaded(true)}
                />
              )
            ) : (
              <div className="flex h-full w-full items-center justify-center opacity-20">
                <ChefHat className="h-6 w-6" />
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center gap-2">
            <span className="font-display font-black uppercase tracking-wider text-foreground leading-tight text-sm">
              {item.name}
            </span>
            {item.is_special && (
              <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-tighter text-amber-500 border border-amber-500/20">
                TOP
              </span>
            )}
          </div>
          {item.name_am && (
            <p className="font-medium text-muted-foreground leading-tight text-xs">
              {item.name_am}
            </p>
          )}
          {showDescription && (item.description || item.description_am) && (
            <p className="truncate text-muted-foreground mt-0.5 max-w-[200px] sm:max-w-md text-[11px]">
              {dt(item, 'description')}
            </p>
          )}
        </div>

        <div className="hidden sm:block">
          <span className="font-display font-black text-foreground text-sm">
            {item.price}
          </span>
          <span className="ml-1 font-bold text-muted-foreground uppercase text-[10px]">
            {t('currency')}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => handleToggle()}
            disabled={busy}
            className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase transition-all border ${
              localAvailable
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
                : 'border-destructive/20 bg-destructive/10 text-destructive'
            }`}
          >
            {busy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : localAvailable ? (
              t('available')
            ) : (
              t('out')
            )}
          </button>

          <div className="flex items-center">
            <button
              onClick={onEdit}
              className="rounded-lg transition-colors hover:bg-muted p-1.5 text-muted-foreground hover:text-primary"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              className="rounded-lg transition-colors hover:bg-muted p-1.5 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {showConfirm && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-background/80 px-4 backdrop-blur-xs"
          onPointerDown={() => setShowConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center shadow-2xl"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Trash2 className="mx-auto mb-4 h-10 w-10 text-destructive/80" />
            <h3 className="font-display text-xl text-foreground">
              {t('delete_item_title')}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('delete_confirm_desc', { name: dt(item, 'name') })}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-md border border-border px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-muted"
              >
                {t('cancel')}
              </button>
              <button
                disabled={busy}
                onClick={handleDelete}
                className="flex-1 flex items-center justify-center gap-2 rounded-md bg-destructive px-4 py-2 text-xs font-bold uppercase tracking-wider text-destructive-foreground hover:opacity-90 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  t('delete')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ItemForm({
  item,
  categories,
  onClose,
  onSaved,
}: {
  item: MenuItem | null
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}) {
  const { t, dt } = useTranslation()
  const [form, setForm] = useState({
    name: item?.name ?? '',
    name_am: item?.name_am ?? '',
    description: item?.description ?? '',
    description_am: item?.description_am ?? '',
    category_id: item?.category_id ?? categories[0]?.id ?? '',
    price: String(item?.price ?? ''),
    image_url: item?.image_url ?? '',
    is_available: item?.is_available ?? true,
    is_vegetarian: item?.is_vegetarian ?? false,
    is_spicy: item?.is_spicy ?? false,
    is_fasting: item?.is_fasting ?? false,
    is_featured: item?.is_featured ?? false,
    is_special: item?.is_special ?? false,
    sort_order: item?.sort_order ?? 0,
    gallery:
      (item?.gallery as string[]) || (item?.image_url ? [item.image_url] : []),
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const upsert = useServerFn(upsertMenuItem)
  const upload = useServerFn(uploadItemImage)

  const onFiles = async (files: File[]) => {
    setUploading(true)
    setError('')
    try {
      const uploadPromises = files.map(async (file) => {
        const isVideo = file.type.startsWith('video/')
        const isGif = file.type === 'image/gif'
        const maxSize = isVideo ? VIDEO_MAX_SIZE : IMAGE_MAX_SIZE

        if (file.size > maxSize) {
          throw new Error(
            `${file.name}: ${isVideo ? t('media_size_error_video') : t('media_size_error_image')}`,
          )
        }

        let base64: string
        let contentType: string
        let filename: string

        if (shouldBypassCompression(file)) {
          base64 = await readFileAsBase64(file)
          contentType = file.type
          filename = file.name
        } else {
          base64 = await compressImageFile(file, 800, 0.8)
          contentType = 'image/webp'
          filename = file.name.replace(/\.[^/.]+$/, '') + '.webp'
        }

        const res = await upload({ data: { filename, contentType, base64 } })
        return res.url
      })

      const urls = await Promise.all(uploadPromises)

      setForm((f) => {
        // Ensure the current image_url is in the gallery if it exists
        const currentGallery = [...f.gallery]
        if (f.image_url && !currentGallery.includes(f.image_url)) {
          currentGallery.unshift(f.image_url)
        }

        const newGallery = [...currentGallery, ...urls]
        return {
          ...f,
          image_url: f.image_url || urls[0],
          gallery: newGallery,
        }
      })
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed')
      toast.error('Upload failed', {
        description: e?.message ?? 'Unexpected error',
      })
    } finally {
      setUploading(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await upsert({
        data: {
          id: item?.id,
          category_id: form.category_id || null,
          name: form.name.trim(),
          name_am: form.name_am.trim() || null,
          description: form.description.trim() || null,
          description_am: form.description_am.trim() || null,
          price: Number(form.price) || 0,
          image_url: form.image_url || null,
          is_available: form.is_available,
          is_vegetarian: form.is_vegetarian,
          is_spicy: form.is_spicy,
          is_fasting: form.is_fasting,
          is_featured: form.is_featured,
          is_special: form.is_special,
          sort_order: form.sort_order,
          // Guarantee gallery is an array and contains the primary image_url at [0]
          gallery:
            form.gallery.length > 0
              ? form.gallery
              : form.image_url
                ? [form.image_url]
                : [],
        },
      })
      onSaved()
      toast.success(item ? 'Item updated' : 'Item added')
    } catch (e: any) {
      setError(e?.message ?? 'Save failed')
      toast.error('Failed to save item', {
        description: !navigator.onLine
          ? 'No internet connection'
          : (e?.message ?? 'Unexpected error'),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 px-4 py-8 backdrop-blur-sm sm:items-center min-h-screen"
      onPointerDown={onClose}
    >
      <div
        className="w-full max-w-2xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <form
          onSubmit={submit}
          className="rounded-xl border border-primary/40 bg-card p-5 shadow-2xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg uppercase tracking-wider text-primary">
              {item ? t('edit_item') : t('add_new_item')}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('name_en')}>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label={t('name_am')}>
              <input
                value={form.name_am}
                onChange={(e) => setForm({ ...form, name_am: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label={t('description_en')}>
              <input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className={inputCls}
                placeholder={t('ingredients_placeholder')}
              />
            </Field>
            <Field label={t('description_am')}>
              <input
                value={form.description_am}
                onChange={(e) =>
                  setForm({ ...form, description_am: e.target.value })
                }
                className={inputCls}
              />
            </Field>
            <PremiumSelect
              label={t('category')}
              value={form.category_id ?? ''}
              onChange={(val) => setForm({ ...form, category_id: val })}
              options={categories.map((c) => ({
                id: c.id,
                label: dt(c, 'name'),
              }))}
            />
            <Field label={t('price_label')}>
              <input
                required
                type="number"
                min="0"
                step="1"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t('media_label')}
            </label>
            <div className="flex items-center gap-3">
              {form.image_url ? (
                getMediaType(form.image_url) === 'video' ? (
                  <video
                    src={form.image_url}
                    className="h-16 w-16 rounded-lg object-cover bg-muted"
                    muted
                    autoPlay
                    loop
                    playsInline
                  />
                ) : (
                  <img
                    src={optimizeImage(form.image_url, 150)}
                    alt=""
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                )
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
                  <Upload className="h-5 w-5" />
                </div>
              )}
              <label className="cursor-pointer rounded-md border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:border-primary hover:text-primary">
                {uploading
                  ? t('uploading')
                  : form.gallery.length > 0 || form.image_url
                    ? t('add_media')
                    : t('upload')}
                <input
                  type="file"
                  multiple
                  accept="image/*,video/mp4,video/webm,.gif"
                  hidden
                  onChange={(e) => {
                    const files = Array.from(e.target.files || [])
                    if (files.length > 0) onFiles(files)
                  }}
                />
              </label>
              {form.gallery.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setForm({ ...form, image_url: '', gallery: [] })
                  }
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  {t('remove_all')}
                </button>
              )}
            </div>

            {/* Gallery Preview */}
            {form.gallery.length > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {form.gallery.map((url, idx) => (
                  <div
                    key={idx}
                    className="relative group aspect-square rounded-md overflow-hidden bg-muted border border-border"
                  >
                    {getMediaType(url) === 'video' ? (
                      <video
                        src={url}
                        className="h-full w-full object-cover"
                        muted
                      />
                    ) : (
                      <img
                        src={optimizeImage(url, 150)}
                        className="h-full w-full object-cover"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const newGallery = form.gallery.filter(
                          (_, i) => i !== idx,
                        )
                        setForm({
                          ...form,
                          gallery: newGallery,
                          image_url:
                            form.image_url === url
                              ? newGallery[0] || ''
                              : form.image_url,
                        })
                      }}
                      className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Toggle
              label={t('available')}
              value={form.is_available}
              onChange={(v) => setForm({ ...form, is_available: v })}
            />
            <Toggle
              label={t('featured')}
              value={form.is_featured}
              onChange={(v) => setForm({ ...form, is_featured: v })}
            />
            <Toggle
              label={t('item_special_badge')}
              value={form.is_special}
              onChange={(v) => setForm({ ...form, is_special: v })}
            />
            <Toggle
              label={t('veg')}
              value={form.is_vegetarian}
              onChange={(v) => setForm({ ...form, is_vegetarian: v })}
            />
            <Toggle
              label={t('spicy')}
              value={form.is_spicy}
              onChange={(v) => setForm({ ...form, is_spicy: v })}
            />
            <Toggle
              label={t('fasting')}
              value={form.is_fasting}
              onChange={(v) => setForm({ ...form, is_fasting: v })}
            />
          </div>

          {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              {t('cancel')}
            </button>
            <button
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {item ? t('save') : t('add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
