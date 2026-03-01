export interface User {
  id: string
  username: string
  nickname: string
  display_name?: string
  phone?: string
  email?: string
  avatar?: string
  avatar_url?: string
  status: 'active' | 'inactive' | 'banned'
  is_banned: boolean
  ban_type?: 'none' | 'login' | 'chat' | 'draw'
  ban_reason?: string
  ban_expires_at?: string
  role: string
  createdAt: string
  updatedAt: string
  created_at: string
  updated_at: string
  last_login?: string
  is_online?: boolean
  total_pixels?: number
  level?: number
  experience?: number
  coins?: number
  gems?: number
}

export interface UserDetail {
  user: User
  wallet: {
    points: number
    current_points: number
    total_earned: number
    total_spent: number
    total_transactions: number
    recent_ledger: WalletLedger[]
  }
  alliance: {
    id: string
    name: string
    role: string
    joined_at: string
  } | null
}

export interface WalletLedger {
  id: string
  user_id: string
  delta_points: number
  reason: string
  ref_id?: string
  created_at: string
  store_item_name?: string
  ad_product_name?: string
}

export interface CreateUserRequest {
  username: string
  nickname: string
  phone?: string
  email?: string
  password: string
  role: string
}

export interface UpdateUserRequest {
  nickname?: string
  phone?: string
  email?: string
  status?: 'active' | 'inactive' | 'banned'
  role?: string
}

// 角色权限相关类型
export interface Role {
  id: number
  name: string
  description: string
  permissions: string[]
  createdAt: string
  updatedAt: string
}

export interface Permission {
  id: number
  name: string
  code: string
  description: string
  parentId?: number
  children?: Permission[]
}

export interface CreateRoleRequest {
  name: string
  description: string
  permissions: string[]
}

export interface UpdateRoleRequest {
  name?: string
  description?: string
  permissions?: string[]
}

// 广告审批相关类型
export type { Advertisement, ApproveAdRequest } from '@/services/advertisement'

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  code?: number
}

export interface PaginationParams {
  current?: number
  pageSize?: number
}

export interface PaginationResponse<T> {
  list: T[]
  total: number
  current: number
  pageSize: number
}

// 登录相关类型
export interface LoginForm {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  user: {
    id: number
    username: string
    nickname: string
    role: string
    permissions: string[]
  }
}

// Dashboard相关类型
export interface DashboardStats {
  totalUsers: number
  totalPixels: number
  todayUsers: number
  activeUsers: number
}

export interface RecentActivity {
  id: number
  type: string
  description: string
  timestamp: string
  user: string
}

export interface RecentActivitiesResponse {
  list: RecentActivity[]
  total: number
}

// 自定义旗帜相关类型
export interface CustomFlag {
  id: string
  user_id: string
  username?: string
  nickname?: string
  title: string
  description: string
  pattern_data: string
  grid_x: number
  grid_y: number
  width: number
  height: number
  status: 'pending' | 'approved' | 'rejected'
  reject_reason?: string
  created_at: string
  updated_at: string
}

export interface CreateCustomFlagRequest {
  title: string
  description: string
  pattern_data: string
  grid_x: number
  grid_y: number
  width: number
  height: number
}

export interface UpdateCustomFlagRequest {
  title?: string
  description?: string
  status?: 'pending' | 'approved' | 'rejected'
  reject_reason?: string
}

export interface GetCustomFlagsParams extends PaginationParams {
  status?: 'pending' | 'approved' | 'rejected'
  user_id?: string
  title?: string
}

