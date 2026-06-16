'use client'

import Link from 'next/link'
import { Bell } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getUnreadCount } from '@/actions/user.actions'
import { createClient } from '@/lib/supabase/client'

export function HomeHeader() {
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    const eth = (window as unknown as { ethereum?: { selectedAddress?: string } }).ethereum
    const wallet = eth?.selectedAddress
    if (!wallet) return

    getUnreadCount(wallet).then(setUnread)

    const supabase = createClient()
    const channel = supabase
      .channel('home-notif-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        getUnreadCount(wallet).then(setUnread)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Predikta <span className="text-violet-400">🔮</span>
        </h1>
        <p className="text-sm text-white/40 mt-0.5">¿Qué va a pasar?</p>
      </div>

      <Link href="/notifications" className="relative p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
        <Bell className="w-5 h-5 text-white/60" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-violet-500 text-white text-[10px] font-bold flex items-center justify-center px-0.5">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Link>
    </div>
  )
}
