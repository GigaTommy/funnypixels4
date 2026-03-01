import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { logger } from '../../utils/logger';
import { driftBottleService, DriftBottle, DriftBottleMessage } from '../../services/driftBottleService';
import { ModernFlagIcon } from '../ui/ModernFlagIcon';

/**
 * 漂流瓶库存管理组件 - 精致现代风格
 */
export const DriftBottleInventory: React.FC = () => {
  const [inventory, setInventory] = useState<DriftBottle[]>([]);
  const [selectedBottle, setSelectedBottle] = useState<DriftBottle | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      setIsLoading(true);
      const result = await driftBottleService.getUserInventory();
      if (result.success && result.data) {
        setInventory(result.data.inventory);
      } else {
        toast.error(result.message || '加载库存失败');
      }
    } catch (error) {
      logger.error('加载漂流瓶库存失败:', error);
      toast.error('加载库存失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueDrift = async (bottle: DriftBottle) => {
    setSelectedBottle(bottle);
    setShowMessageModal(true);
  };

  const confirmContinueDrift = async () => {
    if (!selectedBottle) return;

    setIsActionLoading(true);
    try {
      const result = await driftBottleService.continueDrift(
        selectedBottle.bottle_id,
        newMessage
      );

      if (result.success) {
        toast.success('漂流瓶已重新抛出，开始新的旅程！');
        setShowMessageModal(false);
        setNewMessage('');
        setSelectedBottle(null);
        loadInventory(); // 重新加载库存
      } else {
        toast.error(result.message || '继续漂流失败');
      }
    } catch (error) {
      logger.error('继续漂流失败:', error);
      toast.error('继续漂流失败');
    } finally {
      setIsActionLoading(false);
    }
  };

  const showBottleDetail = (bottle: DriftBottle) => {
    setSelectedBottle(bottle);
    setShowDetailModal(true);
  };

  const formatRelativeTime = (dateString: string) => {
    return driftBottleService.formatRelativeTime(dateString);
  };

  const formatDistance = (meters: number) => {
    return driftBottleService.formatDistance(meters);
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 0'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '2px solid #3b82f6',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '8px'
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#111827'
        }}>我的漂流瓶</h3>
        <div style={{
          fontSize: '14px',
          color: '#6b7280'
        }}>
          共 {inventory.length} 个瓶子
        </div>
      </div>

      {inventory.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '48px 0'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🍾</div>
          <h4 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#111827',
            marginBottom: '8px'
          }}>还没有漂流瓶</h4>
          <p style={{
            fontSize: '14px',
            color: '#6b7280'
          }}>去商店购买一个漂流瓶，开始你的漂流之旅吧！</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gap: '16px'
        }}>
          {inventory.map((bottle) => (
            <div
              key={bottle.bottle_id}
              style={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                transition: 'box-shadow 0.3s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'}
            >
              {/* 瓶子头部信息 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    background: 'linear-gradient(135deg, #60a5fa 0%, #06b6d4 100%)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px'
                  }}>
                    🍾
                  </div>
                  <div>
                    <div style={{
                      fontWeight: '600',
                      color: '#111827',
                      fontSize: '15px'
                    }}>
                      瓶号: {bottle.bottle_id}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#9ca3af'
                    }}>
                      {formatRelativeTime((bottle as any).acquired_at || bottle.created_at)}获得
                    </div>
                  </div>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {bottle.current_country && (
                    <ModernFlagIcon country={bottle.current_country} size="xs" />
                  )}
                  <span style={{
                    fontSize: '12px',
                    color: '#6b7280'
                  }}>
                    {bottle.current_city || '未知城市'}
                  </span>
                </div>
              </div>

              {/* 瓶子统计信息 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '16px',
                marginBottom: '12px'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: '#2563eb'
                  }}>
                    {formatDistance(bottle.total_distance)}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#6b7280'
                  }}>总距离</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: '#10b981'
                  }}>
                    {bottle.pickup_count}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#6b7280'
                  }}>被捡次数</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: '#8b5cf6'
                  }}>
                    {bottle.message_count || 0}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#6b7280'
                  }}>纸条数量</div>
                </div>
              </div>

              {/* 起始信息 */}
              <div style={{
                fontSize: '12px',
                color: '#6b7280',
                marginBottom: '12px',
                lineHeight: '1.6'
              }}>
                <div>
                  📍 起始: {bottle.origin_city || '未知'}, {bottle.origin_country || '未知'}
                </div>
                <div>
                  👤 最初由: {bottle.original_owner_name || '匿名'} 抛出
                </div>
              </div>

              {/* 操作按钮 */}
              <div style={{
                display: 'flex',
                gap: '8px'
              }}>
                <button
                  onClick={() => showBottleDetail(bottle)}
                  style={{
                    flex: 1,
                    backgroundColor: '#eff6ff',
                    color: '#2563eb',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dbeafe'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                >
                  查看详情
                </button>
                <button
                  onClick={() => handleContinueDrift(bottle)}
                  style={{
                    flex: 1,
                    backgroundColor: '#f0fdf4',
                    color: '#10b981',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dcfce7'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                >
                  继续漂流
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 详情弹窗 */}
      {showDetailModal && selectedBottle && (
        <DriftBottleDetailModal
          bottle={selectedBottle}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedBottle(null);
          }}
        />
      )}

      {/* 继续漂流弹窗 */}
      {showMessageModal && selectedBottle && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50
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
            }}>继续漂流</h3>
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                留言 (可选)
              </label>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
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
                placeholder="给这个瓶子写点什么..."
              />
              <div style={{
                fontSize: '12px',
                color: '#9ca3af',
                marginTop: '4px',
                textAlign: 'right'
              }}>
                {newMessage.length}/200
              </div>
            </div>
            <div style={{
              fontSize: '14px',
              color: '#6b7280',
              marginBottom: '24px'
            }}>
              漂流瓶将随机漂向新的位置，等待下一个有缘人发现...
            </div>
            <div style={{
              display: 'flex',
              gap: '12px'
            }}>
              <button
                onClick={() => {
                  setShowMessageModal(false);
                  setNewMessage('');
                  setSelectedBottle(null);
                }}
                style={{
                  flex: 1,
                  backgroundColor: '#e5e7eb',
                  color: '#1f2937',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#d1d5db'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
              >
                取消
              </button>
              <button
                onClick={confirmContinueDrift}
                disabled={isActionLoading}
                style={{
                  flex: 1,
                  backgroundColor: isActionLoading ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: isActionLoading ? 'not-allowed' : 'pointer',
                  opacity: isActionLoading ? 0.5 : 1,
                  transition: 'background-color 0.2s',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
                onMouseEnter={(e) => {
                  if (!isActionLoading) e.currentTarget.style.backgroundColor = '#2563eb';
                }}
                onMouseLeave={(e) => {
                  if (!isActionLoading) e.currentTarget.style.backgroundColor = '#3b82f6';
                }}
              >
                {isActionLoading ? '处理中...' : '确认抛出'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 漂流瓶详情弹窗组件
 */
const DriftBottleDetailModal: React.FC<{
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

      // 如果瓶子没有消息，重新获取详情
      if (!bottle.messages || bottle.messages.length === 0) {
        const detailResult = await driftBottleService.getBottleDetails(bottle.bottle_id);
        if (detailResult.success && detailResult.data) {
          setMessages(detailResult.data.bottle.messages || []);
        }
      } else {
        setMessages(bottle.messages);
      }

      // 获取历史记录
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
      zIndex: 50
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        maxWidth: '672px',
        width: '100%',
        margin: '0 16px',
        maxHeight: '80vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* 头部 */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <h3 style={{
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#111827'
            }}>漂流瓶详情</h3>
            <button
              onClick={onClose}
              style={{
                color: '#9ca3af',
                cursor: 'pointer',
                backgroundColor: 'transparent',
                border: 'none',
                fontSize: '24px',
                lineHeight: '1',
                padding: '4px'
              }}
            >
              ✕
            </button>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              background: 'linear-gradient(135deg, #60a5fa 0%, #06b6d4 100%)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px'
            }}>
              🍾
            </div>
            <div>
              <div style={{
                fontWeight: '600',
                color: '#111827',
                fontSize: '16px'
              }}>
                瓶号: {bottle.bottle_id}
              </div>
              <div style={{
                fontSize: '14px',
                color: '#6b7280'
              }}>
                由 {bottle.original_owner_name || '匿名'} 创建
              </div>
            </div>
          </div>
        </div>

        {/* 统计信息 */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#2563eb'
              }}>
                {driftBottleService.formatDistance(bottle.total_distance)}
              </div>
              <div style={{
                fontSize: '12px',
                color: '#6b7280'
              }}>总距离</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#10b981'
              }}>
                {bottle.pickup_count}
              </div>
              <div style={{
                fontSize: '12px',
                color: '#6b7280'
              }}>被捡次数</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#8b5cf6'
              }}>
                {messages.length}
              </div>
              <div style={{
                fontSize: '12px',
                color: '#6b7280'
              }}>纸条数量</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#f97316'
              }}>
                {driftBottleService.formatDuration(
                  Date.now() - new Date(bottle.created_at).getTime()
                )}
              </div>
              <div style={{
                fontSize: '12px',
                color: '#6b7280'
              }}>漂流时长</div>
            </div>
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
              padding: '12px 16px',
              fontSize: '14px',
              fontWeight: '500',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'messages' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'messages' ? '#2563eb' : '#6b7280',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            纸条 ({messages.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              flex: 1,
              padding: '12px 16px',
              fontSize: '14px',
              fontWeight: '500',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'history' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'history' ? '#2563eb' : '#6b7280',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            漂流记录 ({history.length})
          </button>
        </div>

        {/* 内容区域 */}
        <div style={{
          padding: '24px',
          overflowY: 'auto',
          maxHeight: '400px'
        }}>
          {isLoading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
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
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  {messages.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '32px 0',
                      color: '#9ca3af'
                    }}>
                      还没有人添加纸条
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div key={message.id} style={{
                        backgroundColor: '#f9fafb',
                        borderRadius: '8px',
                        padding: '16px'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          marginBottom: '8px'
                        }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            backgroundColor: '#d1d5db',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px'
                          }}>
                            {message.author_name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <div style={{
                              fontWeight: '500',
                              color: '#111827',
                              fontSize: '14px'
                            }}>
                              {message.author_name}
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#9ca3af'
                            }}>
                              {driftBottleService.formatRelativeTime(message.created_at)}
                            </div>
                          </div>
                        </div>
                        <div style={{
                          fontSize: '14px',
                          color: '#374151',
                          lineHeight: '1.6'
                        }}>
                          {message.message}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'history' && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  {history.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '32px 0',
                      color: '#9ca3af'
                    }}>
                      暂无漂流记录
                    </div>
                  ) : (
                    history.map((record, index) => (
                      <div key={record.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        fontSize: '14px'
                      }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          backgroundColor: '#dbeafe',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#2563eb',
                          fontWeight: '500',
                          fontSize: '13px'
                        }}>
                          {index + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontWeight: '500',
                            color: '#111827'
                          }}>
                            {record.username} {record.action === 'throw' ? '抛出' :
                               record.action === 'pickup' ? '捡起' : '持有'}
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: '#9ca3af'
                          }}>
                            {record.city || '未知'}, {record.country || '未知'} ·
                            {driftBottleService.formatRelativeTime(record.created_at)}
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

export default DriftBottleInventory;
