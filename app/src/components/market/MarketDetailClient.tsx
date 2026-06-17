'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Clock, TrendingUp, Users, ExternalLink,
  Trophy, Loader2, Wallet, Share2,
} from 'lucide-react'
import { createWalletClient, custom, parseUnits } from 'viem'
import { celo } from 'viem/chains'
import { useAccount, useWalletClient } from 'wagmi'
import { ProbabilityBar } from './ProbabilityBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { participateMarket, getUserParticipation, markParticipationClaimed } from '@/actions/market.actions'
import { TOKENS, PREDIKTA_ABI, CONTRACT_ADDRESS, uuidToBytes32 } from '@/lib/contracts/predikta'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Market } from '@/types'


const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function' as const,
    inputs: [
      { name: 'spender', type: 'address' as const },
      { name: 'amount',  type: 'uint256' as const },
    ],
    outputs: [{ type: 'bool' as const }],
    stateMutability: 'nonpayable' as const,
  },
  {
    name: 'allowance',
    type: 'function' as const,
    inputs: [
      { name: 'owner',   type: 'address' as const },
      { name: 'spender', type: 'address' as const },
    ],
    outputs: [{ type: 'uint256' as const }],
    stateMutability: 'view' as const,
  },
] as const

const CATEGORY_LABELS: Record<string, string> = {
  deportes:      '⚽ Deportes',
  comunidad:     '🏘️ Comunidad',
  clima:         '🌤️ Clima',
  educacion:     '📚 Educación',
  tecnologia:    '💻 Tecnología',
  politica_local:'🏛️ Política Local',
  otros:         '✨ Otros',
}

const SOURCE_LABELS: Record<string, string> = {
  deportivo:    '📊 Resultado deportivo',
  fuente_publica: '📰 Fuente pública',
  meteorologico: '🌦️ Meteorológico',
  institucional: '🏛️ Institucional',
  organizador:   '👤 Organizador',
  comunitario:   '🤝 Verificación comunitaria',
}

