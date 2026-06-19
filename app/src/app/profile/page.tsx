'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUserProfile } from '@/actions/user.actions'
import { TrustScore } from '@/components/profile/TrustScore'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ShieldCheck } from 'lucide-react'
import type { User, UserBadge, Participation } from '@/types'

const ADMIN_WALLET = (process.env.NEXT_PUBLIC_TREASURY_ADDRESS ?? '').toLowerCase()

interface ProfileData {
  user: User
  badges: UserBadge[]
  participations: Participation[]
}

export default function ProfilePage() {
  const router = useRouter()
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [detectedWallet, setDetectedWallet] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const eth = (window as unknown as { ethereum?: { selectedAddress?: string; request?: (a: { method: string }) => Promise<string[]> } }).ethereum
      if (!eth) { setLoading(false); return }

      let wallet = eth.selectedAddress
      if (!wallet && eth.request) {
        try {
          const accounts = await eth.request({ method: 'eth_requestAccounts' }) as string[]
          wallet = accounts?.[0] ?? null
        } catch { /* ignore */ }
      }
      if (!wallet) { setLoading(false); return }

      setDetectedWallet(wallet)
      setIsAdmin(wallet.toLowerCase() === ADMIN_WALLET)
      getUserProfile(wallet)
        .then(({ data }) => {
          if (data) {
            setData(data as ProfileData)
            // También verificar desde Supabase como fallback
            const profileWallet = (data as ProfileData).user?.wallet_address?.toLowerCase()
            if (profileWallet === ADMIN_WALLET) setIsAdmin(true)
          }
        })
        .finally(() => setLoading(false))
    }
    init()
  }, [])

  if (loading) return (
    <div className="px-4 pt-6 space-y-4">
      <Skeleton className="h-24 rounded-2xl bg-white/5" />
      <Skeleton className="h-40 rounded-2xl bg-white/5" />
    </div>
  )

  if (!data) return (
    <div className="px-4 pt-16 text-center text-white/40 space-y-4">
      <div>
        <p className="text-4xl mb-2">👛</p>
        <p className="text-sm">Conectá tu wallet en MiniPay para ver tu perfil.</p>
        {detectedWallet && (
          <p className="text-[10px] font-mono mt-2 text-white/30 break-all">{detectedWallet}</p>
        )}
      </div>
      {isAdmin && (
        <button
          onClick={() => router.push('/admin')}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600/20 border border-violet-500/30 py-3 text-sm font-semibold text-violet-300 hover:bg-violet-600/30 transition-colors"
        >
          <ShieldCheck className="w-4 h-4" />
          Panel de administración
        </button>
      )}
    </div>
  )

  const { user, badges, participations } = data

  return (
    <div className="px-4 pt-6 space-y-5">
      {/* Avatar + stats */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center text-2xl font-bold text-white">
          {user.username?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div>
          <h2 className="font-bold text-white text-lg">{user.username ?? 'Usuario'}</h2>
          <p className="text-xs text-white/40 font-mono">{user.wallet_address.slice(0, 6)}…{user.wallet_address.slice(-4)}</p>
        </div>
      </div>

      {/* Trust Score */}
      <TrustScore score={user.trust_score} level={user.level} />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Ganados', value: user.total_markets_won },
          { label: 'Creados', value: user.total_markets_created },
          { label: 'USDm ganados', value: user.total_earnings.toFixed(0) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
            <p className="text-xl font-bold text-white">{s.value}</p>
            <p className="text-[10px] text-white/40 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Badges</h3>
          <div className="flex flex-wrap gap-2">
            {badges.map((ub) => (
              <div key={ub.id} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
                <span className="text-base">{ub.badge?.icon}</span>
                <span className="text-xs text-white/70">{ub.badge?.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}


      {(isAdmin || user.wallet_address.toLowerCase() === ADMIN_WALLET) && (
        <button
          onClick={() => router.push('/admin')}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600/20 border border-violet-500/30 py-3 text-sm font-semibold text-violet-300 hover:bg-violet-600/30 transition-colors"
        >
          <ShieldCheck className="w-4 h-4" />
          Panel de administración
        </button>
      )}
      {/* Recent participations */}
      {participations.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Últimas participaciones</h3>
          <div className="space-y-2">
            {participations.map((p) => (
              <div key={p.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                <div>
                  <p className="text-xs text-white/60 font-mono">{p.tx_hash.slice(0, 10)}…</p>
                  <p className="text-[10px] text-white/30">{new Date(p.created_at).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">{p.amount} {p.token}</p>
                  <p className={`text-[10px] font-medium ${p.status === 'won' ? 'text-emerald-400' :
                    p.status === 'lost' ? 'text-red-400' :
                      'text-white/40'
                    }`}>{p.status.toUpperCase()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}



      <Separator className="bg-white/10" />
      <p className="text-center text-xs text-white/20 pb-2">
        Predikta · MiniPay · Celo
      </p>
    </div>
  )
}
