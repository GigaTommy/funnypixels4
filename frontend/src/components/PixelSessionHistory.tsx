import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History,
  MapPin,
  Clock,
  Palette,
  BarChart3,
  Filter,
  Calendar,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Eye,
  Share2,
  Download,
  RefreshCw,
  AlertCircle,
  Navigation,
  Users,
  Timer,
  Grid3X3,
  Route,
  Star,
  Award,
  Flag
} from 'lucide-react';
import { logger } from '../utils/logger';
import { pixelSessionService, type DrawingSession, type DrawingStats } from '../services/pixelSessionService';
import { toast } from '../services/toast';
import { soundService } from '../services/soundService';

interface PixelSessionHistoryProps {
  isAuthenticated: boolean;
  onNavigate?: (page: string) => void;
}

type ViewMode = 'card' | 'list';
type SortType = 'newest' | 'oldest' | 'longest' | 'shortest' | 'most_pixels';

export default function PixelSessionHistory({ isAuthenticated }: PixelSessionHistoryProps) {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<DrawingSession[]>([]);
  const [stats, setStats] = useState<DrawingStats | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [sortType, setSortType] = useState<SortType>('newest');
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedSession, setSelectedSession] = useState<DrawingSession | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // 加载会话数据
  const loadSessions = useCallback(async (pageNum: number = 1, reset: boolean = false) => {
    if (!isAuthenticated) return;

    try {
      if (reset) {
        setLoading(true);
        setPage(1);
      } else {
        setLoadingMore(true);
      }

      const response = await pixelSessionService.getUserDrawingSessions({
        page: pageNum,
        limit: 20
      });

      if (response.success && response.data) {
        if (reset) {
          setSessions(response.data.sessions);
        } else {
          setSessions(prev => [...prev, ...response.data.sessions]);
        }

        setHasMore(response.pagination ? pageNum < response.pagination.totalPages : false);
        setPage(pageNum);
      }
    } catch (error) {
      logger.error('加载绘制会话失败:', error);
      toast.error('加载失败，请重试');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [isAuthenticated]);

  // 加载统计数据
  const loadStats = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const response = await pixelSessionService.getUserDrawingStats();
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      logger.error('加载统计数据失败:', error);
    }
  }, [isAuthenticated]);

  // 初始化加载
  useEffect(() => {
    if (isAuthenticated) {
      loadSessions(1, true);
      loadStats();
    }
  }, [isAuthenticated, loadSessions, loadStats]);

  // 排序会话
  const sortedSessions = useMemo(() => {
    const sorted = [...sessions];

    switch (sortType) {
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      case 'longest':
        return sorted.sort((a, b) => b.duration.minutes - a.duration.minutes);
      case 'shortest':
        return sorted.sort((a, b) => a.duration.minutes - b.duration.minutes);
      case 'most_pixels':
        return sorted.sort((a, b) => b.statistics.pixelCount - a.statistics.pixelCount);
      case 'newest':
      default:
        return sorted.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    }
  }, [sessions, sortType]);

  // 处理会话展开/收起
  const toggleSessionExpanded = (sessionId: string) => {
    setExpandedSession(prev => prev === sessionId ? null : sessionId);
    soundService.play('click');
  };

  // 处理会话详情查看
  const handleViewSessionDetails = async (session: DrawingSession) => {
    try {
      setSelectedSession(session);
      setShowDetailModal(true);
      soundService.play('click');
    } catch (error) {
      logger.error('获取会话详情失败:', error);
      toast.error('获取详情失败');
    }
  };

  // 导出功能
  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const response = await pixelSessionService.exportDrawingHistory({ format });

      if (response.success) {
        // 创建下载链接
        const blob = new Blob([format === 'json' ? JSON.stringify(response.data, null, 2) : response.data], {
          type: format === 'json' ? 'application/json' : 'text/csv'
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `drawing_history_${Date.now()}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success('导出成功');
      }
    } catch (error) {
      logger.error('导出失败:', error);
      toast.error('导出失败');
    }
  };

  // 刷新数据
  const handleRefresh = () => {
    loadSessions(1, true);
    loadStats();
    soundService.play('click');
  };

  // 格式化时间
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 渲染统计数据
  const renderStats = () => {
    if (!stats) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="stats-section"
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '20px',
          color: 'white',
          boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <BarChart3 size={20} />
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>绘制统计</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>
              {stats.totalPixels}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.9 }}>总绘制像素</div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>
              {stats.activeDays}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.9 }}>活跃天数</div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>
              {stats.citiesVisited}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.9 }}>访问城市</div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>
              {stats.experience.level}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.9 }}>经验等级</div>
          </div>
        </div>

        {/* 经验条 */}
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span>{stats.experience.level}</span>
            <span>{stats.experience.progress}%</span>
          </div>
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${stats.experience.progress}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              style={{
                height: '100%',
                backgroundColor: '#ffd700',
                borderRadius: '4px'
              }}
            />
          </div>
        </div>
      </motion.div>
    );
  };

  // 渲染会话卡片
  const renderSessionCard = (session: DrawingSession, index: number) => {
    const isExpanded = expandedSession === session.sessionId;

    return (
      <motion.div
        key={session.sessionId}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        whileHover={{ scale: 1.02 }}
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '16px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          cursor: 'pointer',
          border: '1px solid #e5e7eb'
        }}
        onClick={() => toggleSessionExpanded(session.sessionId)}
      >
        {/* 会话头部 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Route size={16} style={{ color: '#6366f1' }} />
              <span style={{ fontWeight: '600', fontSize: '14px', color: '#1f2937' }}>
                绘制会话 #{session.sessionId.split('_')[1]}
              </span>
              <span style={{
                padding: '2px 8px',
                backgroundColor: '#f3f4f6',
                borderRadius: '12px',
                fontSize: '11px',
                color: '#6b7280'
              }}>
                {session.duration.formatted}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#6b7280' }}>
              <Clock size={12} />
              <span>{formatTime(session.startTime)}</span>
            </div>
          </div>

          <ChevronDown
            size={16}
            style={{
              color: '#9ca3af',
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s ease'
            }}
          />
        </div>

        {/* 统计数据 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '12px' }}>
          <div style={{ textAlign: 'center' }}>
            <Grid3X3 size={16} style={{ color: '#10b981', margin: '0 auto 4px' }} />
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>
              {session.statistics.pixelCount}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>像素</div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <MapPin size={16} style={{ color: '#f59e0b', margin: '0 auto 4px' }} />
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>
              {session.statistics.citiesVisited}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>城市</div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <Palette size={16} style={{ color: '#8b5cf6', margin: '0 auto 4px' }} />
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>
              {session.statistics.patternsUsed}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>图案</div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <Flag size={16} style={{ color: '#ef4444', margin: '0 auto 4px' }} />
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1f2937' }}>
              {session.alliance.name}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>联盟</div>
          </div>
        </div>

        {/* 路径信息 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', backgroundColor: '#f9fafb', borderRadius: '8px', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%' }} />
            <span>起点: {session.locations.start?.city || '未知'}</span>
          </div>
          <Navigation size={12} style={{ color: '#6b7280' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>终点: {session.locations.end?.city || '未知'}</span>
            <div style={{ width: '8px', height: '8px', backgroundColor: '#ef4444', borderRadius: '50%' }} />
          </div>
        </div>

        {/* 展开的详细信息 */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{ overflow: 'hidden', marginTop: '12px' }}
            >
              <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#1f2937' }}>详细信息</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewSessionDetails(session);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      backgroundColor: '#6366f1',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    <Eye size={12} />
                    查看详情
                  </button>
                </div>

                <div style={{ fontSize: '11px', color: '#6b7280', lineHeight: '1.5' }}>
                  <div>唯一格子: {session.statistics.uniqueGrids}个</div>
                  <div>主要图案: {session.patterns.main.name}</div>
                  <div>会话时长: {session.duration.formatted}</div>
                  <div>结束时间: {formatTime(session.endTime)}</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  // 渲染列表模式
  const renderSessionList = (session: DrawingSession, index: number) => {
    return (
      <motion.div
        key={session.sessionId}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05 }}
        whileHover={{ x: 4 }}
        style={{
          background: 'white',
          padding: '12px 16px',
          borderBottom: '1px solid #e5e7eb',
          cursor: 'pointer'
        }}
        onClick={() => handleViewSessionDetails(session)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Route size={14} style={{ color: '#6366f1' }} />
              <span style={{ fontWeight: '500', fontSize: '13px', color: '#1f2937' }}>
                会话 #{session.sessionId.split('_')[1]}
              </span>
              <span style={{
                padding: '1px 6px',
                backgroundColor: '#f3f4f6',
                borderRadius: '10px',
                fontSize: '10px',
                color: '#6b7280'
              }}>
                {session.duration.formatted}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#6b7280' }}>
              <span>{session.statistics.pixelCount}像素</span>
              <span>{session.statistics.citiesVisited}城市</span>
              <span>{session.statistics.patternsUsed}图案</span>
              <span>{session.alliance.name}</span>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>
              {formatTime(session.startTime)}
            </div>
            <div style={{ fontSize: '10px', color: '#9ca3af' }}>
              {session.locations.start?.city} → {session.locations.end?.city}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  if (!isAuthenticated) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        color: '#6b7280'
      }}>
        <AlertCircle size={48} style={{ marginBottom: '16px', color: '#d1d5db' }} />
        <p>请先登录查看绘制历史</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', maxWidth: '800px', margin: '0 auto' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <History size={20} style={{ color: '#6366f1' }} />
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>
            绘制历史
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {/* 排序选项 */}
          <select
            value={sortType}
            onChange={(e) => setSortType(e.target.value as SortType)}
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '12px',
              backgroundColor: 'white'
            }}
          >
            <option value="newest">最新优先</option>
            <option value="oldest">最早优先</option>
            <option value="longest">时间最长</option>
            <option value="shortest">时间最短</option>
            <option value="most_pixels">像素最多</option>
          </select>

          {/* 视图模式切换 */}
          <div style={{
            display: 'flex',
            backgroundColor: '#f3f4f6',
            borderRadius: '6px',
            padding: '2px'
          }}>
            <button
              onClick={() => setViewMode('card')}
              style={{
                padding: '4px 8px',
                backgroundColor: viewMode === 'card' ? 'white' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: viewMode === 'card' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              卡片
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '4px 8px',
                backgroundColor: viewMode === 'list' ? 'white' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              列表
            </button>
          </div>

          {/* 操作按钮 */}
          <button
            onClick={handleRefresh}
            style={{
              padding: '6px 12px',
              backgroundColor: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <RefreshCw size={14} />
            刷新
          </button>

          <button
            onClick={() => handleExport('json')}
            style={{
              padding: '6px 12px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Download size={14} />
            导出
          </button>
        </div>
      </div>

      {/* 统计数据 */}
      <AnimatePresence>
        {showStats && stats && renderStats()}
      </AnimatePresence>

      {/* 加载状态 */}
      {loading && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '200px'
        }}>
          <RefreshCw size={32} className="animate-spin" style={{ color: '#6366f1', marginBottom: '16px' }} />
          <p style={{ color: '#6b7280' }}>加载中...</p>
        </div>
      )}

      {/* 会话列表 */}
      {!loading && (
        <AnimatePresence>
          {sortedSessions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '200px',
                color: '#6b7280'
              }}
            >
              <History size={48} style={{ marginBottom: '16px', color: '#d1d5db' }} />
              <p>暂无绘制历史</p>
            </motion.div>
          ) : (
            <div>
              {viewMode === 'card'
                ? sortedSessions.map(renderSessionCard)
                : sortedSessions.map(renderSessionList)
              }

              {/* 加载更多 */}
              {hasMore && (
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                  <button
                    onClick={() => loadSessions(page + 1, false)}
                    disabled={loadingMore}
                    style={{
                      padding: '8px 24px',
                      backgroundColor: '#f3f4f6',
                      color: '#374151',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      cursor: loadingMore ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      margin: '0 auto'
                    }}
                  >
                    {loadingMore ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        加载中...
                      </>
                    ) : (
                      '加载更多'
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
      )}

      {/* 详情模态框 */}
      <AnimatePresence>
        {showDetailModal && selectedSession && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDetailModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'white',
                borderRadius: '16px',
                padding: '24px',
                maxWidth: '600px',
                width: '90%',
                maxHeight: '80vh',
                overflow: 'auto'
              }}
            >
              {/* 详情头部 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                  会话详情 - {selectedSession.sessionId}
                </h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '20px',
                    cursor: 'pointer',
                    color: '#6b7280'
                  }}
                >
                  ×
                </button>
              </div>

              {/* 详情内容 */}
              <div style={{ display: 'grid', gap: '16px' }}>
                <div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                    基本信息
                  </h4>
                  <div style={{ backgroundColor: '#f9fafb', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
                    <div style={{ marginBottom: '4px' }}>开始时间: {formatTime(selectedSession.startTime)}</div>
                    <div style={{ marginBottom: '4px' }}>结束时间: {formatTime(selectedSession.endTime)}</div>
                    <div style={{ marginBottom: '4px' }}>持续时长: {selectedSession.duration.formatted}</div>
                    <div>所属联盟: {selectedSession.alliance.name}</div>
                  </div>
                </div>

                <div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                    统计数据
                  </h4>
                  <div style={{ backgroundColor: '#f9fafb', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
                    <div style={{ marginBottom: '4px' }}>绘制像素: {selectedSession.statistics.pixelCount}个</div>
                    <div style={{ marginBottom: '4px' }}>唯一格子: {selectedSession.statistics.uniqueGrids}个</div>
                    <div style={{ marginBottom: '4px' }}>访问城市: {selectedSession.statistics.citiesVisited}个</div>
                    <div>使用图案: {selectedSession.statistics.patternsUsed}种</div>
                  </div>
                </div>

                <div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                    路径信息
                  </h4>
                  <div style={{ backgroundColor: '#f9fafb', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
                    <div style={{ marginBottom: '4px' }}>
                      起点: {selectedSession.locations.start?.city || '未知'}
                      {selectedSession.locations.start?.coordinates &&
                        ` (${selectedSession.locations.start.coordinates[1].toFixed(4)}, ${selectedSession.locations.start.coordinates[0].toFixed(4)})`
                      }
                    </div>
                    <div>
                      终点: {selectedSession.locations.end?.city || '未知'}
                      {selectedSession.locations.end?.coordinates &&
                        ` (${selectedSession.locations.end.coordinates[1].toFixed(4)}, ${selectedSession.locations.end.coordinates[0].toFixed(4)})`
                      }
                    </div>
                  </div>
                </div>

                <div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                    图案信息
                  </h4>
                  <div style={{ backgroundColor: '#f9fafb', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
                    <div style={{ marginBottom: '4px' }}>主要图案: {selectedSession.patterns.main.name}</div>
                    <div>图案数量: {selectedSession.patterns.uniqueCount}种</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}