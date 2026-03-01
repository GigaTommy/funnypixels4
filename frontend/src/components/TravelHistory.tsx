import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Clock,
  Compass,
  Navigation,
  Package,
  QrCode,
  ChevronRight,
  RefreshCw,
  Filter,
  Calendar,
  Scan,
  Anchor
} from 'lucide-react';
import { logger } from '../utils/logger';
import historyService, { HistoryItem } from '../services/historyService';
import { toast } from '../services/toast';
import { soundService } from '../services/soundService';

interface TravelHistoryProps {
  isAuthenticated: boolean;
}

type TabType = 'all' | 'bottles' | 'treasures' | 'scans';

// 按月份分组的历史记录
interface GroupedHistory {
  [yearMonth: string]: HistoryItem[];
}

export default function TravelHistory({ isAuthenticated }: TravelHistoryProps) {
  const [loading, setLoading] = useState(true);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'day' | 'week' | 'month'>('all');

  // 加载历史记录
  const loadHistory = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // 同时加载历史记录和统计数据
      const [historyResponse, statsResponse] = await Promise.all([
        historyService.getUserHistory({
          type: activeTab === 'all' ? 'all' : activeTab === 'bottles' ? 'bottles' : 'treasures',
          period: selectedPeriod,
          limit: 100,
          sortBy: 'created_at',
          sortOrder: 'desc'
        }),
        historyService.getHistoryStats()
      ]);

      if (historyResponse.success && historyResponse.data) {
        setHistoryItems(historyResponse.data.items);
      }

      setStats(statsResponse);

    } catch (error) {
      logger.error('加载历史记录失败:', error);
      toast.error('加载历史记录失败');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, activeTab, selectedPeriod]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // 按月份分组历史记录
  const groupedHistory = useMemo<GroupedHistory>(() => {
    const groups: GroupedHistory = {};

    historyItems.forEach(item => {
      const date = new Date(item.created_at);
      const yearMonth = `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月`;

      if (!groups[yearMonth]) {
        groups[yearMonth] = [];
      }
      groups[yearMonth].push(item);
    });

    return groups;
  }, [historyItems]);

  // 计算总统计
  const totalStats = useMemo(() => {
    const total = {
      count: historyItems.length,
      bottles: 0,
      treasures: 0,
      scans: 0
    };

    historyItems.forEach(item => {
      if (item.type === 'bottle') total.bottles++;
      else if (item.type === 'treasure') total.treasures++;
      else if (item.type === 'scan') total.scans++;
    });

    return total;
  }, [historyItems]);

  // 获取活动类型图标和颜色
  const getActivityIcon = (item: HistoryItem) => {
    switch (item.type) {
      case 'bottle':
        return {
          Icon: Anchor,
          color: '#3b82f6',
          bgColor: '#dbeafe',
          label: item.action === 'created' ? '投放' : '拾取'
        };
      case 'treasure':
        return {
          Icon: Package,
          color: item.action === 'hidden' ? '#f59e0b' : '#10b981',
          bgColor: item.action === 'hidden' ? '#fef3c7' : '#d1fae5',
          label: item.action === 'hidden' ? '藏宝' : '寻宝'
        };
      case 'scan':
        return {
          Icon: QrCode,
          color: '#8b5cf6',
          bgColor: '#ede9fe',
          label: '扫码'
        };
      default:
        return {
          Icon: MapPin,
          color: '#6b7280',
          bgColor: '#f3f4f6',
          label: '活动'
        };
    }
  };

  // 格式化时间
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${String(date.getMonth() + 1).padStart(2, '0')}月${String(date.getDate()).padStart(2, '0')}日 ${hours}:${minutes}`;
  };

  // 渲染游客模式
  const renderGuestMode = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        textAlign: 'center',
        padding: '48px 24px',
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
        <Navigation size={40} style={{ color: '#9ca3af' }} />
      </div>
      <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#1f2937', marginBottom: '8px' }}>活动历史</h3>
      <p style={{ color: '#6b7280', marginBottom: '16px', lineHeight: '1.5' }}>
        登录后即可查看您的活动足迹
      </p>
      <button
        onClick={() => window.location.href = '/login'}
        style={{
          padding: '10px 24px',
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
        padding: '48px 24px',
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
        <MapPin size={40} style={{ color: '#9ca3af' }} />
      </div>
      <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', marginBottom: '8px' }}>暂无活动记录</h3>
      <p style={{ color: '#6b7280', lineHeight: '1.5' }}>
        开始您的第一次冒险吧！
      </p>
    </motion.div>
  );

  if (!isAuthenticated) {
    return (
      <div style={{ width: '100%', padding: '16px' }}>
        {renderGuestMode()}
      </div>
    );
  }

  return (
    <div style={{ width: '100%', minHeight: '100vh', backgroundColor: '#f9fafb', padding: '16px' }}>
      {/* 顶部标题 */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        border: '1px solid #e5e7eb',
        padding: '16px',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>我的探索记录</h1>
          <button
            onClick={loadHistory}
            disabled={loading}
            style={{
              padding: '8px',
              borderRadius: '8px',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              backgroundColor: '#f3f4f6',
              color: '#374151',
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
            <RefreshCw size={20} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>

        {/* 标签栏 */}
        <div style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          {[
            { id: 'all', label: '全部', icon: Compass },
            { id: 'bottles', label: '漂流瓶', icon: Anchor },
            { id: 'treasures', label: 'QR宝藏', icon: Package },
            { id: 'scans', label: '扫码', icon: QrCode }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                soundService.play('click');
                setActiveTab(tab.id as TabType);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                backgroundColor: activeTab === tab.id ? '#3b82f6' : 'white',
                color: activeTab === tab.id ? 'white' : '#6b7280',
                boxShadow: activeTab === tab.id ? '0 2px 8px rgba(59,130,246,0.3)' : '0 1px 3px rgba(0,0,0,0.08)',
                border: activeTab === tab.id ? 'none' : '1px solid #d1d5db'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f3f4f6';
                  (e.currentTarget as HTMLButtonElement).style.color = '#374151';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'white';
                  (e.currentTarget as HTMLButtonElement).style.color = '#6b7280';
                }
              }}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 累计统计 */}
      {stats && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          border: '1px solid #e5e7eb',
          padding: '16px',
          marginBottom: '16px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px'
          }}>
            <div>
              <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>累计导航</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '32px', fontWeight: 'bold', color: '#1f2937' }}>
                  {totalStats.count}
                </span>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>次活动</span>
              </div>
            </div>
            <div style={{
              display: 'flex',
              gap: '4px',
              padding: '4px',
              backgroundColor: '#f3f4f6',
              borderRadius: '8px'
            }}>
              <button
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 500,
                  backgroundColor: 'transparent',
                  color: '#6b7280'
                }}
              >
                筛选
              </button>
            </div>
          </div>

          {/* 统计详情 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid #e5e7eb'
          }}>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>漂流瓶</div>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#3b82f6' }}>
                {stats.bottles?.total || 0}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>QR宝藏</div>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#10b981' }}>
                {(stats.treasures?.hidden || 0) + (stats.treasures?.claimed || 0)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>扫码次数</div>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#8b5cf6' }}>
                {stats.scans?.total || 0}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 历史记录列表 */}
      {loading ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 0',
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '2px solid #e5e7eb',
            borderTop: '2px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
        </div>
      ) : historyItems.length === 0 ? (
        renderEmptyState()
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {Object.keys(groupedHistory).sort().reverse().map((yearMonth) => (
            <div key={yearMonth}>
              {/* 月份标题 */}
              <div style={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '12px',
                paddingLeft: '4px'
              }}>
                {yearMonth}
              </div>

              {/* 该月的历史记录 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {groupedHistory[yearMonth].map((item, index) => {
                  const { Icon, color, bgColor, label } = getActivityIcon(item);

                  return (
                    <motion.div
                      key={`${item.item_id}-${index}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      style={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        border: '1px solid #e5e7eb',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                      }}
                    >
                      <div style={{ display: 'flex', padding: '16px', gap: '12px' }}>
                        {/* 左侧图标 */}
                        <div style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '12px',
                          backgroundColor: bgColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Icon size={24} style={{ color }} />
                        </div>

                        {/* 中间内容 */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{
                              fontSize: '14px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: bgColor,
                              color: color
                            }}>
                              {label}
                            </span>
                            <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                              {formatTime(item.created_at)}
                            </span>
                          </div>

                          {/* 位置信息 */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <div style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: '#10b981'
                              }}></div>
                              <span style={{
                                fontSize: '13px',
                                color: '#374151',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {item.title || '活动地点'}
                              </span>
                            </div>
                            {item.description && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingLeft: '10px' }}>
                                <div style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  backgroundColor: '#ef4444'
                                }}></div>
                                <span style={{
                                  fontSize: '13px',
                                  color: '#6b7280',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {item.description}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 右侧箭头 */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#d1d5db'
                        }}>
                          <ChevronRight size={20} />
                        </div>
                      </div>

                      {/* 额外信息 */}
                      {item.reward_points && item.reward_points > 0 && (
                        <div style={{
                          borderTop: '1px solid #f3f4f6',
                          padding: '8px 16px',
                          backgroundColor: '#fefce8',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '12px',
                          color: '#ca8a04'
                        }}>
                          <span>💰</span>
                          <span>获得 {item.reward_points} 积分</span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 添加旋转动画样式 */}
      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
