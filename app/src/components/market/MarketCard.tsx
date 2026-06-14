'use client'

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

function timeLeft(closeDate: string): string {
  const diff = new Date(closeDate).getTime() - Date.now()
  if (diff <= 0) return 'Cerrado'
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 24) return `${hours}h restantes`
  return `${Math.floor(hours / 24)}d restantes`
}

interface MarketCardProps {
  market: Market
  index?: number
}

export function MarketCard({ market, index = 0 }: MarketCardProps) {
  const options = market.options ?? []
  const participants = options.reduce((acc, o) => acc + (o.total_staked > 0 ? 1 : 0), 0)

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
              {timeLeft(market.close_date)}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
