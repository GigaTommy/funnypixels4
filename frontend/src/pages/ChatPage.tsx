// frontend/src/pages/ChatPage.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '../utils/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageCircle, 
  Crown, 
  Megaphone,
  Users,
  Settings
} from 'lucide-react';
import { AuthService } from '../services/auth';
import { AllianceAPI } from '../services/alliance';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import PrivateMessageModule from '../components/chat/PrivateMessageModule';
import AllianceChatModule from '../components/chat/AllianceChatModule';
import AnnouncementModule from '../components/chat/AnnouncementModule';

interface Alliance {
  id: string;
  name: string;
  description?: string;
  flag?: string;
  color?: string;
}

export default function ChatPage() {
  const [activeTab, setActiveTab] = useState<'private' | 'alliance' | 'announcements'>('private');
  const [userAlliance, setUserAlliance] = useState<Alliance | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      
      // 获取当前用户
      let user = null;
      try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          user = JSON.parse(userStr);
        }
        
        if (!user && AuthService.isAuthenticated()) {
          try {
            user = await AuthService.getCurrentUser();
          } catch (error) {
            logger.info('从AuthService获取用户信息失败');
          }
        }
      } catch (error) {
        logger.error('获取用户信息失败:', error);
      }
      
      setCurrentUser(user);

      if (user) {
        try {
          const allianceResponse = await AllianceAPI.getUserAlliance();
          if (allianceResponse.alliance) {
            setUserAlliance(allianceResponse.alliance);
          }
        } catch (error) {
          logger.info('用户未加入联盟');
        }
      }
    } catch (error) {
      logger.error('加载聊天数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">请先登录以使用聊天功能</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 顶部导航 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">聊天中心</h1>
              <p className="text-sm text-gray-500">私信、群聊、公告一站式管理</p>
            </div>
          </div>
          
          {userAlliance && (
            <div className="flex items-center space-x-2 bg-blue-50 rounded-xl px-3 py-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-sm text-blue-700 font-medium">{userAlliance.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* 标签页导航和内容 */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="h-full flex flex-col">
          <div className="px-4 pt-4">
            <TabsList className="grid w-full grid-cols-3 bg-gray-100 p-1 rounded-xl">
              <TabsTrigger
                value="private"
                className="data-[state=active]:bg-white data-[state=active]:shadow-md rounded-lg px-3 py-2 text-sm"
              >
                <MessageCircle className="w-4 h-4 mr-1" />
                私信
              </TabsTrigger>
              <TabsTrigger
                value="alliance"
                className="data-[state=active]:bg-white data-[state=active]:shadow-md rounded-lg px-3 py-2 text-sm"
                disabled={!userAlliance}
              >
                <Crown className="w-4 h-4 mr-1" />
                联盟
              </TabsTrigger>
              <TabsTrigger
                value="announcements"
                className="data-[state=active]:bg-white data-[state=active]:shadow-md rounded-lg px-3 py-2 text-sm"
              >
                <Megaphone className="w-4 h-4 mr-1" />
                公告
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 内容区域 */}
          <div className="flex-1 overflow-hidden">
            <TabsContent value="private" className="h-full mt-0">
              <PrivateMessageModule />
            </TabsContent>

            <TabsContent value="alliance" className="h-full mt-0">
              {userAlliance ? (
                <AllianceChatModule />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <Card className="rounded-2xl shadow-lg p-12 bg-white text-center max-w-md">
                    <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Crown className="w-8 h-8 text-yellow-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">加入联盟</h3>
                    <p className="text-gray-600 mb-6">加入联盟后即可使用群聊、投票、活动等功能</p>
                    <div className="space-y-3">
                      <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white">
                        查找联盟
                      </Button>
                      <Button variant="outline" className="w-full">
                        创建联盟
                      </Button>
                    </div>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="announcements" className="h-full mt-0">
              <AnnouncementModule />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}