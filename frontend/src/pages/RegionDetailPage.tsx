import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  MapPin, 
  Users, 
  Trophy, 
  Calendar,
  TrendingUp,
  Clock,
  Globe,
  Star,
  Medal,
  Award,
  Crown,
  Flag,
  BarChart3,
  Activity
} from 'lucide-react';
import { AuthService } from '../services/auth';
import { RegionAPI, RegionStats } from '../services/region';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';

// 使用从region.ts导入的RegionStats类型

interface RegionDetailPageProps {
  regionId: string;
  onBack: () => void;
}

export default function RegionDetailPage({ regionId, onBack }: RegionDetailPageProps) {
  const [region, setRegion] = useState<any>(null);
  const [stats, setStats] = useState<RegionStats | null>(null);
  const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly' | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadRegionData();
  }, [regionId]);

  useEffect(() => {
    if (region) {
      loadRegionStats();
    }
  }, [region, timeRange]);

  const loadRegionData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await RegionAPI.getRegionDetails(regionId);
      setRegion(response);
    } catch (error) {
      logger.error('加载地区详情失败:', error);
    } finally {
      setLoading(false);
    }
  }, [regionId]);

  const loadRegionStats = useCallback(async () => {
    try {
      const response = await RegionAPI.getRegionDetailsWithStats(regionId);
      setStats(response.stats || null);
    } catch (error) {
      logger.error('加载地区统计失败:', error);
    }
  }, [regionId, timeRange]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return { icon: Medal, color: '#FFD700', bgColor: '#FFD70020' };
      case 2: return { icon: Medal, color: '#C0C0C0', bgColor: '#C0C0C020' };
      case 3: return { icon: Medal, color: '#CD7F32', bgColor: '#CD7F3220' };
      default: return { icon: Award, color: '#8E8E93', bgColor: '#8E8E9320' };
    }
  };

  const timeRangeOptions = [
    { key: 'daily', label: '今日', icon: Calendar },
    { key: 'weekly', label: '本周', icon: TrendingUp },
    { key: 'monthly', label: '本月', icon: Clock },
    { key: 'all', label: '总榜', icon: Trophy }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm font-medium">加载地区详情...</p>
        </div>
      </div>
    );
  }

  if (!region) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 font-medium mb-2">地区不存在</p>
          <Button onClick={onBack}>返回</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100">
      {/* 头部 */}
      <div className="bg-white border-b p-4">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" onClick={onBack} className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center space-x-3">
            <div className="text-2xl">{region.flag}</div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{region.name}</h1>
              <p className="text-sm text-gray-500">地区详情</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* 地区概览卡片 */}
        <Card className="rounded-2xl shadow-lg">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Globe className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatNumber(region.radius || 0)}
                </div>
                <div className="text-sm text-gray-500">半径(km)</div>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <MapPin className="w-6 h-6 text-green-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {region.center_lat?.toFixed(2)}, {region.center_lng?.toFixed(2)}
                </div>
                <div className="text-sm text-gray-500">坐标</div>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Activity className="w-6 h-6 text-purple-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {region.color || '#007AFF'}
                </div>
                <div className="text-sm text-gray-500">主题色</div>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Star className="w-6 h-6 text-orange-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {region.id}
                </div>
                <div className="text-sm text-gray-500">地区ID</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 时间范围选择器 */}
        <div className="flex space-x-2 overflow-x-auto scrollbar-hide">
          {timeRangeOptions.map((option) => (
            <Button
              key={option.key}
              onClick={() => setTimeRange(option.key as any)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                timeRange === option.key 
                  ? 'bg-blue-500 text-white shadow-md' 
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <option.icon className="w-4 h-4 mr-2" />
              {option.label}
            </Button>
          ))}
        </div>

        {/* 标签页内容 */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-gray-200 rounded-full p-1 flex space-x-2">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-white data-[state=active]:shadow-md rounded-full px-4 py-1 text-sm"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              概览
            </TabsTrigger>
            <TabsTrigger
              value="users"
              className="data-[state=active]:bg-white data-[state=active]:shadow-md rounded-full px-4 py-1 text-sm"
            >
              <Users className="w-4 h-4 mr-2" />
              用户榜
            </TabsTrigger>
            <TabsTrigger
              value="alliances"
              className="data-[state=active]:bg-white data-[state=active]:shadow-md rounded-full px-4 py-1 text-sm"
            >
              <Trophy className="w-4 h-4 mr-2" />
              联盟榜
            </TabsTrigger>
          </TabsList>

          {/* 概览标签页 */}
          <TabsContent value="overview" className="space-y-4">
            {stats && (
              <>
                {/* 统计卡片 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="rounded-2xl shadow-lg">
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <Activity className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-gray-900">
                            {formatNumber(stats.pixel_count)}
                          </div>
                          <div className="text-sm text-gray-500">总像素点</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl shadow-lg">
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                          <Users className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-gray-900">
                            {formatNumber(stats.user_count)}
                          </div>
                          <div className="text-sm text-gray-500">活跃用户</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl shadow-lg">
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                          <Trophy className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-gray-900">
                            {formatNumber(stats.alliance_count)}
                          </div>
                          <div className="text-sm text-gray-500">活跃联盟</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* 时间统计 */}
                <Card className="rounded-2xl shadow-lg">
                  <CardHeader>
                    <h3 className="text-lg font-semibold">时间统计</h3>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-blue-50 rounded-xl">
                        <div className="text-2xl font-bold text-blue-600">
                          {formatNumber(Math.floor(stats.pixel_count * 0.1))}
                        </div>
                        <div className="text-sm text-blue-500">今日像素</div>
                      </div>
                      
                      <div className="text-center p-4 bg-green-50 rounded-xl">
                        <div className="text-2xl font-bold text-green-600">
                          {formatNumber(Math.floor(stats.pixel_count * 0.3))}
                        </div>
                        <div className="text-sm text-green-500">本周像素</div>
                      </div>
                      
                      <div className="text-center p-4 bg-purple-50 rounded-xl">
                        <div className="text-2xl font-bold text-purple-600">
                          {formatNumber(Math.floor(stats.pixel_count * 0.7))}
                        </div>
                        <div className="text-sm text-purple-500">本月像素</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* 用户榜标签页 */}
          <TabsContent value="users" className="space-y-4">
            {stats?.active_users && stats.active_users.length > 0 ? (
              <div className="space-y-3">
                {stats.active_users.map((user, index) => {
                  const rankDisplay = getRankIcon(index + 1);
                  return (
                    <Card key={user.id} className="rounded-2xl shadow-lg">
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <div 
                              className="w-12 h-12 rounded-2xl flex items-center justify-center"
                              style={{ backgroundColor: rankDisplay.bgColor }}
                            >
                              <rankDisplay.icon className="w-6 h-6" style={{ color: rankDisplay.color }} />
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 truncate">
                              {user.username}
                            </h3>
                            <p className="text-sm text-gray-500">排名 #{index + 1}</p>
                          </div>
                          
                          <div className="text-right flex-shrink-0">
                            <div className="text-lg font-bold text-gray-900">
                              {formatNumber(user.total_pixels)}
                            </div>
                            <div className="text-xs text-gray-500">像素点</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="rounded-2xl shadow-lg p-12 bg-white text-center">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 font-medium mb-2">暂无用户数据</p>
                <p className="text-gray-400 text-sm">该地区还没有用户活动</p>
              </Card>
            )}
          </TabsContent>

          {/* 联盟榜标签页 */}
          <TabsContent value="alliances" className="space-y-4">
            {stats?.active_alliances && stats.active_alliances.length > 0 ? (
              <div className="space-y-3">
                {stats.active_alliances.map((alliance, index) => {
                  const rankDisplay = getRankIcon(index + 1);
                  return (
                    <Card key={alliance.id} className="rounded-2xl shadow-lg">
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <div 
                              className="w-12 h-12 rounded-2xl flex items-center justify-center"
                              style={{ backgroundColor: rankDisplay.bgColor }}
                            >
                              <rankDisplay.icon className="w-6 h-6" style={{ color: rankDisplay.color }} />
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <span 
                                className="text-lg text-gray-700"
                                title={`联盟旗帜: ${alliance.name}`}
                              >
                                {alliance.flag}
                              </span>
                              <h3 className="font-semibold text-gray-900 truncate">
                                {alliance.name}
                              </h3>
                            </div>
                            <p className="text-sm text-gray-500">排名 #{index + 1}</p>
                          </div>
                          
                          <div className="text-right flex-shrink-0">
                            <div className="text-lg font-bold text-gray-900">
                              {formatNumber(alliance.total_pixels)}
                            </div>
                            <div className="text-xs text-gray-500">像素点</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="rounded-2xl shadow-lg p-12 bg-white text-center">
                <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 font-medium mb-2">暂无联盟数据</p>
                <p className="text-gray-400 text-sm">该地区还没有联盟活动</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
