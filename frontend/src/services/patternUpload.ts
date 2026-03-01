import { api } from './api';
import { logger } from '../utils/logger';

export interface PatternUpload {
  id: string;
  user_id: string;
  name: string;
  description: string;
  image_data: string;
  width: number;
  height: number;
  color_count: number;
  service_type: 'free' | 'certified' | 'commercial';
  review_status: 'pending' | 'ai_approved' | 'human_review' | 'approved' | 'rejected';
  risk_level: 'low' | 'medium' | 'high';
  ai_detection_results: any;
  ai_confidence: number | null;
  reviewer_id: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  copyright_evidence_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UploadPatternResponse {
  success: boolean;
  upload?: PatternUpload;
  ai_results?: any;
  error?: string;
}

export interface GetUserPatternsResponse {
  success: boolean;
  uploads?: PatternUpload[];
  error?: string;
}

export interface GetPatternDetailResponse {
  success: boolean;
  upload?: PatternUpload;
  error?: string;
}

export interface UpgradeServiceResponse {
  success: boolean;
  upload?: PatternUpload;
  error?: string;
}

export interface DeletePatternResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface GetStatsResponse {
  success: boolean;
  stats?: {
    total: string;
    pending: string;
    approved: string;
    rejected: string;
    free: string;
    certified: string;
    commercial: string;
  };
  error?: string;
}

class PatternUploadAPI {
  // 上传图案
  static async uploadPattern(formData: FormData): Promise<UploadPatternResponse> {
    try {
      const response = await api.post('/pattern-uploads/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error: any) {
      logger.error('上传图案失败:', error);
      return {
        success: false,
        error: error.response?.data?.error || '上传失败',
      };
    }
  }

  // 获取用户图案列表
  static async getUserPatterns(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<GetUserPatternsResponse> {
    try {
      const response = await api.get('/pattern-uploads/user-patterns', {
        params,
      });
      return response.data;
    } catch (error: any) {
      logger.error('获取用户图案列表失败:', error);
      return {
        success: false,
        error: error.response?.data?.error || '获取列表失败',
      };
    }
  }

  // 获取图案详情
  static async getPatternDetail(uploadId: string): Promise<GetPatternDetailResponse> {
    try {
      const response = await api.get(`/pattern-uploads/pattern/${uploadId}`);
      return response.data;
    } catch (error: any) {
      logger.error('获取图案详情失败:', error);
      return {
        success: false,
        error: error.response?.data?.error || '获取详情失败',
      };
    }
  }

  // 升级服务类型
  static async upgradeService(
    uploadId: string,
    serviceType: 'certified' | 'commercial'
  ): Promise<UpgradeServiceResponse> {
    try {
      const response = await api.put(`/pattern-uploads/pattern/${uploadId}/upgrade`, {
        service_type: serviceType,
      });
      return response.data;
    } catch (error: any) {
      logger.error('升级服务失败:', error);
      return {
        success: false,
        error: error.response?.data?.error || '升级失败',
      };
    }
  }

  // 删除图案
  static async deletePattern(uploadId: string): Promise<DeletePatternResponse> {
    try {
      const response = await api.delete(`/pattern-uploads/pattern/${uploadId}`);
      return response.data;
    } catch (error: any) {
      logger.error('删除图案失败:', error);
      return {
        success: false,
        error: error.response?.data?.error || '删除失败',
      };
    }
  }

  // 获取统计信息
  static async getStats(): Promise<GetStatsResponse> {
    try {
      const response = await api.get('/pattern-uploads/stats');
      return response.data;
    } catch (error: any) {
      logger.error('获取统计信息失败:', error);
      return {
        success: false,
        error: error.response?.data?.error || '获取统计失败',
      };
    }
  }
}

export { PatternUploadAPI };
