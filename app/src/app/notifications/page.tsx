'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Bell } from 'lucide-react'
import { getNotifications, markNotificationsRead } from '@/actions/user.actions'
import { Skeleton } from '@/components/ui/skeleton'
import type { Notification } from '@/types'

const ICONS: Record<string, string> = {
  market_approved:      '✅',
  market_rejected:      '❌',
  market_resolved:      '🏁',
  participation_won:    '🏆',
  participation_lost:   '😔',
  trust_score_changed:  '⚡',
  badge_earned:         '🎖️',
  report_confirmed:     '🚨',
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const wallet = typeof window !== 'undefined'
    ? (window as unknown as { ethereum?: { selectedAddress?: string } }).ethereum?.selectedAddress ?? ''
    : ''

  useEffect(() => {
    if (!wallet) { setLoading(false); return }

    getNotifications(wallet)
      .then(({ data }) => setNotifications(data as Notification[]))
      .finally(() => setLoading(false))

    // Marcar como leídas al abrir
    markNotificationsRead(wallet)
  }, [wallet])

  return (
    <div className="px-4 pt-6 space-y-5 pb-4">
      <div className="flex items-center gap-2">
        <Bell className="w-5 h-5 text-violet-400" />
        <h1 className="text-lg font-bold text-white">Notificaciones</h1>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sin notificaciones todavía.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`flex items-start gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                n.is_read ? 'bg-white/3 border-white/5' : 'bg-violet-600/10 border-violet-500/30'
              }`}
            >
              <span className="text-xl shrink-0 mt-0.5">{ICONS[n.type] ?? '🔔'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{n.title}</p>
                <p className="text-xs text-white/50 mt-0.5">{n.body}</p>
                <p className="text-[10px] text-white/25 mt-1">
                  {new Date(n.created_at).toLocaleDateString('es-AR', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
              {!n.is_read && (
                <div className="w-2 h-2 rounded-full bg-violet-400 shrink-0 mt-1.5" />
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
