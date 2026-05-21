// ============================================================
// Shared Types
// ============================================================

export interface User {
  id: string
  email: string
  nickname: string | null
  avatar_url: string | null
  role: "user" | "admin"
  status: "active" | "disabled"
  balance_cents: number
  subscription_tier: "free" | "vip" | "enterprise"
  subscription_expires_at: string | null
  daily_token_quota: number
  daily_token_used: number
  created_at: string
}

export interface ApiKey {
  id: string
  name: string
  key_prefix: string
  is_enabled: boolean
  last_used_at: string | null
  rpm_limit: number | null
  tpm_limit: number | null
  created_at: string
}

export interface Channel {
  id: string
  name: string
  provider: string
  base_url: string
  models: string[]
  weight: number
  priority: number
  max_concurrency: number
  status: string
  error_count: number
  cost_multiplier: number
  created_at: string
}

export interface ModelPricing {
  id: string
  model_name: string
  model_display: string | null
  cost_input_price: number
  cost_output_price: number
  sell_input_price: number
  sell_output_price: number
  vip_discount: number
  enterprise_discount: number
  is_active: boolean
}

export interface BillingRecord {
  id: number
  user_id: string
  api_key_id: string | null
  channel_id: string | null
  model_name: string
  request_id: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cost_cents: number
  balance_after: number
  status: string
  created_at: string
}

export interface UsagePoint {
  date: string
  tokens: number
  cost: number
}

export interface AdminStats {
  total_users: number
  active_channels: number
  today_revenue_cents: number
  today_tokens: number
  total_requests_today: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  page_size: number
}
