import { Plus } from 'lucide-react'
import { useCart } from '@/components/CartProvider'
import type { MenuItem } from '@/server/menu.functions'

interface AIChatFoodCardProps {
  item: MenuItem
  lang: 'en' | 'am'
}

export function AIChatFoodCard({ item, lang }: AIChatFoodCardProps) {
  const { add } = useCart()

  return (
    <div className="flex items-center gap-3 overflow-hidden rounded-xl border border-border bg-card p-3 shadow-sm transition hover:border-primary/40">
      {/* Image */}
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl">
            🍽️
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-sm text-foreground leading-tight">
          {lang === 'am' && item.name_am ? item.name_am : item.name}
        </p>
        {lang === 'am' && item.name_am && (
          <p className="truncate text-xs text-muted-foreground">{item.name}</p>
        )}
        {/* Tags */}
        <div className="mt-1 flex flex-wrap gap-1">
          {item.is_vegetarian && (
            <span className="rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-success">
              VEG
            </span>
          )}
          {item.is_fasting && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              FASTING
            </span>
          )}
          {item.is_spicy && (
            <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
              SPICY
            </span>
          )}
        </div>
        <p className="mt-1 font-display text-sm font-bold text-primary">
          {item.price.toLocaleString()} ETB
        </p>
      </div>

      {/* Add Button */}
      <button
        onClick={() => add({ id: item.id, name: item.name, price: item.price })}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow transition hover:scale-110 active:scale-95"
        aria-label={`Add ${item.name} to cart`}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}
