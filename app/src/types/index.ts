export type UserLevel = 'nuevo' | 'verificado' | 'premium'
export type MarketStatus = 'pending' | 'approved' | 'active' | 'closed' | 'resolved' | 'rejected' | 'cancelled'
export type MarketCategory = 'deportes' | 'comunidad' | 'clima' | 'educacion' | 'tecnologia' | 'politica_local' | 'otros'
export type ResolutionSource = 'deportivo' | 'fuente_publica' | 'meteorologico' | 'institucional' | 'organizador' | 'comunitario'
export type ModerationStatus = 'pending' | 'auto_approved' | 'needs_review' | 'auto_rejected'
export type TokenType = 'USDm' | 'USDC' | 'USDT'
export type ParticipationStatus = 'pending' | 'confirmed' | 'won' | 'lost' | 'refunded'
export type NotificationType = 'market_approved' | 'market_rejected' | 'market_resolved' | 'participation_won' | 'participation_lost' | 'trust_score_changed' | 'badge_earned' | 'report_confirmed'
export type RankingPeriod = 'all_time' | 'monthly' | 'weekly'

export interface User {
  id: string
  wallet_address: string
  username: string | null
  avatar_url: string | null
  trust_score: number
  level: UserLevel
  is_verified: boolean
  is_banned: boolean
  total_markets_created: number
  total_markets_won: number
  total_earnings: number
  created_at: string
  updated_at: string
}

export interface Market {
  id: string
  creator_id: string
  title: string
  description: string
  category: MarketCategory
  status: MarketStatus
  resolution_source: ResolutionSource
  resolution_source_url: string | null
  close_date: string
  resolution_date: string | null
  image_url: string | null
  contract_address: string | null
  pool_total: number
  token: TokenType
  moderation_status: ModerationStatus
  moderation_reason: string | null
  is_featured: boolean
  resolved_option_id: string | null
  created_at: string
  updated_at: string
  creator?: User
  options?: MarketOption[]
}

export interface MarketOption {
  id: string
  market_id: string
  label: string
  position_index: number
  total_staked: number
  probability: number
  created_at: string
}

export interface Participation {
  id: string
  user_id: string
  market_id: string
  option_id: string
  amount: number
  token: TokenType
  tx_hash: string
  status: ParticipationStatus
  payout: number | null
  created_at: string
  confirmed_at: string | null
  market?: Market
  option?: MarketOption
}

export interface Badge {
  id: string
  name: string
  description: string
  icon: string
  condition_type: string
}

export interface UserBadge {
  id: string
  user_id: string
  badge_id: string
  earned_at: string
  badge?: Badge
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  is_read: boolean
  reference_id: string | null
  created_at: string
}

export interface Ranking {
  id: string
  user_id: string
  rank_position: number
  total_earnings: number
  win_rate: number
  total_participations: number
  period: RankingPeriod
  calculated_at: string
  user?: User
}

export interface ModerationResult {
  categoria: 'AUTO_APPROVE' | 'NEEDS_REVIEW' | 'AUTO_REJECT'
  razon: string
}
