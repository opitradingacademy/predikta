import { getMarkets } from '@/actions/market.actions'
import { MarketCard } from '@/components/market/MarketCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Suspense } from 'react'
import type { Market } from '@/types'

async function FeaturedMarkets() {
  const { data: featured } = await getMarkets({ featured: true, status: 'active', limit: 3 })
  const { data: recent }   = await getMarkets({ status: 'active', limit: 10 })

  return (
    <div className="space-y-6">
      {featured && featured.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
            ⭐ Destacados
          </h2>
          <div className="space-y-3">
            {featured.map((m: Market, i: number) => <MarketCard key={m.id} market={m} index={i} />)}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
          🔥 Activos ahora
        </h2>
        {recent && recent.length > 0 ? (
          <div className="space-y-3">
            {recent.map((m: Market, i: number) => <MarketCard key={m.id} market={m} index={i} />)}
          </div>
        ) : (
          <div className="text-center py-12 text-white/30">
            <p className="text-4xl mb-2">🔮</p>
            <p className="text-sm">No hay mercados activos todavía.</p>
            <p className="text-xs mt-1">¡Sé el primero en crear uno!</p>
          </div>
        )}
      </section>
    </div>
  )
}

function MarketsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-36 w-full rounded-2xl bg-white/5" />
      ))}
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="px-4 pt-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          Predikta <span className="text-violet-400">🔮</span>
        </h1>
        <p className="text-sm text-white/40 mt-0.5">¿Qué va a pasar?</p>
      </div>

      <Suspense fallback={<MarketsSkeleton />}>
        <FeaturedMarkets />
      </Suspense>
    </div>
  )
}
