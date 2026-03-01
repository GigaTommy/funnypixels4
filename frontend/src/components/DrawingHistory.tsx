import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Grid,
  List,
  Search,
  ChevronDown,
  ChevronUp,
  Eye,
  Share2,
  Download,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { logger } from '../utils/logger';
import { AuthService } from '../services/auth';
import { drawingHistoryService, type DrawingHistoryItem, type DrawingStatsResponse } from '../services/drawingHistoryService';
import { pixelsHistoryService, type PixelsHistoryItem, type PixelsHistoryResponse, type PixelsHistoryStats } from '../services/pixelsHistoryService';
import { sessionHistoryService, type SessionHistoryItem, type SessionHistoryResponse, type SessionStatisticsResponse } from '../services/sessionHistoryService';
import { drawingSessionService, type DrawingSession } from '../services/drawingSessionService';
import { toast } from '../services/toast';
import { soundService } from '../services/soundService';
import { AllianceFlagRenderer } from './ui/AllianceFlagRenderer';
import ShareModal from './ShareModal';
import TrackMapViewer from './TrackMapViewer';

interface DrawingHistoryProps {
  isAuthenticated: boolean;
  onNavigate?: (page: string) => void;
}

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'today' | 'week' | 'month' | 'year';
type SortType = 'newest' | 'oldest' | 'most_pixels' | 'most_time';

