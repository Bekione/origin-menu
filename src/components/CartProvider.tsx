import { createContext, useContext, useState, useEffect } from 'react'

export interface CartItem {
  id: string
  name: string
  price: number
  qty: number
}

interface CartContextValue {
  items: CartItem[]
  add: (item: Omit<CartItem, 'qty'>) => void
  remove: (id: string) => void
  increment: (id: string) => void
  decrement: (id: string) => void
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

  const add = (item: Omit<CartItem, 'qty'>) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id)
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, qty: i.qty + 1 } : i,
        )
      }
      return [...prev, { ...item, qty: 1 }]
    })
  }

  const remove = (id: string) =>
    setItems((prev) => prev.filter((i) => i.id !== id))

  const increment = (id: string) =>
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, qty: i.qty + 1 } : i)),
    )

  const decrement = (id: string) =>
    setItems((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: i.qty - 1 } : i))
        .filter((i) => i.qty > 0),
    )

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
      value={{ items, add, remove, increment, decrement, clear, total, count }}
    >
      {children}
    </CartContext.Provider>
  )
}
