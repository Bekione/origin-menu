import { useState, useEffect } from 'react'
import {
  Globe,
  Bell,
  Moon,
  Sun,
  Volume2,
  Play,
  RefreshCw,
  QrCode,
  HardDrive,
  LayoutDashboard,
  ShieldCheck,
  Wifi,
} from 'lucide-react'

import { useTranslation } from '@/lib/i18n'
import { useTheme } from '@/components/ThemeProvider'
import { playAdminAlert } from '@/lib/audio-utils'

export function SettingsTab() {
  const { t, lang, setLang } = useTranslation()
  const { theme, setTheme } = useTheme()

  // Notification settings
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('admin_sound_enabled') !== 'false'
  })
  const [volume, setVolume] = useState(() => {
    if (typeof window === 'undefined') return 30
    return Number(localStorage.getItem('admin_sound_volume') || '30')
  })

  // Display & Reliability settings
  const [density, setDensity] = useState(() => {
    if (typeof window === 'undefined') return 'Comfortable'
    return localStorage.getItem('admin_layout_density') || 'Comfortable'
  })
  const [refreshInterval, setRefreshInterval] = useState(() => {
    if (typeof window === 'undefined') return 'Live'
    return localStorage.getItem('admin_refresh_interval') || 'Live'
  })

  // QR Settings
  const [qrSize, setQrSize] = useState(() => {
    if (typeof window === 'undefined') return 'Medium'
    return localStorage.getItem('admin_qr_size') || 'Medium'
  })
  const [qrIncludeLogo, setQrIncludeLogo] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('admin_qr_logo') !== 'false'
  })

  // KDS Settings
  const [kdsSound, setKdsSound] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('admin_kds_sound_enabled') !== 'false'
  })

  useEffect(() => {
    localStorage.setItem('admin_sound_enabled', String(soundEnabled))
    localStorage.setItem('admin_sound_volume', String(volume))
    localStorage.setItem('admin_layout_density', density)
    localStorage.setItem('admin_refresh_interval', refreshInterval)
    localStorage.setItem('admin_qr_size', qrSize)
    localStorage.setItem('admin_qr_logo', String(qrIncludeLogo))
    localStorage.setItem('admin_kds_sound_enabled', String(kdsSound))
  }, [
    soundEnabled,
    volume,
    density,
    refreshInterval,
    qrSize,
    qrIncludeLogo,
    kdsSound,
  ])

  const handleTestSound = () => {
    playAdminAlert(volume / 100)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 lg:px-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="font-display text-2xl uppercase tracking-widest text-foreground">
          {t('app_settings')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground italic font-medium">
          {t('settings_desc')}
        </p>
      </div>

      <div className="grid gap-6">
        {/* Language Section */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/20">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-display text-sm uppercase tracking-widest text-foreground">
                {t('language_region')}
              </h3>
              <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mt-0.5">
                {t('language_desc')}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            {[
              { id: 'en', label: 'English' },
              { id: 'am', label: 'አማርኛ' },
            ].map((l) => (
              <button
                key={l.id}
                onClick={() => setLang(l.id as any)}
                className={`flex-1 rounded-xl border px-4 py-3 text-sm font-black transition-all uppercase tracking-widest ${
                  lang === l.id
                    ? 'border-primary bg-primary/5 text-primary shadow-sm shadow-primary/10'
                    : 'border-border bg-muted/20 text-muted-foreground hover:border-border-hover hover:bg-muted/40'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications Section */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-amber-500/20">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
              <Bell className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h3 className="font-display text-sm uppercase tracking-widest text-foreground">
                {t('notification_sound')}
              </h3>
              <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mt-0.5">
                Manage order and call alerts.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-foreground uppercase tracking-wider">
                Enable Sound Alerts
              </span>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`relative h-6 w-11 rounded-full transition-colors outline-none focus:ring-2 focus:ring-primary/20 ${
                  soundEnabled ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <div
                  className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform duration-300 ${
                    soundEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div
              className={`space-y-4 transition-all duration-300 ${soundEnabled ? 'opacity-100' : 'opacity-30 grayscale pointer-events-none'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground uppercase tracking-wider">
                  {t('notification_volume')}
                </span>
                <span className="text-[10px] font-black text-muted-foreground bg-muted p-1 rounded min-w-[32px] text-center">
                  {volume}%
                </span>
              </div>
              <div className="flex items-center gap-4">
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
                />
              </div>

              <button
                onClick={handleTestSound}
                className="group flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-foreground transition hover:bg-muted/50 active:scale-95"
              >
                <Play className="h-3 w-3 transition-transform group-hover:scale-125" />
                {t('test_sound')}
              </button>
            </div>
          </div>
        </div>

        {/* Display Mode Section */}
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-blue-500/20">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
              <Sun className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-display text-sm uppercase tracking-widest text-foreground">
                {t('display_preferences')}
              </h3>
              <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mt-0.5">
                Adjust the look of your dashboard.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Appearance
            </label>
            <div className="flex gap-2">
              {[
                { id: 'light', icon: Sun },
                { id: 'dark', icon: Moon },
                { id: 'system', icon: Globe },
              ].map((m) => {
                const Icon = m.icon
                return (
                  <button
                    key={m.id}
                    onClick={() => setTheme(m.id as any)}
                    className={`flex flex-1 flex-col items-center gap-2 rounded-xl border p-3 transition-all ${
                      theme === m.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-muted/5 text-muted-foreground hover:bg-muted/10'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Layout Density
            </label>
            <div className="flex gap-2">
              {['Compact', 'Comfortable'].map((d) => (
                <button
                  key={d}
                  onClick={() => setDensity(d)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-[10px] font-bold uppercase transition-all ${
                    density === d
                      ? 'border-primary bg-primary/10 text-primary shadow-sm'
                      : 'border-border bg-muted/5 text-muted-foreground hover:bg-muted/10'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Console Reliability Section */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-emerald-500/20">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <RefreshCw className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-display text-sm uppercase tracking-widest text-foreground">
                CONSOLE RELIABILITY
              </h3>
              <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mt-0.5">
                Manage background updates.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Auto-Refresh Interval
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'Live', label: 'Live (Realtime)' },
                { id: '1m', label: '1 Minute' },
                { id: '5m', label: '5 Minutes' },
                { id: 'Off', label: 'Manual Only' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setRefreshInterval(opt.id)}
                  className={`rounded-xl border px-3 py-2 text-[10px] font-bold uppercase transition-all ${
                    refreshInterval === opt.id
                      ? 'border-primary bg-primary/10 text-primary shadow-sm'
                      : 'border-border bg-muted/5 text-muted-foreground hover:bg-muted/10'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* QR Code Preferences Section */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-violet-500/20">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
              <QrCode className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <h3 className="font-display text-sm uppercase tracking-widest text-foreground">
                QR Code Preferences
              </h3>
              <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mt-0.5">
                Customize generated table QR codes.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex flex-col gap-3">
              <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Print Size
              </label>
              <div className="flex gap-2">
                {[
                  { id: 'Small', label: 'Small (300px)' },
                  { id: 'Medium', label: 'Medium (500px)' },
                  { id: 'Large', label: 'Large (800px)' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setQrSize(s.id)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-[10px] font-bold uppercase transition-all ${
                      qrSize === s.id
                        ? 'border-violet-500 bg-violet-500/10 text-violet-500 shadow-sm'
                        : 'border-border bg-muted/5 text-muted-foreground hover:bg-muted/10'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-foreground uppercase tracking-wider">
                Include Restaurant Logo
              </span>
              <button
                onClick={() => setQrIncludeLogo(!qrIncludeLogo)}
                className={`relative h-6 w-11 rounded-full transition-colors outline-none focus:ring-2 focus:ring-violet-500/20 ${
                  qrIncludeLogo ? 'bg-violet-500' : 'bg-muted'
                }`}
              >
                <div
                  className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform duration-300 ${
                    qrIncludeLogo ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* KDS Control Section */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-orange-500/20">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
              <LayoutDashboard className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <h3 className="font-display text-sm uppercase tracking-widest text-foreground">
                KDS Preferences
              </h3>
              <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mt-0.5">
                Staff Kitchen Display controls.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-foreground uppercase tracking-wider">
              Enable Alert Sounds
            </span>
            <button
              onClick={() => setKdsSound(!kdsSound)}
              className={`relative h-6 w-11 rounded-full transition-colors outline-none focus:ring-2 focus:ring-orange-500/20 ${
                kdsSound ? 'bg-orange-500' : 'bg-muted'
              }`}
            >
              <div
                className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform duration-300 ${
                  kdsSound ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* System Dashboard Section */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/20">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <HardDrive className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-display text-sm uppercase tracking-widest text-foreground">
                System Info
              </h3>
              <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mt-0.5">
                Diagnostics and application data.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-foreground">
                  App Version
                </span>
              </div>
              <span className="text-[10px] font-black text-muted-foreground">
                v1.2.0-stable
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-emerald-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-foreground">
                  API Health
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                  Optimal
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
