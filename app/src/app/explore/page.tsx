'use client'

import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { MarketCard } from '@/components/market/MarketCard'
import { getMarkets } from '@/actions/market.actions'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { Market, MarketCategory } from '@/types'

const CATEGORIES: { value: MarketCategory | 'all'; label: string }[] = [
  { value: 'all',          label: '🌐 Todos'    },
  { value: 'deportes',     label: '⚽ Deportes' },
  { value: 'comunidad',    label: '🏘️ Comunidad' },
  { value: 'clima',        label: '🌤️ Clima'    },
  { value: 'educacion',    label: '📚 Educación' },
  { value: 'tecnologia',   label: '💻 Tecnología' },
  { value: 'politica_local', label: '🏛️ Política' },
  { value: 'otros',        label: '✨ Otros'    },
]

export default function ExplorePage() {
  const [markets, setMarkets]       = useState<Market[]>([])
  const [loading, setLoading]       = useState(true)
  const [category, setCategory]     = useState<MarketCategory | 'all'>('all')
  const [search, setSearch]         = useState('')

  useEffect(() => {
    setLoading(true)
    getMarkets({ category: category === 'all' ? undefined : category, status: 'active' })
      .then(({ data }) => setMarkets(data ?? []))
      .finally(() => setLoading(false))
  }, [category])

  const filtered = markets.filter(m =>
    m.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="px-4 pt-6">
      <h1 className="text-xl font-bold text-white mb-4">Explorar</h1>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <Input
          placeholder="Buscar mercados..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-violet-500"
        />
      </div>

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={cn(
              'shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-all',
              category === cat.value
                ? 'bg-violet-600 border-violet-500 text-white'
                : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Markets */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((m, i) => <MarketCard key={m.id} market={m} index={i} />)}
        </div>
      ) : (
        <div className="text-center py-16 text-white/30">
          <p className="text-4xl mb-2">🔍</p>
          <p className="text-sm">No se encontraron mercados.</p>
        </div>
      )}
    </div>
  )
}
