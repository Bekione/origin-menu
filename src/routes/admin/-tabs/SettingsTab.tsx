import { useState, useEffect } from 'react'
import {
  Globe,
  Bell,
  Moon,
  Sun,
  Volume2,
  Play,
  HardDrive,
  ShieldCheck,
  Wifi,
  ChefHat,
  Layout,
  QrCode,
} from 'lucide-react'
import { supabaseBrowser } from '@/integrations/supabase/client.browser'
import { ConfirmationModal } from '@/components/ui/ConfirmationModal'

import { useTranslation } from '@/lib/i18n'
import { useTheme } from '@/components/ThemeProvider'
import { playAdminAlert } from '@/lib/audio-utils'

// Reusable Toggle component
function Toggle({
  enabled,
  onChange,
  color = 'bg-primary',
}: {
  enabled: boolean
  onChange: (v: boolean) => void
  color?: string
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative h-6 w-11 rounded-full transition-colors outline-none focus:ring-2 focus:ring-primary/20 ${
        enabled ? color : 'bg-muted'
      }`}
    >
      <div
        className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform duration-300 ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

// Reusable Volume Row component
function VolumeRow({
  label,
  volume,
  onChange,
}: {
  label: string
  volume: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-foreground uppercase tracking-wider">
          {label}
        </span>
        <span className="text-[10px] font-black text-muted-foreground bg-muted px-1.5 py-0.5 rounded min-w-[36px] text-center">
          {volume}%
        </span>
      </div>
      <div className="flex items-center gap-4">
        <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
        />
      </div>
    </div>
  )
}

export function SettingsTab() {
  const { t, lang, setLang } = useTranslation()
  const { theme, setTheme } = useTheme()

  // Admin console notification
  const [adminSoundEnabled, setAdminSoundEnabled] = useState(true)
  const [adminVolume, setAdminVolume] = useState(30)

  // KDS notification
  const [kdsSoundEnabled, setKdsSoundEnabled] = useState(true)
  const [kdsVolume, setKdsVolume] = useState(32)

  // Display & Layout
  const [showDescriptions, setShowDescriptions] = useState(true)
  const [qrSize, setQrSize] = useState('Medium')
  const [isApiHealthy, setIsApiHealthy] = useState(true)
  const [isClearing, setIsClearing] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Real API Health Check
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const { error } = await supabaseBrowser
          .from('menu_items')
          .select('count', { count: 'exact', head: true })
        setIsApiHealthy(!error)
      } catch {
        setIsApiHealthy(false)
      }
    }

    checkHealth()
    const interval = setInterval(checkHealth, 30000) // Check every 30s
    return () => clearInterval(interval)
  }, [])

  // Load from localStorage after mount (avoids SSR/hydration mismatch)
  useEffect(() => {
    setAdminSoundEnabled(
      localStorage.getItem('admin_sound_enabled') !== 'false',
    )
    setAdminVolume(Number(localStorage.getItem('admin_sound_volume') || '30'))
    setKdsSoundEnabled(
      localStorage.getItem('admin_kds_sound_enabled') !== 'false',
    )
    setKdsVolume(Number(localStorage.getItem('admin_kds_volume') || '32'))
    setShowDescriptions(
      localStorage.getItem('app_show_descriptions') !== 'false',
    )
    setQrSize(localStorage.getItem('admin_qr_size') || 'Medium')
  }, [])

  // Persist admin sound settings
  useEffect(() => {
    localStorage.setItem('admin_sound_enabled', String(adminSoundEnabled))
    localStorage.setItem('admin_sound_volume', String(adminVolume))
  }, [adminSoundEnabled, adminVolume])

  // Persist KDS settings
  useEffect(() => {
    localStorage.setItem('admin_kds_sound_enabled', String(kdsSoundEnabled))
    localStorage.setItem('admin_kds_volume', String(kdsVolume))
  }, [kdsSoundEnabled, kdsVolume])

  // Persist display settings + notify listeners
  useEffect(() => {
    localStorage.setItem('app_show_descriptions', String(showDescriptions))
    localStorage.setItem('admin_qr_size', qrSize)

    // Dispatch events for real-time updates in other tabs
    window.dispatchEvent(new CustomEvent('settings-changed'))
  }, [showDescriptions, qrSize])

  const handleTestAdminSound = () => {
    playAdminAlert(adminVolume / 100)
  }

  const handleClearCache = async () => {
    setIsClearing(true)
    await new Promise((r) => setTimeout(r, 800))
    localStorage.clear()
    window.location.reload()
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
        {/* Language & Theme */}
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

          <div className="flex flex-col gap-6">
            {/* Language */}
            <div className="flex flex-col gap-3">
              <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {t('language_region')}
              </label>
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

            {/* Theme */}
            <div className="flex flex-col gap-3">
              <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {t('light_mode')} / {t('dark_mode')}
              </label>
              <div className="flex gap-2">
                {[
                  { id: 'light', icon: Sun, label: t('light_mode') },
                  { id: 'dark', icon: Moon, label: t('dark_mode') },
                  { id: 'system', icon: Globe, label: t('system_mode') },
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
                      <span className="text-[9px] font-black uppercase tracking-widest">
                        {m.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Admin Console Notifications */}
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
                Admin console alerts (new orders, waiter calls)
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-foreground uppercase tracking-wider">
                {t('notification_sound')}
              </span>
              <Toggle
                enabled={adminSoundEnabled}
                onChange={setAdminSoundEnabled}
              />
            </div>

            <div
              className={`space-y-4 transition-all duration-300 ${adminSoundEnabled ? 'opacity-100' : 'opacity-30 grayscale pointer-events-none'}`}
            >
              <VolumeRow
                label={t('notification_volume')}
                volume={adminVolume}
                onChange={setAdminVolume}
              />
              <button
                onClick={handleTestAdminSound}
                className="group flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-foreground transition hover:bg-muted/50 active:scale-95"
              >
                <Play className="h-3 w-3 transition-transform group-hover:scale-125" />
                {t('test_sound')}
              </button>
            </div>
          </div>
        </div>

        {/* KDS Notification Settings */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-orange-500/20">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
              <ChefHat className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <h3 className="font-display text-sm uppercase tracking-widest text-foreground">
                {t('kds_title')} Alerts
              </h3>
              <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mt-0.5">
                {t('active_kds_desc')}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-foreground uppercase tracking-wider">
                {t('notification_sound')}
              </span>
              <Toggle
                enabled={kdsSoundEnabled}
                onChange={setKdsSoundEnabled}
                color="bg-orange-500"
              />
            </div>

            <div
              className={`space-y-4 transition-all duration-300 ${kdsSoundEnabled ? 'opacity-100' : 'opacity-30 grayscale pointer-events-none'}`}
            >
              <VolumeRow
                label={t('notification_volume')}
                volume={kdsVolume}
                onChange={setKdsVolume}
              />
            </div>
          </div>
        </div>

        {/* Display Preferences */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-blue-500/20">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
              <Layout className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-display text-sm uppercase tracking-widest text-foreground">
                {t('display_preferences')}
              </h3>
              <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mt-0.5">
                Fine-tune the layout and content density
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Show Descriptions */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-foreground uppercase tracking-wider">
                  {t('show_descriptions')}
                </span>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Show item descriptions in the menu items list
                </p>
              </div>
              <Toggle
                enabled={showDescriptions}
                onChange={setShowDescriptions}
                color="bg-blue-500"
              />
            </div>
          </div>
        </div>

        {/* QR Code Preferences */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-violet-500/20">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
              <QrCode className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <h3 className="font-display text-sm uppercase tracking-widest text-foreground">
                {t('scan_qr_title')}
              </h3>
              <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mt-0.5">
                Manage how your table QR codes are generated
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {t('title_download_qr')} Resolution
            </label>
            <div className="flex gap-2">
              {[
                { id: 'Small', label: '300px' },
                { id: 'Medium', label: '500px' },
                { id: 'Large', label: '800px' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setQrSize(s.id)}
                  className={`flex-1 rounded-xl border px-3 py-3 text-[10px] font-black uppercase transition-all tracking-widest ${
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
        </div>

        {/* System */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/20">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <HardDrive className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-display text-sm uppercase tracking-widest text-foreground">
                {t('system_info')}
              </h3>
              <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mt-0.5">
                {t('diagnostics_desc')}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-foreground">
                  {t('app_version')}
                </span>
              </div>
              <span className="text-[10px] font-black text-muted-foreground uppercase">
                v
                {typeof __APP_VERSION__ !== 'undefined'
                  ? __APP_VERSION__
                  : '1.0.0'}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-emerald-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-foreground">
                  {t('api_health')}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  className={`h-1.5 w-1.5 rounded-full animate-pulse ${isApiHealthy ? 'bg-emerald-500' : 'bg-destructive'}`}
                />
                <span
                  className={`text-[10px] font-black uppercase tracking-widest ${isApiHealthy ? 'text-emerald-500' : 'text-destructive'}`}
                >
                  {isApiHealthy
                    ? t('optimal_status')
                    : t('unstable_connection')}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowConfirm(true)}
              disabled={isClearing}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 py-3 text-[10px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/10 transition-all disabled:opacity-50"
            >
              <HardDrive className="h-3 w-3" />
              {t('clear_cache')}
            </button>
          </div>
        </div>
      </div>

      <ConfirmationModal
        open={showConfirm}
        busy={isClearing}
        title={t('clear_cache')}
        description={t('privacy_clear_confirm')}
        confirmLabel={t('clear_cache')}
        onConfirm={handleClearCache}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}
