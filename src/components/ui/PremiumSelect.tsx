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
  const [search, setSearch] = useState('')
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const filteredOptions = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase()),
  )

  const selectedOption = options.find((o) => o.id === value)

  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setFocusedIndex(-1)
      // Focus search input on open
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    if (focusedIndex >= 0 && isOpen) {
      const container = containerRef.current?.querySelector('.overflow-y-auto')
      const focusedElement = container?.children[focusedIndex] as HTMLElement
      if (focusedElement) {
        focusedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        })
      }
    }
  }, [focusedIndex, isOpen])

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        setIsOpen(true)
        e.preventDefault()
      }
      return
    }

    if (e.key === 'Escape') {
      setIsOpen(false)
    } else if (e.key === 'ArrowDown') {
      setFocusedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : prev,
      )
      e.preventDefault()
    } else if (e.key === 'ArrowUp') {
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0))
      e.preventDefault()
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      onChange(filteredOptions[focusedIndex].id)
      setIsOpen(false)
      e.preventDefault()
    }
  }

  return (
    <div
      className={`relative ${className}`}
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
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
          <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-xl border border-border bg-card p-2 shadow-2xl animate-in fade-in slide-in-from-top-1 duration-200 origin-top">
            <div className="mb-2 px-1">
              <input
                ref={searchInputRef}
                type="text"
                autoComplete="off"
                placeholder="Search..."
                className="w-full bg-muted/50 rounded-md px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/30"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setFocusedIndex(0)
                }}
              />
            </div>
            <ScrollFade direction="vertical" fadeSize={20}>
              <div className="max-h-[220px] overflow-y-auto thin-scrollbar space-y-0.5 px-0.5">
                {filteredOptions.length === 0 ? (
                  <p className="p-4 text-center text-xs text-muted-foreground">
                    No matches found {/* TODO: translate */}
                  </p>
                ) : (
                  filteredOptions.map((option, idx) => (
                    <button
                      key={option.id}
                      type="button"
                      onMouseEnter={() => setFocusedIndex(idx)}
                      onClick={() => {
                        onChange(option.id)
                        setIsOpen(false)
                      }}
                      className={`group relative flex w-full cursor-pointer items-center rounded-md py-2 pl-3 pr-9 text-sm transition-all ${
                        idx === focusedIndex || option.id === value
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground/70 hover:text-foreground hover:bg-primary/5'
                      }`}
                    >
                      <span className="truncate font-medium">
                        {option.label}
                      </span>
                      {option.id === value && (
                        <span className="absolute right-3 flex h-4 w-4 items-center justify-center">
                          <Check className="h-4 w-4" />
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </ScrollFade>
          </div>
        </>
      )}
    </div>
  )
}
