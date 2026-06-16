'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Compass, PlusCircle, User, Trophy, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getUnreadCount } from '@/actions/user.actions'

const LINKS = [
  { href: '/',        label: 'Inicio',   icon: Home,       notif: false },
  { href: '/explore', label: 'Explorar', icon: Compass,    notif: false },
  { href: '/create',  label: 'Crear',    icon: PlusCircle, notif: false },
  { href: '/ranking', label: 'Ranking',  icon: Trophy,     notif: false },
  { href: '/profile', label: 'Perfil',   icon: User,       notif: false },
]

export function BottomNav() {
  const pathname  = usePathname()
  const [unread, setUnread] = useState(0)

  const wallet = typeof window !== 'undefined'
    ? (window as unknown as { ethereum?: { selectedAddress?: string } }).ethereum?.selectedAddress ?? ''
    : ''

  useEffect(() => {
    if (!wallet) return

    // Carga inicial
    getUnreadCount(wallet).then(setUnread)

    // Real-time: escucha inserts en notifications para este usuario
    const supabase = createClient()

    const channel = supabase
      .channel('notif-badge')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, (_payload: any) => {
        // Re-fetch count en lugar de parsear el payload (evita race con user_id)
        getUnreadCount(wallet).then(setUnread)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [wallet])

  // Al navegar a /notifications resetear el badge localmente
  useEffect(() => {
    if (pathname === '/notifications') setUnread(0)
  }, [pathname])

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#0A0A0F]/95 backdrop-blur-md">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2">
        {LINKS.map(({ href, label, icon: Icon, notif }) => {
          const isActive = pathname === href
          const isCreate = href === '/create'
          const showBadge = notif && unread > 0

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-200',
                isCreate
                  ? 'text-violet-400'
                  : isActive
                  ? 'text-white'
                  : 'text-white/40 hover:text-white/70'
              )}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    'transition-all duration-200',
                    isCreate ? 'w-7 h-7' : 'w-5 h-5',
                    isActive && !isCreate && 'text-violet-400'
                  )}
                />
                {showBadge && (
                  <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-violet-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
