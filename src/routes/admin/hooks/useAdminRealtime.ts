import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useNavigate } from '@tanstack/react-router'
import { supabaseBrowser } from '@/integrations/supabase/client.browser'
import { useTranslation } from '@/lib/i18n'
import { playAdminAlert } from '@/lib/audio-utils'
import type { WaiterCall } from '@/server/table.functions'

interface RealtimeProps {
  setCalls: (fn: (prev: WaiterCall[]) => WaiterCall[]) => void
  setPendingOrderCount: (
    fn: (n: number | ((n: number) => number)) => number,
  ) => void
  setCallsOpen: (v: boolean) => void
}

export function useAdminRealtime({
  setCalls,
  setPendingOrderCount,
  setCallsOpen,
}: RealtimeProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const channelRef = useRef<ReturnType<typeof supabaseBrowser.channel> | null>(
    null,
  )
  const ordersChannelRef = useRef<ReturnType<
    typeof supabaseBrowser.channel
  > | null>(null)

  useEffect(() => {
    const channel = supabaseBrowser
      .channel('admin-realtime')
      // 1. Waiter Calls INSERT
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'waiter_calls' },
        (payload) => {
          const newCall = payload.new as WaiterCall
          setCalls((prev) => [newCall, ...prev])
          playAdminAlert()
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
        },
      )
      // 2. Waiter Calls UPDATE
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'waiter_calls' },
        (payload) => {
          const updated = payload.new as WaiterCall
          setCalls((prev) =>
            prev.map((c) => (c.id === updated.id ? updated : c)),
          )
        },
      )
      // 3. Table Orders INSERT
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'table_orders' },
        (payload) => {
          const order = payload.new as any
          setPendingOrderCount((n: any) =>
            typeof n === 'function' ? n(0) + 1 : n + 1,
          )
          playAdminAlert()
          window.dispatchEvent(new CustomEvent('reload-orders'))
          toast(
            t('new_order_toast').replace('{tableLabel}', order.table_label),
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
        },
      )
      // 4. Table Orders UPDATE
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'table_orders' },
        (payload) => {
          const order = payload.new as any
          if (order.status !== 'pending') {
            setPendingOrderCount((n: any) =>
              typeof n === 'function'
                ? Math.max(0, n(0) - 1)
                : Math.max(0, n - 1),
            )
          }
          window.dispatchEvent(new CustomEvent('reload-orders'))
        },
      )
      .subscribe()

    channelRef.current = channel

    // 5. Broadcast channel for direct server-sent events
    const bc = supabaseBrowser
      .channel('admin-orders')
      .on('broadcast', { event: 'new_order' }, (payload) => {
        const order = payload.payload as any
        setPendingOrderCount((n: any) =>
          typeof n === 'function' ? n(0) + 1 : n + 1,
        )
        playAdminAlert()
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
      })
      .subscribe()

    ordersChannelRef.current = bc

    return () => {
      supabaseBrowser.removeChannel(channel)
      supabaseBrowser.removeChannel(bc)
    }
  }, [navigate, setCalls, setPendingOrderCount, setCallsOpen, t])
}