// 商品相关类型
export interface Product {
  id: string
  name: string
  description: string
  price: number
  category: string
  image_url?: string
  stock: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface CreateProductRequest {
  name: string
  description: string
  price: number
  category: string
  image_url?: string
  stock: number
}

export interface UpdateProductRequest {
  name?: string
  description?: string
  price?: number
  category?: string
  image_url?: string
  stock?: number
  active?: boolean
}

export interface GetProductsParams extends PaginationParams {
  category?: string
  active?: boolean
  name?: string
}

// store_items 商品相关类型
export interface StoreItem {
  id: string
  name: string
  description: string
  price_points: number
  item_type: 'consumable' | 'cosmetic' | 'special' | 'pattern' | 'frame' | 'bubble' | 'badge' | 'ad'
  category: string
  icon?: string
  metadata?: any
  active: boolean
  created_at: string
  updated_at: string
}

export interface CreateStoreItemRequest {
  name: string
  description: string
  price_points: number
  item_type: 'consumable' | 'cosmetic' | 'special' | 'pattern' | 'frame' | 'bubble' | 'badge' | 'ad'
  category?: string
  icon?: string
  metadata?: any
  active?: boolean
}

export interface UpdateStoreItemRequest {
  name?: string
  description?: string
  price_points?: number
  item_type?: 'consumable' | 'cosmetic' | 'special' | 'pattern' | 'frame' | 'bubble' | 'badge' | 'ad'
  category?: string
  icon?: string
  metadata?: any
  active?: boolean
}

export interface GetStoreItemsParams extends PaginationParams {
  item_type?: string
  category?: string
  active?: boolean
  keyword?: string
}

// 订单相关类型
export interface Order {
  id: string
  user_id: string
  username?: string
  nickname?: string
  product_id: string
  product_name: string
  quantity: number
  total_price: number
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled'
  payment_method: string
  shipping_address?: string
  created_at: string
  updated_at: string
}

export interface GetOrdersParams extends PaginationParams {
  status?: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled'
  user_id?: string
  product_id?: string
}

// 数据分析相关类型
export interface UserAnalytics {
  total_users: number
  active_users: number
  new_users_today: number
  new_users_week: number
  user_growth_rate: number
  daily_active_users: Array<{
    date: string
    count: number
  }>
  user_role_distribution: Array<{
    role: string
    count: number
    percentage: number
  }>
}

export interface ContentAnalytics {
  total_content: number
  active_content: number
  new_content_today: number
  content_growth_rate: number
  average_views_per_content: number
  popular_content: Array<{
    id: string
    title: string
    views: number
    downloads: number
  }>
  content_type_distribution: Array<{
    type: string
    count: number
    percentage: number
  }>
  top_creators: Array<{
    user_id: string
    username: string
    role: string
    content_count: number
    total_views: number
    total_downloads: number
    total_likes: number
  }>
  total_pixels: number
  active_pixels: number
  total_patterns: number
  approved_patterns: number
  pending_patterns: number
  content_creation_rate: number
  daily_content_stats: Array<{
    date: string
    pixels: number
    patterns: number
  }>
}

export interface RevenueAnalytics {
  total_revenue: number
  today_revenue: number
  week_revenue: number
  month_revenue: number
  revenue_growth_rate: number
  revenue_by_source: Array<{
    source: string
    amount: number
    percentage: number
  }>
  monthly_revenue: Array<{
    month: string
    revenue: number
  }>
}

// 系统设置相关类型
export interface SystemSettings {
  site_name: string
  site_description: string
  site_logo?: string
  maintenance_mode: boolean
  max_upload_size: number
  allowed_file_types: string[]
  supported_image_formats: string[]
  pixel_cooldown_seconds: number
  registration_enabled: boolean
  contact_email: string
  icp_number?: string
  allow_registration: boolean
  email_verification_required: boolean
  default_user_role: 'user' | 'creator' | 'admin'
  session_timeout: number
}

export interface SystemLog {
  id: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  module: string
  user_id?: string
  ip_address?: string
  created_at: string
}

export interface GetSystemLogsParams extends PaginationParams {
  current?: number
  pageSize?: number
  level?: 'info' | 'warn' | 'error' | 'debug'
  module?: string
  start_date?: string
  end_date?: string
}

export interface SystemMetrics {
  cpu_usage: number
  memory_usage: number
  disk_usage: number
  network_in: number
  network_out: number
  active_connections: number
  database_connections: number
  response_time: number
  uptime: number
  timestamp: string
}

// 统一待办模块相关类型
export interface TodoItem {
  id: string
  type: 'ad_approval' | 'custom_flag_approval' | 'report_review'
  title: string
  description: string
  status: 'pending' | 'approved' | 'rejected' | 'processed'
  priority: 'high' | 'medium' | 'low'
  submitter: {
    id: string
    username: string
    nickname?: string
  }
  created_at: string
  updated_at: string
  // 广告审批特有字段
  ad_data?: {
    id: string
    content: string
    image_url?: string
    target_url?: string
    title?: string
    product_name?: string
    width?: number
    height?: number
  }
  // 自定义旗帜审批特有字段
  flag_data?: {
    id: string
    pattern_data: string
    grid_x: number
    grid_y: number
    width: number
    height: number
    preview_url?: string
    pattern_name?: string
  }
  // 举报处理特有字段
  report_data?: {
    id: string
    target_type: 'pixel' | 'pattern' | 'user' | 'comment'
    target_id: string
    reason: string
    description: string
    metadata?: {
      username?: string
      alliance_name?: string
      lat?: number
      lng?: number
      color?: string
      pixel_id?: string
    }
  }
}

export interface GetTodosParams extends PaginationParams {
  type?: 'ad_approval' | 'custom_flag_approval' | 'report_review' | 'all'
  status?: 'pending' | 'approved' | 'rejected' | 'processed' | 'all'
  priority?: 'high' | 'medium' | 'low' | 'all'
}

export interface ProcessTodoRequest {
  action: 'approve' | 'reject' | 'process'
  reason?: string
}

export interface TodoStats {
  pending_count: number
  processed_count: number
  ad_approval_pending: number
  custom_flag_pending: number
  report_pending: number
}

// Audit Log types
export type { AuditLog, AuditLogStats } from '@/services/audit'

// Achievement types
export type { Achievement as AdminAchievement, AchievementStats } from '@/services/achievement'

// Challenge types
export type { ChallengeTemplate, ChallengeStats } from '@/services/challenge'

// Checkin types
export type { CheckinRewardConfig, CheckinStats, RewardPreview } from '@/services/checkin'

// Payment types
export type { PaymentStats } from '@/services/payment'

// Feedback types
export type { UserFeedback, FeedbackStats } from '@/services/feedback'

// Alliance moderation types
export type { AllianceModerationLog, AllianceDetail } from '@/services/alliance'