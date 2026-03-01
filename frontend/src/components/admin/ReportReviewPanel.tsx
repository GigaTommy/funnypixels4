import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ReportAPI } from '../../services/report';
import { AuthService } from '../../services/auth';
import { soundService } from '../../services/soundService';
import { logger } from '../../utils/logger';
import {
  AlertTriangle,
  User,
  MessageSquare,
  Image as ImageIcon,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  Filter,
  BarChart3,
  Flag,
  Archive,
  AlertCircle,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

// 使用ReportAPI中定义的Report接口
type Report = {
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
};

const REPORT_REASON_LABELS = {
  porn: '色情内容',
  violence: '暴力内容',
  political: '政治敏感',
  spam: '垃圾信息',
  abuse: '恶意行为',
  hate_speech: '仇恨言论',
  inappropriate: '不当内容',
  other: '其他'
};

const STATUS_CONFIG = {
  pending: {
    color: '#FFA500',
    bgColor: '#FFF7E6',
    textColor: '#FF8C00',
    label: '待处理',
    icon: Clock
  },
  reviewing: {
    color: '#5A4AF4',
    bgColor: '#F0F0FF',
    textColor: '#4545A0',
    label: '审核中',
    icon: Eye
  },
  resolved: {
    color: '#4ECDC4',
    bgColor: '#E6F7F5',
    textColor: '#00A896',
    label: '已解决',
    icon: CheckCircle
  },
  rejected: {
    color: '#FF6B6B',
    bgColor: '#FFEBEE',
    textColor: '#E53935',
    label: '已拒绝',
    icon: XCircle
  }
};

export const ReportReviewPanel: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [statistics, setStatistics] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  // 加载当前用户信息
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = await AuthService.getCurrentUser();
        setCurrentUser(user);
      } catch (error) {
        logger.error('获取当前用户信息失败:', error);
      }
    };
    loadCurrentUser();
  }, []);

  // 加载举报列表
  const loadReports = async () => {
    try {
      setLoading(true);
      const response = await ReportAPI.getReports({
        status: filterStatus !== 'all' ? filterStatus : undefined,
        targetType: 'pixel',
        limit: 50,
        offset: 0
      });

      if (response.success && response.data) {
        setReports(response.data);
      } else {
        setError('加载举报列表失败');
      }
    } catch (error: any) {
      logger.error('加载举报列表失败:', error);

      if (error.response?.status === 403) {
        setError('权限不足：无法访问举报管理功能。请确认您的管理员权限已正确配置。');
      } else if (error.response?.status === 401) {
        setError('身份验证失败：请重新登录');
      } else if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        setError('网络连接失败：请检查网络连接或联系系统管理员');
      } else {
        setError(`加载举报列表失败: ${error.message || '未知错误'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时加载数据，以及当过滤器变化时重新加载
  useEffect(() => {
    loadReports();
    loadStatistics();
  }, [filterStatus]);

  // 加载统计信息
  const loadStatistics = async () => {
    try {
      setLoadingStats(true);
      const response = await ReportAPI.getReportStatistics();
      if (response.success && response.data) {
        setStatistics(response.data);
      }
    } catch (error: any) {
      logger.error('加载统计信息失败:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  // 分配举报给当前管理员
  const handleAssignReport = async (reportId: string) => {
    soundService.play('confirm');
    setProcessingAction(reportId);
    try {
      const response = await ReportAPI.assignReport(reportId);
      if (response.success) {
        loadReports();
        logger.info('举报分配成功');
      }
    } catch (error) {
      logger.error('分配举报失败:', error);
    } finally {
      setProcessingAction(null);
    }
  };

  // 处理举报
  const handleResolveReport = async (reportId: string, resolution: 'resolved' | 'rejected', note?: string) => {
    soundService.play('confirm');
    setProcessingAction(reportId);
    try {
      const response = await ReportAPI.resolveReport(reportId, resolution, note);
      if (response.success) {
        loadReports();
        setSelectedReport(null);
        setResolutionNote('');
        logger.info('举报处理成功');
      }
    } catch (error) {
      logger.error('处理举报失败:', error);
    } finally {
      setProcessingAction(null);
    }
  };

  // 获取目标类型图标
  const getTargetIcon = (targetType: string) => {
    switch (targetType) {
      case 'pixel': return ImageIcon;
      case 'user': return User;
      case 'message': return MessageSquare;
      default: return AlertTriangle;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-3 border-gray-200 border-t-blue-600 rounded-full"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 p-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4"
        >
          <AlertCircle className="w-8 h-8 text-red-500" />
        </motion.div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">加载失败</h3>
        <p className="text-gray-600 text-center mb-6 max-w-md">{error}</p>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={loadReports}
          className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
        >
          重试
        </motion.button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 统计卡片区域 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statistics && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-blue-50">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-2">
                  {statistics.summary.totalReports || 0}
                </div>
                <div className="text-sm text-gray-600">总举报数</div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: STATUS_CONFIG.pending.bgColor }}>
                  <Clock className="w-6 h-6" style={{ color: STATUS_CONFIG.pending.color }} />
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-2">
                  {statistics.details?.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.report_count, 0) || 0}
                </div>
                <div className="text-sm text-gray-600">待处理举报</div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: STATUS_CONFIG.resolved.bgColor }}>
                  <CheckCircle className="w-6 h-6" style={{ color: STATUS_CONFIG.resolved.color }} />
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-2">
                  {statistics.summary.totalResolved || 0}
                </div>
                <div className="text-sm text-gray-600">已解决举报</div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gray-50">
                  <RefreshCw className="w-6 h-6 text-gray-600" />
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    loadReports();
                    loadStatistics();
                  }}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium text-sm"
                >
                  刷新数据
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </div>

      {/* 过滤器 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-2xl shadow-sm p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-gray-600" />
            <span className="font-medium text-gray-900">状态过滤</span>
          </div>
          <div className="text-sm text-gray-500">
            共 {reports.length} 条记录
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {[
            { value: 'all', label: '全部' },
            { value: 'pending', label: '待处理' },
            { value: 'reviewing', label: '审核中' },
            { value: 'resolved', label: '已解决' },
            { value: 'rejected', label: '已拒绝' }
          ].map((filter) => (
            <motion.button
              key={filter.value}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setFilterStatus(filter.value)}
              className={`
                px-4 py-2 rounded-xl font-medium transition-all duration-200 text-sm
                ${filterStatus === filter.value
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
            >
              {filter.label}
              {filter.value !== 'all' && (
                <span className="ml-2 px-2 py-0.5 bg-white bg-opacity-20 rounded-full text-xs">
                  {reports.filter(r => filter.value === 'all' ? true : r.status === filter.value).length}
                </span>
              )}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* 举报列表和详情 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 举报列表 */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl shadow-sm overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">举报列表</h3>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {reports.length === 0 ? (
              <div className="p-8 text-center">
                <Archive className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">暂无举报记录</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                <AnimatePresence>
                  {reports.map((report, index) => {
                    const TargetIcon = getTargetIcon(report.target_type);
                    const statusConfig = STATUS_CONFIG[report.status];

                    return (
                      <motion.div
                        key={report.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ scale: 1.01 }}
                        onClick={() => setSelectedReport(report)}
                        className={`
                          p-4 cursor-pointer transition-all duration-200 hover:bg-gray-50
                          ${selectedReport?.id === report.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''}
                        `}
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: statusConfig.bgColor }}
                          >
                            <TargetIcon className="w-5 h-5" style={{ color: statusConfig.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900 truncate">
                                {REPORT_REASON_LABELS[report.reason] || report.reason}
                              </span>
                              <span
                                className="text-xs px-2 py-1 rounded-full font-medium"
                                style={{
                                  backgroundColor: statusConfig.bgColor,
                                  color: statusConfig.textColor
                                }}
                              >
                                {statusConfig.label}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-1">
                              举报者: {report.reporter_display_name || report.reporter_username}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(report.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.div>

        {/* 举报详情 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl shadow-sm overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">举报详情</h3>
          </div>

          {selectedReport ? (
            <div className="p-6">
              <div className="space-y-6">
                {/* 举报基本信息 */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="font-medium text-gray-900 mb-4">基本信息</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">举报原因:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {REPORT_REASON_LABELS[selectedReport.reason]}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">目标类型:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {selectedReport.target_type}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">举报者:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {selectedReport.reporter_display_name || selectedReport.reporter_username}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">状态:</span>
                      <span className="ml-2 font-medium" style={{ color: STATUS_CONFIG[selectedReport.status].color }}>
                        {STATUS_CONFIG[selectedReport.status].label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 举报描述 */}
                {selectedReport.description && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="font-medium text-gray-900 mb-2">举报描述</h4>
                    <p className="text-sm text-gray-700">{selectedReport.description}</p>
                  </div>
                )}

                {/* 处理操作 */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="font-medium text-gray-900 mb-4">处理操作</h4>
                  <div className="space-y-4">
                    {selectedReport.status === 'pending' && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleAssignReport(selectedReport.id)}
                        disabled={processingAction === selectedReport.id}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                      >
                        {processingAction === selectedReport.id ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            处理中...
                          </div>
                        ) : (
                          '分配给我'
                        )}
                      </motion.button>
                    )}

                    <div className="flex gap-3">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleResolveReport(selectedReport.id, 'resolved', resolutionNote)}
                        disabled={processingAction === selectedReport.id}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
                      >
                        {processingAction === selectedReport.id ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            处理中...
                          </div>
                        ) : (
                          '通过'
                        )}
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleResolveReport(selectedReport.id, 'rejected', resolutionNote)}
                        disabled={processingAction === selectedReport.id}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
                      >
                        {processingAction === selectedReport.id ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            处理中...
                          </div>
                        ) : (
                          '拒绝'
                        )}
                      </motion.button>
                    </div>

                    <textarea
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      placeholder="处理说明（可选）"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center">
              <Eye className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">请选择一个举报查看详情</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};