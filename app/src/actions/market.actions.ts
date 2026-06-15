'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { moderateMarket } from '@/lib/minimax/moderation'
import { uuidToBytes32, CONTRACT_ADDRESS, PREDIKTA_ABI, TOKENS, getResolverClient, publicClient } from '@/lib/contracts/predikta'
import type { MarketCategory, ResolutionSource, TokenType } from '@/types'
import { revalidatePath } from 'next/cache'
import { isAddress } from 'viem'

const ADMIN_ADDRESS = (process.env.NEXT_PUBLIC_TREASURY_ADDRESS ?? process.env.TREASURY_ADDRESS ?? '') as `0x${string}`

async function registerReferrerIfNeeded(userWallet: `0x${string}`, referrerWallet: `0x${string}`) {
  if (!isAddress(userWallet) || !isAddress(referrerWallet)) return
  if (userWallet.toLowerCase() === referrerWallet.toLowerCase()) return

  try {
    const existing = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: PREDIKTA_ABI,
      functionName: 'referrers',
      args: [userWallet],
    })

    if (existing === '0x0000000000000000000000000000000000000000') {
      const resolverClient = getResolverClient()
      await resolverClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: PREDIKTA_ABI,
        functionName: 'setReferrer',
        args: [userWallet, referrerWallet],
      })
    }
  } catch {
    // No bloquear flujo principal si falla
  }
}

interface CreateMarketInput {
  title: string
  description: string
  category: MarketCategory
  closeDate: string
  options: string[]
  resolutionSource: ResolutionSource
  resolutionSourceUrl?: string
  imageUrl?: string
  token?: TokenType
  creatorWallet: string
}

export async function createMarket(input: CreateMarketInput) {
  const supabase = createServiceClient()

  // 1. Moderar con MiniMax
  let moderation: { categoria: 'AUTO_APPROVE' | 'NEEDS_REVIEW' | 'AUTO_REJECT'; razon: string }
  try {
    moderation = await moderateMarket(input.title, input.description, input.resolutionSourceUrl)
  } catch {
    moderation = { categoria: 'NEEDS_REVIEW' as const, razon: 'Moderación automática no disponible' }
  }

  if (moderation.categoria === 'AUTO_REJECT') {
    return { error: `Mercado rechazado: ${moderation.razon}` }
  }

  // 2. Obtener creator
  const { data: creator } = await supabase
    .from('users')
    .select('id, trust_score, total_markets_created')
    .eq('wallet_address', input.creatorWallet.toLowerCase())
    .single()

  if (!creator) return { error: 'Usuario no encontrado' }

  // 3. Insertar mercado en Supabase
  const { data: market, error } = await supabase
    .from('markets')
    .insert({
      creator_id: creator.id,
      title: input.title,
      description: input.description,
      category: input.category,
      close_date: input.closeDate,
      resolution_source: input.resolutionSource,
      resolution_source_url: input.resolutionSourceUrl,
      image_url: input.imageUrl,
      token: input.token ?? 'USDm',
      moderation_status: moderation.categoria === 'AUTO_APPROVE' ? 'auto_approved' : 'pending',
      moderation_reason: moderation.razon,
      status: moderation.categoria === 'AUTO_APPROVE' ? 'approved' : 'pending',
    })
    .select()
    .single()

  if (error || !market) return { error: 'Error al crear el mercado' }

  // 4. Insertar opciones
  const optionsToInsert = input.options.map((label, index) => ({
    market_id: market.id,
    label,
    position_index: index,
    probability: Math.round(100 / input.options.length),
  }))

  await supabase.from('options').insert(optionsToInsert)

  // 5. Actualizar contador del creador
  await supabase
    .from('users')
    .update({ total_markets_created: creator.total_markets_created + 1 })
    .eq('id', creator.id)

  // 6. Usuario nuevo que crea mercado solo → referido del admin (casa)
  if (creator.total_markets_created === 0 && ADMIN_ADDRESS) {
    await registerReferrerIfNeeded(input.creatorWallet as `0x${string}`, ADMIN_ADDRESS)
  }

  revalidatePath('/')
  revalidatePath('/explore')

  return { data: market }
}

export async function resolveMarket(marketId: string, winningOptionId: string, resolvedBy: string) {
  const supabase = createServiceClient()

  // 1. Obtener datos del mercado
  const { data: market } = await supabase
    .from('markets')
    .select('*, options(*)')
    .eq('id', marketId)
    .single()

  if (!market) return { error: 'Mercado no encontrado' }

  const winningOption = market.options?.find((o: { id: string }) => o.id === winningOptionId)
  if (!winningOption) return { error: 'Opción inválida' }

  // 2. Llamar al smart contract
  try {
    const resolverClient = getResolverClient()
    const bytes32Id = uuidToBytes32(marketId)

    const hash = await resolverClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: PREDIKTA_ABI,
      functionName: 'resolveMarket',
      args: [bytes32Id, winningOption.position_index],
    })

    // 3. Actualizar Supabase
    const { data: admin } = await supabase.from('users').select('id').eq('wallet_address', resolvedBy).single()

    await supabase.from('markets').update({
      status: 'resolved',
      resolved_option_id: winningOptionId,
      resolution_date: new Date().toISOString(),
    }).eq('id', marketId)

    await supabase.from('resolutions').insert({
      market_id: marketId,
      winning_option_id: winningOptionId,
      resolved_by: admin?.id,
      resolution_method: 'admin',
      tx_hash: hash,
    })

    // 4. Actualizar participaciones
    await supabase.from('participations')
      .update({ status: 'won', payout: null })
      .eq('market_id', marketId)
      .eq('option_id', winningOptionId)
      .eq('status', 'confirmed')

    await supabase.from('participations')
      .update({ status: 'lost' })
      .eq('market_id', marketId)
      .neq('option_id', winningOptionId)
      .eq('status', 'confirmed')

    revalidatePath(`/market/${marketId}`)
    return { data: { txHash: hash } }
  } catch (e) {
    return { error: `Error on-chain: ${(e as Error).message}` }
  }
}

