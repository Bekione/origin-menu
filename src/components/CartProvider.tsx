import { createContext, useContext, useState, useEffect } from 'react'

export interface CartItem {
  id: string
  name: string
  price: number
  qty: number
  notes?: string[]
  customNote?: string
  category_id?: string
  tags?: string[]
}

interface CartContextValue {
  items: CartItem[]
  add: (item: Omit<CartItem, 'qty' | 'notes' | 'customNote'>) => void
  remove: (id: string, notes?: string[], customNote?: string) => void
  increment: (id: string, notes?: string[], customNote?: string) => void
  decrement: (id: string, notes?: string[], customNote?: string) => void
  updateCustomizations: (
    id: string,
    oldNotes: string[] | undefined,
    oldCustomNote: string | undefined,
    newNotes: string[],
    newCustomNote: string,
  ) => void
  clear: () => void
  total: number
  count: number
}

const CartContext = createContext<CartContextValue | undefined>(undefined)

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])

  const areNotesEqual = (a?: string[], b?: string[]) => {
    if (!a && !b) return true
    if (!a || !b) return false
    if (a.length !== b.length) return false
    return a.every((v, i) => v === b[i])
  }

  const add = (item: Omit<CartItem, 'qty' | 'notes' | 'customNote'>) => {
    setItems((prev) => {
      const existing = prev.find(
        (i) => i.id === item.id && !i.notes && !i.customNote,
      )
      if (existing) {
        return prev.map((i) =>
          i.id === item.id && !i.notes && !i.customNote
            ? { ...i, qty: i.qty + 1 }
            : i,
        )
      }
      return [...prev, { ...item, qty: 1 }]
    })
  }

  const remove = (id: string, notes?: string[], customNote?: string) =>
    setItems((prev) =>
      prev.filter(
        (i) =>
          !(
            i.id === id &&
            areNotesEqual(i.notes, notes) &&
            i.customNote === customNote
          ),
      ),
    )

  const increment = (id: string, notes?: string[], customNote?: string) =>
    setItems((prev) =>
      prev.map((i) =>
        i.id === id &&
        areNotesEqual(i.notes, notes) &&
        i.customNote === customNote
          ? { ...i, qty: i.qty + 1 }
          : i,
      ),
    )

  const decrement = (id: string, notes?: string[], customNote?: string) =>
    setItems((prev) =>
      prev
        .map((i) =>
          i.id === id &&
          areNotesEqual(i.notes, notes) &&
          i.customNote === customNote
            ? { ...i, qty: i.qty - 1 }
            : i,
        )
        .filter((i) => i.qty > 0),
    )

  const updateCustomizations = (
    id: string,
    oldNotes: string[] | undefined,
    oldCustomNote: string | undefined,
    newNotes: string[],
    newCustomNote: string,
  ) => {
    setItems((prev) => {
      // Find the item to update
      const target = prev.find(
        (i) =>
          i.id === id &&
          areNotesEqual(i.notes, oldNotes) &&
          i.customNote === oldCustomNote,
      )
      if (!target) return prev

      // Check if there's already an item with the NEW customizations to merge into
      const existingWithNew = prev.find(
        (i) =>
          i.id === id &&
          areNotesEqual(i.notes, newNotes) &&
          i.customNote === newCustomNote,
      )

      if (existingWithNew && target !== existingWithNew) {
        // Merge!
        return prev
          .filter((i) => i !== target)
          .map((i) =>
            i === existingWithNew ? { ...i, qty: i.qty + target.qty } : i,
          )
      }

      // Just update customizations on the target
      return prev.map((i) =>
        i === target
          ? {
              ...i,
              notes: newNotes.length > 0 ? newNotes : undefined,
              customNote: newCustomNote || undefined,
            }
          : i,
      )
    })
  }

  const clear = () => setItems([])

  // Watch for real-time 86'd item removals
  useEffect(() => {
    const handleRemove = (e: CustomEvent<{ id: string }>) => {
      remove(e.detail.id)
    }
    window.addEventListener('origin:cart:remove', handleRemove as EventListener)
    return () => {
      window.removeEventListener(
        'origin:cart:remove',
        handleRemove as EventListener,
      )
    }
  }, [])

  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0)
  const count = items.reduce((sum, i) => sum + i.qty, 0)

  return (
    <CartContext.Provider
      value={{
        items,
        add,
        remove,
        increment,
        decrement,
        updateCustomizations,
        clear,
        total,
        count,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}
