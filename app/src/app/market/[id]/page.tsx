import { getMarketById } from '@/actions/market.actions'
import { MarketDetailClient } from '@/components/market/MarketDetailClient'
import { notFound } from 'next/navigation'

export default async function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: market, error } = await getMarketById(id)

  if (error || !market) notFound()

  return <MarketDetailClient market={market} />
}
