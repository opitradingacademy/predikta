'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Clock, Users, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ProbabilityBar } from './ProbabilityBar'
import type { Market } from '@/types'
import { cn } from '@/lib/utils'

const CATEGORY_LABELS: Record<string, string> = {
  deportes: '⚽ Deportes',
  comunidad: '🏘️ Comunidad',
  clima: '🌤️ Clima',
  educacion: '📚 Educación',
  tecnologia: '💻 Tecnología',
  politica_local: '🏛️ Política Local',
  otros: '✨ Otros',
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

interface MarketCardProps {
  market: Market
  index?: number
}

export function MarketCard({ market, index = 0 }: MarketCardProps) {
  const options = market.options ?? []
  const participants = options.reduce((acc, o) => acc + (o.total_staked > 0 ? 1 : 0), 0)
  const timeLeft = useTimeLeft(market.close_date)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Link href={`/market/${market.id}`}>
        <div className={cn(
          'rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-4',
          'hover:border-white/20 hover:bg-white/8 transition-all duration-200',
          'cursor-pointer group'
        )}>
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex-1 min-w-0">
              {market.is_featured && (
                <span className="text-xs font-semibold text-violet-400 mb-1 block">⭐ DESTACADO</span>
              )}
              <h3 className="font-semibold text-white text-sm leading-snug line-clamp-2 group-hover:text-violet-200 transition-colors">
                {market.title}
              </h3>
            </div>
            <Badge variant="secondary" className="text-xs shrink-0 bg-white/10 text-white/60 border-0">
              {CATEGORY_LABELS[market.category]}
            </Badge>
          </div>

          {/* Probability bars */}
          {options.length > 0 && (
            <div className="mb-3">
              <ProbabilityBar options={options} disabled />
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-white/40">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {market.pool_total.toFixed(0)} {market.token}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {participants}
              </span>
            </div>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeLeft}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
