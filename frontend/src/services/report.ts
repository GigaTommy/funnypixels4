import { api } from './api';
import { AuthService } from './auth';
import { logger } from '../utils/logger';

export interface Report {
  id: string;
  reporter_id: string;
  target_type: 'pixel' | 'user' | 'message';
  target_id: string;
  reason: 'porn' | 'violence' | 'political' | 'spam' | 'abuse' | 'hate_speech' | 'inappropriate' | 'other';
  description?: string;
  metadata: Record<string, any>;
  status: 'pending' | 'reviewing' | 'resolved' | 'rejected';
  assigned_admin_id?: string;
  admin_note?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  reporter_username?: string;
  reporter_display_name?: string;
  admin_username?: string;
}

export interface ReportLimitStatus {
  canReport: boolean;
  todayCount: number;
  dailyLimit: number;
  remaining: number;
}

export interface CreateReportData {
  targetType: 'pixel' | 'user' | 'message';
  targetId: string;
  reason: 'porn' | 'violence' | 'political' | 'spam' | 'abuse' | 'hate_speech' | 'inappropriate' | 'other';
  description?: string;
  metadata?: Record<string, any>;
}

export interface ReportStatistics {
  details: Array<{
    report_date: string;
    target_type: string;
    reason: string;
    report_count: number;
    resolved_count: number;
    rejected_count: number;
  }>;
  summary: {
    totalReports: number;
    totalResolved: number;
    totalRejected: number;
    byReason: Record<string, { reports: number; resolved: number; rejected: number }>;
    byTargetType: Record<string, { reports: number; resolved: number; rejected: number }>;
  };
}

export interface AdminDashboard {
  pending: number;
  reviewing: number;
  total: number;
  assignedToMe: number | null;
  recentReports: Report[];
}

export class ReportAPI {
  // 创建举报
  static async createReport(data: CreateReportData): Promise<{
    success: boolean;
    message: string;
    data: { reportId: string; remaining: number }
  }> {
    const response = await api.post('/reports', data);
    return response.data;
  }

  // 获取用户举报历史
  static async getUserReports(limit: number = 20, offset: number = 0): Promise<{ success: boolean; data: Report[] }> {
    const response = await api.get('/reports/my/history', {
      params: { limit, offset }
    });
    return response.data;
  }

  // 获取举报限额状态
  static async getReportLimitStatus(): Promise<{ success: boolean; data: ReportLimitStatus }> {
    const response = await api.get('/reports/my/limit-status');
    return response.data;
  }

  // 管理员接口 - 获取举报列表
  static async getReports(options: {
    status?: string;
    targetType?: string;
    reason?: string;
    assignedAdminId?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{ success: boolean; data: Report[] }> {
    // 临时调试：检查JWT token内容
    const token = localStorage.getItem('funnypixels_token');
    if (token) {
      try {
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          logger.info('🔑 举报API JWT Token检查:', {
            payload: JSON.stringify(payload, null, 2),
            role: payload.role,
            is_admin: payload.is_admin,
            userId: payload.id,
            exp: new Date(payload.exp * 1000).toISOString(),
            currentTime: new Date().toISOString()
          });
        }
      } catch (error) {
        logger.error('❌ JWT Token解析失败:', error);
      }
    }

    // 测试API拦截器是否工作
    logger.debug('🔍 测试API拦截器，准备调用JWT测试路由');
    try {
      const testResponse = await api.get('/reports/admin/test-jwt');
      logger.debug('🔍 JWT测试路由响应:', testResponse.data);
    } catch (testError) {
      logger.debug('🔍 JWT测试路由失败:', testError);
    }

    // 管理员权限通过JWT token验证，api拦截器会自动添加认证头部
    const response = await api.get('/reports/admin/list', {
      params: options
    });
    return response.data;
  }

  // 管理员接口 - 获取举报详情
  static async getReportById(reportId: string): Promise<{ success: boolean; data: Report }> {
    // 使用标准api调用，管理员权限通过JWT token验证
    const response = await api.get(`/reports/admin/${reportId}`);
    return response.data;
  }

  // 管理员接口 - 分配举报
  static async assignReport(reportId: string, adminId?: string): Promise<{
    success: boolean;
    message: string;
    data: Report
  }> {
    const response = await api.put(`/reports/admin/${reportId}/assign`, { adminId });
    return response.data;
  }

  // 管理员接口 - 处理举报
  static async resolveReport(
    reportId: string,
    resolution: 'resolved' | 'rejected',
    adminNote?: string
  ): Promise<{ success: boolean; message: string; data: Report }> {
    const response = await api.put(`/reports/admin/${reportId}/resolve`, {
      resolution,
      adminNote
    });
    return response.data;
  }

  // 管理员接口 - 获取统计信息
  static async getReportStatistics(startDate?: string, endDate?: string): Promise<{
    success: boolean;
    data: ReportStatistics
  }> {
    // 使用标准api调用，管理员权限通过JWT token验证
    const response = await api.get('/reports/admin/statistics', {
      params: { startDate, endDate }
    });
    return response.data;
  }

  // 管理员接口 - 获取工作台数据
  static async getAdminDashboard(): Promise<{ success: boolean; data: AdminDashboard }> {
    // 使用标准api调用，管理员权限通过JWT token验证
    const response = await api.get('/reports/admin/dashboard');
    return response.data;
  }
}

// 举报相关的工具函数和常量
export class ReportUtils {
  // 举报原因映射
  static readonly REASON_MAP = {
    porn: '色情内容',
    violence: '暴力内容',
    political: '政治敏感',
    spam: '垃圾信息',
    abuse: '恶意行为',
    hate_speech: '仇恨言论',
    inappropriate: '不当内容',
    other: '其他'
  };

