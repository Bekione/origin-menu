import { useEffect, useRef, type KeyboardEvent } from 'react'
import { useChat } from 'ai/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { X, Send, Sparkles, Bot } from 'lucide-react'
import type { MenuItem } from '@/server/menu.functions'
import { AIChatFoodCard } from '@/components/AIChatFoodCard'

const SUGGESTED_PROMPTS = [
  { en: '🔥 Recommend something spicy', am: '🔥 ቅቅ የሚያደርግ ምግብ ጥቀምልኝ' },
  { en: '🌿 Fasting-friendly options', am: '🌿 ለፆም የሚሆን ምግብ ይጠቁሙ' },
  { en: '👫 Best combo for two people', am: '👫 ለሁለት የሚሆን ጥሩ ምርጫ' },
  { en: '💰 Something under 200 ETB', am: '💰 ከ 200 ብር ያነሰ ምግብ' },
]

interface AIChatDrawerProps {
  open: boolean
  onClose: () => void
  items: MenuItem[]
  lang: 'en' | 'am'
}

/* ------------------------------------------------------------------
   Parse assistant message: extract optional <SUGGESTIONS> JSON block
   Returns: { text, suggestedIds }
------------------------------------------------------------------ */
function parseAssistantMessage(content: string): {
  text: string
  suggestedIds: string[]
} {
  const match = content.match(/<SUGGESTIONS>([\s\S]*?)<\/SUGGESTIONS>/)
  if (!match) return { text: content.trim(), suggestedIds: [] }

  try {
    const json: { itemIds?: string[] } = JSON.parse(match[1].trim())
    const text = content
      .replace(/<SUGGESTIONS>[\s\S]*?<\/SUGGESTIONS>/, '')
      .trim()
    return { text, suggestedIds: json.itemIds ?? [] }
  } catch {
    return {
      text: content.replace(/<SUGGESTIONS>[\s\S]*?<\/SUGGESTIONS>/, '').trim(),
      suggestedIds: [],
    }
  }
}

/* ------------------------------------------------------------------
   Typing indicator dots
------------------------------------------------------------------ */
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}

export function AIChatDrawer({
  open,
  onClose,
  items,
  lang,
}: AIChatDrawerProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    append,
    error,
  } = useChat({
    api: '/api/ai-chat',
    initialMessages: [
      {
        id: 'sys-welcome',
        role: 'assistant',
        content:
          lang === 'am'
            ? 'ሰላምታ! እኔ Origin AI ነኝ — የምትፈልጉትን ምግብ ለማግኘት እረዳዎታለሁ። ምን ይፈልጋሉ?'
            : "Hi! I'm **Origin AI**, your personal food concierge 🍽️\n\nTell me what you're in the mood for, or ask me anything about the menu!",
      },
    ],
  })

  // auto-scroll on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // focus input when drawer opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300)
  }, [open])

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>)
    }
  }

  const handlePromptChip = (prompt: string) => {
    append({ role: 'user', content: prompt })
  }

  const lookupItem = (id: string) => items.find((i) => i.id === id)

  if (!open) return null

  return (
    <>
      {/* Drawer panel (Floating Widget) */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="AI Meal Suggester"
        className="fixed bottom-0 right-0 z-50 flex flex-col rounded-t-2xl border border-border bg-background shadow-2xl sm:bottom-18 sm:right-4 sm:left-auto sm:top-auto sm:h-[550px] sm:w-[380px] sm:rounded-2xl"
        style={{ maxHeight: 'calc(100dvh - 4.5rem)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Origin AI</p>
              <p className="text-xs text-muted-foreground">
                {lang === 'am' ? 'የምግብ አማካሪ' : 'Food Concierge'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Close AI chat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="scrollbar-none flex-1 overflow-y-auto space-y-4 px-4 py-4">
          {messages
            .filter((m) => m.role !== 'system')
            .map((m) => {
              const isUser = m.role === 'user'
              const text = m.content
              const parsed = isUser ? null : parseAssistantMessage(text)
              const suggestCards = parsed
                ? (parsed.suggestedIds
                    .map(lookupItem)
                    .filter(Boolean) as MenuItem[])
                : []

              return (
                <div
                  key={m.id}
                  className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}
                >
                  {/* Assistant bubble */}
                  {!isUser && (
                    <div className="flex items-start gap-2">
                      <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Bot className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5 text-sm text-foreground">
                        <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ul>li]:mb-0.5">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {parsed?.text ?? text}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* User bubble */}
                  {isUser && (
                    <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                      {text}
                    </div>
                  )}

                  {/* Food cards */}
                  {suggestCards.length > 0 && (
                    <div className="ml-8 mt-1 w-full max-w-[85%] space-y-2">
                      {suggestCards.map((item) => (
                        <AIChatFoodCard key={item.id} item={item} lang={lang} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

          {/* Streaming Typing Indicator */}
          {isLoading && (
            <div className="flex items-start gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3">
                <TypingIndicator />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20 text-center">
              <p className="font-semibold">Oops! Something went wrong.</p>
              <p className="text-xs mt-1 opacity-80">
                {error.message ||
                  'Failed to reach AI. Please check your connection or API key.'}
              </p>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Suggested Prompts (only when just welcome message) */}
        {messages.length <= 1 && !isLoading && (
          <div className="border-t border-border px-4 py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {lang === 'am' ? 'ምሳሌ' : 'Try asking'}
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p.en}
                  onClick={() => handlePromptChip(lang === 'am' ? p.am : p.en)}
                  disabled={isLoading}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  {lang === 'am' ? p.am : p.en}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit(e)
          }}
          className="flex items-center gap-2 sm:rounded-b-2xl border-t border-border bg-card/80 px-4 py-3 backdrop-blur-sm"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKey}
            placeholder={
              lang === 'am' ? 'ምን ምግብ ትፈልጋለህ?...' : 'Ask about the menu...'
            }
            disabled={isLoading}
            className="h-10 flex-1 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:opacity-60"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow transition hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </>
  )
}