export default function DrawingHistory({ isAuthenticated }: DrawingHistoryProps) {
  const [loading, setLoading] = useState(true);
  const [drawings, setDrawings] = useState<DrawingHistoryItem[]>([]);
  const [pixelHistory, setPixelHistory] = useState<PixelsHistoryItem[]>([]);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);
  const [viewType, setViewType] = useState<'session' | 'pixel' | 'battle'>('session'); // 默认显示会话历史
  const [stats, setStats] = useState<DrawingStatsResponse['data'] | null>(null);
  const [pixelStats, setPixelStats] = useState<PixelsHistoryStats['data'] | null>(null);
  const [sessions, setSessions] = useState<DrawingSession[]>([]);
  const [sessionStats, setSessionStats] = useState<any>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortType, setSortType] = useState<SortType>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDrawing, setSelectedDrawing] = useState<DrawingHistoryItem | null>(null);
  const [selectedPixel, setSelectedPixel] = useState<PixelsHistoryItem | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionHistoryItem | null>(null);
  const [showStats, setShowStats] = useState(true); // 默认显示统计
  const [showSessionStats, setShowSessionStats] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedShareSession, setSelectedShareSession] = useState<SessionHistoryItem | null>(null);
  const [showTrackViewer, setShowTrackViewer] = useState(false);
  const [selectedTrackSession, setSelectedTrackSession] = useState<SessionHistoryItem | null>(null);

  const LIMIT = 20;

  // 获取当前用户ID
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUserId = async () => {
      const user = await AuthService.getCurrentUser();
      setCurrentUserId(user?.id || null);
    };
    getUserId();
  }, [isAuthenticated]);

  // 加载会话历史
  const loadSessionHistory = useCallback(async (reset = false) => {
    if (!currentUserId || !isAuthenticated) return;

    try {
      if (reset) {
        setLoading(true);
        setOffset(0);
        setSessionHistory([]);
      } else {
        setLoadingMore(true);
      }

      // 计算日期过滤
      const endDate = new Date();
      const startDate = new Date();

      switch (filterType) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(endDate.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
        default:
          startDate.setFullYear(endDate.getFullYear() - 5); // 显示所有历史
      }

      const response = await sessionHistoryService.getUserSessions({
        page: reset ? 1 : Math.floor(offset / LIMIT) + 1,
        limit: LIMIT,
        status: 'completed', // 只显示已完成的会话
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      });

      if (response.success && response.data) {
        if (reset) {
          setSessionHistory(response.data.sessions);
        } else {
          setSessionHistory(prev => [...prev, ...response.data!.sessions]);
        }
        setHasMore(response.data.sessions.length === LIMIT);
        setOffset(prev => prev + response.data!.sessions.length);
      } else {
        toast.error(response.error || '加载会话历史失败');
      }
    } catch (error) {
      logger.error('加载会话历史失败:', error);
      toast.error('加载会话历史失败');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [currentUserId, isAuthenticated, filterType, offset]);

  // 加载像素历史
  const loadPixelHistory = useCallback(async (reset = false) => {
    if (!currentUserId || !isAuthenticated) return;

    try {
      if (reset) {
        setLoading(true);
        setOffset(0);
        setPixelHistory([]);
      } else {
        setLoadingMore(true);
      }

      // 计算日期过滤
      const endDate = new Date();
      const startDate = new Date();

      switch (filterType) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(endDate.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
        default:
          startDate.setFullYear(endDate.getFullYear() - 5); // 显示所有历史
      }

      const response = await pixelsHistoryService.getUserPixelHistory(currentUserId, {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        limit: LIMIT,
        offset: reset ? 0 : offset
      });

      if (response.success && response.data) {
        if (reset) {
          setPixelHistory(response.data);
        } else {
          setPixelHistory(prev => [...prev, ...response.data!]);
        }
        setHasMore(response.data.length === LIMIT);
        setOffset(prev => prev + response.data!.length);
      } else {
        toast.error(response.error || '加载像素历史失败');
      }
    } catch (error) {
      logger.error('加载像素历史失败:', error);
      toast.error('加载像素历史失败');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [currentUserId, isAuthenticated, filterType, offset]);

  // 加载绘制历史
  const loadDrawingHistory = useCallback(async (reset = false) => {
    if (!currentUserId || !isAuthenticated) return;

    try {
      if (reset) {
        setLoading(true);
        setOffset(0);
        setDrawings([]);
      } else {
        setLoadingMore(true);
      }

      // 计算日期过滤
      const endDate = new Date();
      const startDate = new Date();

      switch (filterType) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(endDate.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
        default:
          startDate.setFullYear(endDate.getFullYear() - 5); // 显示所有历史
      }

      const response = await drawingHistoryService.getUserDrawingHistory(currentUserId, {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        limit: LIMIT,
        offset: reset ? 0 : offset
      });

      if (response.success && response.data) {
        if (reset) {
          setDrawings(response.data);
        } else {
          setDrawings(prev => [...prev, ...response.data!]);
        }
        setHasMore(response.data.length === LIMIT);
        setOffset(prev => prev + response.data!.length);
      } else {
        toast.error(response.error || '加载绘制历史失败');
      }
    } catch (error) {
      logger.error('加载绘制历史失败:', error);
      toast.error('加载绘制历史失败');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [currentUserId, isAuthenticated, filterType, offset]);

  // 加载像素统计数据
  const loadPixelStats = useCallback(async () => {
    if (!currentUserId || !isAuthenticated) return;

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(endDate.getFullYear() - 1); // 最近一年的统计

      const response = await pixelsHistoryService.getUserBehaviorStats(
        currentUserId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );

      if (response.success && response.data) {
        setPixelStats(response.data);
      }
    } catch (error) {
      logger.error('加载像素统计数据失败:', error);
    }
  }, [currentUserId, isAuthenticated]);

  // 加载统计数据
  const loadStats = useCallback(async () => {
    if (!currentUserId || !isAuthenticated) return;

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(endDate.getFullYear() - 1); // 最近一年的统计

      const response = await drawingHistoryService.getUserDrawingStats(
        currentUserId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );

      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      logger.error('加载统计数据失败:', error);
    }
  }, [currentUserId, isAuthenticated]);

  // 加载会话数据
  const loadSessionData = useCallback(async () => {
    if (!currentUserId || !isAuthenticated) return;

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(endDate.getFullYear() - 1); // 最近一年的会话

      const response = await drawingSessionService.getUserSessions({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        status: 'all',
        limit: 100
      });

      if (response.success && response.data) {
        setSessions(response.data.sessions);

        // 计算会话统计数据
        const completedSessions = response.data.sessions.filter(s => s.status === 'completed');
        const totalPixels = completedSessions.reduce((sum, session) =>
          sum + (session.metadata?.statistics?.pixelCount || 0), 0);
        const totalDuration = completedSessions.reduce((sum, session) =>
          sum + (session.metadata?.statistics?.duration || 0), 0);
        const avgPixels = completedSessions.length > 0 ? Math.round(totalPixels / completedSessions.length) : 0;
        const avgDuration = completedSessions.length > 0 ? Math.round(totalDuration / completedSessions.length) : 0;

        setSessionStats({
          totalSessions: completedSessions.length,
          totalPixels,
          totalDuration,
          avgPixels,
          avgDuration,
          activeSessions: response.data.sessions.filter(s => s.status === 'active').length,
          pausedSessions: response.data.sessions.filter(s => s.status === 'paused').length
        });
      }
    } catch (error) {
      logger.error('加载会话数据失败:', error);
    }
  }, [currentUserId, isAuthenticated]);

  // 初始化加载
  useEffect(() => {
    if (isAuthenticated && currentUserId) {
      // 默认加载会话历史
      if (viewType === 'session') {
        loadSessionHistory(true);
      } else if (viewType === 'pixel') {
        loadPixelHistory(true);
        loadPixelStats();
      } else {
        loadDrawingHistory(true);
        loadStats();
      }
      loadSessionData();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, currentUserId, viewType]);

  // 过滤和排序绘制记录
  const filteredAndSortedDrawings = useMemo(() => {
    let filtered = [...drawings];

    // 搜索过滤
    if (searchQuery) {
      filtered = filtered.filter(battleResult =>
        battleResult.session_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        battleResult.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        battleResult.alliance_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        battleResult.session_pixels.toString().includes(searchQuery)
      );
    }

    // 排序
    filtered.sort((a, b) => {
      switch (sortType) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'most_pixels':
          return b.session_pixels - a.session_pixels;
        case 'most_time':
          return b.draw_time - a.draw_time;
        default:
          return 0;
      }
    });

    return filtered;
  }, [drawings, searchQuery, sortType]);

// 过滤和排序像素历史记录
  const filteredAndSortedPixelHistory = useMemo(() => {
    let filtered = [...pixelHistory];

    // 搜索过滤
    if (searchQuery) {
      filtered = filtered.filter(pixel =>
        pixel.session_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pixel.grid_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pixel.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pixel.district?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pixel.pattern_id?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // 排序
    filtered.sort((a, b) => {
      switch (sortType) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'most_pixels':
          return 0; // 像素历史都是单个像素，没有数量差异
        case 'most_time':
          return 0; // 像素历史没有时间差异
        default:
          return 0;
      }
    });

    return filtered;
  }, [pixelHistory, searchQuery, sortType]);

// 过滤和排序会话历史记录
  const filteredAndSortedSessionHistory = useMemo(() => {
    let filtered = [...sessionHistory];

    // 搜索过滤
    if (searchQuery) {
      filtered = filtered.filter(session =>
        session.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.session_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.start_city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.end_city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.drawing_type?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // 排序
    filtered.sort((a, b) => {
      switch (sortType) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'most_pixels':
          return (b.metadata?.statistics?.pixelCount || 0) - (a.metadata?.statistics?.pixelCount || 0);
        case 'most_time':
          return (b.metadata?.statistics?.duration || 0) - (a.metadata?.statistics?.duration || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [sessionHistory, searchQuery, sortType]);

  // 渲染像素统计卡片
  const renderPixelStatsCards = () => {
    if (!pixelStats) return null;

    const cards = [
      {
        title: '总像素数',
        value: (pixelStats.total_pixels || 0).toLocaleString(),
        icon: Palette,
        color: 'from-blue-500 to-cyan-600'
      },
      {
        title: '活跃天数',
        value: pixelStats.active_days || 0,
        icon: Calendar,
        color: 'from-green-500 to-emerald-600'
      },
      {
        title: '独特位置',
        value: (pixelStats.unique_locations || 0).toLocaleString(),
        icon: MapPin,
        color: 'from-purple-500 to-pink-600'
      },
      {
        title: '操作类型',
        value: pixelStats.action_types || 0,
        icon: Filter,
        color: 'from-orange-500 to-red-600'
      }
    ];

    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {cards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            style={{
              background: `linear-gradient(135deg, ${card.color.replace('from-', '').replace('to-', ', ').split(' ')[0]}, ${card.color.split(' ')[1]})`,
              padding: '16px',
              borderRadius: '12px',
              color: 'white',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <card.icon size={20} style={{ opacity: 0.9 }} />
              <span style={{ fontSize: '12px', opacity: 0.8 }}>{card.title}</span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', lineHeight: 1.2 }}>{card.value}</div>
          </motion.div>
        ))}
      </div>
    );
  };

  // 渲染统计卡片
  const renderStatsCards = () => {
    if (!stats) return null;

    const cards = [
      {
        title: '绘制场次',
        value: (stats.totalSessions || 0).toLocaleString(),
        icon: Palette,
        color: 'from-blue-500 to-purple-600'
      },
      {
        title: '总像素数',
        value: (stats.totalPixels || 0).toLocaleString(),
        icon: MapPin,
        color: 'from-green-500 to-teal-600'
      },
      {
        title: '平均像素',
        value: Math.round(stats.avgPixelsPerSession || 0),
        icon: TrendingUp,
        color: 'from-orange-500 to-red-600'
      },
      {
        title: '总时长',
        value: `${Math.round((stats.totalDuration || 0) / 60)}分钟`,
        icon: Clock,
        color: 'from-pink-500 to-rose-600'
      }
    ];

    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {cards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            style={{
              background: `linear-gradient(to right, ${card.color.replace('from-', '').replace('to-', '').split(' ')[0]}, ${card.color.split(' ')[1]})`,
              padding: '16px',
              borderRadius: '12px',
              color: 'white',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <card.icon size={20} style={{ opacity: 0.8 }} />
              <span style={{ fontSize: '12px', opacity: 0.8 }}>{card.title}</span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{card.value}</div>
          </motion.div>
        ))}
      </div>
    );
  };

  // 渲染会话统计卡片
  const renderSessionStatsCards = () => {
    if (!sessionHistory || sessionHistory.length === 0) return null;

    // 计算统计数据
    const completedSessions = sessionHistory.filter(s => s.status === 'completed');
    const totalPixels = completedSessions.reduce((sum, session) =>
      sum + (session.metadata?.statistics?.pixelCount || 0), 0);
    const totalDuration = completedSessions.reduce((sum, session) =>
      sum + (session.metadata?.statistics?.duration || 0), 0);
    const totalDistance = completedSessions.reduce((sum, session) =>
      sum + (session.metadata?.statistics?.distance || 0), 0);
    const avgPixels = completedSessions.length > 0 ? Math.round(totalPixels / completedSessions.length) : 0;
    const avgDuration = completedSessions.length > 0 ? Math.round(totalDuration / completedSessions.length) : 0;
    const avgDistance = completedSessions.length > 0 ? Math.round(totalDistance / completedSessions.length) : 0;

    const cards = [
      {
        title: '完成会话',
        value: completedSessions.length.toLocaleString(),
        icon: Palette,
        color: 'from-indigo-500 to-purple-600'
      },
      {
        title: '总像素数',
        value: totalPixels.toLocaleString(),
        icon: MapPin,
        color: 'from-green-500 to-emerald-600'
      },
      {
        title: '平均像素/会话',
        value: avgPixels.toLocaleString(),
        icon: TrendingUp,
        color: 'from-blue-500 to-cyan-600'
      },
      {
        title: '总绘制时长',
        value: sessionHistoryService.formatSessionDuration(totalDuration),
        icon: Clock,
        color: 'from-amber-500 to-orange-600'
      }
    ];

    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {cards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            style={{
              background: `linear-gradient(135deg, ${card.color.replace('from-', '').replace('to-', ', ').split(' ')[0]}, ${card.color.split(' ')[1]})`,
              padding: '16px',
              borderRadius: '12px',
              color: 'white',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <card.icon size={20} style={{ opacity: 0.9 }} />
              <span style={{ fontSize: '12px', opacity: 0.8, textAlign: 'right' }}>
                {card.title}
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', lineHeight: 1.2 }}>{card.value}</div>
          </motion.div>
        ))}
      </div>
    );
  };

  // 渲染像素历史项
  const renderPixelItem = (pixel: PixelsHistoryItem, index: number) => {
    const formatted = pixelsHistoryService.formatHistoryItem(pixel);
    const timeAgo = pixelsHistoryService.formatRelativeTime(pixel.created_at);

    return (
      <motion.div
        key={`${pixel.id}-${index}`}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.05 }}
        whileHover={{ scale: 1.02 }}
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          border: '1px solid #e5e7eb',
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          ...(viewMode === 'list' ? { display: 'flex' } : {})
        }}
        onClick={() => setSelectedPixel(pixel)}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 16px rgba(0,0,0,0.12)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
        }}
      >
        {/* 像素颜色/图案预览 */}
        <div style={{
          width: viewMode === 'list' ? '64px' : '100%',
          height: viewMode === 'list' ? '64px' : '80px',
          backgroundColor: pixel.color || '#f3f4f6',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {pixel.pattern_id ? (
            <div style={{
              width: '40px',
              height: '40px',
              backgroundColor: pixel.color,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              图案
            </div>
          ) : (
            <div style={{
              width: '40px',
              height: '40px',
              backgroundColor: pixel.color || '#ff0000',
              borderRadius: '50%'
            }} />
          )}

          {/* 会话ID标识 */}
          {pixel.session_id && (
            <div style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: 'rgba(0,0,0,0.6)',
              color: 'white',
              fontSize: '8px',
              fontWeight: 500
            }}>
              会话
            </div>
          )}
        </div>

        {/* 详细信息 */}
        <div style={{ padding: '12px', flex: viewMode === 'list' ? 1 : 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', color: '#6b7280' }}>
              网格: {pixel.grid_id}
            </span>
            <span style={{ fontSize: '10px', color: '#9ca3af' }}>
              {timeAgo}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#6b7280', marginBottom: '4px' }}>
            <MapPin size={10} />
            <span>{formatted.location}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#6b7280' }}>
            <span>{formatted.action}</span>
            <span>•</span>
            <span>{formatted.pattern}</span>
          </div>
        </div>
      </motion.div>
    );
  };

  // 渲染会话历史项
  const renderSessionItem = (session: SessionHistoryItem, index: number) => {
    const thumbnail = sessionHistoryService.generateSessionThumbnail(session);
    const timeAgo = sessionHistoryService.formatRelativeTime(session.created_at);
    const statusColor = sessionHistoryService.getSessionStatusColor(session.status);
    const statusText = sessionHistoryService.getSessionStatusText(session.status);
    const drawingTypeText = sessionHistoryService.getDrawingTypeText(session.drawing_type);

    // 获取统计数据
    const stats = session.metadata?.statistics;
    const pixelCount = stats?.pixelCount || 0;
    const duration = stats?.duration || 0;
    const distance = stats?.distance || 0;

    return (
      <motion.div
        key={`${session.id}-${index}`}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.05 }}
        whileHover={{ scale: 1.02 }}
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          border: '1px solid #e5e7eb',
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          ...(viewMode === 'list' ? { display: 'flex' } : {})
        }}
        onClick={() => setSelectedSession(session)}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
        }}
      >
        {/* 缩略图区域 */}
        <div style={{
          width: viewMode === 'list' ? '120px' : '100%',
          height: viewMode === 'list' ? '120px' : '160px',
          background: thumbnail ? `url(${thumbnail})` : 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {!thumbnail && (
            <div style={{ textAlign: 'center', color: 'white' }}>
              <div style={{ fontSize: '24px', marginBottom: '4px' }}>
                {session.drawing_type === 'gps' ? '📍' : '🎨'}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>{drawingTypeText}</div>
            </div>
          )}

          {/* 状态标识 */}
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            padding: '4px 8px',
            borderRadius: '12px',
            backgroundColor: statusColor,
            color: 'white',
            fontSize: '10px',
            fontWeight: 600
          }}>
            {statusText}
          </div>

          {/* 像素数标识 */}
          <div style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            padding: '4px 8px',
            borderRadius: '8px',
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: 'white',
            fontSize: '10px',
            fontWeight: 600
          }}>
            {pixelCount} 像素
          </div>
        </div>

        {/* 详细信息 */}
        <div style={{ padding: '16px', flex: viewMode === 'list' ? 1 : 'auto' }}>
          {/* 会话名称和时间 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#1f2937',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {session.session_name}
            </div>
            <div style={{ fontSize: '10px', color: '#9ca3af', marginLeft: '8px' }}>
              {timeAgo}
            </div>
          </div>

          {/* 位置信息 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#6b7280', marginBottom: '8px' }}>
            <MapPin size={10} />
            <span>
              {session.start_city && session.end_city && session.start_city !== session.end_city
                ? `${session.start_city} → ${session.end_city}`
                : session.start_city || session.end_city || '未知位置'
              }
            </span>
          </div>

          {/* 统计信息 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: viewMode === 'list' ? 'repeat(3, 1fr)' : '1fr',
            gap: '8px',
            marginBottom: '8px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '10px',
              color: '#6b7280'
            }}>
              <Palette size={10} />
              <span>{pixelCount}像素</span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '10px',
              color: '#6b7280'
            }}>
              <Clock size={10} />
              <span>{sessionHistoryService.formatSessionDuration(duration)}</span>
            </div>

            {distance > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '10px',
                color: '#6b7280'
              }}>
                <TrendingUp size={10} />
                <span>{sessionHistoryService.formatDistance(distance)}</span>
              </div>
            )}
          </div>

          {/* 绘制类型和会话ID */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '9px',
            color: '#9ca3af'
          }}>
            <span>{drawingTypeText}</span>
            <span>会话: {session.id.slice(0, 8)}</span>
          </div>
        </div>
      </motion.div>
    );
  };

  // 渲染绘制项
  const renderDrawingItem = (battleResult: DrawingHistoryItem, index: number) => {
    const thumbnail = drawingHistoryService.generateThumbnail(battleResult);
    const timeAgo = drawingHistoryService.formatRelativeTime(battleResult.created_at || '');
    const statusLabel = drawingHistoryService.getSessionStatusLabel(battleResult.is_shared);
    const statusColor = drawingHistoryService.getSessionStatusColor(battleResult.is_shared);

    return (
      <motion.div
        key={`${battleResult.id}-${index}`}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.05 }}
        whileHover={{ scale: 1.02 }}
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          border: '1px solid #e5e7eb',
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          ...(viewMode === 'list' ? { display: 'flex' } : {})
        }}
        onClick={() => setSelectedDrawing(battleResult)}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 16px rgba(0,0,0,0.12)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
        }}
      >
        {/* 缩略图 */}
        <div style={{
          width: viewMode === 'list' ? '64px' : '100%',
          height: viewMode === 'list' ? '64px' : '128px',
          backgroundColor: '#f3f4f6',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {thumbnail ? (
            <img
              src={thumbnail}
              alt="绘制缩略图"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f9fafb'
            }}>
              <div style={{ textAlign: 'center' }}>
                <Palette size={24} style={{ color: '#9ca3af', marginBottom: '4px' }} />
                <div style={{ fontSize: '12px', color: '#6b7280' }}>绘制</div>
              </div>
            </div>
          )}

          {/* 分享状态标识 */}
          <div style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            padding: '2px 6px',
            borderRadius: '4px',
            color: 'white',
            fontSize: '10px',
            fontWeight: 500,
            backgroundColor: statusColor
          }}>
            {statusLabel}
          </div>

          {/* 像素数标识 */}
          <div style={{
            position: 'absolute',
            bottom: '4px',
            left: '4px',
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: 'white',
            fontSize: '10px',
            fontWeight: 500
          }}>
            {battleResult.session_pixels}像素
          </div>
        </div>

        {/* 详细信息 */}
        <div style={{ padding: '12px', flex: viewMode === 'list' ? 1 : 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', color: '#6b7280' }}>
              会话ID: {battleResult.session_id || '未知'}
            </span>
            <span style={{ fontSize: '10px', color: '#9ca3af' }}>
              {timeAgo}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#6b7280', marginBottom: '4px' }}>
            <Clock size={10} />
            <span>{drawingHistoryService.formatDrawTime(battleResult.draw_time)}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#6b7280' }}>
            <span>总像素: {battleResult.total_pixels}</span>
            {battleResult.alliance_name && (
              <span style={{ color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {battleResult.alliance_pattern_id && (
                  <AllianceFlagRenderer
                    patternId={battleResult.alliance_pattern_id}
                    patternType={battleResult.alliance_pattern_type || 'color'}
                    size="sm"
                    className="flex-shrink-0"
                  />
                )}
                {battleResult.alliance_name}
              </span>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  // 渲染网格视图
  const renderGridView = () => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '16px'
    }}>
      {filteredAndSortedDrawings.map((drawing, index) => renderDrawingItem(drawing, index))}
    </div>
  );

  // 渲染列表视图
  const renderListView = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {filteredAndSortedDrawings.map((drawing, index) => renderDrawingItem(drawing, index))}
    </div>
  );

  // 渲染游客模式提示
  const renderGuestMode = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        textAlign: 'center',
        padding: '48px 0',
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        border: '1px solid #e5e7eb'
      }}
    >
      <div style={{
        width: '80px',
        height: '80px',
        backgroundColor: '#f3f4f6',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 16px'
      }}>
        <History size={40} style={{ color: '#9ca3af' }} />
      </div>
      <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#1f2937', marginBottom: '8px' }}>绘制历史</h3>
      <p style={{ color: '#6b7280', marginBottom: '16px', lineHeight: '1.5' }}>
        登录后即可查看您的绘制记录和统计信息
      </p>
      <button
        onClick={() => window.location.href = '/login'}
        style={{
          padding: '8px 24px',
          borderRadius: '12px',
          backgroundColor: '#3b82f6',
          color: 'white',
          fontWeight: 600,
          fontSize: '14px',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#2563eb';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 16px rgba(59,130,246,0.4)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#3b82f6';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(59,130,246,0.3)';
        }}
      >
        立即登录
      </button>
    </motion.div>
  );

  // 渲染空状态
  const renderEmptyState = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        textAlign: 'center',
        padding: '48px 0',
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        border: '1px solid #e5e7eb'
      }}
    >
      <div style={{
        width: '80px',
        height: '80px',
        backgroundColor: '#f9fafb',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 16px'
      }}>
        <AlertCircle size={40} style={{ color: '#9ca3af' }} />
      </div>
      <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', marginBottom: '8px' }}>暂无绘制记录</h3>
      <p style={{ color: '#6b7280', lineHeight: '1.5' }}>
        开始您的第一场像素绘制并分享作品吧！
      </p>
    </motion.div>
  );

  if (!isAuthenticated) {
    return renderGuestMode();
  }

  return (
    <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '16px' }}>
      {/* 页面标题和控制栏 */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          border: '1px solid #e5e7eb',
          padding: '16px',
          marginBottom: '24px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <History size={24} style={{ color: '#3b82f6' }} />
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
              {viewType === 'session' ? '绘制会话' : viewType === 'pixel' ? '像素历史' : '绘制历史'}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* 切换按钮 */}
            <div style={{
              display: 'flex',
              backgroundColor: '#f3f4f6',
              borderRadius: '8px',
              padding: '4px',
              gap: '2px'
            }}>
              <button
                onClick={() => setViewType('session')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  backgroundColor: viewType === 'session' ? 'white' : 'transparent',
                  color: viewType === 'session' ? '#3b82f6' : '#6b7280',
                  boxShadow: viewType === 'session' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  fontSize: '14px',
                  fontWeight: 500
                }}
              >
                绘制会话
              </button>
              <button
                onClick={() => setViewType('pixel')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  backgroundColor: viewType === 'pixel' ? 'white' : 'transparent',
                  color: viewType === 'pixel' ? '#3b82f6' : '#6b7280',
                  boxShadow: viewType === 'pixel' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  fontSize: '14px',
                  fontWeight: 500
                }}
              >
                像素历史
              </button>
              <button
                onClick={() => setViewType('battle')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  backgroundColor: viewType === 'battle' ? 'white' : 'transparent',
                  color: viewType === 'battle' ? '#3b82f6' : '#6b7280',
                  boxShadow: viewType === 'battle' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  fontSize: '14px',
                  fontWeight: 500
                }}
              >
                绘制历史
              </button>
            </div>

            <button
              onClick={() => setShowStats(!showStats)}
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backgroundColor: showStats ? '#dbeafe' : '#f3f4f6',
                color: showStats ? '#3b82f6' : '#6b7280'
              }}
              onMouseEnter={(e) => {
                if (!showStats) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#e5e7eb';
                }
              }}
              onMouseLeave={(e) => {
                if (!showStats) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f3f4f6';
                }
              }}
            >
              <BarChart3 size={20} />
            </button>

            <button
              onClick={() => setShowSessionStats(!showSessionStats)}
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backgroundColor: showSessionStats ? '#ddd6fe' : '#f3f4f6',
                color: showSessionStats ? '#7c3aed' : '#6b7280'
              }}
              onMouseEnter={(e) => {
                if (!showSessionStats) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#e5e7eb';
                }
              }}
              onMouseLeave={(e) => {
                if (!showSessionStats) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f3f4f6';
                }
              }}
            >
              <Clock size={20} />
            </button>

            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backgroundColor: showFilters ? '#dbeafe' : '#f3f4f6',
                color: showFilters ? '#3b82f6' : '#6b7280'
              }}
              onMouseEnter={(e) => {
                if (!showFilters) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#e5e7eb';
                }
              }}
              onMouseLeave={(e) => {
                if (!showFilters) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f3f4f6';
                }
              }}
            >
              <Filter size={20} />
            </button>

            <div style={{
              display: 'flex',
              backgroundColor: '#f3f4f6',
              borderRadius: '8px',
              padding: '4px',
              gap: '2px'
            }}>
              <button
                onClick={() => setViewMode('grid')}
                style={{
                  padding: '6px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  backgroundColor: viewMode === 'grid' ? 'white' : 'transparent',
                  color: viewMode === 'grid' ? '#3b82f6' : '#6b7280',
                  boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                <Grid size={18} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                style={{
                  padding: '6px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  backgroundColor: viewMode === 'list' ? 'white' : 'transparent',
                  color: viewMode === 'list' ? '#3b82f6' : '#6b7280',
                  boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* 搜索框 */}
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#9ca3af'
          }} />
          <input
            type="text"
            placeholder="搜索会话ID、用户名或像素数..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: '40px',
              paddingRight: '16px',
              padding: '8px 16px 8px 40px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none',
              transition: 'all 0.2s ease',
              boxSizing: 'border-box'
            }}
            onFocus={(e) => {
              (e.target as HTMLInputElement).style.borderColor = '#3b82f6';
              (e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
            }}
            onBlur={(e) => {
              (e.target as HTMLInputElement).style.borderColor = '#e5e7eb';
              (e.target as HTMLInputElement).style.boxShadow = 'none';
            }}
          />
        </div>

        {/* 过滤器 */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid #e5e7eb'
              }}
            >
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '12px'
              }}>
                {/* 时间过滤 */}
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as FilterType)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    cursor: 'pointer',
                    backgroundColor: 'white'
                  }}
                  onFocus={(e) => {
                    (e.target as HTMLSelectElement).style.borderColor = '#3b82f6';
                    (e.target as HTMLSelectElement).style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
                  }}
                  onBlur={(e) => {
                    (e.target as HTMLSelectElement).style.borderColor = '#e5e7eb';
                    (e.target as HTMLSelectElement).style.boxShadow = 'none';
                  }}
                >
                  <option value="all">全部时间</option>
                  <option value="today">今天</option>
                  <option value="week">本周</option>
                  <option value="month">本月</option>
                  <option value="year">今年</option>
                </select>

                {/* 排序 */}
                <select
                  value={sortType}
                  onChange={(e) => setSortType(e.target.value as SortType)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    cursor: 'pointer',
                    backgroundColor: 'white'
                  }}
                  onFocus={(e) => {
                    (e.target as HTMLSelectElement).style.borderColor = '#3b82f6';
                    (e.target as HTMLSelectElement).style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
                  }}
                  onBlur={(e) => {
                    (e.target as HTMLSelectElement).style.borderColor = '#e5e7eb';
                    (e.target as HTMLSelectElement).style.boxShadow = 'none';
                  }}
                >
                  <option value="newest">最新优先</option>
                  <option value="oldest">最早优先</option>
                  <option value="most_pixels">像素最多</option>
                  <option value="most_time">时长最长</option>
                </select>

                {/* 刷新按钮 */}
                <button
                  onClick={() => {
                    if (viewType === 'session') {
                      loadSessionHistory(true);
                    } else if (viewType === 'pixel') {
                      loadPixelHistory(true);
                    } else {
                      loadDrawingHistory(true);
                    }
                  }}
                  disabled={loading}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                    opacity: loading ? 0.5 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#e5e7eb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f3f4f6';
                    }
                  }}
                >
                  <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                  刷新
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 统计卡片 */}
      <AnimatePresence>
        {showStats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{ marginBottom: '24px' }}
          >
            {viewType === 'session' ? renderSessionStatsCards() :
             viewType === 'pixel' ? renderPixelStatsCards() :
             renderStatsCards()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 会话统计卡片 */}
      <AnimatePresence>
        {showSessionStats && sessionStats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{ marginBottom: '24px' }}
          >
            {renderSessionStatsCards()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 绘制历史列表 */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        border: '1px solid #e5e7eb',
        padding: '16px'
      }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
            <div style={{
              width: '32px',
              height: '32px',
              border: '2px solid #e5e7eb',
              borderTop: '2px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
          </div>
        ) : (viewType === 'session' ?
            (filteredAndSortedSessionHistory.length === 0 ? renderEmptyState() : false)
          : viewType === 'pixel' ?
            (filteredAndSortedPixelHistory.length === 0 ? renderEmptyState() : false)
          :
            (filteredAndSortedDrawings.length === 0 ? renderEmptyState() : false)
        ) ? (
          renderEmptyState()
        ) : (
          <>
            {viewType === 'session' ? (
              // 会话历史视图
              viewMode === 'grid' ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '16px'
                }}>
                  {filteredAndSortedSessionHistory.map((session, index) => renderSessionItem(session, index))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {filteredAndSortedSessionHistory.map((session, index) => renderSessionItem(session, index))}
                </div>
              )
            ) : viewType === 'pixel' ? (
              // 像素历史视图
              viewMode === 'grid' ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px'
                }}>
                  {filteredAndSortedPixelHistory.map((pixel, index) => renderPixelItem(pixel, index))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {filteredAndSortedPixelHistory.map((pixel, index) => renderPixelItem(pixel, index))}
                </div>
              )
            ) : (
              // 绘制历史视图
              viewMode === 'grid' ? renderGridView() : renderListView()
            )}

            {/* 加载更多 */}
            {hasMore && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
                <button
                  onClick={() => {
                    if (viewType === 'session') {
                      loadSessionHistory(false);
                    } else if (viewType === 'pixel') {
                      loadPixelHistory(false);
                    } else {
                      loadDrawingHistory(false);
                    }
                  }}
                  disabled={loadingMore}
                  style={{
                    padding: '8px 24px',
                    borderRadius: '12px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '14px',
                    border: 'none',
                    cursor: loadingMore ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
                    opacity: loadingMore ? 0.5 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!loadingMore) {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#2563eb';
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 16px rgba(59,130,246,0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loadingMore) {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#3b82f6';
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(59,130,246,0.3)';
                    }
                  }}
                >
                  {loadingMore && <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />}
                  加载更多
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 详情弹窗 */}
      <AnimatePresence>
        {selectedDrawing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 50,
              padding: '16px'
            }}
            onClick={() => setSelectedDrawing(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                maxWidth: '448px',
                width: '100%',
                padding: '24px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: 0 }}>绘制详情</h3>
                <button
                  onClick={() => setSelectedDrawing(null)}
                  style={{
                    padding: '4px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  }}
                >
                  <ChevronUp size={20} />
                </button>
              </div>

              {/* 缩略图 */}
              <div style={{
                width: '128px',
                height: '128px',
                backgroundColor: '#f3f4f6',
                borderRadius: '12px',
                margin: '0 auto 16px',
                overflow: 'hidden'
              }}>
                {(() => {
                  const thumbnail = drawingHistoryService.generateThumbnail(selectedDrawing);
                  return thumbnail ? (
                    <img
                      src={thumbnail}
                      alt="绘制缩略图"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#f9fafb'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <Palette size={32} style={{ color: '#9ca3af', marginBottom: '4px' }} />
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>绘制</div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 详细信息 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>会话ID:</span>
                  <span style={{ fontWeight: 500 }}>{selectedDrawing.session_id || '未知'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>用户名:</span>
                  <span style={{ fontWeight: 500 }}>{selectedDrawing.username}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>本次像素:</span>
                  <span style={{ fontWeight: 500 }}>{selectedDrawing.session_pixels}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>总像素数:</span>
                  <span style={{ fontWeight: 500 }}>{selectedDrawing.total_pixels}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>绘制时长:</span>
                  <span style={{ fontWeight: 500 }}>
                    {drawingHistoryService.formatDrawTime(selectedDrawing.draw_time)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>创建时间:</span>
                  <span style={{ fontWeight: 500 }}>
                    {new Date(selectedDrawing.created_at).toLocaleString('zh-CN')}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>分享状态:</span>
                  <span style={{ fontWeight: 500 }}>
                    {drawingHistoryService.getSessionStatusLabel(selectedDrawing.is_shared)}
                  </span>
                </div>
                {selectedDrawing.alliance_name && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280' }}>联盟:</span>
                    <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {selectedDrawing.alliance_pattern_id && (
                        <AllianceFlagRenderer
                          patternId={selectedDrawing.alliance_pattern_id}
                          patternType={selectedDrawing.alliance_pattern_type || 'color'}
                          size="md"
                          className="flex-shrink-0"
                        />
                      )}
                      {selectedDrawing.alliance_name}
                    </span>
                  </div>
                )}

                {/* 显示关联的会话信息 */}
                {selectedDrawing.session_id && (() => {
                  const relatedSession = sessions.find(s => s.id === selectedDrawing.session_id);
                  if (relatedSession) {
                    return (
                      <div style={{
                        marginTop: '8px',
                        padding: '8px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0'
                      }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                          📋 会话详情
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#6b7280' }}>会话名称:</span>
                            <span style={{ fontWeight: 500 }}>{relatedSession.sessionName}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#6b7280' }}>绘制类型:</span>
                            <span style={{ fontWeight: 500 }}>
                              {relatedSession.drawingType === 'gps' ? 'GPS绘制' : '手动绘制'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#6b7280' }}>会话状态:</span>
                            <span style={{
                              fontWeight: 500,
                              color: drawingSessionService.getSessionStatusColor(relatedSession.status)
                            }}>
                              {drawingSessionService.getSessionStatusText(relatedSession.status)}
                            </span>
                          </div>
                          {relatedSession.metadata?.statistics && (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#6b7280' }}>会话总像素:</span>
                                <span style={{ fontWeight: 500 }}>
                                  {relatedSession.metadata.statistics.pixelCount}
                                </span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#6b7280' }}>会话时长:</span>
                                <span style={{ fontWeight: 500 }}>
                                  {drawingSessionService.formatSessionDuration(relatedSession.metadata.statistics.duration)}
                                </span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#6b7280' }}>绘制效率:</span>
                                <span style={{ fontWeight: 500 }}>
                                  {drawingSessionService.calculateSessionEfficiency(
                                    relatedSession.metadata.statistics.pixelCount,
                                    relatedSession.metadata.statistics.duration
                                  )} 像素/分钟
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* 操作按钮 */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '24px' }}>
                <button
                  onClick={() => {
                    if (selectedDrawing.image_url) {
                      window.open(selectedDrawing.image_url, '_blank');
                    } else {
                      toast.info('该绘制暂无分享图片');
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 16px',
                    borderRadius: '12px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '14px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#2563eb';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 16px rgba(59,130,246,0.4)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#3b82f6';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(59,130,246,0.3)';
                  }}
                >
                  查看绘制图
                </button>
                <button
                  onClick={() => {
                    if (selectedDrawing.image_url) {
                      // 下载图片
                      const link = document.createElement('a');
                      link.href = selectedDrawing.image_url;
                      link.download = `绘制-${selectedDrawing.id}.png`;
                      link.click();
                    } else {
                      toast.info('该绘制暂无分享图片');
                    }
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '12px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    fontWeight: 600,
                    fontSize: '14px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#e5e7eb';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f3f4f6';
                  }}
                >
                  <Download size={18} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 像素详情弹窗 */}
      <AnimatePresence>
        {selectedPixel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 50,
              padding: '16px'
            }}
            onClick={() => setSelectedPixel(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                maxWidth: '448px',
                width: '100%',
                padding: '24px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: 0 }}>像素详情</h3>
                <button
                  onClick={() => setSelectedPixel(null)}
                  style={{
                    padding: '4px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  }}
                >
                  <ChevronUp size={20} />
                </button>
              </div>

              {/* 像素颜色预览 */}
              <div style={{
                width: '80px',
                height: '80px',
                backgroundColor: selectedPixel.color || '#ff0000',
                borderRadius: '12px',
                margin: '0 auto 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #e5e7eb'
              }}>
                {selectedPixel.pattern_id && (
                  <div style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: 'rgba(255,255,255,0.3)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    图案
                  </div>
                )}
              </div>

              {/* 详细信息 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>网格ID:</span>
                  <span style={{ fontWeight: 500 }}>{selectedPixel.grid_id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>会话ID:</span>
                  <span style={{ fontWeight: 500 }}>{selectedPixel.session_id || '无'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>坐标:</span>
                  <span style={{ fontWeight: 500 }}>
                    {selectedPixel.latitude != null && selectedPixel.longitude != null
                      ? `${parseFloat(selectedPixel.latitude.toString()).toFixed(6)}, ${parseFloat(selectedPixel.longitude.toString()).toFixed(6)}`
                      : '未知坐标'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>颜色:</span>
                  <span style={{ fontWeight: 500 }}>{selectedPixel.color}</span>
                </div>
                {selectedPixel.pattern_id && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280' }}>图案ID:</span>
                    <span style={{ fontWeight: 500 }}>{selectedPixel.pattern_id}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>操作类型:</span>
                  <span style={{ fontWeight: 500 }}>
                    {selectedPixel.action_type === 'draw' ? '绘制' : selectedPixel.action_type || '绘制'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>位置:</span>
                  <span style={{ fontWeight: 500 }}>
                    {selectedPixel.city && selectedPixel.city !== '未知城市'
                      ? `${selectedPixel.city}${selectedPixel.district && selectedPixel.district !== selectedPixel.city ? '·' + selectedPixel.district : ''}`
                      : '未知位置'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>创建时间:</span>
                  <span style={{ fontWeight: 500 }}>
                    {new Date(selectedPixel.created_at).toLocaleString('zh-CN')}
                  </span>
                </div>

                {/* 显示关联的会话信息 */}
                {selectedPixel.session_id && (() => {
                  const relatedSession = sessions.find(s => s.id === selectedPixel.session_id);
                  if (relatedSession) {
                    return (
                      <div style={{
                        marginTop: '8px',
                        padding: '8px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0'
                      }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                          📋 关联会话
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#6b7280' }}>会话名称:</span>
                            <span style={{ fontWeight: 500 }}>{relatedSession.sessionName}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#6b7280' }}>绘制类型:</span>
                            <span style={{ fontWeight: 500 }}>
                              {relatedSession.drawingType === 'gps' ? 'GPS绘制' : '手动绘制'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#6b7280' }}>会话状态:</span>
                            <span style={{
                              fontWeight: 500,
                              color: drawingSessionService.getSessionStatusColor(relatedSession.status)
                            }}>
                              {drawingSessionService.getSessionStatusText(relatedSession.status)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* 操作按钮 */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '24px' }}>
                <button
                  onClick={() => {
                    // 在地图上定位该像素
                    const lat = selectedPixel.latitude;
                    const lng = selectedPixel.longitude;
                    toast.info(`定位到坐标: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 16px',
                    borderRadius: '12px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '14px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#2563eb';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 16px rgba(59,130,246,0.4)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#3b82f6';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(59,130,246,0.3)';
                  }}
                >
                  地图定位
                </button>
                <button
                  onClick={() => {
                    // 复制坐标信息
                    navigator.clipboard.writeText(
                      `${selectedPixel.latitude.toFixed(6)}, ${selectedPixel.longitude.toFixed(6)}`
                    ).then(() => {
                      toast.success('坐标已复制到剪贴板');
                    }).catch(() => {
                      toast.error('复制失败');
                    });
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '12px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    fontWeight: 600,
                    fontSize: '14px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#e5e7eb';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f3f4f6';
                  }}
                >
                  复制坐标
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 会话详情弹窗 */}
      <AnimatePresence>
        {selectedSession && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 50,
              padding: '16px'
            }}
            onClick={() => setSelectedSession(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                maxWidth: '600px',
                width: '100%',
                maxHeight: '80vh',
                overflow: 'auto',
                padding: '24px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#1f2937', margin: 0 }}>
                  {selectedSession.session_name}
                </h3>
                <button
                  onClick={() => setSelectedSession(null)}
                  style={{
                    padding: '4px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  }}
                >
                  <ChevronUp size={20} />
                </button>
              </div>

              {/* 会话状态和类型 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
                padding: '12px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{
                  padding: '4px 12px',
                  borderRadius: '8px',
                  backgroundColor: sessionHistoryService.getSessionStatusColor(selectedSession.status),
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 600
                }}>
                  {sessionHistoryService.getSessionStatusText(selectedSession.status)}
                </div>
                <div style={{
                  padding: '4px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#e0e7ff',
                  color: '#3730a3',
                  fontSize: '12px',
                  fontWeight: 600
                }}>
                  {sessionHistoryService.getDrawingTypeText(selectedSession.drawing_type)}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  marginLeft: 'auto'
                }}>
                  会话ID: {selectedSession.id.slice(0, 8)}
                </div>
              </div>

              {/* 统计信息 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '16px',
                marginBottom: '20px'
              }}>
                <div style={{
                  padding: '16px',
                  backgroundColor: '#f0fdf4',
                  borderRadius: '12px',
                  border: '1px solid #dcfce7'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Palette size={20} style={{ color: '#16a34a' }} />
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#166534' }}>像素统计</span>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#15803d', marginBottom: '4px' }}>
                    {selectedSession.metadata?.statistics?.pixelCount || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#15803d' }}>
                    总绘制像素数
                  </div>
                </div>

                <div style={{
                  padding: '16px',
                  backgroundColor: '#fef3c7',
                  borderRadius: '12px',
                  border: '1px solid #fde68a'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Clock size={20} style={{ color: '#d97706' }} />
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#92400e' }}>绘制时长</span>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#b45309', marginBottom: '4px' }}>
                    {sessionHistoryService.formatSessionDuration(selectedSession.metadata?.statistics?.duration || 0)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#92400e' }}>
                    总绘制时间
                  </div>
                </div>

                {(selectedSession.metadata?.statistics?.distance || 0) > 0 && (
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#eff6ff',
                    borderRadius: '12px',
                    border: '1px solid #dbeafe'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <TrendingUp size={20} style={{ color: '#2563eb' }} />
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e3a8a' }}>移动距离</span>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1d4ed8', marginBottom: '4px' }}>
                      {sessionHistoryService.formatDistance(selectedSession.metadata.statistics.distance || 0)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#1e3a8a' }}>
                      总移动距离
                    </div>
                  </div>
                )}

                <div style={{
                  padding: '16px',
                  backgroundColor: '#f5f3ff',
                  borderRadius: '12px',
                  border: '1px solid #e9d5ff'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <BarChart3 size={20} style={{ color: '#7c3aed' }} />
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#6b21a8' }}>绘制效率</span>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#7e22ce', marginBottom: '4px' }}>
                    {sessionHistoryService.calculateSessionEfficiency(
                      selectedSession.metadata?.statistics?.pixelCount || 0,
                      selectedSession.metadata?.statistics?.duration || 0
                    )} 像素/分
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b21a8' }}>
                    平均绘制速度
                  </div>
                </div>
              </div>

              {/* 详细信息 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>开始时间:</span>
                  <span style={{ fontWeight: 500 }}>
                    {selectedSession.start_time ?
                      new Date(selectedSession.start_time).toLocaleString('zh-CN') :
                      '未知'
                    }
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>结束时间:</span>
                  <span style={{ fontWeight: 500 }}>
                    {selectedSession.end_time ?
                      new Date(selectedSession.end_time).toLocaleString('zh-CN') :
                      '未知'
                    }
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>开始位置:</span>
                  <span style={{ fontWeight: 500 }}>
                    {selectedSession.start_city || '未知'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>结束位置:</span>
                  <span style={{ fontWeight: 500 }}>
                    {selectedSession.end_city || '未知'}
                  </span>
                </div>
                {selectedSession.alliance_name && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280' }}>联盟:</span>
                    <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {selectedSession.alliance_pattern_id && (
                        <AllianceFlagRenderer
                          patternId={selectedSession.alliance_pattern_id}
                          patternType={selectedSession.alliance_pattern_type || 'color'}
                          size="md"
                          className="flex-shrink-0"
                        />
                      )}
                      {selectedSession.alliance_name}
                    </span>
                  </div>
                )}
              </div>

              {/* 操作按钮 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '24px' }}>
                <button
                  onClick={() => {
                    setSelectedTrackSession(selectedSession);
                    setShowTrackViewer(true);
                    soundService.play('click');
                  }}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '14px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#059669';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 16px rgba(16,185,129,0.4)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#10b981';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(16,185,129,0.3)';
                  }}
                >
                  <MapPin size={16} />
                  查看轨迹
                </button>
                <button
                  onClick={() => {
                    setSelectedShareSession(selectedSession);
                    setShowShareModal(true);
                    soundService.play('click');
                  }}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    backgroundColor: '#8b5cf6',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '14px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#7c3aed';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 16px rgba(139,92,246,0.4)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#8b5cf6';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(139,92,246,0.3)';
                  }}
                >
                  <Share2 size={16} />
                  分享会话
                </button>
                <button
                  onClick={() => {
                    // 获取会话详细统计
                    sessionHistoryService.getSessionStatistics(selectedSession.id).then(response => {
                      if (response.success && response.data) {
                        const stats = response.data;
                        toast.info(`会话详细统计: ${stats.pixelCount}像素, ${sessionHistoryService.formatSessionDuration(stats.duration)}`);
                      } else {
                        toast.error('获取会话统计失败');
                      }
                    });
                  }}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '14px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#2563eb';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 16px rgba(59,130,246,0.4)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#3b82f6';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(59,130,246,0.3)';
                  }}
                >
                  详细统计
                </button>
                <button
                  onClick={() => {
                    // 复制会话ID
                    navigator.clipboard.writeText(selectedSession.id).then(() => {
                      toast.success('会话ID已复制到剪贴板');
                    }).catch(() => {
                      toast.error('复制失败');
                    });
                  }}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    fontWeight: 600,
                    fontSize: '14px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#e5e7eb';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f3f4f6';
                  }}
                >
                  复制ID
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 轨迹查看器 */}
      {selectedTrackSession && (
        <TrackMapViewer
          isOpen={showTrackViewer}
          onClose={() => {
            setShowTrackViewer(false);
            setSelectedTrackSession(null);
          }}
          sessionData={selectedTrackSession}
        />
      )}

      {/* 分享弹窗 */}
      {selectedShareSession && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => {
            setShowShareModal(false);
            setSelectedShareSession(null);
          }}
          sessionId={selectedShareSession.id}
          sessionData={selectedShareSession}
        />
      )}
    </div>
  );
}