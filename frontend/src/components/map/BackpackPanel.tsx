import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { logger } from '../../utils/logger';
import { driftBottleService, DriftBottle, DriftBottleMessage } from '../../services/driftBottle';
import qrTreasureService from '../../services/qrTreasureService';
import historyService, { HistoryItem, HistoryFilters } from '../../services/historyService';
import { ModernFlagIcon } from '../ui/ModernFlagIcon';
import { X, BaggageClaim, Send, Eye, Package, MapPin, Clock, Filter, Search, TrendingUp, Trophy } from 'lucide-react';

interface BackpackPanelProps {
  onClose: () => void;
  onNewItemCountChange?: (count: number) => void;
}

/**
 * 百宝箱浮窗组件 - 显示拾到的所有物品
 */
export const BackpackPanel: React.FC<BackpackPanelProps> = ({ onClose, onNewItemCountChange }) => {
  const [driftBottles, setDriftBottles] = useState<DriftBottle[]>([]);
  const [treasures, setTreasures] = useState<any[]>([]);
  const [selectedBottle, setSelectedBottle] = useState<DriftBottle | null>(null);
  const [selectedTreasure, setSelectedTreasure] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [showTreasureDetailModal, setShowTreasureDetailModal] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'bottles' | 'treasures' | 'history'>('bottles');

  // 历史记录相关状态
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [historyStats, setHistoryStats] = useState<any>(null);
  const [historyFilters, setHistoryFilters] = useState<HistoryFilters>({
    type: 'all',
    period: 'all',
    action: 'all',
    limit: 20,
    offset: 0,
    sortBy: 'created_at',
    sortOrder: 'desc'
  });
  const [historyPagination, setHistoryPagination] = useState({
    total: 0,
    hasMore: false
  });
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadBackpackData();
  }, []);

  useEffect(() => {
    if (activeTab === 'treasures') {
      loadTreasures();
    } else if (activeTab === 'history') {
      loadHistoryData();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistoryData();
    }
  }, [historyFilters]);

  const loadBackpackData = async () => {
    try {
      setIsLoading(true);
      const result = await driftBottleService.getUserInventory();
      if (result.success && result.data) {
        // 只显示拾到的瓶子（不是自己创建的）
        const pickedBottles = result.data.inventory.filter((bottle: DriftBottle) =>
          bottle.owner_id !== bottle.original_owner_id
        );
        setDriftBottles(pickedBottles);

        // 计算未读数量
        const newItemCount = pickedBottles.filter((b: any) => b.is_new).length;
        onNewItemCountChange?.(newItemCount);
      }
    } catch (error) {
      logger.error('加载拾到的漂流瓶失败:', error);
      toast.error('加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPickedBottles = async () => {
    try {
      const result = await driftBottleService.getUserInventory();
      if (result.success && result.data) {
        // 只显示拾到的瓶子（不是自己创建的）
        const pickedBottles = result.data.inventory.filter((bottle: DriftBottle) =>
          bottle.owner_id !== bottle.original_owner_id
        );
        setDriftBottles(pickedBottles);
      }
    } catch (error) {
      logger.error('加载拾到的漂流瓶失败:', error);
    }
  };

  const loadTreasures = async () => {
    try {
      const foundTreasures = await qrTreasureService.getMyFoundTreasures();
      setTreasures(foundTreasures || []);
    } catch (error) {
      logger.error('加载宝藏失败:', error);
    }
  };

  // 历史记录相关函数
  const loadHistoryData = async () => {
    try {
      setIsHistoryLoading(true);

      // 并行加载历史记录和统计数据
      const [historyResponse, statsResponse] = await Promise.all([
        searchKeyword.trim()
          ? historyService.searchHistory(searchKeyword, historyFilters)
          : historyService.getUserHistory(historyFilters),
        historyService.getHistoryStats()
      ]);

      setHistoryItems(historyResponse.data.items);
      setHistoryPagination({
        total: historyResponse.data.pagination.total,
        hasMore: historyResponse.data.pagination.hasMore
      });
      setHistoryStats(statsResponse);

      logger.info('历史记录加载成功', {
        itemsCount: historyResponse.data.items.length,
        stats: statsResponse
      });
    } catch (error) {
      logger.error('加载历史记录失败:', error);
      toast.error('加载历史记录失败');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleHistoryFilterChange = (newFilters: Partial<HistoryFilters>) => {
    setHistoryFilters(prev => ({
      ...prev,
      ...newFilters,
      offset: 0 // 重置分页
    }));
  };

  const handleSearch = (keyword: string) => {
    setSearchKeyword(keyword);
    // 延迟搜索，避免频繁请求
    const timeoutId = setTimeout(() => {
      loadHistoryData();
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  const handleLoadMore = async () => {
    if (!historyPagination.hasMore || isHistoryLoading) return;

    try {
      setIsHistoryLoading(true);
      const newFilters = {
        ...historyFilters,
        offset: historyFilters.offset + historyFilters.limit
      };

      const response = searchKeyword.trim()
        ? await historyService.searchHistory(searchKeyword, newFilters)
        : await historyService.getUserHistory(newFilters);

      setHistoryItems(prev => [...prev, ...response.data.items]);
      setHistoryPagination({
        total: response.data.pagination.total,
        hasMore: response.data.pagination.hasMore
      });
      setHistoryFilters(newFilters);

    } catch (error) {
      logger.error('加载更多历史记录失败:', error);
      toast.error('加载更多失败');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleViewDetail = (bottle: DriftBottle) => {
    setSelectedBottle(bottle);
    setShowDetailModal(true);
  };

  const handleViewTreasureDetail = (treasure: any) => {
    setSelectedTreasure(treasure);
    setShowTreasureDetailModal(true);
  };

  const handleReply = (bottle: DriftBottle) => {
    setSelectedBottle(bottle);
    setShowReplyModal(true);
  };

  const confirmReply = async () => {
    if (!selectedBottle || !replyMessage.trim()) return;

    setIsActionLoading(true);
    try {
      // 添加留言并继续漂流
      const result = await driftBottleService.continueDrift(
        selectedBottle.bottle_id,
        replyMessage
      );

      if (result.success) {
        toast.success('🌊 已回复并重新抛出漂流瓶！');
        setShowReplyModal(false);
        setReplyMessage('');
        setSelectedBottle(null);
        loadPickedBottles();
      } else {
        toast.error(result.message || '操作失败');
      }
    } catch (error) {
      logger.error('回复漂流瓶失败:', error);
      toast.error('操作失败');
    } finally {
      setIsActionLoading(false);
    }
  };

  const formatRelativeTime = (dateString: string) => {
    return driftBottleService.formatRelativeTime(dateString);
  };

  const formatRewardPoints = (rewardValue?: string) => {
    if (!rewardValue) return 0;
    try {
      const parsed = JSON.parse(rewardValue);
      return parsed.amount || 0;
    } catch {
      return 0;
    }
  };

  return (
    <>
      {/* 百宝箱面板 */}
      <div style={{
        position: 'fixed',
        top: '50%',
        right: '80px',
        transform: 'translateY(-50%)',
        zIndex: 1010, // 🔥 优化：使用标准z-index规范，百宝箱面板
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
        border: '1px solid #e5e7eb',
        width: '360px',
        maxHeight: '600px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* 头部 */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#f9fafb'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <BaggageClaim size={20} color="#3b82f6" />
            <h3 style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#111827',
              margin: 0
            }}>百宝箱</h3>
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              color: '#6b7280'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 内容区域 */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px'
        }}>
          {/* 标签页切换 */}
          <div style={{
            display: 'flex',
            gap: '4px',
            marginBottom: '16px',
            backgroundColor: '#f3f4f6',
            padding: '4px',
            borderRadius: '8px'
          }}>
            <button
              onClick={() => setActiveTab('bottles')}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: '14px',
                fontWeight: '500',
                backgroundColor: activeTab === 'bottles' ? 'white' : 'transparent',
                color: activeTab === 'bottles' ? '#1f2937' : '#6b7280',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <span style={{ fontSize: '16px' }}>🍾</span>
              漂流瓶 {driftBottles.length > 0 && `(${driftBottles.length})`}
            </button>
            <button
              onClick={() => setActiveTab('treasures')}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: '14px',
                fontWeight: '500',
                backgroundColor: activeTab === 'treasures' ? 'white' : 'transparent',
                color: activeTab === 'treasures' ? '#1f2937' : '#6b7280',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <span style={{ fontSize: '16px' }}>📦</span>
              宝藏 {treasures.length > 0 && `(${treasures.length})`}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: '14px',
                fontWeight: '500',
                backgroundColor: activeTab === 'history' ? 'white' : 'transparent',
                color: activeTab === 'history' ? '#1f2937' : '#6b7280',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Clock size={16} />
              历史记录
            </button>
          </div>

          {/* 漂流瓶内容 */}
          {activeTab === 'bottles' && (
            <div>
              {isLoading ? (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  padding: '32px 0'
                }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    border: '2px solid #3b82f6',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                </div>
              ) : driftBottles.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '32px 16px',
                  color: '#9ca3af'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '8px' }}>🍾</div>
                  <div style={{ fontSize: '14px' }}>还没有拾到漂流瓶</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    去地图上探索吧！
                  </div>
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  {driftBottles.map((bottle) => (
                    <div
                      key={bottle.bottle_id}
                      style={{
                        backgroundColor: '#f9fafb',
                        borderRadius: '8px',
                        padding: '12px',
                        border: '1px solid #e5e7eb',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        marginBottom: '8px'
                      }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          background: 'linear-gradient(135deg, #60a5fa 0%, #06b6d4 100%)',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          fontSize: '18px'
                        }}>
                          🍾
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '13px',
                            fontWeight: '600',
                            color: '#111827',
                            marginBottom: '4px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            来自 {bottle.origin_city || '未知'}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: '#6b7280'
                          }}>
                            {formatRelativeTime((bottle as any).acquired_at || bottle.created_at)}拾到
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: '#9ca3af',
                            marginTop: '2px'
                          }}>
                            📝 {bottle.message_count || 0} 条留言
                          </div>
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        gap: '6px'
                      }}>
                        <button
                          onClick={() => handleViewDetail(bottle)}
                          style={{
                            flex: 1,
                            backgroundColor: '#eff6ff',
                            color: '#2563eb',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            fontSize: '12px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dbeafe'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                        >
                          <Eye size={14} />
                          查看
                        </button>
                        <button
                          onClick={() => handleReply(bottle)}
                          style={{
                            flex: 1,
                            backgroundColor: '#f0fdf4',
                            color: '#10b981',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            fontSize: '12px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dcfce7'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                        >
                          <Send size={14} />
                          回复
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 宝藏内容 */}
          {activeTab === 'treasures' && (
            <div>
              {isLoading ? (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  padding: '32px 0'
                }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    border: '2px solid #f59e0b',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                </div>
              ) : treasures.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '32px 16px',
                  color: '#9ca3af'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '8px' }}>📦</div>
                  <div style={{ fontSize: '14px' }}>还没有拾到宝藏</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    快去扫码寻找宝藏吧！
                  </div>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: '12px'
                }}>
                  {treasures.map((treasure) => (
                    <div
                      key={treasure.treasure_id}
                      onClick={() => handleViewTreasureDetail(treasure)}
                      style={{
                        backgroundColor: '#f9fafb',
                        borderRadius: '8px',
                        padding: '12px',
                        border: '1px solid #e5e7eb',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#f9fafb';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      {/* 宝藏图片 */}
                      {treasure.image_url ? (
                        <div style={{
                          width: '100%',
                          height: '80px',
                          backgroundImage: `url(${treasure.image_url})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          borderRadius: '6px',
                          position: 'relative'
                        }}>
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.5) 100%)',
                            borderRadius: '6px'
                          }}></div>
                          <div style={{
                            position: 'absolute',
                            bottom: '4px',
                            left: '4px',
                            right: '4px'
                          }}>
                            <div style={{
                              backgroundColor: 'rgba(0, 0, 0, 0.7)',
                              color: 'white',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 600,
                              textAlign: 'center'
                            }}>
                              {formatRewardPoints(treasure.reward_value)} 积分
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          width: '100%',
                          height: '80px',
                          background: 'linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <span style={{ fontSize: '32px' }}>📦</span>
                        </div>
                      )}

                      {/* 宝藏信息 */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#1f2937',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {treasure.title}
                        </div>
                        <div style={{
                          fontSize: '10px',
                          color: '#6b7280',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}>
                          <MapPin size={10} />
                          {treasure.hider_name} 藏
                        </div>
                        <div style={{
                          fontSize: '10px',
                          color: '#9ca3af'
                        }}>
                          {formatRelativeTime(treasure.found_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 历史记录内容 */}
          {activeTab === 'history' && (
            <div style={{ padding: '16px 0' }}>
              {/* 搜索和筛选栏 */}
              <div style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '16px'
              }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Search size={16} style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#9ca3af'
                  }} />
                  <input
                    type="text"
                    placeholder="搜索历史记录..."
                    value={searchKeyword}
                    onChange={(e) => handleSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 36px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                  />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    backgroundColor: showFilters ? '#3b82f6' : 'white',
                    color: showFilters ? 'white' : '#374151',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s'
                  }}
                >
                  <Filter size={16} />
                  筛选
                </button>
              </div>

              {/* 筛选面板 */}
              {showFilters && (
                <div style={{
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    gap: '8px'
                  }}>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '12px',
                        color: '#6b7280',
                        marginBottom: '4px'
                      }}>类型</label>
                      <select
                        value={historyFilters.type}
                        onChange={(e) => handleHistoryFilterChange({ type: e.target.value as any })}
                        style={{
                          width: '100%',
                          padding: '6px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                      >
                        <option value="all">全部</option>
                        <option value="bottles">漂流瓶</option>
                        <option value="treasures">宝藏</option>
                      </select>
                    </div>

                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '12px',
                        color: '#6b7280',
                        marginBottom: '4px'
                      }}>时间</label>
                      <select
                        value={historyFilters.period}
                        onChange={(e) => handleHistoryFilterChange({ period: e.target.value as any })}
                        style={{
                          width: '100%',
                          padding: '6px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                      >
                        <option value="all">全部</option>
                        <option value="day">今天</option>
                        <option value="week">本周</option>
                        <option value="month">本月</option>
                      </select>
                    </div>

                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '12px',
                        color: '#6b7280',
                        marginBottom: '4px'
                      }}>操作</label>
                      <select
                        value={historyFilters.action}
                        onChange={(e) => handleHistoryFilterChange({ action: e.target.value as any })}
                        style={{
                          width: '100%',
                          padding: '6px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                      >
                        <option value="all">全部</option>
                        <option value="created">创建</option>
                        <option value="picked">拾取</option>
                        <option value="hidden">藏宝</option>
                        <option value="found">寻宝</option>
                        <option value="scanned">扫码</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* 统计卡片 */}
              {historyStats && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '12px',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    backgroundColor: '#fef3c7',
                    border: '1px solid #fbbf24',
                    borderRadius: '8px',
                    padding: '12px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '24px', marginBottom: '4px' }}>🍾</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#92400e' }}>
                      {historyStats.bottles.total}
                    </div>
                    <div style={{ fontSize: '12px', color: '#78350f' }}>
                      漂流瓶
                    </div>
                  </div>

                  <div style={{
                    backgroundColor: '#dbeafe',
                    border: '1px solid #60a5fa',
                    borderRadius: '8px',
                    padding: '12px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '24px', marginBottom: '4px' }}>📦</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e40af' }}>
                      {historyStats.treasures.claimed}
                    </div>
                    <div style={{ fontSize: '12px', color: '#1e3a8a' }}>
                      寻宝成功
                    </div>
                  </div>

                  <div style={{
                    backgroundColor: '#d1fae5',
                    border: '1px solid #34d399',
                    borderRadius: '8px',
                    padding: '12px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '24px', marginBottom: '4px' }}>📱</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#065f46' }}>
                      {historyStats.scans.total}
                    </div>
                    <div style={{ fontSize: '12px', color: '#064e3b' }}>
                      扫码次数
                    </div>
                  </div>

                  <div style={{
                    backgroundColor: '#fce7f3',
                    border: '1px solid #f9a8d4',
                    borderRadius: '8px',
                    padding: '12px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '24px', marginBottom: '4px' }}>💎</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#9f1239' }}>
                      {historyStats.treasures.total_rewards_earned || 0}
                    </div>
                    <div style={{ fontSize: '12px', color: '#881337' }}>
                      获得积分
                    </div>
                  </div>
                </div>
              )}

              {/* 历史记录列表 */}
              {isHistoryLoading && historyItems.length === 0 ? (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  padding: '32px 0'
                }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    border: '2px solid #3b82f6',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                </div>
              ) : historyItems.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '32px 16px',
                  color: '#9ca3af'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '8px' }}>📋</div>
                  <div style={{ fontSize: '14px' }}>暂无历史记录</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    开始你的寻宝之旅吧！
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    marginBottom: '12px'
                  }}>
                    共 {historyPagination.total} 条记录
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {historyItems.map((item, index) => (
                      <div
                        key={`${item.type}-${item.item_id}-${index}`}
                        style={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          padding: '12px',
                          display: 'flex',
                          gap: '12px',
                          transition: 'all 0.2s',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f9fafb';
                          e.currentTarget.style.borderColor = '#d1d5db';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                          e.currentTarget.style.borderColor = '#e5e7eb';
                        }}
                      >
                        {/* 图标 */}
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '20px',
                          backgroundColor: item.type === 'bottle' ? '#fef3c7' :
                                          item.type === 'treasure' ? '#dbeafe' : '#f3f4f6'
                        }}>
                          {item.type === 'bottle' ? '🍾' :
                           item.type === 'treasure' ? '📦' : '📱'}
                        </div>

                        {/* 内容 */}
                        <div style={{ flex: 1 }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '4px'
                          }}>
                            <div>
                              <div style={{
                                fontSize: '14px',
                                fontWeight: '500',
                                color: '#111827',
                                marginBottom: '2px'
                              }}>
                                {item.title}
                              </div>
                              {item.description && (
                                <div style={{
                                  fontSize: '12px',
                                  color: '#6b7280',
                                  lineHeight: '1.4'
                                }}>
                                  {item.description.length > 50
                                    ? item.description.substring(0, 50) + '...'
                                    : item.description}
                                </div>
                              )}
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#9ca3af',
                              whiteSpace: 'nowrap'
                            }}>
                              {item.relative_time}
                            </div>
                          </div>

                          <div style={{
                            display: 'flex',
                            gap: '8px',
                            alignItems: 'center'
                          }}>
                            <span style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: item.action === 'created' ? '#fef3c7' :
                                              item.action === 'picked' ? '#d1fae5' :
                                              item.action === 'hidden' ? '#dbeafe' :
                                              item.action === 'found' ? '#fce7f3' :
                                              '#f3f4f6',
                              color: item.action === 'created' ? '#92400e' :
                                     item.action === 'picked' ? '#065f46' :
                                     item.action === 'hidden' ? '#1e40af' :
                                     item.action === 'found' ? '#9f1239' :
                                     '#374151'
                            }}>
                              {item.action === 'created' ? '创建' :
                               item.action === 'picked' ? '拾取' :
                               item.action === 'hidden' ? '藏宝' :
                               item.action === 'found' ? '寻宝' :
                               item.action === 'scanned' ? '扫码' : item.action}
                            </span>

                            {item.reward_points && (
                              <span style={{
                                fontSize: '10px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: '#fef3c7',
                                color: '#92400e'
                              }}>
                                +{item.reward_points} 积分
                              </span>
                            )}

                            {item.location && (
                              <span style={{
                                fontSize: '10px',
                                color: '#9ca3af',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2px'
                              }}>
                                <MapPin size={10} />
                                {item.location.lat.toFixed(2)}, {item.location.lng.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 加载更多 */}
                  {historyPagination.hasMore && (
                    <div style={{ textAlign: 'center', marginTop: '16px' }}>
                      <button
                        onClick={handleLoadMore}
                        disabled={isHistoryLoading}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: isHistoryLoading ? '#9ca3af' : '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: isHistoryLoading ? 'not-allowed' : 'pointer',
                          fontSize: '14px',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                          if (!isHistoryLoading) e.currentTarget.style.backgroundColor = '#2563eb';
                        }}
                        onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                          if (!isHistoryLoading) e.currentTarget.style.backgroundColor = '#3b82f6';
                        }}
                      >
                        {isHistoryLoading ? '加载中...' : '加载更多'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 回复弹窗 */}
      {showReplyModal && selectedBottle && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '448px',
            width: '100%',
            margin: '0 16px'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#111827',
              marginBottom: '16px'
            }}>回复并重新抛出</h3>
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                你的留言
              </label>
              <textarea
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                maxLength={200}
                rows={4}
                style={{
                  width: '100%',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
                placeholder="写下你的故事..."
              />
              <div style={{
                fontSize: '12px',
                color: '#9ca3af',
                marginTop: '4px',
                textAlign: 'right'
              }}>
                {replyMessage.length}/200
              </div>
            </div>
            <div style={{
              fontSize: '14px',
              color: '#6b7280',
              marginBottom: '24px',
              padding: '12px',
              backgroundColor: '#eff6ff',
              borderRadius: '8px',
              border: '1px solid #bfdbfe'
            }}>
              💡 回复后漂流瓶将重新漂向新的位置
            </div>
            <div style={{
              display: 'flex',
              gap: '12px'
            }}>
              <button
                onClick={() => {
                  setShowReplyModal(false);
                  setReplyMessage('');
                  setSelectedBottle(null);
                }}
                style={{
                  flex: 1,
                  backgroundColor: '#e5e7eb',
                  color: '#1f2937',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                取消
              </button>
              <button
                onClick={confirmReply}
                disabled={isActionLoading || !replyMessage.trim()}
                style={{
                  flex: 1,
                  backgroundColor: isActionLoading || !replyMessage.trim() ? '#9ca3af' : '#10b981',
                  color: 'white',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: isActionLoading || !replyMessage.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                {isActionLoading ? '发送中...' : '确认发送'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 详情弹窗（复用之前的组件） */}
      {showDetailModal && selectedBottle && (
        <BottleDetailModal
          bottle={selectedBottle}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedBottle(null);
          }}
        />
      )}

      {/* 宝藏详情弹窗 */}
      {showTreasureDetailModal && selectedTreasure && (
        <TreasureDetailModal
          treasure={selectedTreasure}
          onClose={() => {
            setShowTreasureDetailModal(false);
            setSelectedTreasure(null);
          }}
        />
      )}
    </>
  );
};

/**
 * 漂流瓶详情弹窗
 */
const BottleDetailModal: React.FC<{
  bottle: DriftBottle;
  onClose: () => void;
}> = ({ bottle, onClose }) => {
  const [messages, setMessages] = useState<DriftBottleMessage[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'messages' | 'history'>('messages');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (bottle.bottle_id) {
      loadBottleData();
    }
  }, [bottle.bottle_id]);

  const loadBottleData = async () => {
    try {
      setIsLoading(true);

      const detailResult = await driftBottleService.getBottleDetails(bottle.bottle_id);
      if (detailResult.success && detailResult.data) {
        setMessages(detailResult.data.bottle.messages || []);
      }

      const historyResult = await driftBottleService.getBottleHistory(bottle.bottle_id);
      if (historyResult.success && historyResult.data) {
        setHistory(historyResult.data.history);
      }
    } catch (error) {
      logger.error('加载瓶子数据失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        maxWidth: '600px',
        width: '100%',
        margin: '0 16px',
        maxHeight: '80vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* 头部 */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#111827'
            }}>漂流瓶详情</h3>
            <button
              onClick={onClose}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '24px',
                color: '#9ca3af',
                padding: '0'
              }}
            >
              ×
            </button>
          </div>
          <div style={{
            fontSize: '13px',
            color: '#6b7280'
          }}>
            瓶号: {bottle.bottle_id} · 来自 {bottle.origin_city}, {bottle.origin_country}
          </div>
        </div>

        {/* 标签页 */}
        <div style={{
          borderBottom: '1px solid #e5e7eb',
          display: 'flex'
        }}>
          <button
            onClick={() => setActiveTab('messages')}
            style={{
              flex: 1,
              padding: '12px',
              fontSize: '14px',
              fontWeight: '500',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'messages' ? '2px solid #2563eb' : 'none',
              color: activeTab === 'messages' ? '#2563eb' : '#6b7280',
              cursor: 'pointer'
            }}
          >
            留言 ({messages.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              flex: 1,
              padding: '12px',
              fontSize: '14px',
              fontWeight: '500',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'history' ? '2px solid #2563eb' : 'none',
              color: activeTab === 'history' ? '#2563eb' : '#6b7280',
              cursor: 'pointer'
            }}
          >
            轨迹 ({history.length})
          </button>
        </div>

        {/* 内容 */}
        <div style={{
          padding: '20px',
          overflowY: 'auto',
          maxHeight: '400px'
        }}>
          {isLoading ? (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '32px 0'
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                border: '2px solid #3b82f6',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
            </div>
          ) : (
            <>
              {activeTab === 'messages' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {messages.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
                      还没有留言
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div key={message.id} style={{
                        backgroundColor: '#f9fafb',
                        borderRadius: '8px',
                        padding: '12px'
                      }}>
                        <div style={{
                          fontSize: '13px',
                          fontWeight: '600',
                          color: '#111827',
                          marginBottom: '4px'
                        }}>
                          {message.author_name}
                        </div>
                        <div style={{
                          fontSize: '13px',
                          color: '#374151',
                          lineHeight: '1.5'
                        }}>
                          {message.message}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: '#9ca3af',
                          marginTop: '4px'
                        }}>
                          {driftBottleService.formatRelativeTime(message.created_at)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'history' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {history.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
                      暂无漂流记录
                    </div>
                  ) : (
                    history.map((record, index) => (
                      <div key={record.id} style={{
                        display: 'flex',
                        gap: '10px',
                        fontSize: '13px'
                      }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          backgroundColor: '#dbeafe',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#2563eb',
                          fontWeight: '600',
                          fontSize: '12px',
                          flexShrink: 0
                        }}>
                          {index + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontWeight: '600',
                            color: '#111827'
                          }}>
                            {record.username} {record.action === 'throw' ? '抛出' : record.action === 'pickup' ? '捡起' : '持有'}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: '#9ca3af'
                          }}>
                            {record.city || '未知'}, {record.country || '未知'} · {driftBottleService.formatRelativeTime(record.created_at)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * 宝藏详情弹窗
 */
const TreasureDetailModal: React.FC<{
  treasure: any;
  onClose: () => void;
}> = ({ treasure, onClose }) => {
  const formatRewardPoints = (rewardValue?: string) => {
    if (!rewardValue) return 0;
    try {
      const parsed = JSON.parse(rewardValue);
      return parsed.amount || 0;
    } catch {
      return 0;
    }
  };

  const rewardPoints = formatRewardPoints(treasure.reward_value);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        maxWidth: '480px',
        width: '100%',
        maxHeight: '90vh',
        margin: '0 16px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* 头部 */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'white'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Package size={20} color="#f59e0b" />
            <h3 style={{
              fontSize: '16px',
              fontWeight: 600,
              color: '#111827',
              margin: 0
            }}>宝藏详情</h3>
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              color: '#6b7280'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* 内容 */}
        <div style={{
          padding: '20px',
          overflowY: 'auto',
          flex: 1
        }}>
          {/* 宝藏图片 */}
          {treasure.image_url && (
            <div style={{
              marginBottom: '16px',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <img
                src={treasure.image_url}
                alt={treasure.title}
                style={{
                  width: '100%',
                  height: '200px',
                  objectFit: 'cover'
                }}
              />
            </div>
          )}

          {/* 宝藏标题和积分 */}
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            background: 'linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)',
            borderRadius: '8px',
            border: '1px solid #fbbf24'
          }}>
            <h4 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: '#1f2937',
              margin: '0 0 8px 0'
            }}>
              {treasure.title}
            </h4>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f97316 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{ fontSize: '14px', color: 'white' }}>💎</span>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>获得积分</div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: '#ea580c', margin: 0 }}>{rewardPoints}</div>
                </div>
              </div>
              <div style={{
                padding: '4px 8px',
                backgroundColor: '#16a34a',
                color: 'white',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 600
              }}>
                已拾取
              </div>
            </div>
          </div>

          {/* 宝藏描述 */}
          {treasure.description && (
            <div style={{ marginBottom: '16px' }}>
              <h5 style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span>📝</span> 描述
              </h5>
              <div style={{
                padding: '10px',
                backgroundColor: '#f9fafb',
                borderRadius: '6px',
                border: '1px solid #e5e7eb',
                fontSize: '14px',
                color: '#374151',
                lineHeight: 1.4
              }}>
                {treasure.description}
              </div>
            </div>
          )}

          {/* 宝藏线索 */}
          {treasure.hint && (
            <div style={{ marginBottom: '16px' }}>
              <h5 style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span>💡</span> 线索
              </h5>
              <div style={{
                padding: '10px',
                background: 'linear-gradient(135deg, #f3e8ff 0%, #e0e7ff 100%)',
                borderRadius: '6px',
                border: '1px solid #c084fc',
                fontSize: '14px',
                color: '#4c1d95',
                lineHeight: 1.4,
                fontStyle: 'italic'
              }}>
                {treasure.hint}
              </div>
            </div>
          )}

          {/* 藏宝信息 */}
          <div style={{ marginBottom: '16px' }}>
            <h5 style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>🏴</span> 藏宝信息
            </h5>
            <div style={{
              backgroundColor: '#f9fafb',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              padding: '10px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '6px',
                fontSize: '13px',
                color: '#374151'
              }}>
                <span style={{ fontWeight: 600, marginRight: '8px', minWidth: '50px' }}>藏宝者:</span>
                <span>{treasure.hider_name}</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '6px',
                fontSize: '13px',
                color: '#374151'
              }}>
                <span style={{ fontWeight: 600, marginRight: '8px', minWidth: '50px' }}>藏宝时间:</span>
                <span>{new Date(treasure.hidden_at).toLocaleString()}</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '13px',
                color: '#374151'
              }}>
                <span style={{ fontWeight: 600, marginRight: '8px', minWidth: '50px' }}>拾取时间:</span>
                <span>{new Date(treasure.found_at).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* 成就徽章 */}
          <div style={{
            textAlign: 'center',
            padding: '16px',
            background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
            borderRadius: '8px',
            border: '1px solid #34d399'
          }}>
            <div style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ fontSize: '20px' }}>✅</span>
              </div>
              <div>
                <div style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#065f46',
                  margin: '0 0 4px 0'
                }}>
                  寻宝成功
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#047857',
                  margin: 0
                }}>
                  成功发现并拾取了这个宝藏
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackpackPanel;
