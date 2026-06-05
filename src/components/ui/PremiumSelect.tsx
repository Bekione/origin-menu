import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { inputCls } from '@/routes/admin/-components/FormPrimitives'
import ScrollFade from '@/components/ScrollFade'

interface Option {
  id: string
  label: string
}

interface PremiumSelectProps {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  className?: string
  label?: string
}

export function PremiumSelect({
  value,
  onChange,
  options,
  placeholder,
  className = '',
  label,
}: PremiumSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((o) => o.id === value)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`${inputCls} group flex items-center justify-between transition-all hover:border-primary/50`}
      >
        <span className="truncate font-medium text-foreground/90">
          {selectedOption
            ? selectedOption.label
            : placeholder || 'Select option...'}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-2xl animate-in fade-in slide-in-from-top-1 duration-200 origin-top">
            <ScrollFade direction="vertical" fadeSize={30}>
              <div className="max-h-[220px] overflow-y-auto thin-scrollbar space-y-0.5 p-0.5">
                {options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onChange(option.id)
                      setIsOpen(false)
                    }}
                    className={`group relative flex w-full cursor-pointer items-center rounded-md py-2 pl-3 pr-9 text-sm transition-all hover:bg-primary/10 ${
                      option.id === value
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground/70 hover:text-foreground'
                    }`}
                  >
                    <span className="truncate font-medium">{option.label}</span>
                    {option.id === value && (
                      <span className="absolute right-3 flex h-4 w-4 items-center justify-center">
                        <Check className="h-4 w-4" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </ScrollFade>
          </div>
        </>
      )}
    </div>
  )
}
