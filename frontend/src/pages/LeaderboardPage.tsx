import React, { useState } from 'react';
import { User, Flag, MapPin } from 'lucide-react';
import GeographicLeaderboard from '../components/leaderboard/GeographicLeaderboard';

type TabType = 'personal' | 'alliance' | 'city';

const LeaderboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('personal');

  // 标签页配置 - 使用SVG图标
  const tabs = [
    { key: 'personal', label: '个人榜', icon: User },
    { key: 'alliance', label: '联盟榜', icon: Flag },
    { key: 'city', label: '城市榜', icon: MapPin }
  ];

  return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f3f4f6'
      }}>
      {/* 头部 */}
      <div style={{
        backgroundColor: 'white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '64px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '32px'
          }}>
            <h1 style={{
              fontSize: '24px',
              fontWeight: 700,
              color: '#111827',
              margin: '0'
            }}>
              排行榜
            </h1>
          </div>

          <div style={{
            fontSize: '14px',
            color: '#9ca3af'
          }}>
            更新时间: {new Date().toLocaleString('zh-CN')}
          </div>
        </div>
      </div>

      {/* 标签页 - 药丸按钮风格 */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '16px 0'
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 16px',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as TabType)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                backgroundColor: activeTab === key ? '#4f46e5' : 'white',
                color: activeTab === key ? 'white' : '#6b7280',
                boxShadow: activeTab === key ? '0 2px 8px rgba(79,70,229,0.2)' : 'none',
                borderColor: activeTab === key ? '#4f46e5' : '#d1d5db',
                borderWidth: activeTab === key ? '0' : '1px'
              }}
              onMouseEnter={(e) => {
                const target = e.currentTarget as HTMLButtonElement;
                if (activeTab !== key) {
                  target.style.backgroundColor = '#f3f4f6';
                  target.style.color = '#374151';
                }
              }}
              onMouseLeave={(e) => {
                const target = e.currentTarget as HTMLButtonElement;
                if (activeTab !== key) {
                  target.style.backgroundColor = 'white';
                  target.style.color = '#6b7280';
                }
              }}
            >
              <Icon size={18} style={{
                flexShrink: 0
              }} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 排行榜内容 */}
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '32px 16px'
      }}>
        {/* 所有排行榜都使用 GeographicLeaderboard 组件 */}
        <GeographicLeaderboard
          type={activeTab as 'personal' | 'alliance' | 'city'}
          title={
            activeTab === 'personal' ? '个人排行榜' :
            activeTab === 'alliance' ? '联盟排行榜' :
            '城市排行榜'
          }
        />
      </div>
    </div>
  );
};

export default LeaderboardPage;
