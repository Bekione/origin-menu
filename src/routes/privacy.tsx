import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useTranslation } from '#/lib/i18n'
import {
  ShieldCheck,
  Database,
  Trash2,
  ChevronLeft,
  ExternalLink,
  Smartphone,
  Stamp,
} from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmationModal } from '@/components/ui/ConfirmationModal'

export const Route = createFileRoute('/privacy')({
  component: PrivacyPage,
})

function PrivacyPage() {
  const { t } = useTranslation()
  const [isClearing, setIsClearing] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleClearData = async () => {
    setIsClearing(true)
    // Simulate slight delay for professional feel
    await new Promise((r) => setTimeout(r, 800))
    localStorage.clear()
    toast.success(
      t('privacy_cleared_success') || 'All local data has been cleared.',
    )
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        {/* Back Button */}
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
          {t('back_to_menu')}
        </Link>

        {/* Header */}
        <div className="mb-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="font-display text-4xl tracking-tight text-foreground">
            {t('privacy_title') || 'Privacy & Terms'}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t('privacy_subtitle') || 'Last updated: June 10, 2026'}
          </p>
        </div>

        <div className="space-y-8 leading-relaxed text-muted-foreground">
          {/* Section: Data Collection */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3 text-foreground">
              <Smartphone className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl">
                {t('privacy_data_title') || 'What We Collect'}
              </h2>
            </div>
            <p className="text-sm">
              {t('privacy_data_desc') ||
                'We value your privacy. We do not collect personal information like your name, email, or phone number unless you explicitly provide it (e.g., during feedback).'}
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex gap-3">
                <div className="h-5 w-5 shrink-0 rounded-full bg-primary/20 p-1 text-primary">
                  <div className="h-full w-full rounded-full bg-current" />
                </div>
                <span>
                  <strong>
                    {t('privacy_device_id') || 'Anonymous Device ID'}:
                  </strong>{' '}
                  {t('privacy_device_id_desc') ||
                    'We use a locally stored identifier to remember your loyalty stamps and favorite dishes.'}
                </span>
              </li>
              <li className="flex gap-3">
                <div className="h-5 w-5 shrink-0 rounded-full bg-primary/20 p-1 text-primary">
                  <div className="h-full w-full rounded-full bg-current" />
                </div>
                <span>
                  <strong>{t('privacy_orders') || 'Order History'}:</strong>{' '}
                  {t('privacy_orders_desc') ||
                    'Your past order items are stored locally to suggest "Your Favorites" and provide a better experience.'}
                </span>
              </li>
            </ul>
          </section>

          {/* Section: Loyalty Program */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3 text-foreground">
              <Stamp className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl">
                {t('privacy_loyalty_title') || 'Digital Loyalty Stamps'}
              </h2>
            </div>
            <p className="text-sm">
              {t('privacy_loyalty_desc') ||
                'Our digital stamp card system uses your anonymous Device ID to track your progress. Stamps are not transferable and have no cash value. Once a reward is redeemed, it is removed from your balance.'}
            </p>
          </section>

          {/* Section: Third Parties */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3 text-foreground">
              <ExternalLink className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl">
                {t('privacy_third_party_title') || 'Third-Party Services'}
              </h2>
            </div>
            <p className="text-sm">
              {t('privacy_third_party_desc') ||
                'We use Supabase for secure data storage and real-time order updates. Your data is protected by industry-standard encryption.'}
            </p>
          </section>

          {/* Section: User Control */}
          <section className="rounded-2xl border border-primary/20 bg-primary/5 p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3 text-foreground">
              <Database className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl">
                {t('privacy_control_title') || 'Your Control'}
              </h2>
            </div>
            <p className="mb-6 text-sm">
              {t('privacy_control_desc') ||
                'Because we store most data locally on your device, you have full control over it. You can clear all your data at any time.'}
            </p>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={isClearing}
              className="flex items-center gap-2 rounded-xl bg-destructive px-4 py-2.5 text-sm font-bold text-destructive-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {t('privacy_clear_button') || 'Clear All My Data'}
            </button>
            <p className="mt-4 text-[10px] text-muted-foreground italic">
              {t('privacy_clear_warning') ||
                '*Warning: This action cannot be undone. You will lose all your loyalty stamps and favorite dishes history.'}
            </p>
          </section>

          <footer className="pt-12 text-center text-xs text-muted-foreground">
            <p className="mb-2">
              © {new Date().getFullYear()} {t('privacy_copyright')}
            </p>
            <div className="flex justify-center gap-4">
              <Link to="/" className="hover:text-primary">
                {t('menu_link')}
              </Link>
              <a
                href="https://kidusportfoloio.netlify.app/"
                target="_blank"
                className="hover:text-primary"
              >
                {t('support_link')}
              </a>
            </div>
          </footer>
        </div>
      </div>

      <ConfirmationModal
        open={showConfirm}
        busy={isClearing}
        title={t('privacy_clear_button')}
        description={t('privacy_clear_confirm')}
        confirmLabel={t('privacy_clear_button')}
        onConfirm={handleClearData}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}
