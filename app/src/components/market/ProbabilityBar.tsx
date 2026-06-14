'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { MarketOption } from '@/types'

interface ProbabilityBarProps {
  options: MarketOption[]
  selectedOptionId?: string
  onSelect?: (optionId: string) => void
  disabled?: boolean
}

const OPTION_COLORS = [
  { bg: 'from-blue-600 to-violet-600', text: 'text-blue-400', border: 'border-blue-500/50', glow: 'shadow-blue-500/25' },
  { bg: 'from-red-600 to-orange-500',  text: 'text-red-400',  border: 'border-red-500/50',  glow: 'shadow-red-500/25'  },
  { bg: 'from-emerald-600 to-teal-500', text: 'text-emerald-400', border: 'border-emerald-500/50', glow: 'shadow-emerald-500/25' },
  { bg: 'from-amber-500 to-yellow-400', text: 'text-amber-400', border: 'border-amber-500/50', glow: 'shadow-amber-500/25' },
]

export function ProbabilityBar({ options, selectedOptionId, onSelect, disabled }: ProbabilityBarProps) {
  const sorted = [...options].sort((a, b) => a.position_index - b.position_index)

  return (
    <div className="space-y-3">
      {sorted.map((option, i) => {
        const colors = OPTION_COLORS[i % OPTION_COLORS.length]
        const isSelected = selectedOptionId === option.id
        const prob = option.probability ?? Math.round(100 / options.length)

        return (
          <button
            key={option.id}
            onClick={() => onSelect?.(option.id)}
            disabled={disabled}
            className={cn(
              'w-full rounded-xl border p-3 transition-all duration-200 text-left',
              'bg-white/5 hover:bg-white/10',
              isSelected ? `${colors.border} shadow-lg ${colors.glow}` : 'border-white/10',
              disabled && 'cursor-default'
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white">{option.label}</span>
              <span className={cn('text-sm font-bold', colors.text)}>{prob}%</span>
            </div>

            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className={cn('h-full rounded-full bg-gradient-to-r', colors.bg)}
                initial={{ width: 0 }}
                animate={{ width: `${prob}%` }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.1 }}
              />
            </div>
          </button>
        )
      })}
    </div>
  )
}