  // 举报对象类型映射
  static readonly TARGET_TYPE_MAP = {
    pixel: '像素',
    user: '用户',
    message: '消息'
  };

  // 举报状态映射
  static readonly STATUS_MAP = {
    pending: '待处理',
    reviewing: '审核中',
    resolved: '已解决',
    rejected: '已拒绝'
  };

  // 获取举报原因的中文显示
  static getReasonText(reason: string): string {
    return this.REASON_MAP[reason as keyof typeof this.REASON_MAP] || reason;
  }

  // 获取举报对象类型的中文显示
  static getTargetTypeText(targetType: string): string {
    return this.TARGET_TYPE_MAP[targetType as keyof typeof this.TARGET_TYPE_MAP] || targetType;
  }

  // 获取举报状态的中文显示
  static getStatusText(status: string): string {
    return this.STATUS_MAP[status as keyof typeof this.STATUS_MAP] || status;
  }

  // 获取状态对应的颜色样式
  static getStatusColor(status: string): string {
    switch (status) {
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'reviewing':
        return 'text-blue-600 bg-blue-100';
      case 'resolved':
        return 'text-green-600 bg-green-100';
      case 'rejected':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  }

  // 验证举报数据
  static validateReportData(data: CreateReportData): { valid: boolean; error?: string } {
    if (!data.targetType || !['pixel', 'user', 'message'].includes(data.targetType)) {
      return { valid: false, error: '无效的举报对象类型' };
    }

    if (!data.targetId || data.targetId.trim().length === 0) {
      return { valid: false, error: '举报对象ID不能为空' };
    }

    if (!data.reason || !Object.keys(this.REASON_MAP).includes(data.reason)) {
      return { valid: false, error: '请选择举报原因' };
    }

    if (data.description && data.description.length > 1000) {
      return { valid: false, error: '描述长度不能超过1000字符' };
    }

    return { valid: true };
  }

  // 格式化时间显示
  static formatReportTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return '刚刚';
    } else if (diffMins < 60) {
      return `${diffMins}分钟前`;
    } else if (diffHours < 24) {
      return `${diffHours}小时前`;
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else {
      return date.toLocaleDateString('zh-CN');
    }
  }
}

// 举报原因选项（用于前端表单）
export const REPORT_REASON_OPTIONS = [
  { value: 'porn', label: '色情内容' },
  { value: 'violence', label: '暴力内容' },
  { value: 'political', label: '政治敏感' },
  { value: 'spam', label: '垃圾信息' },
  { value: 'abuse', label: '恶意行为' },
  { value: 'hate_speech', label: '仇恨言论' },
  { value: 'inappropriate', label: '不当内容' },
  { value: 'other', label: '其他' }
];