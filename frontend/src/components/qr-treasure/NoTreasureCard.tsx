import React from 'react';

interface NoTreasureCardProps {
  onHideClick: () => void;
  onRescan: () => void;
  onViewBackpack?: () => void;
  treasureHidden?: boolean;
}

const NoTreasureCard: React.FC<NoTreasureCardProps> = ({
  onHideClick,
  onRescan,
  onViewBackpack,
  treasureHidden = false
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 藏宝成功提示 */}
      {treasureHidden && (
        <div style={{
          background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
          borderRadius: '8px',
          padding: '16px',
          border: '1px solid #34d399',
          textAlign: 'center'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px'
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
            <h3 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: '#065f46',
              margin: '0 0 4px 0'
            }}>
              藏宝成功！
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#047857',
              margin: 0
            }}>
              你的宝藏已成功埋藏，等待有缘人发现
            </p>
          </div>

          {/* 藏宝成功后的操作按钮 */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={onRescan}
              style={{
                flex: 1,
                padding: '8px 12px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                fontSize: '14px',
                fontWeight: 600,
                borderRadius: '6px',
                border: '1px solid #e5e7eb',
                cursor: 'pointer'
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
                padding: '8px 12px',
                backgroundColor: 'white',
                color: '#16a34a',
                fontSize: '14px',
                fontWeight: 600,
                borderRadius: '6px',
                border: '1px solid #34d399',
                cursor: 'pointer'
              }}
            >
              查看我的藏宝
            </button>
          </div>
        </div>
      )}

      {/* 空状态插图 - 只在非藏宝成功时显示 */}
      {!treasureHidden && (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            {/* 背景装饰 */}
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
                backgroundColor: '#e5e7eb',
                borderRadius: '50%',
                opacity: 0.3
              }}></div>
            </div>

            {/* 图标 */}
            <div style={{ position: 'relative', zIndex: 10 }}>
              <svg style={{ width: '96px', height: '96px', margin: '0 auto', color: '#9ca3af' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <h3 style={{
            fontSize: '20px',
            fontWeight: 700,
            color: '#374151',
            marginTop: '16px',
            marginBottom: '8px'
          }}>
            这里还没有宝藏
          </h3>
          <p style={{ color: '#6b7280' }}>
            成为第一个藏宝者吧！
          </p>
        </div>
      )}

      {/* 藏宝邀请卡片 - 只在非藏宝成功时显示 */}
      {!treasureHidden && (
        <div style={{
          background: 'linear-gradient(135deg, #f3e8ff 0%, #e0e7ff 100%)',
          borderRadius: '8px',
          padding: '24px',
          border: '2px solid #c084fc',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <svg style={{ width: '24px', height: '24px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div style={{ marginLeft: '16px', flex: 1 }}>
              <h4 style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937', marginBottom: '4px' }}>藏下你的宝藏</h4>
              <p style={{ fontSize: '14px', color: '#4b5563' }}>
                在这个二维码上留下你的宝藏，等待有缘人发现
              </p>
            </div>
          </div>

          {/* 藏宝优势 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '14px', color: '#374151' }}>
              <svg style={{ width: '16px', height: '16px', color: '#16a34a', marginRight: '8px' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>设置积分奖励，吸引寻宝者</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '14px', color: '#374151' }}>
              <svg style={{ width: '16px', height: '16px', color: '#16a34a', marginRight: '8px' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>宝藏被找到后获得反馈积分</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '14px', color: '#374151' }}>
              <svg style={{ width: '16px', height: '16px', color: '#16a34a', marginRight: '8px' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>留下照片和线索，增加趣味性</span>
            </div>
          </div>

          {/* 藏宝按钮 */}
          <button
            onClick={onHideClick}
            style={{
              width: '100%',
              padding: '12px',
              background: 'linear-gradient(to right, #a855f7, #6366f1)',
              color: 'white',
              fontWeight: 600,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(168, 85, 247, 0.3)',
              transition: 'all 0.3s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg style={{ width: '20px', height: '20px', marginRight: '8px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              藏一个宝藏
            </div>
          </button>
        </div>
      )}

      {/* 或者继续寻宝 */}
      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center'
        }}>
          <div style={{ width: '100%', borderTop: '1px solid #d1d5db' }}></div>
        </div>
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', fontSize: '14px' }}>
          <span style={{ padding: '0 8px', backgroundColor: 'white', color: '#6b7280' }}>或者</span>
        </div>
      </div>

      {/* 继续寻宝 */}
      <div style={{
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        padding: '16px',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '12px' }}>
          <svg style={{ width: '20px', height: '20px', color: '#4b5563', marginRight: '8px', marginTop: '2px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <div style={{ flex: 1 }}>
            <h5 style={{ fontSize: '14px', fontWeight: 500, color: '#1f2937', marginBottom: '4px' }}>继续寻找其他宝藏</h5>
            <p style={{ fontSize: '12px', color: '#4b5563' }}>
              这个二维码没有宝藏，试试扫描其他地方的二维码
            </p>
          </div>
        </div>

        <button
          onClick={onRescan}
          style={{
            width: '100%',
            padding: '8px 16px',
            border: '2px solid #d1d5db',
            color: '#374151',
            fontWeight: 500,
            borderRadius: '8px',
            backgroundColor: 'white',
            cursor: 'pointer',
            transition: 'background-color 0.3s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg style={{ width: '16px', height: '16px', marginRight: '8px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            换个地方找找
          </div>
        </button>
      </div>

      {/* 提示信息 */}
      <div style={{
        backgroundColor: '#dbeafe',
        border: '1px solid #93c5fd',
        borderRadius: '8px',
        padding: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <svg style={{ width: '20px', height: '20px', color: '#3b82f6', marginRight: '8px', marginTop: '2px', flexShrink: 0 }} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div style={{ flex: 1, fontSize: '12px', color: '#1e40af' }}>
            <p style={{ fontWeight: 500, marginBottom: '4px' }}>寻宝小贴士</p>
            <ul style={{ listStyle: 'disc', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <li>共享单车、广告牌、商品包装都可能有宝藏</li>
              <li>同一个二维码在不同地点可能有不同的宝藏</li>
              <li>试试扫描身边的各种二维码吧！</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoTreasureCard;
