import React, { useState, useEffect } from 'react';
import qrTreasureService from '../../services/qrTreasureService';
import TreasureDetailModal from './TreasureDetailModal';

interface Treasure {
  treasure_id: string;
  title: string;
  description?: string;
  image_url?: string;
  hint?: string;
  reward_value?: string;
  found_at: string;
  hidden_at: string;
  hider_name: string;
  location?: {
    lat: number;
    lng: number;
  };
}

interface BackpackInventoryProps {
  isOpen: boolean;
  onClose: () => void;
}

const BackpackInventory: React.FC<BackpackInventoryProps> = ({
  isOpen,
  onClose
}) => {
  const [treasures, setTreasures] = useState<Treasure[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTreasure, setSelectedTreasure] = useState<Treasure | null>(null);

  // 加载已拾取的宝藏
  const loadFoundTreasures = async () => {
    setLoading(true);
    setError('');

    try {
      const foundTreasures = await qrTreasureService.getMyFoundTreasures();
      setTreasures(foundTreasures || []);
    } catch (err: any) {
      setError(err.message || '获取宝藏失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadFoundTreasures();
    }
  }, [isOpen]);

  const handleTreasureClick = (treasure: Treasure) => {
    setSelectedTreasure(treasure);
  };

  const handleCloseDetailModal = () => {
    setSelectedTreasure(null);
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

  if (!isOpen) return null;

  return (
    <>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* 顶部导航栏 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px',
          backgroundColor: 'white',
          borderBottom: '1px solid #e5e7eb',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <svg style={{ width: '24px', height: '24px', color: '#8b5cf6' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 3v4m0-4h4m-4 4l4-4M4 16l4 4m0 0h4m-4 0v4m0-4l-4 4M8 3v4m0-4H4m4 0L4 7m12 10v4m0 0h-4m4 0l-4-4m-8 0V7m0 0h4m-4 0l4 4" />
            </svg>
            <h1 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>我的百宝箱</h1>
          </div>

          <button
            onClick={onClose}
            style={{
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#374151',
              backgroundColor: '#f3f4f6',
              border: '2px solid #e5e7eb',
              borderRadius: '50%',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容区域 */}
        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#f9fafb' }}>
          {loading && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '64px 24px',
              textAlign: 'center'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                border: '4px solid #e5e7eb',
                borderTopColor: '#8b5cf6',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                marginBottom: '16px'
              }}></div>
              <p style={{ color: '#6b7280' }}>正在加载宝藏...</p>
            </div>
          )}

          {error && (
            <div style={{
              margin: '16px',
              padding: '16px',
              backgroundColor: '#fee2e2',
              border: '1px solid #f87171',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <p style={{ color: '#dc2626', marginBottom: '12px' }}>{error}</p>
              <button
                onClick={loadFoundTreasures}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                重试
              </button>
            </div>
          )}

          {!loading && !error && (
            <>
              {treasures.length === 0 ? (
                // 空状态
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '64px 24px',
                  textAlign: 'center'
                }}>
                  <div style={{
                    width: '120px',
                    height: '120px',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '24px'
                  }}>
                    <svg style={{ width: '64px', height: '64px', color: '#9ca3af' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    百宝箱还是空的
                  </h3>
                  <p style={{
                    color: '#6b7280',
                    marginBottom: '24px',
                    lineHeight: 1.5
                  }}>
                    快去扫码寻找宝藏吧！<br />
                    世界上处处都有惊喜等着你
                  </p>
                  <button
                    onClick={onClose}
                    style={{
                      padding: '12px 24px',
                      background: 'linear-gradient(to right, #8b5cf6, #6366f1)',
                      color: 'white',
                      fontSize: '16px',
                      fontWeight: 600,
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 4px 6px rgba(139, 92, 246, 0.3)'
                    }}
                  >
                    开始寻宝
                  </button>
                </div>
              ) : (
                // 宝藏列表
                <div style={{ padding: '16px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '16px'
                  }}>
                    <h2 style={{
                      fontSize: '16px',
                      fontWeight: 600,
                      color: '#374151',
                      margin: 0
                    }}>
                      已拾取宝藏 ({treasures.length})
                    </h2>
                    <div style={{
                      fontSize: '14px',
                      color: '#6b7280'
                    }}>
                      总计: {treasures.reduce((sum, t) => sum + formatRewardPoints(t.reward_value), 0)} 积分
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: '12px'
                  }}>
                    {treasures.map((treasure) => (
                      <div
                        key={treasure.treasure_id}
                        onClick={() => handleTreasureClick(treasure)}
                        style={{
                          backgroundColor: 'white',
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                        }}
                      >
                        {/* 宝藏图片 */}
                        {treasure.image_url ? (
                          <div style={{
                            width: '100%',
                            height: '120px',
                            backgroundImage: `url(${treasure.image_url})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            position: 'relative'
                          }}>
                            <div style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.5) 100%)'
                            }}></div>
                            <div style={{
                              position: 'absolute',
                              bottom: '8px',
                              left: '8px',
                              right: '8px'
                            }}>
                              <div style={{
                                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                color: 'white',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 600
                              }}>
                                +{formatRewardPoints(treasure.reward_value)} 积分
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div style={{
                            width: '100%',
                            height: '120px',
                            background: 'linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <svg style={{ width: '48px', height: '48px', color: '#f59e0b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                          </div>
                        )}

                        {/* 宝藏信息 */}
                        <div style={{ padding: '12px' }}>
                          <h3 style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: '#1f2937',
                            margin: '0 0 4px 0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {treasure.title}
                          </h3>
                          <p style={{
                            fontSize: '12px',
                            color: '#6b7280',
                            margin: '0 0 8px 0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {treasure.hider_name} 藏
                          </p>
                          <div style={{
                            fontSize: '11px',
                            color: '#9ca3af'
                          }}>
                            {new Date(treasure.found_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 宝藏详情弹窗 */}
      {selectedTreasure && (
        <TreasureDetailModal
          treasure={selectedTreasure}
          onClose={handleCloseDetailModal}
        />
      )}

      {/* CSS动画 */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </>
  );
};

export default BackpackInventory;