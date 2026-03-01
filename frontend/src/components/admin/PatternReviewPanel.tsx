import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../../utils/logger';
import { PatternUploadAPI } from '../../services/patternUpload';
import { useToast } from '../ui/Toast';

interface PatternUpload {
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
  created_at: string;
}

export const PatternReviewPanel: React.FC = () => {
  const toast = useToast();
  const [uploads, setUploads] = useState<PatternUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUpload, setSelectedUpload] = useState<PatternUpload | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [filterRisk, setFilterRisk] = useState<string>('all');

  // 获取待审核图案列表
  const fetchPendingUploads = useCallback(async () => {
    try {
      setLoading(true);
      const response = await PatternUploadAPI.getUserPatterns({
        status: filterStatus === 'all' ? undefined : filterStatus,
        limit: 50
      });
      
      if (response.success && response.uploads) {
        let filteredUploads = response.uploads;
        
        // 按风险等级过滤
        if (filterRisk !== 'all') {
          filteredUploads = filteredUploads.filter(upload => upload.risk_level === filterRisk);
        }
        
        setUploads(filteredUploads);
      } else {
        setError(response.error || '获取待审核列表失败');
      }
    } catch (error) {
      logger.error('获取待审核列表失败:', error);
      setError('获取待审核列表失败');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterRisk]);

  // 审核图案
  const handleReview = useCallback(async (uploadId: string, action: 'approve' | 'reject') => {
    if (!reviewNotes.trim()) {
      toast.error('请填写审核意见');
      return;
    }

    try {
      // 这里需要调用后端的审核API
      // 由于后端还没有实现审核API，这里先模拟
      logger.info('审核图案:', { uploadId, action, reviewNotes });
      
      // 更新本地状态
      setUploads(prev => prev.map(upload => 
        upload.id === uploadId 
          ? { 
              ...upload, 
              review_status: action === 'approve' ? 'approved' : 'rejected',
              review_notes: reviewNotes,
              reviewed_at: new Date().toISOString()
            }
          : upload
      ));
      
      setSelectedUpload(null);
      setReviewNotes('');
      toast.success(action === 'approve' ? '审核通过' : '审核拒绝');
      
    } catch (error) {
      logger.error('审核失败:', error);
      toast.error('审核失败，请稍后重试');
    }
  }, [reviewNotes]);

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

  // 获取风险等级颜色
  const getRiskColor = (risk: string) => {
    const colorMap: Record<string, string> = {
      low: 'text-green-600 bg-green-100',
      medium: 'text-yellow-600 bg-yellow-100',
      high: 'text-red-600 bg-red-100'
    };
    return colorMap[risk] || 'text-gray-600 bg-gray-100';
  };

  // 渲染AI检测结果
  const renderAIDetectionResults = (results: any) => {
    if (!results || !results.detections) return null;

    const { detections } = results;
    
    return (
      <div className="space-y-2 text-sm">
        <div className="font-medium">AI检测结果:</div>
        {detections.faces && (
          <div>人脸检测: {detections.faces.has_faces ? '检测到人脸' : '未检测到人脸'} (置信度: {(detections.faces.confidence * 100).toFixed(1)}%)</div>
        )}
        {detections.trademarks && (
          <div>商标检测: {detections.trademarks.has_trademarks ? '检测到商标' : '未检测到商标'} (置信度: {(detections.trademarks.confidence * 100).toFixed(1)}%)</div>
        )}
        {detections.copyright_content && (
          <div>版权内容: {detections.copyright_content.is_copyright_content ? '可能是版权内容' : '非版权内容'} (复杂度: {(detections.copyright_content.complexity_score * 100).toFixed(1)}%)</div>
        )}
        {detections.inappropriate_content && (
          <div>不当内容: {detections.inappropriate_content.is_inappropriate ? '可能包含不当内容' : '内容正常'} (评分: {(detections.inappropriate_content.inappropriate_score * 100).toFixed(1)}%)</div>
        )}
      </div>
    );
  };

  useEffect(() => {
    fetchPendingUploads();
  }, [fetchPendingUploads]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 标题和筛选 */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">图案审核管理</h2>
        <div className="flex space-x-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">全部状态</option>
            <option value="pending">待审核</option>
            <option value="human_review">人工审核中</option>
            <option value="approved">已通过</option>
            <option value="rejected">已拒绝</option>
          </select>
          <select
            value={filterRisk}
            onChange={(e) => setFilterRisk(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">全部风险</option>
            <option value="low">低风险</option>
            <option value="medium">中风险</option>
            <option value="high">高风险</option>
          </select>
        </div>
      </div>

      {/* 错误信息 */}
      {error && (
        <div className="text-red-600 bg-red-50 p-3 rounded-md">
          {error}
        </div>
      )}

      {/* 图案列表 */}
      {uploads.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          暂无待审核的图案
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {uploads.map((upload) => (
            <div key={upload.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-lg truncate">{upload.name}</h3>
                <div className="flex space-x-1">
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
                <div>尺寸: {upload.width} x {upload.height}</div>
                <div>颜色数: {upload.color_count}</div>
                {upload.ai_confidence && (
                  <div>AI置信度: {(upload.ai_confidence * 100).toFixed(1)}%</div>
                )}
                <div>上传时间: {new Date(upload.created_at).toLocaleDateString()}</div>
              </div>

              {/* AI检测结果 */}
              {upload.ai_detection_results && (
                <div className="mt-3 p-2 bg-gray-50 rounded-md">
                  {renderAIDetectionResults(upload.ai_detection_results)}
                </div>
              )}

              <div className="flex justify-end space-x-2 mt-4 pt-3 border-t border-gray-100">
                <button
                  onClick={() => setSelectedUpload(upload)}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  审核
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 审核模态框 */}
      {selectedUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">审核图案: {selectedUpload.name}</h3>
              <button
                onClick={() => setSelectedUpload(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* 图案信息 */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>图案名称:</strong> {selectedUpload.name}
                </div>
                <div>
                  <strong>服务类型:</strong> {selectedUpload.service_type === 'free' ? '免费' : selectedUpload.service_type === 'certified' ? '认证' : '商业'}
                </div>
                <div>
                  <strong>风险等级:</strong> 
                  <span className={`ml-1 px-2 py-1 rounded-full text-xs ${getRiskColor(selectedUpload.risk_level)}`}>
                    {selectedUpload.risk_level === 'low' ? '低风险' : selectedUpload.risk_level === 'medium' ? '中风险' : '高风险'}
                  </span>
                </div>
                <div>
                  <strong>AI置信度:</strong> {selectedUpload.ai_confidence ? `${(selectedUpload.ai_confidence * 100).toFixed(1)}%` : 'N/A'}
                </div>
              </div>

              {selectedUpload.description && (
                <div>
                  <strong>描述:</strong>
                  <p className="mt-1 text-gray-600">{selectedUpload.description}</p>
                </div>
              )}

              {/* AI检测结果 */}
              {selectedUpload.ai_detection_results && (
                <div>
                  <strong>AI检测结果:</strong>
                  <div className="mt-2 p-3 bg-gray-50 rounded-md">
                    {renderAIDetectionResults(selectedUpload.ai_detection_results)}
                  </div>
                </div>
              )}

              {/* 审核意见 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  审核意见 *
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="请填写审核意见..."
                  rows={4}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>

              {/* 操作按钮 */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setSelectedUpload(null)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={() => handleReview(selectedUpload.id, 'reject')}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  拒绝
                </button>
                <button
                  onClick={() => handleReview(selectedUpload.id, 'approve')}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  通过
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatternReviewPanel;
