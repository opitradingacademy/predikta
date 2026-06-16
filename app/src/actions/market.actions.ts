'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { moderateMarket } from '@/lib/minimax/moderation'
import { uuidToBytes32, CONTRACT_ADDRESS, PREDIKTA_ABI, TOKENS, getResolverClient, publicClient } from '@/lib/contracts/predikta'
import type { MarketCategory, ResolutionSource, TokenType } from '@/types'
import { revalidatePath } from 'next/cache'
import { isAddress } from 'viem'
import { upsertUser, createNotification } from './user.actions'

const ADMIN_ADDRESS = (process.env.NEXT_PUBLIC_TREASURY_ADDRESS ?? process.env.TREASURY_ADDRESS ?? '') as `0x${string}`

async function registerMarketOnChain(marketId: string, token: string, closeDate: string, optionCount: number): Promise<{ error?: string }> {
  try {
    const resolverClient = getResolverClient()
    const bytes32Id = uuidToBytes32(marketId)
    const tokenAddress = TOKENS[token as keyof typeof TOKENS] ?? TOKENS.USDm
    const closeTimestamp = BigInt(Math.floor(new Date(closeDate).getTime() / 1000))

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
        args: [bytes32Id, tokenAddress, optionCount as number, closeTimestamp],
      })
    }
    return {}
  } catch (e) {
    const msg = (e as Error).message
    if (msg.includes('Market already exists')) return {}
    return { error: `Error on-chain: ${msg}` }
  }
}

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
  } catch (e) {
    console.error('[createMarket] MiniMax moderation failed:', (e as Error).message)
    moderation = { categoria: 'NEEDS_REVIEW' as const, razon: 'Moderación automática no disponible' }
  }

  if (moderation.categoria === 'AUTO_REJECT') {
    return { error: `Mercado rechazado: ${moderation.razon}` }
  }

  // 2. Obtener o crear creator (auto-registro en primer uso)
  await upsertUser(input.creatorWallet.toLowerCase())

  const { data: creator } = await supabase
    .from('users')
    .select('id, trust_score, total_markets_created')
    .eq('wallet_address', input.creatorWallet.toLowerCase())
    .single()

  if (!creator) return { error: 'Error al registrar usuario' }

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

  // 7. Si AUTO_APPROVE, registrar on-chain inmediatamente
  if (moderation.categoria === 'AUTO_APPROVE') {
    const { error: onChainError } = await registerMarketOnChain(
      market.id,
      input.token ?? 'USDm',
      input.closeDate,
      input.options.length,
    )
    if (onChainError) {
      // No es fatal — el admin puede re-aprobar manualmente
      console.error('[createMarket] on-chain registration failed:', onChainError)
    }
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
    .select('*, options!options_market_id_fkey(*)')
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

    // 5. Incrementar total_markets_won + notificar ganadores y perdedores
    const { data: allParticipants } = await supabase
      .from('participations')
      .select('user_id, status')
      .eq('market_id', marketId)
      .in('status', ['won', 'lost'])

    for (const p of allParticipants ?? []) {
      if (p.status === 'won') {
        const { data: u } = await supabase.from('users').select('total_markets_won').eq('id', p.user_id).single()
        if (u) await supabase.from('users').update({ total_markets_won: u.total_markets_won + 1 }).eq('id', p.user_id)
        await createNotification(p.user_id, 'participation_won', '¡Ganaste! 🏆', `Elegiste la opción ganadora en "${market.title}". ¡Reclamá tus ganancias!`, marketId)
      } else {
        await createNotification(p.user_id, 'participation_lost', 'Esta no fue 😔', `El mercado "${market.title}" se resolvió. ¡Mejor suerte la próxima!`, marketId)
      }
    }

    // Notificar al creador que su mercado fue resuelto
    await createNotification(market.creator_id, 'market_resolved', 'Mercado resuelto 🏁', `Tu mercado "${market.title}" fue resuelto con la opción "${winningOption.label}".`, marketId)

    revalidatePath(`/market/${marketId}`)
    revalidatePath('/')
    revalidatePath('/explore')
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

  // Auto-registro si es la primera vez que apuesta
  await upsertUser(input.walletAddress.toLowerCase())

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('wallet_address', input.walletAddress.toLowerCase())
    .single()

  if (!user) return { error: 'Error al registrar usuario' }

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
    const { data: market } = await supabase
      .from('markets')
      .select('id, token, close_date, options!options_market_id_fkey(id)')
      .eq('id', marketId)
      .single()

    if (market) {
      const { error: onChainError } = await registerMarketOnChain(
        market.id,
        market.token,
        market.close_date,
        (market.options as { id: string }[])?.length ?? 2,
      )
      if (onChainError) return { error: onChainError }
    }
  }

  const updates =
    action === 'approve'
      ? { status: 'approved', moderation_status: 'auto_approved', moderation_reason: reason ?? null }
      : { status: 'rejected', moderation_status: 'auto_rejected', moderation_reason: reason ?? 'Rechazado por moderación' }

  const { error } = await supabase.from('markets').update(updates).eq('id', marketId)
  if (error) return { error: error.message }

  // Notificar al creador
  const { data: mkt } = await supabase.from('markets').select('title, creator_id').eq('id', marketId).single()
  if (mkt) {
    if (action === 'approve') {
      await createNotification(mkt.creator_id, 'market_approved', '¡Mercado aprobado! ✅', `Tu mercado "${mkt.title}" fue aprobado y ya está activo.`, marketId)
    } else {
      await createNotification(mkt.creator_id, 'market_rejected', 'Mercado rechazado', `Tu mercado "${mkt.title}" fue rechazado. ${reason ?? ''}`.trim(), marketId)
    }
  }

  revalidatePath('/admin')
  revalidatePath('/')
  return { data: true }
}

export async function getUserParticipation(marketId: string, walletAddress: string) {
  const supabase = createServiceClient()

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('wallet_address', walletAddress.toLowerCase())
    .single()

  if (!user) return { data: null }

  const { data } = await supabase
    .from('participations')
    .select('id, option_id, amount, status, token')
    .eq('market_id', marketId)
    .eq('user_id', user.id)
    .single()

  return { data: data ?? null }
}

export async function markParticipationClaimed(marketId: string, walletAddress: string) {
  const supabase = createServiceClient()

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('wallet_address', walletAddress.toLowerCase())
    .single()

  if (!user) return { error: 'Usuario no encontrado' }

  await supabase
    .from('participations')
    .update({ status: 'claimed' })
    .eq('market_id', marketId)
    .eq('user_id', user.id)
    .eq('status', 'won')

  revalidatePath(`/market/${marketId}`)
  revalidatePath('/profile')
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
