import { Settings, Bell, Printer, Globe } from 'lucide-react'

/**
 * SettingsTab — placeholder for future app-level settings.
 * Planned content: language preference, notification sounds, receipt/printer config.
 */
export function SettingsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl uppercase tracking-wider text-foreground">
          Settings
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          App configuration — coming soon.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          {
            icon: Globe,
            label: 'Language & Localization',
            desc: 'Set default app language and locale.',
          },
          {
            icon: Bell,
            label: 'Notifications',
            desc: 'Configure alert sounds for new orders.',
          },
          {
            icon: Printer,
            label: 'Receipt Printer',
            desc: 'Connect and configure receipt printer.',
          },
          {
            icon: Settings,
            label: 'Advanced',
            desc: 'Developer and debug options.',
          },
        ].map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="flex items-start gap-4 rounded-xl border border-border bg-card p-5 opacity-60 cursor-not-allowed"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
