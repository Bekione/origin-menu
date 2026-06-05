import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useServerFn } from '@tanstack/react-start'
import {
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Check,
  X,
  GripVertical,
} from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import { inputCls } from '../-components/FormPrimitives'
import {
  upsertCategory,
  deleteCategory,
  reorderCategories,
  type Category,
  type MenuData,
} from '@/server/menu.functions'

export function CategoriesTab({
  data,
  onChange,
}: {
  data: MenuData
  onChange: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [nameAm, setNameAm] = useState('')
  const [busy, setBusy] = useState(false)
  const upsert = useServerFn(upsertCategory)
  const del = useServerFn(deleteCategory)
  const reorder = useServerFn(reorderCategories)
  const [localCats, setLocalCats] = useState(data.categories)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  useEffect(() => {
    setLocalCats(data.categories)
  }, [data.categories])

  const onDragStart = (id: string, e: React.DragEvent) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
  }
  const onDragOver = (id: string, e: React.DragEvent) => {
    e.preventDefault()
    if (!draggedId || draggedId === id) return
    const newList = [...localCats]
    const draggedIdx = newList.findIndex((c) => c.id === draggedId)
    const targetIdx = newList.findIndex((c) => c.id === id)
    const [moved] = newList.splice(draggedIdx, 1)
    newList.splice(targetIdx, 0, moved)
    newList.forEach((c, idx) => (c.sort_order = idx))
    setLocalCats(newList)
  }
  const onDrop = async () => {
    setDraggedId(null)
    try {
      await reorder({
        data: {
          updates: localCats.map((c) => ({
            id: c.id,
            sort_order: c.sort_order,
          })),
        },
      })
      onChange()
    } catch (err: any) {
      toast.error('Reorder failed', {
        description: !navigator.onLine
          ? 'No internet connection'
          : err?.message || 'Unexpected error',
      })
    }
  }

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    try {
      await upsert({
        data: {
          name: name.trim(),
          name_am: nameAm.trim() || null,
          sort_order: data.categories.length + 1,
        },
      })
      setName('')
      setNameAm('')
      onChange()
      toast.success('Category added')
    } catch (err: any) {
      toast.error('Failed to add category', {
        description: !navigator.onLine
          ? 'No internet connection'
          : err?.message || 'Unexpected error',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="font-display text-xl uppercase tracking-wider">
        {t('admin_categories')}
      </h2>
      <form
        onSubmit={add}
        className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_1fr_auto]"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('category_name_placeholder')}
          className={inputCls}
        />
        <input
          value={nameAm}
          onChange={(e) => setNameAm(e.target.value)}
          placeholder={t('amharic_optional')}
          className={inputCls}
        />
        <button
          disabled={busy || !name.trim()}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {t('add')}
        </button>
      </form>

      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {localCats.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {t('no_categories')}
          </p>
        ) : (
          localCats
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((c) => (
              <CategoryRow
                key={c.id}
                cat={c}
                itemCount={
                  data.items.filter((i) => i.category_id === c.id).length
                }
                onDragStart={(e) => onDragStart(c.id, e)}
                onDragOver={(e) => onDragOver(c.id, e)}
                onDrop={onDrop}
                isDragging={draggedId === c.id}
                onSave={async (n, na, so) => {
                  try {
                    await upsert({
                      data: {
                        id: c.id,
                        name: n,
                        name_am: na || null,
                        sort_order: so,
                      },
                    })
                    onChange()
                    toast.success('Category saved')
                  } catch (err: any) {
                    toast.error('Failed to save category', {
                      description: !navigator.onLine
                        ? 'No internet connection'
                        : err?.message || 'Unexpected error',
                    })
                  }
                }}
                onDelete={async () => {
                  try {
                    await del({ data: { id: c.id } })
                    onChange()
                    toast.success('Category deleted')
                  } catch (err: any) {
                    toast.error('Failed to delete category', {
                      description: !navigator.onLine
                        ? 'No internet connection'
                        : err?.message || 'Unexpected error',
                    })
                  }
                }}
              />
            ))
        )}
      </div>
    </div>
  )
}

function CategoryRow({
  cat,
  itemCount,
  onSave,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
}: {
  cat: Category
  itemCount: number
  onSave: (n: string, na: string, so: number) => Promise<void>
  onDelete: () => Promise<void>
  onDragStart?: (e: any) => void
  onDragOver?: (e: any) => void
  onDrop?: () => void
  isDragging?: boolean
}) {
  const { t, dt } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [n, setN] = useState(cat.name)
  const [na, setNa] = useState(cat.name_am ?? '')
  const [so, setSo] = useState(cat.sort_order)
  const [busy, setBusy] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  if (editing) {
    return (
      <div className="grid gap-4 p-3 sm:grid-cols-[1fr_1fr_80px_auto] bg-primary/5 rounded-lg border border-primary/10">
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
            {t('name_en')}
          </label>
          <input
            value={n}
            onChange={(e) => setN(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
            {t('name_am')}
          </label>
          <input
            value={na}
            onChange={(e) => setNa(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
            {t('order')}
          </label>
          <input
            type="number"
            value={so}
            onChange={(e) => setSo(Number(e.target.value))}
            className={inputCls}
          />
        </div>
        <div className="flex items-end gap-1 pb-1">
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await onSave(n, na, so)
              setBusy(false)
              setEditing(false)
            }}
            className="rounded bg-primary p-2 text-primary-foreground"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded border border-border p-2"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        className={`flex items-center gap-3 p-3 ${isDragging ? 'opacity-50 bg-muted/20' : ''}`}
        draggable={!!onDragStart}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDrop}
      >
        <GripVertical
          className={`h-4 w-4 shrink-0 text-muted-foreground/40 ${onDragStart ? 'cursor-grab active:cursor-grabbing hover:text-primary' : ''}`}
        />
        <span className="w-8 text-center text-xs text-muted-foreground">
          {cat.sort_order}
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold">{dt(cat, 'name')}</p>
          <p className="text-xs text-muted-foreground">
            {cat.name_am ?? '—'} · {itemCount}{' '}
            {itemCount === 1 ? t('item') : t('items')}
          </p>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="rounded border border-border p-1.5 text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setShowConfirm(true)}
          className="rounded border border-border p-1.5 text-muted-foreground hover:border-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {showConfirm && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-background/80 px-4 backdrop-blur-sm"
          onPointerDown={() => setShowConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center shadow-2xl"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Trash2 className="mx-auto mb-4 h-10 w-10 text-destructive/80" />
            <h3 className="font-display text-xl text-foreground">
              {t('delete_category')}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('delete_category_confirm', {
                name: dt(cat, 'name'),
                count: itemCount,
              })}
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
                onClick={async () => {
                  setBusy(true)
                  try {
                    await onDelete()
                  } finally {
                    setBusy(false)
                  }
                }}
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
