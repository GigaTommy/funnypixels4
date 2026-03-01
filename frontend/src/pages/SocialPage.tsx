import React, { useState, useEffect } from 'react';
import { AuthService, AuthUser } from '../services/auth';
import ChatPanel from '../components/chat/ChatPanel';
import ChatSearch from '../components/chat/ChatSearch';
import FollowList from '../components/social/FollowList';
import RecommendedFollows from '../components/social/RecommendedFollows';
import Leaderboard from '../components/leaderboard/Leaderboard';
import LeaderboardHistory from '../components/leaderboard/LeaderboardHistory';

type TabType = 'chat' | 'social' | 'leaderboard';

export default function SocialPage() {
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [chatSubTab, setChatSubTab] = useState<'global' | 'alliance' | 'search'>('global');
  const [socialSubTab, setSocialSubTab] = useState<'following' | 'followers' | 'recommended'>('recommended');
  const [leaderboardSubTab, setLeaderboardSubTab] = useState<'current' | 'history'>('current');

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const loadCurrentUser = async () => {
      const user = await AuthService.getCurrentUser();
      setCurrentUser(user);
    };
    loadCurrentUser();
  }, []);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-sm border">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">请先登录</h2>
          <p className="text-gray-600 mb-6">您需要登录才能使用社交功能</p>
          <button
            onClick={() => window.location.href = '/login'}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            去登录
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'chat' as TabType, label: '聊天', icon: '💬' },
    { id: 'social' as TabType, label: '社交', icon: '👥' },
    { id: 'leaderboard' as TabType, label: '排行榜', icon: '🏆' }
  ];

      return (
      <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">社交中心</h1>
          <p className="text-gray-600 mt-2">与其他玩家交流，查看排行榜，建立社交关系</p>
        </div>

        {/* 主标签页 */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 pb-2 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* 聊天标签页内容 */}
        {activeTab === 'chat' && (
          <div className="space-y-6">
            {/* 聊天子标签 */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <nav className="flex space-x-4">
                <button
                  onClick={() => setChatSubTab('global')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    chatSubTab === 'global'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  全局聊天
                </button>
                <button
                  onClick={() => setChatSubTab('alliance')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    chatSubTab === 'alliance'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  联盟聊天
                </button>
                <button
                  onClick={() => setChatSubTab('search')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    chatSubTab === 'search'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  搜索消息
                </button>
              </nav>
            </div>

            {/* 聊天内容 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {chatSubTab === 'global' && (
                <ChatPanel
                  channelType="global"
                  title="全局聊天"
                />
              )}
              {chatSubTab === 'alliance' && (
                <ChatPanel
                  channelType="alliance"
                  channelId="your-alliance-id"
                  title="联盟聊天"
                />
              )}
              {chatSubTab === 'search' && (
                <div className="lg:col-span-2">
                  <ChatSearch />
                </div>
              )}
            </div>
          </div>
        )}

        {/* 社交标签页内容 */}
        {activeTab === 'social' && (
          <div className="space-y-6">
            {/* 社交子标签 */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <nav className="flex space-x-4">
                <button
                  onClick={() => setSocialSubTab('recommended')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    socialSubTab === 'recommended'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  推荐关注
                </button>
                <button
                  onClick={() => setSocialSubTab('following')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    socialSubTab === 'following'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  我的关注
                </button>
                <button
                  onClick={() => setSocialSubTab('followers')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    socialSubTab === 'followers'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  我的粉丝
                </button>
              </nav>
            </div>

            {/* 社交内容 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {socialSubTab === 'recommended' && (
                <div className="lg:col-span-2">
                  <RecommendedFollows />
                </div>
              )}
              {socialSubTab === 'following' && (
                <div className="lg:col-span-2">
                  <FollowList
                    userId={currentUser.id}
                    type="following"
                    title="我的关注"
                  />
                </div>
              )}
              {socialSubTab === 'followers' && (
                <div className="lg:col-span-2">
                  <FollowList
                    userId={currentUser.id}
                    type="followers"
                    title="我的粉丝"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* 排行榜标签页内容 */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-6">
            {/* 排行榜子标签 */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <nav className="flex space-x-4">
                <button
                  onClick={() => setLeaderboardSubTab('current')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    leaderboardSubTab === 'current'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  当前排行榜
                </button>
                <button
                  onClick={() => setLeaderboardSubTab('history')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    leaderboardSubTab === 'history'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  历史排行榜
                </button>
              </nav>
            </div>

            {/* 排行榜内容 */}
            {leaderboardSubTab === 'current' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Leaderboard type="user" title="用户排行榜" />
                <Leaderboard type="alliance" title="联盟排行榜" />
              </div>
            )}

            {leaderboardSubTab === 'history' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <LeaderboardHistory type="user" title="用户排行榜" />
                <LeaderboardHistory type="alliance" title="联盟排行榜" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
