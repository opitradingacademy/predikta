'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, TrendingUp, Zap } from 'lucide-react'
import { getRanking, getUserRankPosition } from '@/actions/user.actions'
import { Skeleton } from '@/components/ui/skeleton'
import type { Ranking, RankingPeriod } from '@/types'

const PERIODS: { key: RankingPeriod; label: string }[] = [
  { key: 'weekly',   label: 'Semana' },
  { key: 'monthly',  label: 'Mes' },
  { key: 'all_time', label: 'Total' },
]

const LEVEL_COLORS: Record<string, string> = {
  nuevo:      'text-white/40',
  verificado: 'text-blue-400',
  premium:    'text-violet-400',
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default function RankingPage() {
  const [period, setPeriod]   = useState<RankingPeriod>('all_time')
  const [ranking, setRanking] = useState<Ranking[]>([])
  const [myPos, setMyPos]     = useState<{ rank_position: number; total_earnings: number; win_rate: number } | null>(null)
  const [loading, setLoading] = useState(true)

  const wallet = typeof window !== 'undefined'
    ? (window as unknown as { ethereum?: { selectedAddress?: string } }).ethereum?.selectedAddress ?? ''
    : ''

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getRanking(period),
      wallet ? getUserRankPosition(wallet, period) : Promise.resolve({ data: null }),
    ]).then(([rankRes, myRes]) => {
      setRanking((rankRes.data ?? []) as Ranking[])
      setMyPos(myRes.data as typeof myPos)
    }).finally(() => setLoading(false))
  }, [period, wallet])

  return (
    <div className="px-4 pt-6 pb-4 space-y-5">
      {/* Título */}
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-yellow-400" />
        <h1 className="text-lg font-bold text-white">Ranking</h1>
      </div>

      {/* Selector de período */}
      <div className="flex gap-2 bg-white/5 rounded-xl p-1">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${
              period === p.key
                ? 'bg-violet-600 text-white'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Tu posición */}
      {myPos && (
        <div className="rounded-2xl bg-gradient-to-r from-violet-600/20 to-blue-600/20 border border-violet-500/30 p-4">
          <p className="text-xs text-white/50 mb-1">Tu posición</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-white">#{myPos.rank_position}</span>
              <div>
                <p className="text-sm text-white font-semibold">{myPos.total_earnings.toFixed(2)} USDm</p>
                <p className="text-xs text-white/40">{Math.round(myPos.win_rate * 100)}% aciertos</p>
              </div>
            </div>
            <Zap className="w-5 h-5 text-yellow-400" />
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : ranking.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Todavía no hay datos para este período.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {ranking.map((entry, i) => {
            const u = entry.user as (typeof entry.user & { wallet_address?: string }) | undefined
            const isMe = wallet && u?.wallet_address?.toLowerCase() === wallet.toLowerCase()
            const pos = entry.rank_position

            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                  isMe
                    ? 'bg-violet-600/10 border-violet-500/40'
                    : 'bg-white/5 border-white/8'
                }`}
              >
                {/* Posición */}
                <div className="w-8 text-center shrink-0">
                  {MEDAL[pos] ? (
                    <span className="text-xl">{MEDAL[pos]}</span>
                  ) : (
                    <span className="text-sm font-bold text-white/40">#{pos}</span>
                  )}
                </div>

                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                  {u?.username?.[0]?.toUpperCase() ?? '?'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {u?.username ?? `${u?.wallet_address?.slice(0, 6)}…${u?.wallet_address?.slice(-4)}`}
                    {isMe && <span className="ml-1.5 text-[10px] text-violet-400 font-normal">vos</span>}
                  </p>
                  <p className={`text-[10px] ${LEVEL_COLORS[u?.level ?? 'nuevo']}`}>
                    {u?.level === 'verificado' ? 'Creador Verificado' : u?.level === 'premium' ? 'Creador Premium' : 'Nuevo Usuario'}
                  </p>
                </div>

                {/* Stats */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-white">{entry.total_earnings.toFixed(1)}</p>
                  <p className="text-[10px] text-white/40">{Math.round(entry.win_rate * 100)}% win</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
