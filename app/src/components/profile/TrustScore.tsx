'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { UserLevel } from '@/types'

const LEVEL_CONFIG: Record<UserLevel, { label: string; color: string; glow: string }> = {
  nuevo:      { label: 'Nuevo',             color: 'text-slate-400',   glow: '' },
  verificado: { label: 'Creador Verificado', color: 'text-violet-400',  glow: 'shadow-violet-500/30' },
  premium:    { label: 'Creador Premium',    color: 'text-amber-400',   glow: 'shadow-amber-500/30' },
}

interface TrustScoreProps {
  score: number
  level: UserLevel
}

export function TrustScore({ score, level }: TrustScoreProps) {
  const config = LEVEL_CONFIG[level]
  const pct = score // already 0-100

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-white/60">Trust Score</span>
        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10', config.color)}>
          {config.label}
        </span>
      </div>

      <div className="flex items-end gap-3 mb-3">
        <span className="text-4xl font-bold text-white">{score}</span>
        <span className="text-white/40 text-sm mb-1">/ 100</span>
      </div>

      <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-violet-600 to-blue-500"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>

      <div className="flex justify-between text-[10px] text-white/30 mt-1">
        <span>0</span>
        <span>Verificado ≥80</span>
        <span>Premium ≥90</span>
      </div>
    </div>
  )
}