export async function getMarketById(id: string) {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('markets')
    .select('*, creator:users(id, username, trust_score, avatar_url), options!options_market_id_fkey(*)')
    .eq('id', id)
    .single()

  if (error) return { error: error.message }
  return { data }
}

export async function participateMarket(input: {
  marketId: string
  optionId: string
  amount: number
  txHash: string
  walletAddress: string
  token: TokenType
}) {
  const supabase = createServiceClient()

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('wallet_address', input.walletAddress.toLowerCase())
    .single()

  if (!user) return { error: 'Usuario no encontrado. Creá tu perfil primero.' }

  // Registrar referido: quien apuesta se convierte en referido del creador del mercado
  const { data: mktCreator } = await supabase
    .from('markets')
    .select('creator:users(wallet_address)')
    .eq('id', input.marketId)
    .single()

  const creatorRaw = mktCreator?.creator as unknown as { wallet_address: string } | { wallet_address: string }[] | null
  const creatorWallet = (Array.isArray(creatorRaw) ? creatorRaw[0] : creatorRaw)?.wallet_address
  if (creatorWallet && creatorWallet.toLowerCase() !== input.walletAddress.toLowerCase()) {
    await registerReferrerIfNeeded(
      input.walletAddress as `0x${string}`,
      creatorWallet as `0x${string}`,
    )
  }

  const { data, error } = await supabase
    .from('participations')
    .insert({
      user_id: user.id,
      market_id: input.marketId,
      option_id: input.optionId,
      amount: input.amount,
      token: input.token,
      tx_hash: input.txHash,
      status: 'confirmed',
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Actualizar total_staked de la opción
  const { data: opt } = await supabase
    .from('options')
    .select('total_staked')
    .eq('id', input.optionId)
    .single()

  if (opt) {
    await supabase
      .from('options')
      .update({ total_staked: opt.total_staked + input.amount })
      .eq('id', input.optionId)
  }

  // Actualizar pool_total del mercado
  const { data: mkt } = await supabase
    .from('markets')
    .select('pool_total')
    .eq('id', input.marketId)
    .single()

  const newTotal = (mkt?.pool_total ?? 0) + input.amount
  await supabase.from('markets').update({ pool_total: newTotal }).eq('id', input.marketId)

  // Recalcular probabilidades
  const { data: allOpts } = await supabase
    .from('options')
    .select('id, total_staked')
    .eq('market_id', input.marketId)

  if (allOpts && newTotal > 0) {
    for (const o of allOpts) {
      await supabase
        .from('options')
        .update({ probability: Math.round((o.total_staked / newTotal) * 100) })
        .eq('id', o.id)
    }
  }

  revalidatePath(`/market/${input.marketId}`)
  revalidatePath('/')
  return { data }
}

export async function adminUpdateMarket(marketId: string, action: 'approve' | 'reject', reason?: string) {
  const supabase = createServiceClient()

  if (action === 'approve') {
    // Registrar mercado on-chain antes de aprobar en Supabase
    const { data: market } = await supabase
      .from('markets')
      .select('*, options!options_market_id_fkey(*)')
      .eq('id', marketId)
      .single()

    if (market) {
      try {
        const resolverClient = getResolverClient()
        const bytes32Id = uuidToBytes32(marketId)
        const tokenAddress = TOKENS[market.token as keyof typeof TOKENS] ?? TOKENS.USDm
        const closeTimestamp = BigInt(Math.floor(new Date(market.close_date).getTime() / 1000))
        const optionCount = (market.options?.length ?? 2) as number

        // Verificar si ya existe on-chain
        const onChain = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: PREDIKTA_ABI,
          functionName: 'getMarket',
          args: [bytes32Id],
        }) as { closeDate: bigint }

        if (!onChain.closeDate || onChain.closeDate === 0n) {
          await resolverClient.writeContract({
            address: CONTRACT_ADDRESS,
            abi: PREDIKTA_ABI,
            functionName: 'createMarket',
            args: [bytes32Id, tokenAddress, optionCount, closeTimestamp],
          })
        }
      } catch (e) {
        const msg = (e as Error).message
        if (!msg.includes('Market already exists')) {
          return { error: `Error on-chain: ${msg}` }
        }
      }
    }
  }

  const updates =
    action === 'approve'
      ? { status: 'approved', moderation_status: 'auto_approved', moderation_reason: reason ?? null }
      : { status: 'rejected', moderation_status: 'auto_rejected', moderation_reason: reason ?? 'Rechazado por moderación' }

  const { error } = await supabase.from('markets').update(updates).eq('id', marketId)
  if (error) return { error: error.message }

  revalidatePath('/admin')
  revalidatePath('/')
  return { data: true }
}

export async function getMarkets(filters: {
  category?: string
  status?: string
  featured?: boolean
  limit?: number
} = {}) {
  const supabase = createServiceClient()

  let query = supabase
    .from('markets')
    .select('*, creator:users(id, username, trust_score, avatar_url), options!options_market_id_fkey(*)')
    .order('created_at', { ascending: false })

  if (filters.category) query = query.eq('category', filters.category)
  if (filters.status)   query = query.eq('status', filters.status)
  if (filters.featured) query = query.eq('is_featured', true)
  if (filters.limit)    query = query.limit(filters.limit)

  const { data, error } = await query
  if (error) return { error: error.message }
  return { data }
}
