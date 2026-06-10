import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useNavigate } from '@tanstack/react-router'
import { supabaseBrowser } from '@/integrations/supabase/client.browser'
import { useTranslation } from '@/lib/i18n'
import { playAdminAlert } from '@/lib/audio-utils'
import {
  sendDesktopNotification,
  updateTaskbarBadge,
} from '@/lib/desktop-utils'
import { getPendingOrderCount } from '@/server/admin.functions'
import type { WaiterCall } from '@/server/table.functions'

interface RealtimeProps {
  setCalls: (fn: (prev: WaiterCall[]) => WaiterCall[]) => void
  setPendingOrderCount: (n: number) => void
  setCallsOpen: (v: boolean) => void
  /** Current active waiter call count — for composite taskbar badge */
  activeWaiterCallCount: number
  /** Current pending order count — for composite taskbar badge */
  pendingOrderCount: number
}

export function useAdminRealtime({
  setCalls,
  setPendingOrderCount,
  setCallsOpen,
  activeWaiterCallCount,
  pendingOrderCount,
}: RealtimeProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const channelRef = useRef<ReturnType<typeof supabaseBrowser.channel> | null>(
    null,
  )

  const fetchInitialCount = async () => {
    try {
      const count = await getPendingOrderCount()
      setPendingOrderCount(count)
    } catch (err) {
      console.error('Failed to fetch pending count', err)
    }
  }

  // Update the taskbar badge whenever either count changes (orders + waiter calls)
  useEffect(() => {
    updateTaskbarBadge(pendingOrderCount + activeWaiterCallCount)
  }, [pendingOrderCount, activeWaiterCallCount])

  useEffect(() => {
    const channel = supabaseBrowser
      .channel('origin-realtime')
      // 1. Waiter Calls Changes
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waiter_calls' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newCall = payload.new as WaiterCall
            setCalls((prev) => {
              if (prev.find((c) => c.id === newCall.id)) return prev
              return [newCall, ...prev]
            })

            // Respect admin sound settings
            if (localStorage.getItem('admin_sound_enabled') !== 'false') {
              const vol =
                Number(localStorage.getItem('admin_sound_volume') || '30') / 100
              playAdminAlert(vol)
            }

            toast(
              t('waiter_calling_admin_toast').replace(
                '{tableLabel}',
                newCall.table_label ?? '',
              ),
              {
                duration: 8000,
                action: { label: t('view'), onClick: () => setCallsOpen(true) },
              },
            )

            // Native Desktop Notification — click opens Waiter Calls panel
            sendDesktopNotification(
              t('waiter_calling_admin_toast').replace(
                '{tableLabel}',
                newCall.table_label ?? '',
              ),
              undefined,
              'waiter',
            )
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as WaiterCall
            setCalls((prev) =>
              prev.map((c) => (c.id === updated.id ? updated : c)),
            )
          }
        },
      )
      // 2. Broadcasts for orders
      .on('broadcast', { event: 'new_order' }, (payload) => {
        const order = payload.payload as any
        if (!order?.id) return
        fetchInitialCount()
        playAdminAlert(
          localStorage.getItem('admin_sound_enabled') !== 'false'
            ? Number(localStorage.getItem('admin_sound_volume') || '30') / 100
            : 0,
        )
        window.dispatchEvent(new CustomEvent('reload-orders'))
        toast(
          t('new_order_toast').replace('{tableLabel}', order.table_label ?? ''),
          {
            duration: 10000,
            action: {
              label: t('view_orders'),
              onClick: () =>
                navigate({
                  to: '/admin',
                  search: { tab: 'orders' } as any,
                  replace: true,
                }),
            },
          },
        )

        // Native Desktop Notification — click opens Orders tab
        sendDesktopNotification(
          t('new_order_toast').replace('{tableLabel}', order.table_label ?? ''),
          order.total_amount ? `${t('total')}: ${order.total_amount} ETB` : '',
          'order',
        )
      })
      .on('broadcast', { event: 'order_status_updated' }, (payload) => {
        const order = payload.payload as any
        if (!order?.id) return
        fetchInitialCount()
        window.dispatchEvent(new CustomEvent('reload-orders'))
      })
      // 3. Simple Broadcasts for acknowledgments
      .on('broadcast', { event: 'call_acknowledged' }, (payload) => {
        const { id } = payload.payload
        setCalls((prev) =>
          prev.map((c) => (c.id === id ? { ...c, status: 'acknowledged' } : c)),
        )
      })
      .on('broadcast', { event: 'call_rejected' }, (payload) => {
        const { id } = payload.payload
        setCalls((prev) =>
          prev.map((c) => (c.id === id ? { ...c, status: 'rejected' } : c)),
        )
      })
      // 4. Menu Availability changes (postgres) for real-time 86'd list
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items' },
        () => {
          window.dispatchEvent(new CustomEvent('reload-menu'))
        },
      )
      .subscribe()

    channelRef.current = channel
    fetchInitialCount()

    return () => {
      supabaseBrowser.removeChannel(channel)
    }
  }, [navigate, setCalls, setPendingOrderCount, setCallsOpen, t])
}
