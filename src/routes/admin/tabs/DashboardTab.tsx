import { BarChart3, TrendingUp, Users, ShoppingBag } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

/**
 * DashboardTab — placeholder for future analytics overview.
 * Planned content: today's order count, revenue, most-ordered items, table occupancy.
 */
export function DashboardTab() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl uppercase tracking-wider text-foreground">
          Dashboard
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Analytics overview — coming soon.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: ShoppingBag, label: "Today's Orders", value: '—' },
          { icon: TrendingUp, label: 'Revenue (ETB)', value: '—' },
          { icon: Users, label: 'Active Tables', value: '—' },
          { icon: BarChart3, label: 'Top Item', value: '—' },
        ].map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                {label}
              </span>
            </div>
            <p className="font-display text-2xl font-bold text-foreground">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-border">
        <p className="text-sm text-muted-foreground">
          Charts and analytics will appear here.
        </p>
      </div>
    </div>
  )
}
