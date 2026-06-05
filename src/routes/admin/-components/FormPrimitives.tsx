export const inputCls =
  'h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary'

export function Field({
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

export function Toggle({
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