function formatTimeLeft(closeDate: string): string {
  const diff = new Date(closeDate).getTime() - Date.now()
  if (diff <= 0) return 'Cerrado'
  const totalMinutes = Math.floor(diff / 60_000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function useTimeLeft(closeDate: string) {
  const [label, setLabel] = useState(() => formatTimeLeft(closeDate))
  useEffect(() => {
    const id = setInterval(() => setLabel(formatTimeLeft(closeDate)), 30_000)
    return () => clearInterval(id)
  }, [closeDate])
  return label
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

interface Props {
  market: Market
}

export function MarketDetailClient({ market }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const timeLeft = useTimeLeft(market.close_date)

  const { address: wagmiAddress, isConnected: wagmiConnected, isConnecting } = useAccount()
  const { data: wagmiWalletClient } = useWalletClient()

  const [miniPayAddress, setMiniPayAddress] = useState<`0x${string}` | null>(null)

  // Fallback directo a window.ethereum para MiniPay
  useEffect(() => {
    if (wagmiAddress) return
    if (typeof window === 'undefined' || !window.ethereum) return
    const load = async () => {
      try {
        const accounts = await window.ethereum!.request({ method: 'eth_requestAccounts' }) as string[]
        if (accounts[0]) setMiniPayAddress(accounts[0].toLowerCase() as `0x${string}`)
      } catch { /* silencioso */ }
    }
    load()
  }, [wagmiAddress])

  const address    = wagmiAddress ?? miniPayAddress ?? undefined
  const isConnected = wagmiConnected || !!miniPayAddress

  // Si Wagmi no tiene walletClient, crear uno desde window.ethereum
  function getClient() {
    if (wagmiWalletClient) return wagmiWalletClient
    if (typeof window === 'undefined' || !window.ethereum) return null
    return createWalletClient({
      account: address,
      chain: celo,
      transport: custom(window.ethereum),
    })
  }

  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [amount, setAmount]                     = useState('')
  const [isBetting, setIsBetting]               = useState(false)
  const [isClaiming, setIsClaiming]             = useState(false)

  // Participation del usuario en este mercado
  const [userParticipation, setUserParticipation] = useState<{
    id: string; option_id: string; amount: number; status: string; token: string
  } | null>(null)

  useEffect(() => {
    if (!address) return
    getUserParticipation(market.id, address).then(({ data }) => setUserParticipation(data))
  }, [address, market.id])

  const [liveMarket, setLiveMarket] = useState(market)
  const [liveOptions, setLiveOptions] = useState(market.options ?? [])

  useEffect(() => {
    const supabase = createSupabaseClient()

    const channel = supabase
      .channel(`market-${market.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'markets',
        filter: `id=eq.${market.id}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, (payload: any) => {
        setLiveMarket(prev => ({ ...prev, ...payload.new }))
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'options',
        filter: `market_id=eq.${market.id}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, (payload: any) => {
        setLiveOptions(prev =>
          prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o)
        )
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [market.id])

  const options    = liveOptions
  const isActive   = liveMarket.status === 'active' || liveMarket.status === 'approved'
  const isResolved = liveMarket.status === 'resolved'
  const winningOption = isResolved
    ? options.find(o => o.id === liveMarket.resolved_option_id)
    : null

  async function handleBet() {
    const parsedAmount = parseFloat(amount)
    if (!parsedAmount || parsedAmount <= 0) { toast.error('Ingresá un monto válido'); return }
    if (!selectedOptionId)                  { toast.error('Seleccioná una opción'); return }
    if (!CONTRACT_ADDRESS)                  { toast.error('Contrato no desplegado todavía'); return }
    const client = getClient()
    if (!client || !address)                { toast.error('Wallet no conectada'); return }

    const option       = options.find(o => o.id === selectedOptionId)!
    const tokenAddress = TOKENS[market.token]
    const decimals     = market.token === 'USDm' ? 18 : 6
    const amountBigInt = parseUnits(amount, decimals)
    const bytes32Id    = uuidToBytes32(market.id)

    setIsBetting(true)
    try {
      toast.loading('Aprobando tokens...', { id: 'bet' })
      await client.writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESS, amountBigInt],
        account: address,
      })

      toast.loading('Enviando participación...', { id: 'bet' })
      const txHash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        abi: PREDIKTA_ABI,
        functionName: 'placeBet',
        args: [bytes32Id, option.position_index, amountBigInt],
        account: address,
      })

      toast.loading('Confirmando...', { id: 'bet' })
      startTransition(async () => {
        const result = await participateMarket({
          marketId: market.id,
          optionId: selectedOptionId,
          amount: parsedAmount,
          txHash,
          walletAddress: address,
          token: market.token,
        })
        if (result.error) {
          toast.error(result.error, { id: 'bet' })
        } else {
          toast.success(`¡Participaste con ${amount} ${market.token} en "${option.label}"!`, { id: 'bet' })
          setSelectedOptionId(null)
          setAmount('')
        }
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast.error(msg.includes('User rejected') ? 'Transacción cancelada' : msg, { id: 'bet' })
    } finally {
      setIsBetting(false)
    }
  }

  async function handleClaim() {
    if (!CONTRACT_ADDRESS)         { toast.error('Contrato no desplegado todavía'); return }
    const client = getClient()
    if (!client || !address)       { toast.error('Wallet no conectada'); return }

    setIsClaiming(true)
    try {
      toast.loading('Reclamando ganancias...', { id: 'claim' })
      await client.writeContract({
        address: CONTRACT_ADDRESS,
        abi: PREDIKTA_ABI,
        functionName: 'claimWinnings',
        args: [uuidToBytes32(market.id)],
        account: address,
      })
      await markParticipationClaimed(market.id, address)
      setUserParticipation(prev => prev ? { ...prev, status: 'claimed' } : prev)
      toast.success('¡Ganancias reclamadas!', { id: 'claim' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast.error(msg.includes('User rejected') ? 'Transacción cancelada' : msg, { id: 'claim' })
    } finally {
      setIsClaiming(false)
    }
  }

  const selectedOption = options.find(o => o.id === selectedOptionId)
  const showBetPanel = isActive && isConnected && selectedOptionId !== null

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0A0A0F]/90 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white/70" />
        </button>
        <span className="text-sm font-medium text-white/70 truncate flex-1">{market.title}</span>
        <button
          onClick={() => {
            const url = `${window.location.origin}/market/${market.id}`
            if (navigator.share) {
              navigator.share({ title: market.title, url })
            } else {
              navigator.clipboard.writeText(url)
              toast.success('Link copiado')
            }
          }}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
        >
          <Share2 className="w-4 h-4 text-white/60" />
        </button>
        <Badge variant="secondary" className="text-xs bg-white/10 text-white/60 border-0 shrink-0">
          {CATEGORY_LABELS[market.category]}
        </Badge>
      </div>

      <div className="px-4 pt-5 space-y-5">
        {/* Título y descripción */}
        <div>
          {market.is_featured && (
            <span className="text-xs font-semibold text-violet-400 mb-1 block">⭐ DESTACADO</span>
          )}
          <h1 className="text-xl font-bold text-white leading-snug">{market.title}</h1>
          {market.description && (
            <p className="text-sm text-white/50 mt-2 leading-relaxed">{market.description}</p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-white/5 border border-white/8 p-3 text-center">
            <TrendingUp className="w-4 h-4 text-violet-400 mx-auto mb-1" />
            <p className="text-base font-bold text-white">{liveMarket.pool_total.toFixed(0)}</p>
            <p className="text-[10px] text-white/40">{market.token}</p>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/8 p-3 text-center">
            <Clock className="w-4 h-4 text-amber-400 mx-auto mb-1" />
            <p className="text-sm font-bold text-white">{timeLeft}</p>
            <p className="text-[10px] text-white/40">{formatDate(market.close_date)}</p>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/8 p-3 text-center">
            <Users className="w-4 h-4 text-blue-400 mx-auto mb-1" />
            <p className="text-base font-bold text-white">
              {options.reduce((acc, o) => acc + (o.total_staked > 0 ? 1 : 0), 0)}
            </p>
            <p className="text-[10px] text-white/40">participantes</p>
          </div>
        </div>

        {/* Resolución — banner si está resuelto */}
        <AnimatePresence>
          {isResolved && winningOption && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  Mercado resuelto
                </span>
              </div>
              <p className="text-white font-semibold">Ganó: {winningOption.label}</p>
              {market.resolution_date && (
                <p className="text-xs text-white/40 mt-1">
                  Resuelto el {formatDate(market.resolution_date)}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Opciones */}
        <div>
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
            Opciones
          </h2>
          <ProbabilityBar
            options={options}
            selectedOptionId={selectedOptionId ?? undefined}
            onSelect={isActive ? setSelectedOptionId : undefined}
            disabled={!isActive}
          />
          {isActive && !selectedOptionId && isConnected && (
            <p className="text-xs text-white/30 text-center mt-3">
              Tocá una opción para participar
            </p>
          )}
          {isActive && !isConnected && !isConnecting && (
            <div className="mt-3 rounded-xl bg-white/5 border border-white/10 p-3 flex items-center gap-2 text-white/40">
              <Wallet className="w-4 h-4 shrink-0" />
              <p className="text-xs">Abrí esta app en MiniPay para participar</p>
            </div>
          )}
          {isConnecting && (
            <div className="mt-3 rounded-xl bg-white/5 border border-white/10 p-3 flex items-center gap-2 text-white/40">
              <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
              <p className="text-xs">Conectando wallet...</p>
            </div>
          )}
        </div>

        {/* Panel de apuesta */}
        <AnimatePresence>
          {showBetPanel && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">
                  Participar en: <span className="text-violet-300">{selectedOption?.label}</span>
                </p>
                <button
                  onClick={() => setSelectedOptionId(null)}
                  className="text-white/30 hover:text-white/60 text-lg leading-none"
                >
                  ×
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-white/50">Monto ({market.token})</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-violet-500 text-lg font-semibold"
                    min="0"
                    step="0.1"
                  />
                  <div className="flex gap-1">
                    {['1', '5', '10'].map((v) => (
                      <button
                        key={v}
                        onClick={() => setAmount(v)}
                        className={cn(
                          'px-3 py-2 rounded-lg text-xs font-semibold border transition-all',
                          amount === v
                            ? 'bg-violet-600 border-violet-500 text-white'
                            : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'
                        )}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <Button
                onClick={handleBet}
                disabled={isBetting || isPending || !amount}
                className="w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-semibold h-12 rounded-xl"
              >
                {isBetting || isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Procesando...</>
                ) : (
                  `Participar${amount ? ` con ${amount} ${market.token}` : ''}`
                )}
              </Button>

              <p className="text-[10px] text-white/30 text-center">
                Se solicitarán 2 transacciones: aprobación + participación
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Botón de reclamo — solo para ganadores que no reclamaron */}
        {isResolved && userParticipation?.status === 'won' && (
          <Button
            onClick={handleClaim}
            disabled={isClaiming}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold h-12 rounded-xl"
          >
            {isClaiming ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Reclamando...</>
            ) : (
              <><Trophy className="w-4 h-4 mr-2" /> Reclamar mis ganancias</>
            )}
          </Button>
        )}
        {isResolved && userParticipation?.status === 'claimed' && (
          <div className="w-full rounded-xl bg-emerald-500/10 border border-emerald-500/20 h-12 flex items-center justify-center gap-2">
            <Trophy className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-emerald-400 font-medium">Ganancias ya reclamadas</span>
          </div>
        )}
        {isResolved && userParticipation?.status === 'lost' && (
          <div className="w-full rounded-xl bg-white/5 border border-white/8 h-12 flex items-center justify-center">
            <span className="text-sm text-white/40">No ganaste esta vez — ¡seguí intentando!</span>
          </div>
        )}

        {/* Info de verificación */}
        <div className="rounded-xl bg-white/3 border border-white/8 p-3 space-y-2">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Verificación</p>
          <p className="text-sm text-white/60">{SOURCE_LABELS[market.resolution_source]}</p>
          {market.resolution_source_url && (
            <a
              href={market.resolution_source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300"
            >
              <ExternalLink className="w-3 h-3" />
              Ver fuente
            </a>
          )}
        </div>

        {/* Creador */}
        {market.creator && (
          <div className="flex items-center gap-3 rounded-xl bg-white/3 border border-white/8 p-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-white text-sm font-bold">
              {(market.creator.username ?? 'A')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/40">Creado por</p>
              <p className="text-sm text-white font-medium truncate">
                {market.creator.username ?? 'Anónimo'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/40">Trust Score</p>
              <p className="text-sm font-bold text-violet-400">{market.creator.trust_score}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
