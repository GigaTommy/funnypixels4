import React, { useState, useEffect } from 'react';
import { logger } from '../utils/logger';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { Button } from '../components/ui/Button';
import {
  AchievementAPI,
  type UserAchievementStats,
  type Achievement
} from '../services/achievement';
import { toast } from '../services/toast';

const AchievementPage: React.FC = () => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [stats, setStats] = useState<UserAchievementStats | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAchievements();
  }, []);

  const loadAchievements = async () => {
    try {
      setLoading(true);
      const [achievementsData, overviewData] = await Promise.all([
        AchievementAPI.getAllAchievements(),
        AchievementAPI.getMyAchievementOverview()
      ]);

      setAchievements(achievementsData);
      setStats(overviewData.stats);
    } catch (error) {
      logger.error('加载成就数据失败:', error);
      toast.showUserFriendlyMessage('error', '加载成就数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClaimReward = async (achievementId: string) => {
    // TODO: Implement claimReward functionality when API is available
    logger.info('Claim reward for achievement:', achievementId);
    toast.showUserFriendlyMessage('info', '奖励领取功能暂未实现');
  };

  const getCategoryDisplayName = (category: string) => {
    const categoryMap: Record<string, string> = {
      pixel: '🎨 像素绘制',
      social: '👥 社交互动',
      alliance: '🏰 联盟活动',
      shop: '🛍️ 商店购买',
      special: '⭐ 特殊成就'
    };
    return categoryMap[category] || category;
  };

  const getTypeDisplayName = (type: string) => {
    const typeMap: Record<string, string> = {
      milestone: '里程碑',
      repeatable: '可重复',
      special: '特殊'
    };
    return typeMap[type] || type;
  };

  const getRepeatCycleDisplayName = (cycle: string) => {
    const map: Record<string, string> = {
      permanent: '长期',
      daily: '每日',
      weekly: '每周',
      monthly: '每月',
      seasonal: '赛季'
    };
    return map[cycle] || cycle;
  };

  const getStatusDisplay = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      locked: { label: '未解锁', variant: 'outline' },
      in_progress: { label: '进行中', variant: 'secondary' },
      completed: { label: '可领取', variant: 'default' },
      claimed: { label: '已领取', variant: 'secondary' }
    };

    return statusMap[status] || statusMap.locked;
  };

  const getRarityDisplay = (rarity?: string) => {
    const rarityNameMap: Record<string, string> = {
      common: '普通',
      rare: '稀有',
      epic: '史诗',
      legendary: '传说'
    };

    const rarityStyleMap: Record<string, string> = {
      common: 'bg-slate-100 text-slate-700 border-slate-200',
      rare: 'bg-blue-100 text-blue-800 border-blue-200',
      epic: 'bg-purple-100 text-purple-800 border-purple-200',
      legendary: 'bg-amber-100 text-amber-800 border-amber-200'
    };

    const key = rarity ? rarity.toLowerCase() : 'common';
    return {
      label: rarityNameMap[key] || key,
      className: rarityStyleMap[key] || rarityStyleMap.common
    };
  };

  const filterAchievements = (achievements: Achievement[]) => {
    switch (activeTab) {
      case 'likes':
      case 'social':
      case 'pixels':
      case 'activity':
      case 'special':
        return achievements.filter(achievement => achievement.category === activeTab);
      default:
        return achievements;
    }
  };

  const handleHighlightAction = (achievementId: string) => {
    // TODO: Implement highlight action when needed
    logger.info('Handle highlight action for:', achievementId);
  };

  const filteredAchievements = filterAchievements(achievements);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载成就数据中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold mb-6">🏆 成就系统</h1>

          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                <div className="text-2xl font-bold">{achievements.length}</div>
                <div className="text-sm opacity-90">总成就数</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                <div className="text-2xl font-bold">{stats.like_received_count}</div>
                <div className="text-sm opacity-90">获得点赞</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                <div className="text-2xl font-bold">{stats.like_given_count}</div>
                <div className="text-sm opacity-90">给出点赞</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                <div className="text-2xl font-bold">{stats.achievements_unlocked.length}</div>
                <div className="text-sm opacity-90">已解锁</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* TODO: Implement highlights section when API is ready */}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 mb-8">
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="completed">已完成</TabsTrigger>
            <TabsTrigger value="unclaimed">待领取</TabsTrigger>
            <TabsTrigger value="pixel">像素</TabsTrigger>
            <TabsTrigger value="social">社交</TabsTrigger>
            <TabsTrigger value="alliance">联盟</TabsTrigger>
            <TabsTrigger value="shop">商店</TabsTrigger>
            <TabsTrigger value="special">特殊</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAchievements.map((achievement) => {
                const rarityInfo = getRarityDisplay(achievement.rarity);
                const isUnlocked = stats?.achievements_unlocked.includes(achievement.key) || false;

                return (
                  <Card key={achievement.id} className={`p-6 transition-all duration-200 hover:shadow-lg ${
                    isUnlocked ? 'ring-2 ring-green-200 bg-green-50' : 'hover:shadow-md'
                  }`}>
                    <div className="flex items-start space-x-4">
                      <div className={`flex-shrink-0 w-16 h-16 rounded-lg flex items-center justify-center text-2xl ${
                        isUnlocked ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        <span>{getCategoryDisplayName(achievement.category).split(' ')[0]}</span>
                      </div>

                      <div className="flex-1 space-y-3 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge>{getCategoryDisplayName(achievement.category)}</Badge>
                          <Badge className={rarityInfo.className}>{rarityInfo.label}</Badge>
                          {isUnlocked && <Badge variant="default">已解锁</Badge>}
                        </div>
                        <div>
                          <h3 className={`font-semibold text-lg ${
                            isUnlocked ? 'text-green-800' : 'text-gray-900'
                          }`}>{achievement.name}</h3>
                          <p className="text-gray-600 text-sm">{achievement.description}</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AchievementPage;
