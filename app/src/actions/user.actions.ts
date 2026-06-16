'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import type { NotificationType } from '@/types'

export async function createNotification(userId: string, type: NotificationType, title: string, body: string, referenceId?: string) {
  const supabase = createServiceClient()
  await supabase.from('notifications').insert({ user_id: userId, type, title, body, reference_id: referenceId ?? null })
}

export async function upsertUser(walletAddress: string) {
  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('wallet_address', walletAddress)
    .single()

  if (existing) return { data: existing }

  const { data, error } = await supabase
    .from('users')
    .insert({ wallet_address: walletAddress })
    .select()
    .single()

  if (error) return { error: error.message }
  return { data }
}

export async function updateTrustScore(
  userId: string,
  delta: number,
  reason: string,
  referenceId?: string
) {
  const supabase = createServiceClient()

  const { data: user } = await supabase
    .from('users')
    .select('trust_score')
    .eq('id', userId)
    .single()

  if (!user) return { error: 'Usuario no encontrado' }

  const newScore = Math.min(100, Math.max(0, user.trust_score + delta))

  // Determinar nivel
  let level = 'nuevo'
  if (newScore >= 90) level = 'premium'
  else if (newScore >= 80) level = 'verificado'

  await supabase.from('users').update({ trust_score: newScore, level }).eq('id', userId)

  await supabase.from('trust_score_history').insert({
    user_id: userId,
    delta,
    reason,
    reference_id: referenceId,
    score_after: newScore,
  })

  await createNotification(
    userId,
    'trust_score_changed',
    delta > 0 ? `Trust Score +${delta} ⚡` : `Trust Score ${delta} ⚡`,
    `${reason}. Tu nuevo puntaje es ${newScore}.`,
  )

  revalidatePath('/profile')
  return { data: { newScore, level } }
}

export async function getUserProfile(walletAddress: string) {
  const supabase = createServiceClient()

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('wallet_address', walletAddress)
    .single()

  if (error || !user) return { error: 'Usuario no encontrado' }

  const [{ data: badges }, { data: participations }, { data: ranking }] = await Promise.all([
    supabase.from('user_badges').select('*, badge:badges(*)').eq('user_id', user.id),
    supabase.from('participations').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
    supabase.from('rankings').select('*').eq('user_id', user.id).eq('period', 'all_time').single(),
  ])

  return { data: { user, badges: badges ?? [], participations: participations ?? [], ranking } }
}

export async function getNotifications(walletAddress: string) {
  const supabase = createServiceClient()

  const { data: user } = await supabase
    .from('users').select('id').eq('wallet_address', walletAddress).single()

  if (!user) return { data: [] }

  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30)

  return { data: data ?? [] }
}

export async function markNotificationsRead(walletAddress: string) {
  const supabase = createServiceClient()

  const { data: user } = await supabase
    .from('users').select('id').eq('wallet_address', walletAddress).single()

  if (!user) return

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  revalidatePath('/notifications')
}

export async function getUnreadCount(walletAddress: string): Promise<number> {
  const supabase = createServiceClient()

  const { data: user } = await supabase
    .from('users').select('id').eq('wallet_address', walletAddress).single()

  if (!user) return 0

  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  return count ?? 0
}

export async function adminAdjustTrustScore(walletAddress: string, delta: number, reason: string) {
  const supabase = createServiceClient()

  const { data: user } = await supabase
    .from('users')
    .select('id, trust_score')
    .eq('wallet_address', walletAddress)
    .single()

  if (!user) return { error: 'Usuario no encontrado' }
  return updateTrustScore(user.id, delta, reason)
}

export async function getAdminStats() {
  const supabase = createServiceClient()

  const [pending, total, users] = await Promise.all([
    supabase.from('markets').select('id', { count: 'exact' }).eq('status', 'pending'),
    supabase.from('markets').select('id', { count: 'exact' }),
    supabase.from('users').select('id', { count: 'exact' }),
  ])

  return {
    data: {
      pendingMarkets: pending.count ?? 0,
      totalMarkets:  total.count ?? 0,
      totalUsers:    users.count ?? 0,
    }
  }
}

export async function getRanking(period: 'all_time' | 'monthly' | 'weekly' = 'all_time', limit = 50) {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('rankings')
    .select('*, user:users(id, username, wallet_address, avatar_url, trust_score, level)')
    .eq('period', period)
    .order('rank_position', { ascending: true })
    .limit(limit)

  if (error) return { error: error.message }
  return { data: data ?? [] }
}

export async function getUserRankPosition(walletAddress: string, period: 'all_time' | 'monthly' | 'weekly' = 'all_time') {
  const supabase = createServiceClient()

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('wallet_address', walletAddress)
    .single()

  if (!user) return { data: null }

  const { data } = await supabase
    .from('rankings')
    .select('rank_position, total_earnings, win_rate, total_participations')
    .eq('user_id', user.id)
    .eq('period', period)
    .single()

  return { data }
}
