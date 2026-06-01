import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { getAuthSession } from '@/server/auth-helpers'
import { verifyStaffPin } from '@/server/staff.functions'
import logo from '@/assets/origin-logo-kds.png'
import { Delete } from 'lucide-react'

const smoothBounceKeyframes = `
  @keyframes smooth-bounce {
    0%, 100% { transform: translateY(0); animation-timing-function: cubic-bezier(0.8, 0, 1, 1); }
    50% { transform: translateY(-30%); animation-timing-function: cubic-bezier(0, 0, 0.2, 1); }
  }
`

export const Route = createFileRoute('/staff-login')({
  beforeLoad: async () => {
    const session = await getAuthSession()
    if (session?.user) {
      const role = (session.user as any).role
      throw redirect({ to: role === 'admin' ? '/admin' : '/staff' })
    }
  },
  component: StaffLoginPage,
})

function StaffLoginPage() {
  const navigate = Route.useNavigate()
  const [pin, setPin] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)

  const digits = [
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    'C',
    '0',
    'DEL',
  ] as const

  const pressDigit = (d: string) => {
    if (pin.length >= 4 || loading) return
    setError(null)
    setPin((prev) => [...prev, d])
  }

  const pressDelete = () => {
    if (loading) return
    setPin((prev) => prev.slice(0, -1))
    setError(null)
  }

  const pressClear = () => {
    if (loading) return
    setPin([])
    setError(null)
  }

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (pin.length === 4) {
      submitPin(pin.join(''))
    }
  }, [pin])

  const submitPin = async (enteredPin: string) => {
    setLoading(true)
    try {
      await verifyStaffPin({ data: { pin: enteredPin } })
      navigate({ to: '/staff' })
    } catch (err: any) {
      setError(err.message || 'Incorrect PIN')
      setLoading(false)
      setShake(true)
      setTimeout(() => {
        setShake(false)
        setPin([])
      }, 600)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-10 flex flex-col items-center gap-4">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-xl ring-4 ring-white/5 border border-white/10">
          <img src={logo} alt="Origin" className="h-14 w-14 object-contain" />
        </div>
        <div className="text-center">
          <h1 className="font-display text-4xl text-primary leading-tight">
            ORIGIN
          </h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Kitchen System
          </p>
        </div>
      </div>

      <style>{smoothBounceKeyframes}</style>

      {/* PIN dots */}
      <div className="mb-8 flex min-h-[40px] flex-col items-center justify-center">
        <div
          className={`flex gap-4 transition-all ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}
          style={
            shake
              ? { animation: 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both' }
              : {}
          }
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-5 w-5 rounded-full border-2 transition-all duration-200 ${
                pin.length > i || loading
                  ? 'border-primary bg-primary'
                  : 'border-muted-foreground/40 bg-transparent'
              } ${shake ? 'border-destructive bg-destructive' : ''}`}
              style={{
                animationName: loading ? 'smooth-bounce' : 'none',
                animationDuration: '1.2s',
                animationIterationCount: 'infinite',
                animationTimingFunction: 'ease-in-out',
                animationDelay: `${i * 150}ms`,
                animationFillMode: 'both',
              }}
            />
          ))}
        </div>
      </div>

      {/* Error message */}
      <div className="mb-6 h-5">
        {error && (
          <p className="text-sm font-medium text-destructive">{error}</p>
        )}
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3">
        {digits.map((d, i) => {
          if (d === 'C')
            return (
              <button
                key={i}
                onClick={pressClear}
                disabled={loading || pin.length === 0}
                className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-card font-display text-xl text-muted-foreground transition hover:border-primary hover:text-primary active:scale-95 disabled:opacity-40"
              >
                C
              </button>
            )

          if (d === 'DEL')
            return (
              <button
                key={i}
                onClick={pressDelete}
                disabled={loading || pin.length === 0}
                className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground transition hover:border-primary hover:text-primary active:scale-95 disabled:opacity-40"
              >
                <Delete className="h-5 w-5" />
              </button>
            )

          return (
            <button
              key={i}
              onClick={() => pressDigit(d)}
              disabled={loading || pin.length >= 4}
              className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-card font-display text-3xl text-foreground transition hover:border-primary hover:bg-primary/5 hover:text-primary active:scale-95 disabled:opacity-40"
            >
              {d}
            </button>
          )
        })}
      </div>

      <style>{`
        @keyframes shake {
          10%, 90% { transform: translateX(-2px); }
          20%, 80% { transform: translateX(4px); }
          30%, 50%, 70% { transform: translateX(-6px); }
          40%, 60% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  )
}
