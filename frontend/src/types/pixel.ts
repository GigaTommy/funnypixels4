// 像素相关类型定义

export interface PixelInfo {
  grid_id: string;
  lat: number;
  lng: number;
  color: string;
  pattern_id?: string;
  pattern_anchor_x?: number;
  pattern_anchor_y?: number;
  pattern_rotation?: number;
  pattern_mirror?: boolean;
  user_id?: string;
  username?: string;
  avatar_url?: string; // 用户头像URL (兼容字段)
  avatar?: string; // 用户头像数据 (主要字段，与ProfilePage保持一致)
  display_name?: string; // 用户显示名称
  timestamp?: number;
  created_at?: string; // 创建时间
  updated_at?: string; // 更新时间
  renderType?: 'color' | 'emoji' | 'complex';

  // 地理位置字段
  city?: string; // 城市名称（高德地图查询结果）
  province?: string; // 省份名称
  country?: string; // 国家名称（高德地图查询结果）

  // 新增字段
  alliance_id?: string;
  alliance_name?: string;
  alliance_flag?: string;
  alliance?: {
    id: string;
    name: string;
    flag: string;
    color?: string;
    role?: string;
  };
  country_code?: string;
  country_name?: string;
  likes_count?: number;
  is_liked?: boolean;
}

export interface PixelCoordinate {
  lat: number;
  lng: number;
}

export interface PixelGrid {
  id: string;
  center_lat: number;
  center_lng: number;
  bounds_lat_min: number;
  bounds_lat_max: number;
  bounds_lng_min: number;
  bounds_lng_max: number;
  pixel_count: number;
  last_updated: Date;
}

export interface PixelPattern {
  id: string;
  name: string;
  description?: string;
  image_data: string;
  width: number;
  height: number;
  color_count: number;
  user_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface PixelLike {
  id: string;
  pixel_id: string;
  user_id: string;
  created_at: Date;
}

export interface PixelReport {
  id: string;
  pixel_id: string;
  reporter_id: string;
  reported_user_id: string;
  reason: string;
  context: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  created_at: Date;
  reviewed_at?: Date;
  reviewer_id?: string;
  review_notes?: string;
}

// 举报原因类型
export interface ReportReason {
  id: string;
  title: string;
  description: string;
}

export const REPORT_REASONS: ReportReason[] = [
  {
    id: 'porn',
    title: '色情内容',
    description: '+18、不当链接、高度暗示性内容...'
  },
  {
    id: 'violence',
    title: '暴力内容',
    description: '暴力、血腥、威胁等不当内容'
  },
  {
    id: 'political',
    title: '政治敏感',
    description: '政治敏感内容、违禁信息'
  },
  {
    id: 'spam',
    title: '垃圾信息',
    description: '垃圾广告、重复信息、恶意刷屏'
  },
  {
    id: 'abuse',
    title: '恶意行为',
    description: '骚扰、欺凌、恶意行为'
  },
  {
    id: 'hate_speech',
    title: '仇恨言论',
    description: '种族主义、恐同、仇恨团体等'
  },
  {
    id: 'inappropriate',
    title: '不当内容',
    description: '其他不当内容、违规信息'
  },
  {
    id: 'other',
    title: '其他原因',
    description: '其他未列出的原因'
  }
];

// 像素操作类型
export enum PixelOperation {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIKE = 'like',
  UNLIKE = 'unlike',
  REPORT = 'report'
}

// 像素渲染类型
export enum PixelRenderType {
  COLOR = 'color',
  EMOJI = 'emoji',
  COMPLEX = 'complex'
}

// 像素状态
export interface PixelState {
  isVisible: boolean;
  isSelected: boolean;
  isHovered: boolean;
  isLiked: boolean;
  isReported: boolean;
}
