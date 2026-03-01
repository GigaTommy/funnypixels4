import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../../utils/logger';
import { PatternUploadAPI } from '../../services/patternUpload';
import PatternUploadModal from './PatternUploadModal';
import { dialogService } from '../../services/dialogService';

interface PatternUpload {
  id: string;
  name: string;
  description: string;
  service_type: 'free' | 'certified' | 'commercial';
  review_status: 'pending' | 'ai_approved' | 'human_review' | 'approved' | 'rejected';
  risk_level: 'low' | 'medium' | 'high';
  ai_confidence: number | null;
  created_at: string;
}

export const PatternManagement: React.FC = () => {
  const [uploads, setUploads] = useState<PatternUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // 获取用户图案列表
  const fetchUploads = useCallback(async () => {
    try {
      setLoading(true);
      const response = await PatternUploadAPI.getUserPatterns();
      
      if (response.success) {
        setUploads(response.uploads || []);
      } else {
        setError(response.error || '获取图案列表失败');
      }
    } catch (error) {
      logger.error('获取图案列表失败:', error);
      setError('获取图案列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 删除图案
  const handleDelete = useCallback(async (uploadId: string) => {
    const confirmed = await dialogService.confirm('确定要删除这个图案吗？此操作不可撤销。', {
      title: '删除图案',
      type: 'warning'
    });
    if (!confirmed) {
      return;
    }

    try {
      const response = await PatternUploadAPI.deletePattern(uploadId);
      
      if (response.success) {
        // 从列表中移除
        setUploads(prev => prev.filter(upload => upload.id !== uploadId));
      } else {
        await dialogService.alert(response.error || '删除失败', {
          type: 'error',
          title: '删除失败'
        });
      }
    } catch (error) {
      logger.error('删除失败:', error);
      await dialogService.alert('删除失败，请稍后重试', {
        type: 'error',
        title: '删除失败'
      });
    }
  }, []);

  // 升级服务类型
  const handleUpgrade = useCallback(async (uploadId: string, newServiceType: 'certified' | 'commercial') => {
    try {
      const response = await PatternUploadAPI.upgradeService(uploadId, newServiceType);
      
      if (response.success) {
        // 更新列表中的项目
        setUploads(prev => prev.map(upload => 
          upload.id === uploadId 
            ? { ...upload, service_type: response.upload?.service_type || upload.service_type, review_status: response.upload?.review_status || upload.review_status }
            : upload
        ));
      } else {
        await dialogService.alert(response.error || '升级失败', {
          type: 'error',
          title: '升级失败'
        });
      }
    } catch (error) {
      logger.error('升级失败:', error);
      await dialogService.alert('升级失败，请稍后重试', {
        type: 'error',
        title: '升级失败'
      });
    }
  }, []);

  // 获取状态显示文本
  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: '待审核',
      ai_approved: 'AI已通过',
      human_review: '人工审核中',
      approved: '已通过',
      rejected: '已拒绝'
    };
    return statusMap[status] || status;
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      pending: 'text-yellow-600 bg-yellow-100',
      ai_approved: 'text-green-600 bg-green-100',
      human_review: 'text-blue-600 bg-blue-100',
      approved: 'text-green-600 bg-green-100',
      rejected: 'text-red-600 bg-red-100'
    };
    return colorMap[status] || 'text-gray-600 bg-gray-100';
  };

  // 获取风险等级颜色
  const getRiskColor = (risk: string) => {
    const colorMap: Record<string, string> = {
      low: 'text-green-600 bg-green-100',
      medium: 'text-yellow-600 bg-yellow-100',
      high: 'text-red-600 bg-red-100'
    };
    return colorMap[risk] || 'text-gray-600 bg-gray-100';
  };

  // 过滤图案列表
  const filteredUploads = uploads.filter(upload => {
    if (selectedStatus === 'all') return true;
    return upload.review_status === selectedStatus;
  });

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 标题和操作按钮 */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">我的图案管理</h2>
        <button
          onClick={() => setShowUploadModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          上传新图案
        </button>
      </div>

      {/* 状态筛选 */}
      <div className="flex space-x-2">
        <button
          onClick={() => setSelectedStatus('all')}
          className={`px-3 py-1 rounded-md text-sm ${
            selectedStatus === 'all' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          全部
        </button>
        <button
          onClick={() => setSelectedStatus('pending')}
          className={`px-3 py-1 rounded-md text-sm ${
            selectedStatus === 'pending' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          待审核
        </button>
        <button
          onClick={() => setSelectedStatus('approved')}
          className={`px-3 py-1 rounded-md text-sm ${
            selectedStatus === 'approved' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          已通过
        </button>
        <button
          onClick={() => setSelectedStatus('rejected')}
          className={`px-3 py-1 rounded-md text-sm ${
            selectedStatus === 'rejected' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          已拒绝
        </button>
      </div>

      {/* 错误信息 */}
      {error && (
        <div className="text-red-600 bg-red-50 p-3 rounded-md">
          {error}
        </div>
      )}

      {/* 图案列表 */}
      {filteredUploads.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {selectedStatus === 'all' ? '暂无图案，点击"上传新图案"开始创建' : '暂无符合条件的图案'}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredUploads.map((upload) => (
            <div key={upload.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-lg truncate">{upload.name}</h3>
                <div className="flex space-x-1">
                  <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(upload.review_status)}`}>
                    {getStatusText(upload.review_status)}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs ${getRiskColor(upload.risk_level)}`}>
                    {upload.risk_level === 'low' ? '低风险' : upload.risk_level === 'medium' ? '中风险' : '高风险'}
                  </span>
                </div>
              </div>

              {upload.description && (
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">{upload.description}</p>
              )}

              <div className="space-y-2 text-sm text-gray-500">
                <div>服务类型: {upload.service_type === 'free' ? '免费' : upload.service_type === 'certified' ? '认证' : '商业'}</div>
                {upload.ai_confidence && (
                  <div>AI置信度: {(upload.ai_confidence * 100).toFixed(1)}%</div>
                )}
                <div>上传时间: {new Date(upload.created_at).toLocaleDateString()}</div>
              </div>

              <div className="flex justify-end space-x-2 mt-4 pt-3 border-t border-gray-100">
                {upload.service_type === 'free' && upload.review_status === 'approved' && (
                  <>
                    <button
                      onClick={() => handleUpgrade(upload.id, 'certified')}
                      className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      升级认证
                    </button>
                    <button
                      onClick={() => handleUpgrade(upload.id, 'commercial')}
                      className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                    >
                      升级商业
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleDelete(upload.id)}
                  className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 上传模态框 */}
      <PatternUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={(uploadId) => {
          setShowUploadModal(false);
          fetchUploads(); // 刷新列表
        }}
      />
    </div>
  );
};

export default PatternManagement;
