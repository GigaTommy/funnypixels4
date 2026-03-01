import React, { useState } from 'react';
import qrTreasureService from '../../services/qrTreasureService';

interface TreasureFoundCardProps {
  treasure: any;
  userLocation: { lat: number; lng: number };
  onClaim?: () => void;
  onClose: () => void;
  onViewBackpack?: () => void;
}

const TreasureFoundCard: React.FC<TreasureFoundCardProps> = ({
  treasure,
  userLocation,
  onClaim,
  onClose,
  onViewBackpack
}) => {
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState('');

  const handleClaim = async () => {
    setIsClaiming(true);
    setError('');

    try {
      const result = await qrTreasureService.claimTreasure(
        treasure.treasure_id,
        userLocation.lat,
        userLocation.lng
      );

      setClaimed(true);

      setTimeout(() => {
        if (onClaim) {
          onClaim();
        }
      }, 2000);
    } catch (err: any) {
      setError(err.message || '领取失败');
    } finally {
      setIsClaiming(false);
    }
  };

  const rewardValue = treasure.reward_value ? JSON.parse(treasure.reward_value) : { amount: 50 };
  const rewardPoints = rewardValue.amount || 50;

  if (claimed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{ marginBottom: '16px', animation: 'bounce 1s infinite' }}>
            <svg style={{ width: '96px', height: '96px', margin: '0 auto', color: '#16a34a' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 style={{ fontSize: '24px', fontWeight: 700, color: '#16a34a', marginBottom: '8px' }}>领取成功！</h3>
          <p style={{ color: '#4b5563', marginBottom: '4px' }}>获得 {rewardPoints} 积分</p>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>宝藏已添加到你的百宝箱</p>
        </div>

        {/* 成功后的操作按钮 */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              fontSize: '16px',
              fontWeight: 600,
              borderRadius: '8px',
              border: '2px solid #e5e7eb',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            继续寻宝
          </button>
          <button
            onClick={() => {
              if (onViewBackpack) {
                onViewBackpack();
              }
            }}
            style={{
              flex: 1,
              padding: '12px',
              background: 'linear-gradient(to right, #8b5cf6, #6366f1)',
              color: 'white',
              fontSize: '16px',
              fontWeight: 600,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(139, 92, 246, 0.3)',
              transition: 'all 0.3s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg style={{ width: '18px', height: '18px', marginRight: '6px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 3v4m0-4h4m-4 4l4-4M4 16l4 4m0 0h4m-4 0v4m0-4l-4 4M8 3v4m0-4H4m4 0L4 7m12 10v4m0 0h-4m4 0l-4-4m-8 0V7m0 0h4m-4 0l4 4" />
              </svg>
              查看百宝箱
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 庆祝动画头部 */}
      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '128px',
            height: '128px',
            background: 'linear-gradient(to right, #fbbf24, #f97316)',
            borderRadius: '50%',
            opacity: 0.2,
            animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite'
          }}></div>
        </div>
        <div style={{ position: 'relative', textAlign: 'center', padding: '24px 0' }}>
          <div style={{ marginBottom: '12px', animation: 'bounce 1s infinite' }}>
            <svg style={{ width: '64px', height: '64px', margin: '0 auto', color: '#f59e0b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 style={{
            fontSize: '24px',
            fontWeight: 700,
            background: 'linear-gradient(to right, #eab308, #ea580c)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            找到宝藏了！
          </h3>
        </div>
      </div>

      {/* 宝藏信息卡片 */}
      <div style={{
        background: 'linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)',
        borderRadius: '8px',
        padding: '16px',
        border: '2px solid #fbbf24',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <h4 style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937', marginBottom: '8px' }}>{treasure.title}</h4>

        {treasure.description && (
          <p style={{ color: '#374151', marginBottom: '12px' }}>{treasure.description}</p>
        )}

        {treasure.image_url && (
          <div style={{ marginBottom: '12px' }}>
            <img
              src={treasure.image_url}
              alt={treasure.title}
              style={{ width: '100%', height: '192px', objectFit: 'cover', borderRadius: '8px' }}
            />
          </div>
        )}

        <div style={{
          display: 'flex',
          alignItems: 'center',
          fontSize: '14px',
          color: '#4b5563',
          marginBottom: '12px',
          paddingBottom: '12px',
          borderBottom: '1px solid #fbbf24'
        }}>
          <svg style={{ width: '16px', height: '16px', marginRight: '4px' }} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
          <span>藏宝者：{treasure.hider_name}</span>
          <span style={{ margin: '0 8px' }}>•</span>
          <svg style={{ width: '16px', height: '16px', marginRight: '4px' }} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
          <span>{new Date(treasure.hidden_at).toLocaleDateString()}</span>
        </div>

        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: 'linear-gradient(135deg, #fbbf24 0%, #f97316 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '12px'
            }}>
              <svg style={{ width: '24px', height: '24px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>奖励积分</p>
              <p style={{ fontSize: '24px', fontWeight: 700, color: '#ea580c' }}>{rewardPoints}</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          backgroundColor: '#fee2e2',
          border: '1px solid #f87171',
          color: '#7f1d1d',
          padding: '12px 16px',
          borderRadius: '6px'
        }}>
          {error}
        </div>
      )}

      <button
        onClick={handleClaim}
        disabled={isClaiming}
        style={{
          width: '100%',
          padding: '12px',
          background: 'linear-gradient(to right, #eab308, #ea580c)',
          color: 'white',
          fontSize: '18px',
          fontWeight: 700,
          borderRadius: '8px',
          border: 'none',
          cursor: isClaiming ? 'not-allowed' : 'pointer',
          opacity: isClaiming ? 0.5 : 1,
          boxShadow: isClaiming ? 'none' : '0 4px 6px rgba(234, 179, 8, 0.3)',
          transition: 'all 0.3s ease'
        }}
      >
        {isClaiming ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
              width: '20px',
              height: '20px',
              border: '2px solid white',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              marginRight: '8px'
            }}></div>
            领取中...
          </div>
        ) : (
          '领取宝藏'
        )}
      </button>
    </div>
  );
};

export default TreasureFoundCard;
