import React, { createContext, useContext, useEffect, useState } from 'react'
import { translations, type Lang, type TranslationKey } from './translations'

type LanguageContextType = {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
  dt: (obj: any, key: string) => any
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
)

const STORAGE_KEY = 'origin_app_lang'

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift()
}

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === 'undefined') return
  const date = new Date()
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/;SameSite=Lax`
}

export function LanguageProvider({
  children,
  initialLang,
}: {
  children: React.ReactNode
  initialLang?: Lang
}) {
  const [lang, setLangState] = useState<Lang>(() => {
    // If we are on the client, check local storage/cookies first to be safe
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY) as Lang
      if (saved) return saved
      const cookie = getCookie(STORAGE_KEY) as Lang
      if (cookie) return cookie
    }
    // Fall back to server-provided lang or default
    return initialLang || 'en'
  })

  useEffect(() => {
    if (lang) {
      localStorage.setItem(STORAGE_KEY, lang)
      setCookie(STORAGE_KEY, lang)
      document.documentElement.lang = lang
      if (lang === 'am') {
        document.documentElement.classList.add('font-amharic')
      } else {
        document.documentElement.classList.remove('font-amharic')
      }
    }
  }, [lang])

  const setLang = (newLang: Lang) => {
    setLangState(newLang)
    setCookie(STORAGE_KEY, newLang) // Set immediately for next navigation
  }

  const t = (
    key: TranslationKey,
    params?: Record<string, string | number>,
  ): string => {
    const dict = translations[lang] as any
    let text = dict[key] || (translations['en'] as any)[key] || key
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v))
      })
    }
    return text
  }

  /**
   * Dynamic Translation Helper
   * Tries to find the translated version of a property in a DB object.
   * e.g. dt(item, 'name') will look for 'name_am' if lang is 'am'.
   */
  const dt = (obj: any, key: string): any => {
    if (!obj) return ''
    if (lang === 'am') {
      const amKey = `${key}_am`
      if (obj[amKey]) return obj[amKey]
    }
    return obj[key]
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dt }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useTranslation() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useTranslation must be used within a LanguageProvider')
  }
  return context
}
