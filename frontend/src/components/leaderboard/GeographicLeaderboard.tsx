import React, { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { motion } from 'framer-motion';
import { AllianceFlagRenderer } from '../ui/AllianceFlagRenderer';
import { materialLoaderService } from '../../services/materialLoaderService';
import { patternCache } from '../../patterns/patternCache';

interface GeographicLeaderboardProps {
  type: 'personal' | 'alliance' | 'city' | 'region' | 'province';
  title: string;
}

interface LeaderboardEntry {
  region_code: string;
  region_name: string;
  pixel_count: number;
  user_count: number;
  rank?: number;
  // 兼容其他排行榜类型的字段
  name?: string;
  alliance_name?: string;
  username?: string;
  display_name?: string;
  total_pixels?: number;
  score?: number;
  member_count?: number;
  pattern_id?: string;  // 新增：联盟图案ID
  pattern_type?: 'color' | 'emoji' | 'complex';  // 新增：联盟图案类型
}

interface LeaderboardData {
  level: string;
  period: string;
  data: LeaderboardEntry[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

export const GeographicLeaderboard: React.FC<GeographicLeaderboardProps> = ({ 
  type, 
  title 
}) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly' | 'allTime'>('daily');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLeaderboard();
  }, [type, period]);

  const loadLeaderboard = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let apiUrl = '';
      
      // 根据类型选择不同的API端点
      if (type === 'personal') {
        apiUrl = `/api/leaderboard/personal?period=${period}&limit=20`;
      } else if (type === 'alliance') {
        apiUrl = `/api/leaderboard/alliance?period=${period}&limit=20`;
      } else if (type === 'city') {
        // 城市榜使用新的专用API端点
        apiUrl = `/api/leaderboard/city?period=${period}&limit=20`;
      } else {
        // 其他类型使用地理统计API
        apiUrl = `/api/geographic/leaderboard/${type}?period=${period}&limit=20`;
      }
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        // 检查响应内容类型
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error(`服务器返回了非JSON响应: ${contentType}`);
        }
        
        const data = await response.json();
        console.log(`🔍 ${type} - ${period} API响应:`, {
          success: data.success,
          period: data.data?.period,
          dataCount: data.data?.data?.length,
          data: data.data?.data
        });

        if (data.success) {
          // 处理不同API的响应格式
          if (type === 'personal' || type === 'alliance' || type === 'city') {
            // 转换格式以匹配 GeographicLeaderboard 的数据结构
            const transformedData = {
              level: type,
              period: period,
              data: data.data?.data || data.data || [],
              pagination: data.data?.pagination || {
                limit: 20,
                offset: 0,
                total: (data.data?.data || data.data || []).length
              }
            };
            console.log(`🔄 ${type} - ${period} 转换后的数据:`, {
              dataLength: transformedData.data.length,
              period: transformedData.period
            });
            setLeaderboard(transformedData);

            // 🆕 预加载联盟旗帜的Material
            if (type === 'alliance' && transformedData.data.length > 0) {
              const patternIds = transformedData.data
                .map((entry: LeaderboardEntry) => entry.pattern_id)
                .filter((id): id is string => !!id);

              if (patternIds.length > 0) {
                // 批量获取图案数据
                const patterns = await Promise.all(
                  patternIds.map(id => patternCache.getPattern(id).catch(() => null))
                );

                // 提取Material IDs
                const materialIds = patterns
                  .map(p => p?.material_id)
                  .filter((id): id is string => !!id);

                // 批量预加载Material（不阻塞UI）
                if (materialIds.length > 0) {
                  materialLoaderService.preloadMaterials(materialIds).catch(err => {
                    logger.warn('预加载Material失败:', err);
                  });
                }
              }
            }
          } else {
            setLeaderboard(data.data);
          }
        } else {
          setError(data.message || '加载排行榜失败');
        }
      } else {
        setError('网络请求失败');
      }
    } catch (error) {
      logger.error('加载排行榜失败:', error);
      if (error instanceof SyntaxError && error.message.includes('Unexpected token')) {
        setError('服务器返回了无效的响应格式，请刷新页面重试');
      } else if (error instanceof Error && error.message.includes('非JSON响应')) {
        setError('服务器返回了错误页面，请检查网络连接');
      } else {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        setError('加载排行榜失败: ' + errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const getPeriodText = (p: string) => {
    switch (p) {
      case 'daily': return '日榜';
      case 'weekly': return '周榜';
      case 'monthly': return '月榜';
      case 'yearly': return '年榜';
      case 'allTime': return '总榜';
      default: return p;
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'personal': return '👤';
      case 'alliance': return '🏴';
      case 'region': return '🌍';
      case 'province': return '🏛️';
      case 'city': return '🏙️';
      case 'country': return '🌍';
      default: return '📍';
    }
  };

  if (loading) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        padding: '24px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '256px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '24px',
              height: '24px',
              border: '2px solid #4f46e5',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }}></div>
            <span style={{
              fontSize: '14px',
              color: '#9ca3af',
              fontWeight: 500
            }}>
              加载中...
            </span>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        padding: '24px'
      }}>
        <div style={{
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '40px',
            marginBottom: '16px'
          }}>
            ❌
          </div>
          <h3 style={{
            fontSize: '16px',
            fontWeight: 700,
            color: '#111827',
            margin: '0 0 8px 0'
          }}>
            加载失败
          </h3>
          <p style={{
            fontSize: '14px',
            color: '#9ca3af',
            margin: '0 0 16px 0'
          }}>
            {error}
          </p>
          <button
            onClick={loadLeaderboard}
            style={{
              padding: '8px 16px',
              backgroundColor: '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = '#4338ca';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = '#4f46e5';
            }}
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    }}>
      {/* 头部 - 简化设计，只显示标题 */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '16px 24px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {/* 左侧：只显示标题 */}
          <div>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 700,
              margin: '0',
              color: '#111827'
            }}>
              {title}
            </h2>
          </div>

          {/* 右侧：时间选择药丸按钮组 */}
          <div style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap'
          }}>
            {['daily', 'weekly', 'monthly', 'yearly', 'allTime'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p as any)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: period === p ? 'none' : '1px solid #d1d5db',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  backgroundColor: period === p ? '#4f46e5' : 'white',
                  color: period === p ? 'white' : '#6b7280',
                  boxShadow: period === p ? '0 2px 8px rgba(79,70,229,0.2)' : 'none'
                }}
                onMouseEnter={(e) => {
                  const target = e.currentTarget as HTMLButtonElement;
                  if (period !== p) {
                    target.style.backgroundColor = '#f3f4f6';
                    target.style.color = '#374151';
                  }
                }}
                onMouseLeave={(e) => {
                  const target = e.currentTarget as HTMLButtonElement;
                  if (period !== p) {
                    target.style.backgroundColor = 'white';
                    target.style.color = '#6b7280';
                  }
                }}
              >
                {getPeriodText(p)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 排行榜内容 */}
      <div style={{
        padding: '24px'
      }}>
        
        {leaderboard && leaderboard.data.length > 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {leaderboard.data.map((entry, index) => (
              <motion.div
                key={`city-${entry.region_code || entry.name || entry.alliance_name || entry.username || entry.display_name || index}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: '1px solid',
                  backgroundColor: index < 3 ? '#fef3c7' : '#f9fafb',
                  borderColor: index < 3 ? '#fde68a' : '#e5e7eb',
                  transition: 'all 0.3s ease',
                  boxShadow: index < 3 ? '0 2px 6px rgba(253,224,71,0.15)' : 'none'
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                  el.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.boxShadow = index < 3 ? '0 2px 6px rgba(253,224,71,0.15)' : 'none';
                  el.style.transform = 'translateY(0)';
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px'
                }}>
                  {/* 排名 - 模仿Store的风格 */}
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: index < 3 ? '#fbbf24' : '#e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: index < 3 ? '16px' : '14px',
                    fontWeight: 700,
                    color: index < 3 ? 'white' : '#6b7280'
                  }}>
                    {index < 3 ? getRankIcon(index + 1) : `#${index + 1}`}
                  </div>

                  {/* 地区信息 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {type === 'alliance' && entry.pattern_id && (
                      <AllianceFlagRenderer
                        patternId={entry.pattern_id}
                        patternType={entry.pattern_type || 'color'}
                        size="lg"
                        className="flex-shrink-0"
                      />
                    )}
                    <div>
                      <h3 style={{
                        fontSize: '15px',
                        fontWeight: 700,
                        color: '#111827',
                        margin: '0 0 4px 0'
                      }}>
                        {entry.region_name || entry.name || entry.alliance_name || entry.username || entry.display_name}
                      </h3>
                      <p style={{
                        fontSize: '13px',
                        color: '#9ca3af',
                        margin: '0',
                        fontWeight: 500
                      }}>
                        {type === 'personal' ? '用户' :
                         type === 'alliance' ? '联盟' :
                         type === 'region' ? '地区' :
                         type === 'province' ? '省份' :
                         type === 'city' ? '城市' : '国家'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 统计数据 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '32px'
                }}>
                  <div style={{
                    textAlign: 'center'
                  }}>
                    <p style={{
                      fontSize: '18px',
                      fontWeight: 700,
                      color: '#4f46e5',
                      margin: '0 0 2px 0'
                    }}>
                      {formatNumber(entry.pixel_count || entry.total_pixels || entry.score || 0)}
                    </p>
                    <p style={{
                      fontSize: '12px',
                      color: '#9ca3af',
                      margin: '0',
                      fontWeight: 500
                    }}>
                      {type === 'alliance' ? '总像素' : '像素数'}
                    </p>
                  </div>
                  <div style={{
                    textAlign: 'center'
                  }}>
                    <p style={{
                      fontSize: '18px',
                      fontWeight: 700,
                      color: '#10b981',
                      margin: '0 0 2px 0'
                    }}>
                      {formatNumber(entry.user_count || entry.member_count || 0)}
                    </p>
                    <p style={{
                      fontSize: '12px',
                      color: '#9ca3af',
                      margin: '0',
                      fontWeight: 500
                    }}>
                      {type === 'alliance' ? '成员数' : '用户数'}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '48px 24px'
          }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '16px'
            }}>
              📊
            </div>
            <h3 style={{
              fontSize: '16px',
              fontWeight: 700,
              color: '#4b5563',
              margin: '0 0 8px 0'
            }}>
              暂无数据
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#9ca3af',
              margin: '0'
            }}>
              {getPeriodText(period)}暂无{title}排行榜数据
            </p>
          </div>
        )}
      </div>

      {/* 分页信息 */}
      {leaderboard && leaderboard.pagination.total > leaderboard.pagination.limit && (
        <div style={{
          backgroundColor: '#f9fafb',
          padding: '16px 24px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span style={{
            fontSize: '13px',
            color: '#9ca3af',
            fontWeight: 500
          }}>
            显示 {leaderboard.pagination.offset + 1} - {Math.min(leaderboard.pagination.offset + leaderboard.pagination.limit, leaderboard.pagination.total)}
            共 {leaderboard.pagination.total} 条
          </span>
          <div style={{
            display: 'flex',
            gap: '8px'
          }}>
            <button
              disabled={leaderboard.pagination.offset === 0}
              style={{
                padding: '8px 12px',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: leaderboard.pagination.offset === 0 ? 'not-allowed' : 'pointer',
                color: '#6b7280',
                opacity: leaderboard.pagination.offset === 0 ? 0.5 : 1,
                transition: 'all 0.3s ease'
              }}
            >
              上一页
            </button>
            <button
              disabled={leaderboard.pagination.offset + leaderboard.pagination.limit >= leaderboard.pagination.total}
              style={{
                padding: '8px 12px',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: leaderboard.pagination.offset + leaderboard.pagination.limit >= leaderboard.pagination.total ? 'not-allowed' : 'pointer',
                color: '#6b7280',
                opacity: leaderboard.pagination.offset + leaderboard.pagination.limit >= leaderboard.pagination.total ? 0.5 : 1,
                transition: 'all 0.3s ease'
              }}
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeographicLeaderboard;
