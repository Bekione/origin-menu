import { useEffect, useRef } from 'react'

export function TabButton({
  active,
  onClick,
  icon,
  className,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (active && ref.current) {
      ref.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      })
    }
  }, [active])

  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition ${className} ${active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
    >
      {icon} {children}
    </button>
  )
}
