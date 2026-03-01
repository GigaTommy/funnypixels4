import React from 'react';

interface TreasureNearbyCardProps {
  distance: number;
  direction: string;
  hint?: string;
  onRefresh: () => void;
}

const TreasureNearbyCard: React.FC<TreasureNearbyCardProps> = ({
  distance,
  direction,
  hint,
  onRefresh
}) => {
  const getArrowRotation = (dir: string) => {
    const rotations: { [key: string]: number } = {
      '北': 0,
      '东北': 45,
      '东': 90,
      '东南': 135,
      '南': 180,
      '西南': 225,
      '西': 270,
      '西北': 315
    };
    return rotations[dir] || 0;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 雷达动画区域 */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
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
            width: '192px',
            height: '192px',
            backgroundColor: '#60a5fa',
            borderRadius: '50%',
            opacity: 0.2,
            animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite'
          }}></div>
        </div>
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
            backgroundColor: '#3b82f6',
            borderRadius: '50%',
            opacity: 0.3,
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
          }}></div>
        </div>

        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center' }}>
          <svg style={{ width: '48px', height: '48px', margin: '0 auto 8px', color: '#3b82f6' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#2563eb', marginBottom: '4px' }}>宝藏就在附近！</h3>
          <p style={{ fontSize: '14px', color: '#4b5563' }}>继续前进就能找到</p>
        </div>
      </div>

      {/* 距离和方向卡片 */}
      <div style={{
        background: 'linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%)',
        borderRadius: '8px',
        padding: '24px',
        border: '2px solid #93c5fd',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        {/* 距离显示 */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <p style={{ fontSize: '14px', color: '#4b5563', marginBottom: '8px' }}>距离宝藏</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span style={{ fontSize: '48px', fontWeight: 700, color: '#2563eb' }}>{distance}</span>
            <span style={{ fontSize: '24px', color: '#6b7280' }}>米</span>
          </div>
        </div>

        {/* 方向指示器 */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px'
        }}>
          <p style={{ fontSize: '14px', color: '#4b5563', textAlign: 'center', marginBottom: '12px' }}>前往方向</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* 方向箭头 */}
            <div style={{ position: 'relative', width: '96px', height: '96px' }}>
              {/* 罗盘背景 */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                border: '4px solid #93c5fd',
                borderRadius: '50%'
              }}></div>
              <div style={{
                position: 'absolute',
                top: '8px',
                left: '8px',
                right: '8px',
                bottom: '8px',
                border: '2px solid #bfdbfe',
                borderRadius: '50%'
              }}></div>

              {/* 方向标记 */}
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
                <div style={{ fontSize: '12px', color: '#6b7280', position: 'absolute', top: '4px' }}>北</div>
                <div style={{ fontSize: '12px', color: '#6b7280', position: 'absolute', right: '4px' }}>东</div>
                <div style={{ fontSize: '12px', color: '#6b7280', position: 'absolute', bottom: '4px' }}>南</div>
                <div style={{ fontSize: '12px', color: '#6b7280', position: 'absolute', left: '4px' }}>西</div>
              </div>

              {/* 旋转的箭头 */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: `rotate(${getArrowRotation(direction)}deg)`,
                  transition: 'transform 0.3s ease'
                }}
              >
                <svg style={{ width: '48px', height: '48px', color: '#2563eb' }} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L4 20h8l8-18z" />
                </svg>
              </div>
            </div>

            {/* 方向文字 */}
            <div style={{ marginLeft: '24px' }}>
              <p style={{ fontSize: '32px', fontWeight: 700, color: '#2563eb' }}>{direction}</p>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>方向</p>
            </div>
          </div>
        </div>

        {/* 提示信息 */}
        {hint && (
          <div style={{
            backgroundColor: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: '8px',
            padding: '12px',
            display: 'flex',
            alignItems: 'flex-start'
          }}>
            <svg style={{ width: '20px', height: '20px', color: '#d97706', marginRight: '8px', marginTop: '2px', flexShrink: 0 }} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '14px', fontWeight: 500, color: '#92400e' }}>提示</p>
              <p style={{ fontSize: '14px', color: '#b45309', marginTop: '4px' }}>{hint}</p>
            </div>
          </div>
        )}
      </div>

      {/* 操作指引 */}
      <div style={{
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        padding: '16px',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <svg style={{ width: '20px', height: '20px', color: '#3b82f6', marginRight: '8px', marginTop: '2px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div style={{ flex: 1, fontSize: '14px', color: '#374151' }}>
            <p style={{ fontWeight: 500, marginBottom: '4px' }}>寻宝指引</p>
            <ul style={{ listStyle: 'disc', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px', color: '#4b5563' }}>
              <li>朝{direction}方向前进约{distance}米</li>
              <li>到达位置后重新扫描二维码</li>
              <li>扫描成功即可领取宝藏</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 刷新按钮 */}
      <button
        onClick={onRefresh}
        style={{
          width: '100%',
          padding: '12px',
          background: 'linear-gradient(to right, #3b82f6, #6366f1)',
          color: 'white',
          fontSize: '18px',
          fontWeight: 600,
          borderRadius: '8px',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 6px rgba(59, 130, 246, 0.3)',
          transition: 'all 0.3s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg style={{ width: '20px', height: '20px', marginRight: '8px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          刷新位置
        </div>
      </button>

      {/* 提示文字 */}
      <p style={{ fontSize: '12px', textAlign: 'center', color: '#6b7280' }}>
        到达指定位置后，点击"刷新位置"重新扫描
      </p>
    </div>
  );
};

export default TreasureNearbyCard;
