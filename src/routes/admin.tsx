import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useServerFn } from '@tanstack/react-start'
import { authClient } from '#/lib/auth-client'
import { getAuthSession } from '@/server/auth-helpers'
import {
  getMenuData,
  upsertMenuItem,
  deleteMenuItem,
  toggleAvailability,
  upsertCategory,
  deleteCategory,
  updateRestaurantInfo,
  uploadItemImage,
  reorderMenuItems,
  reorderCategories,
  type Category,
  type MenuItem,
  type RestaurantInfo,
  type MenuData,
} from '@/server/menu.functions'
import {
  LogOut,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Upload,
  Check,
  X,
  MapPin,
  UtensilsCrossed,
  Layers,
  Store,
  GripVertical,
} from 'lucide-react'
import logo from '@/assets/origin-logo.jpg'
import { Skeleton } from '@/components/ui/skeleton'
import { ThemeToggle } from '@/components/ThemeToggle'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const session = await getAuthSession()
    if (!session?.user) {
      throw redirect({ to: '/login' })
    }
  },
  loader: () => getMenuData(),
  component: AdminPage,
  pendingComponent: AdminSkeleton,
  pendingMs: 0,
})

function AdminPage() {
  const initial = Route.useLoaderData() as MenuData
  const [data, setData] = useState<MenuData>(initial)
  const [tab, setTab] = useState<'items' | 'categories' | 'info'>('items')
  const navigate = Route.useNavigate()

  const refresh = async () => {
    const fresh = await getMenuData()
    setData(fresh)
  }

  const logout = async () => {
    await authClient.signOut()
    navigate({ to: '/login' })
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt=""
              className="h-9 w-9 rounded-full bg-white p-1"
            />
            <div>
              <h1 className="font-display text-2xl text-primary">CONSOLE</h1>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Origin Admin
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="text-xs uppercase tracking-wider text-muted-foreground hover:text-primary"
            >
              View menu
            </Link>
            <ThemeToggle />
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:border-destructive hover:text-destructive"
            >
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
        <div className="mx-auto flex max-w-5xl gap-1 px-4">
          <TabButton
            active={tab === 'items'}
            onClick={() => setTab('items')}
            icon={<UtensilsCrossed className="h-4 w-4" />}
          >
            Menu Items
          </TabButton>
          <TabButton
            active={tab === 'categories'}
            onClick={() => setTab('categories')}
            icon={<Layers className="h-4 w-4" />}
          >
            Categories
          </TabButton>
          <TabButton
            active={tab === 'info'}
            onClick={() => setTab('info')}
            icon={<Store className="h-4 w-4" />}
          >
            Restaurant Info
          </TabButton>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {tab === 'items' && <ItemsTab data={data} onChange={refresh} />}
        {tab === 'categories' && (
          <CategoriesTab data={data} onChange={refresh} />
        )}
        {tab === 'info' && <InfoTab info={data.info} onChange={refresh} />}
      </main>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition ${active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
    >
      {icon} {children}
    </button>
  )
}

/* ------------------------ ITEMS TAB ------------------------ */
function ItemsTab({
  data,
  onChange,
}: {
  data: MenuData
  onChange: () => void
}) {
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [localItems, setLocalItems] = useState(data.items)
  const [draggedId, setDraggedId] = useState<string | null>(null)
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
          Menu Items
        </h2>
        <button
          onClick={() => {
            setEditing(null)
            setShowForm(true)
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add Item
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
              No items yet — add your first one above.
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
                  {cat.name}
                </div>
                {list.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
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
          {/* uncategorised */}
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
}: {
  item: MenuItem
  onEdit: () => void
  onChanged: () => void
  onDragStart?: (e: any) => void
  onDragOver?: (e: any) => void
  onDrop?: () => void
  isDragging?: boolean
}) {
  const toggle = useServerFn(toggleAvailability)
  const del = useServerFn(deleteMenuItem)
  const [busy, setBusy] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleToggle = async () => {
    setBusy(true)
    try {
      await toggle({
        data: { id: item.id, is_available: !item.is_available },
      })
      onChanged()
    } catch (err: any) {
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
        className={`flex items-center gap-3 px-4 py-3 ${isDragging ? 'opacity-50 bg-muted/20' : ''}`}
        draggable={!!onDragStart}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDrop}
      >
        <GripVertical
          className={`h-4 w-4 shrink-0 text-muted-foreground/40 ${onDragStart ? 'cursor-grab active:cursor-grabbing hover:text-primary' : ''}`}
        />
        {item.image_url ? (
          <img
            src={item.image_url}
            alt=""
            className="h-10 w-10 shrink-0 rounded object-cover"
          />
        ) : (
          <div className="h-10 w-10 shrink-0 rounded bg-muted" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{item.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="truncate text-xs text-muted-foreground">
              {Number(item.price)} ETB
            </p>
            {item.is_featured && (
              <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                Chef's Pick
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleToggle}
          disabled={busy}
          className={`rounded flex w-10 justify-center px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${item.is_available ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : item.is_available ? (
            'IN'
          ) : (
            'OUT'
          )}
        </button>
        <button
          onClick={onEdit}
          className="rounded border border-border p-1.5 text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setShowConfirm(true)}
          disabled={busy}
          className="rounded border border-border p-1.5 text-muted-foreground hover:border-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
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
              Delete Item
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete "{item.name}"? This action cannot
              be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-md border border-border px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-muted"
              >
                Cancel
              </button>
              <button
                disabled={busy}
                onClick={handleDelete}
                className="flex-1 flex items-center justify-center gap-2 rounded-md bg-destructive px-4 py-2 text-xs font-bold uppercase tracking-wider text-destructive-foreground hover:opacity-90 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  'Delete'
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
    sort_order: item?.sort_order ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const upsert = useServerFn(upsertMenuItem)
  const upload = useServerFn(uploadItemImage)

  const onFile = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      setError('Image must be under 4MB')
      return
    }
    setUploading(true)
    setError('')
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const res = reader.result as string
          resolve(res.includes(',') ? res.split(',')[1] : res)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const res = await upload({
        data: {
          filename: file.name,
          contentType: file.type,
          base64,
        },
      })
      setForm((f) => ({ ...f, image_url: res.url }))
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed')
      toast.error('Image upload failed', {
        description: !navigator.onLine
          ? 'No internet connection'
          : (e?.message ?? 'Unexpected error'),
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
          sort_order: form.sort_order,
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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 px-4 py-12 backdrop-blur-sm sm:items-center sm:py-8"
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
              {item ? 'Edit Item' : 'Add New Item'}
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
            <Field label="Name (English)">
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Name (አማርኛ)">
              <input
                value={form.name_am}
                onChange={(e) => setForm({ ...form, name_am: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Description (English)">
              <input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className={inputCls}
                placeholder="Ingredients / notes"
              />
            </Field>
            <Field label="Description (አማርኛ)">
              <input
                value={form.description_am}
                onChange={(e) =>
                  setForm({ ...form, description_am: e.target.value })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Category">
              <select
                value={form.category_id ?? ''}
                onChange={(e) =>
                  setForm({ ...form, category_id: e.target.value })
                }
                className={inputCls}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Price (ETB)">
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
              Photo
            </label>
            <div className="flex items-center gap-3">
              {form.image_url ? (
                <img
                  src={form.image_url}
                  alt=""
                  className="h-16 w-16 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
                  <Upload className="h-5 w-5" />
                </div>
              )}
              <label className="cursor-pointer rounded-md border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:border-primary hover:text-primary">
                {uploading
                  ? 'Uploading…'
                  : form.image_url
                    ? 'Replace'
                    : 'Upload'}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) onFile(f)
                  }}
                />
              </label>
              {form.image_url && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, image_url: '' })}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Toggle
              label="Available"
              value={form.is_available}
              onChange={(v) => setForm({ ...form, is_available: v })}
            />
            <Toggle
              label="Featured"
              value={form.is_featured}
              onChange={(v) => setForm({ ...form, is_featured: v })}
            />
            <Toggle
              label="Vegetarian"
              value={form.is_vegetarian}
              onChange={(v) => setForm({ ...form, is_vegetarian: v })}
            />
            <Toggle
              label="Spicy"
              value={form.is_spicy}
              onChange={(v) => setForm({ ...form, is_spicy: v })}
            />
            <Toggle
              label="Fasting (ጾም)"
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
              Cancel
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
              {item ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputCls =
  'h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary'

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${value ? 'bg-primary' : 'bg-muted-foreground/40'}`}
      />{' '}
      {label}
    </button>
  )
}

/* ------------------------ CATEGORIES TAB ------------------------ */
function CategoriesTab({
  data,
  onChange,
}: {
  data: MenuData
  onChange: () => void
}) {
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
        Categories
      </h2>
      <form
        onSubmit={add}
        className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_1fr_auto]"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Category name"
          className={inputCls}
        />
        <input
          value={nameAm}
          onChange={(e) => setNameAm(e.target.value)}
          placeholder="Amharic (optional)"
          className={inputCls}
        />
        <button
          disabled={busy || !name.trim()}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </form>

      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {localCats.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No categories yet — add your first one above.
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
                  if (
                    !confirm(
                      `Delete "${c.name}"? Items inside will also be deleted.`,
                    )
                  )
                    return
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
  const [editing, setEditing] = useState(false)
  const [n, setN] = useState(cat.name)
  const [na, setNa] = useState(cat.name_am ?? '')
  const [so, setSo] = useState(cat.sort_order)
  const [busy, setBusy] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  if (editing) {
    return (
      <div className="grid gap-2 p-3 sm:grid-cols-[1fr_1fr_80px_auto]">
        <input
          value={n}
          onChange={(e) => setN(e.target.value)}
          className={inputCls}
        />
        <input
          value={na}
          onChange={(e) => setNa(e.target.value)}
          className={inputCls}
        />
        <input
          type="number"
          value={so}
          onChange={(e) => setSo(Number(e.target.value))}
          className={inputCls}
        />
        <div className="flex gap-1">
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
          <p className="text-sm font-semibold">{cat.name}</p>
          <p className="text-xs text-muted-foreground">
            {cat.name_am ?? '—'} · {itemCount} item{itemCount !== 1 ? 's' : ''}
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
              Delete Category
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete "{cat.name}"? The {itemCount}{' '}
              items inside it will also be deleted. This cannot be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-md border border-border px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-muted"
              >
                Cancel
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
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ------------------------ INFO TAB ------------------------ */
function InfoTab({
  info,
  onChange,
}: {
  info: RestaurantInfo | null
  onChange: () => void
}) {
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
    hours: initialHours.length
      ? initialHours
      : [{ day: 'Mon–Fri', hours: '10:00 – 22:00' }],
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const update = useServerFn(updateRestaurantInfo)

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
    <form onSubmit={submit} className="space-y-6">
      <h2 className="font-display text-xl uppercase tracking-wider">
        Restaurant Info
      </h2>
      <div className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
        <Field label="Restaurant Name">
          <input
            required
            className={inputCls}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Tagline">
          <input
            className={inputCls}
            value={form.tagline}
            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
          />
        </Field>
        <Field label="Address">
          <input
            className={inputCls}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <input
            className={inputCls}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </Field>
        <Field label="Instagram URL">
          <input
            className={inputCls}
            value={form.instagram_url}
            onChange={(e) =>
              setForm({ ...form, instagram_url: e.target.value })
            }
            placeholder="https://instagram.com/…"
          />
        </Field>
        <Field label="TikTok URL">
          <input
            className={inputCls}
            value={form.tiktok_url}
            onChange={(e) => setForm({ ...form, tiktok_url: e.target.value })}
            placeholder="https://tiktok.com/@…"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Google Maps URL">
            <div className="flex gap-2">
              <MapPin className="mt-2.5 h-4 w-4 shrink-0 text-primary" />
              <input
                className={inputCls}
                value={form.map_url}
                onChange={(e) => setForm({ ...form, map_url: e.target.value })}
                placeholder="https://maps.google.com/?q=…"
              />
            </div>
          </Field>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm uppercase tracking-wider">
            Opening Hours
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
            <Plus className="h-3 w-3" /> Add row
          </button>
        </div>
        <div className="space-y-2">
          {form.hours.map((h, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                className={inputCls}
                value={h.day}
                placeholder="Mon–Fri"
                onChange={(e) => {
                  const a = [...form.hours]
                  a[i] = { ...a[i], day: e.target.value }
                  setForm({ ...form, hours: a })
                }}
              />
              <input
                className={inputCls}
                value={h.hours}
                placeholder="10:00 – 22:00"
                onChange={(e) => {
                  const a = [...form.hours]
                  a[i] = { ...a[i], hours: e.target.value }
                  setForm({ ...form, hours: a })
                }}
              />
              <button
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    hours: form.hours.filter((_, j) => j !== i),
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
          Save Info
        </button>
      </div>
    </form>
  )
}
function AdminSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-2 w-16" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>
        <div className="mx-auto flex max-w-5xl gap-1 px-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-32 rounded-t-md" />
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>

        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </main>
    </div>
  )
}
