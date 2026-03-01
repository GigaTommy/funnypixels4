import React from 'react';

interface Treasure {
  treasure_id: string;
  title: string;
  description?: string;
  image_url?: string;
  hint?: string;
  reward_value?: string;
  found_at: string;
  hider_name: string;
  hidden_at: string;
  location?: {
    lat: number;
    lng: number;
  };
}

interface TreasureDetailModalProps {
  treasure: Treasure;
  onClose: () => void;
}

const TreasureDetailModal: React.FC<TreasureDetailModalProps> = ({
  treasure,
  onClose
}) => {
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
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      zIndex: 1001,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        maxWidth: '480px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        {/* 顶部导航 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: 'white'
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: 600,
            color: '#1f2937',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg style={{ width: '20px', height: '20px', color: '#f59e0b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            宝藏详情
          </h2>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6b7280',
              backgroundColor: '#f3f4f6',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容区域 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {/* 宝藏图片 */}
          {treasure.image_url && (
            <div style={{
              marginBottom: '20px',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid #e5e7eb'
            }}>
              <img
                src={treasure.image_url}
                alt={treasure.title}
                style={{
                  width: '100%',
                  height: '240px',
                  objectFit: 'cover',
                  display: 'block'
                }}
              />
            </div>
          )}

          {/* 宝藏标题和积分奖励 */}
          <div style={{
            marginBottom: '20px',
            padding: '16px',
            background: 'linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)',
            borderRadius: '8px',
            border: '2px solid #fbbf24'
          }}>
            <h3 style={{
              fontSize: '20px',
              fontWeight: 700,
              color: '#1f2937',
              margin: '0 0 8px 0'
            }}>
              {treasure.title}
            </h3>
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
                  width: '32px',
                  height: '32px',
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f97316 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <svg style={{ width: '18px', height: '18px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>获得积分</p>
                  <p style={{ fontSize: '20px', fontWeight: 700, color: '#ea580c', margin: 0 }}>{rewardPoints}</p>
                </div>
              </div>
              <div style={{
                padding: '6px 12px',
                backgroundColor: '#16a34a',
                color: 'white',
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: 600
              }}>
                已拾取
              </div>
            </div>
          </div>

          {/* 宝藏描述 */}
          {treasure.description && (
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#1f2937',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <svg style={{ width: '16px', height: '16px', color: '#6b7280' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                描述
              </h4>
              <div style={{
                padding: '12px',
                backgroundColor: '#f9fafb',
                borderRadius: '6px',
                border: '1px solid #e5e7eb',
                fontSize: '14px',
                color: '#374151',
                lineHeight: 1.5
              }}>
                {treasure.description}
              </div>
            </div>
          )}

          {/* 宝藏线索 */}
          {treasure.hint && (
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#1f2937',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <svg style={{ width: '16px', height: '16px', color: '#8b5cf6' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                线索
              </h4>
              <div style={{
                padding: '12px',
                background: 'linear-gradient(135deg, #f3e8ff 0%, #e0e7ff 100%)',
                borderRadius: '6px',
                border: '1px solid #c084fc',
                fontSize: '14px',
                color: '#4c1d95',
                lineHeight: 1.5,
                fontStyle: 'italic'
              }}>
                {treasure.hint}
              </div>
            </div>
          )}

          {/* 藏宝信息 */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{
              fontSize: '16px',
              fontWeight: 600,
              color: '#1f2937',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <svg style={{ width: '16px', height: '16px', color: '#6b7280' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              藏宝信息
            </h4>
            <div style={{
              backgroundColor: '#f9fafb',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              padding: '12px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '8px',
                fontSize: '14px',
                color: '#374151'
              }}>
                <span style={{ fontWeight: 600, marginRight: '8px', minWidth: '60px' }}>藏宝者:</span>
                <span>{treasure.hider_name}</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '8px',
                fontSize: '14px',
                color: '#374151'
              }}>
                <span style={{ fontWeight: 600, marginRight: '8px', minWidth: '60px' }}>藏宝时间:</span>
                <span>{new Date(treasure.hidden_at).toLocaleString()}</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '14px',
                color: '#374151'
              }}>
                <span style={{ fontWeight: 600, marginRight: '8px', minWidth: '60px' }}>拾取时间:</span>
                <span>{new Date(treasure.found_at).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* 成就徽章 */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '16px',
            background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
            borderRadius: '8px',
            border: '1px solid #34d399',
            textAlign: 'center'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg style={{ width: '24px', height: '24px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h5 style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#065f46',
                  margin: '0 0 4px 0'
                }}>
                  寻宝成功
                </h5>
                <p style={{
                  fontSize: '12px',
                  color: '#047857',
                  margin: 0
                }}>
                  成功发现并拾取了这个宝藏
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TreasureDetailModal;