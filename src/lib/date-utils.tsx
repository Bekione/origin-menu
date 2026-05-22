import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n'

export function timeAgo(ts: string | Date | number, t: any) {
  const date = new Date(ts)
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)

  if (diff < 5) return t('just_now')
  if (diff < 60) return t('seconds_ago', { count: diff })

  const minutes = Math.floor(diff / 60)
  if (minutes < 60) return t('minutes_ago', { count: minutes })

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('hours_ago', { count: hours })

  const days = Math.floor(hours / 24)
  if (days < 7) return t('days_ago', { count: days })

  const weeks = Math.floor(days / 7)
  if (weeks < 4) return t('weeks_ago', { count: weeks })

  const months = Math.floor(days / 30)
  if (months < 12) return t('months_ago', { count: months })

  const years = Math.floor(days / 365)
  return t('years_ago', { count: years })
}

export function LiveTimeAgo({
  ts,
  className,
}: {
  ts: string | Date | number
  className?: string
}) {
  const { t } = useTranslation()
  const [ago, setAgo] = useState(() => timeAgo(ts, t))

  useEffect(() => {
    const update = () => setAgo(timeAgo(ts, t))

    update()

    // Update frequency based on age
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)

    let interval = 1000 // default: every second
    if (diff >= 60) interval = 30 * 1000 // every 30s
    if (diff >= 3600) interval = 60 * 1000 // every 1m
    if (diff >= 86400) interval = 60 * 60 * 1000 // every 1h

    const id = setInterval(update, interval)
    return () => clearInterval(id)
  }, [ts, t])

  return <span className={className}>{ago}</span>
}
