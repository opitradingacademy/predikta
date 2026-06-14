'use client'

import { useEffect, useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, CheckCircle2, XCircle, Gavel, TrendingUp, TrendingDown, Users, LayoutGrid, Clock } from 'lucide-react'
import { getMarkets, adminUpdateMarket, resolveMarket } from '@/actions/market.actions'
import { getAdminStats, adminAdjustTrustScore } from '@/actions/user.actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import type { Market } from '@/types'

type Tab = 'pending' | 'resolve' | 'trust'

export default function AdminPage() {
  const [tab, setTab]         = useState<Tab>('pending')
  const [stats, setStats]     = useState<{ pendingMarkets: number; totalMarkets: number; totalUsers: number } | null>(null)
  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  // Trust score form
  const [tsWallet, setTsWallet] = useState('')
  const [tsDelta,  setTsDelta]  = useState('')
  const [tsReason, setTsReason] = useState('')

  // Resolve form state per market
  const [resolveSelections, setResolveSelections] = useState<Record<string, string>>({})

  function load() {
    setLoading(true)
    const status = tab === 'pending' ? 'pending' : 'approved'
    Promise.all([
      getAdminStats(),
      getMarkets({ status, limit: 30 }),
    ]).then(([s, m]) => {
      if (s.data) setStats(s.data)
      setMarkets((m.data ?? []) as Market[])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [tab])

  function handleApprove(marketId: string) {
    startTransition(async () => {
      const { error } = await adminUpdateMarket(marketId, 'approve')
      if (error) { toast.error(error); return }
      toast.success('Mercado aprobado')
      setMarkets(prev => prev.filter(m => m.id !== marketId))
    })
  }

  function handleReject(marketId: string) {
    startTransition(async () => {
      const { error } = await adminUpdateMarket(marketId, 'reject')
      if (error) { toast.error(error); return }
      toast.success('Mercado rechazado')
      setMarkets(prev => prev.filter(m => m.id !== marketId))
    })
  }

  function handleResolve(market: Market) {
    const winningOptionId = resolveSelections[market.id]
    if (!winningOptionId) { toast.error('Seleccioná la opción ganadora'); return }
    startTransition(async () => {
      const { error } = await resolveMarket(market.id, winningOptionId, 'admin')
      if (error) { toast.error(error); return }
      toast.success('Mercado resuelto')
      setMarkets(prev => prev.filter(m => m.id !== market.id))
    })
  }

  function handleTrustScore() {
    const delta = parseInt(tsDelta)
    if (!tsWallet || isNaN(delta) || !tsReason) { toast.error('Completá todos los campos'); return }
    startTransition(async () => {
      const { error } = await adminAdjustTrustScore(tsWallet, delta, tsReason)
      if (error) { toast.error(error); return }
      toast.success(`Trust Score ajustado: ${delta > 0 ? '+' : ''}${delta}`)
      setTsWallet(''); setTsDelta(''); setTsReason('')
    })
  }

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'pending', label: 'Pendientes', icon: <Clock className="w-3.5 h-3.5" /> },
    { key: 'resolve', label: 'Resolver',   icon: <Gavel className="w-3.5 h-3.5" /> },
    { key: 'trust',   label: 'Trust',      icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  ]

  return (
    <div className="px-4 pt-6 space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-violet-400" />
        <h1 className="text-lg font-bold text-white">Admin</h1>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Pendientes', value: stats.pendingMarkets, icon: <Clock className="w-4 h-4 text-yellow-400" /> },
            { label: 'Mercados',   value: stats.totalMarkets,   icon: <LayoutGrid className="w-4 h-4 text-blue-400" /> },
            { label: 'Usuarios',   value: stats.totalUsers,     icon: <Users className="w-4 h-4 text-violet-400" /> },
          ].map(s => (
            <div key={s.label} className="rounded-xl bg-white/5 border border-white/8 p-3 text-center">
              <div className="flex justify-center mb-1">{s.icon}</div>
              <p className="text-lg font-bold text-white">{s.value}</p>
              <p className="text-[10px] text-white/40">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
              tab === t.key ? 'bg-violet-600 text-white' : 'text-white/50 hover:text-white/80'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* PENDING */}
          {tab === 'pending' && (
            <div className="space-y-3">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl bg-white/5" />)
              ) : markets.length === 0 ? (
                <div className="text-center py-12 text-white/30">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sin mercados pendientes.</p>
                </div>
              ) : markets.map(m => (
                <div key={m.id} className="rounded-2xl bg-white/5 border border-white/8 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-white leading-snug">{m.title}</p>
                    <p className="text-xs text-white/40 mt-0.5 line-clamp-2">{m.description}</p>
                    {m.moderation_reason && (
                      <p className="text-xs text-yellow-400/80 mt-1">IA: {m.moderation_reason}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(m.id)}
                      disabled={isPending}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl h-9 text-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Aprobar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleReject(m.id)}
                      disabled={isPending}
                      className="flex-1 bg-red-700 hover:bg-red-600 text-white rounded-xl h-9 text-xs"
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Rechazar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* RESOLVE */}
          {tab === 'resolve' && (
            <div className="space-y-3">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl bg-white/5" />)
              ) : markets.length === 0 ? (
                <div className="text-center py-12 text-white/30">
                  <Gavel className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sin mercados para resolver.</p>
                </div>
              ) : markets.map(m => (
                <div key={m.id} className="rounded-2xl bg-white/5 border border-white/8 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-white leading-snug">{m.title}</p>
                    <p className="text-xs text-white/40 mt-0.5">Pool: {m.pool_total} {m.token}</p>
                  </div>
                  <div className="space-y-1.5">
                    {(m.options ?? []).map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setResolveSelections(prev => ({ ...prev, [m.id]: opt.id }))}
                        className={`w-full text-left px-3 py-2 rounded-xl text-sm border transition-all ${
                          resolveSelections[m.id] === opt.id
                            ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'
                            : 'bg-white/5 border-white/8 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        {opt.label} <span className="text-xs text-white/40 ml-1">({opt.probability}%)</span>
                      </button>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleResolve(m)}
                    disabled={isPending || !resolveSelections[m.id]}
                    className="w-full bg-violet-600 hover:bg-violet-500 text-white rounded-xl h-9 text-xs"
                  >
                    <Gavel className="w-3.5 h-3.5 mr-1" /> Resolver mercado
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* TRUST SCORE */}
          {tab === 'trust' && (
            <div className="rounded-2xl bg-white/5 border border-white/8 p-4 space-y-4">
              <p className="text-sm font-semibold text-white">Ajustar Trust Score</p>
              <div className="space-y-3">
                <Input
                  placeholder="Wallet address (0x...)"
                  value={tsWallet}
                  onChange={e => setTsWallet(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl text-sm"
                />
                <div className="flex gap-2">
                  <Input
                    placeholder="Delta (+10 / -25)"
                    value={tsDelta}
                    onChange={e => setTsDelta(e.target.value)}
                    type="number"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl text-sm"
                  />
                </div>
                <Input
                  placeholder="Razón (ej: mercado fraudulento)"
                  value={tsReason}
                  onChange={e => setTsReason(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => { setTsDelta(String(Math.abs(parseInt(tsDelta) || 10))); handleTrustScore() }}
                    disabled={isPending}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl h-10 text-sm"
                  >
                    <TrendingUp className="w-4 h-4 mr-1" /> Sumar
                  </Button>
                  <Button
                    onClick={() => { setTsDelta(String(-Math.abs(parseInt(tsDelta) || 10))); handleTrustScore() }}
                    disabled={isPending}
                    className="flex-1 bg-red-700 hover:bg-red-600 text-white rounded-xl h-10 text-sm"
                  >
                    <TrendingDown className="w-4 h-4 mr-1" /> Restar
                  </Button>
                </div>
              </div>

              {/* Referencia rápida */}
              <div className="rounded-xl bg-white/5 p-3 space-y-1">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Referencia</p>
                {[
                  ['+2', 'Aprobado'], ['+3', 'Resuelto exitoso'], ['+10', 'Verificado'],
                  ['-10', 'Rechazado'], ['-15', 'Reportado'], ['-25', 'Engañoso'], ['-100', 'Fraude'],
                ].map(([d, label]) => (
                  <button
                    key={d}
                    onClick={() => setTsDelta(d)}
                    className="w-full flex items-center justify-between px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <span className="text-xs text-white/60">{label}</span>
                    <span className={`text-xs font-mono font-bold ${d.startsWith('+') ? 'text-emerald-400' : 'text-red-400'}`}>{d}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
