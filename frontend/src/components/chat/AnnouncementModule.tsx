import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { replaceAlert } from '../../utils/toastHelper';
import { dialogService } from '../../services/dialogService';
import {
  Megaphone,
  Search,
  Plus,
  Edit,
  Trash2,
  Pin,
  Star,
  Calendar,
  User,
  Globe,
  Crown,
  AlertTriangle,
  Info,
  CheckCircle,
  Clock,
  Filter
} from 'lucide-react';
import { AuthService } from '../../services/auth';
import { AnnouncementAPI } from '../../services/announcement';
import { AllianceAPI } from '../../services/alliance';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { logger } from '../../utils/logger';

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'global' | 'alliance' | 'system' | 'event' | 'maintenance';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'draft' | 'published' | 'archived';
  created_by: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
  expires_at?: string;
  is_pinned: boolean;
  is_starred: boolean;
  read_count: number;
  target_alliance_id?: string;
  tags: string[];
  attachments?: string[];
}

interface AnnouncementForm {
  title: string;
  content: string;
  type: 'global' | 'alliance' | 'system' | 'event' | 'maintenance';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  expires_at?: string;
  tags: string[];
  target_alliance_id?: string;
}

export default function AnnouncementModule() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [filteredAnnouncements, setFilteredAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [formData, setFormData] = useState<AnnouncementForm>({
    title: '',
    content: '',
    type: 'global',
    priority: 'normal',
    tags: []
  });
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('user');
  const [userAlliance, setUserAlliance] = useState<any>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    filterAnnouncements();
  }, [announcements, searchQuery, priorityFilter]);

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
            logger.debug('从AuthService获取用户信息失败');
          }
        }
      } catch (error) {
        logger.error('获取用户信息失败:', error);
      }
      
      setCurrentUser(user);
      setUserRole(user?.role || 'user');

      if (user) {
        // 获取用户联盟信息
        try {
          // 使用AllianceAPI获取用户联盟信息
          const allianceResponse = await AllianceAPI.getUserAlliance();
          if (allianceResponse.alliance) {
            setUserAlliance(allianceResponse.alliance);
          }
        } catch (error) {
          logger.debug('用户未加入联盟');
        }

        // 加载公告
        await loadAnnouncements();
      }
    } catch (error) {
      logger.error('加载公告数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnnouncements = useCallback(async () => {
    try {
      logger.debug('正在加载公告数据...');

      // 调用真实的公告API
      const response = await AnnouncementAPI.getAllAnnouncements();

      if (response.success && response.data) {
        logger.debug('成功获取', response.data.length, '条公告');

        // 将数字优先级转换为字符串优先级的辅助函数
        const getPriorityString = (priority: number): 'urgent' | 'high' | 'normal' | 'low' => {
          switch (priority) {
            case 4: return 'urgent';
            case 3: return 'high';
            case 2: return 'normal';
            case 1: return 'low';
            default: return 'normal';
          }
        };

        // 转换API响应数据格式以匹配组件期望的格式
        const transformedAnnouncements: Announcement[] = response.data.map((item: any) => ({
          id: item.id,
          title: item.title,
          content: item.content,
          type: item.type,
          priority: getPriorityString(item.priority || 2),
          status: item.is_active ? 'published' : 'draft',
          created_by: item.author_name || 'system',
          created_at: item.created_at,
          updated_at: item.updated_at,
          published_at: item.publish_at,
          expires_at: item.expire_at,
          is_pinned: item.is_pinned || false,
          is_starred: false, // 这个需要从用户偏好中获取
          read_count: 0, // 暂时设为0，后续可以添加阅读统计
          tags: [], // 暂时为空，后续可以解析metadata
          attachments: [],
          target_alliance_id: item.alliance_id
        }));

        setAnnouncements(transformedAnnouncements);
        logger.debug('设置公告数据:', transformedAnnouncements);
      } else {
        logger.debug('没有获取到公告数据');
        setAnnouncements([]);
      }
    } catch (error) {
      logger.error('加载公告失败:', error);
      setAnnouncements([]);
    }
  }, []);

  const filterAnnouncements = useCallback(() => {
    logger.debug('过滤公告开始:', { totalAnnouncements: announcements.length });
    let filtered = announcements;

    // 按搜索关键词过滤
    if (searchQuery) {
      filtered = filtered.filter(announcement =>
        announcement.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        announcement.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        announcement.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // 按优先级过滤
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(announcement => announcement.priority === priorityFilter);
    }

    // 排序：置顶 > 优先级 > 发布时间
    filtered.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;

      const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    logger.debug('最终过滤结果:', filtered);
    setFilteredAnnouncements(filtered);
  }, [announcements, searchQuery, priorityFilter]);

  const handleCreateAnnouncement = useCallback(async () => {
    try {
      // 这里应该调用创建公告API
      const newAnnouncement: Announcement = {
        id: Date.now().toString(),
        ...formData,
        status: 'published',
        created_by: currentUser?.id || 'current',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
        is_pinned: false,
        is_starred: false,
        read_count: 0,
        attachments: []
      };

      setAnnouncements(prev => [newAnnouncement, ...prev]);
      setShowCreateForm(false);
      setFormData({
        title: '',
        content: '',
        type: 'global',
        priority: 'normal',
        tags: []
      });
    } catch (error) {
      logger.error('创建公告失败:', error);
      replaceAlert.error('创建失败，请重试');
    }
  }, [formData, currentUser]);

  const handleEditAnnouncement = useCallback(async () => {
    if (!editingAnnouncement) return;

    try {
      // 这里应该调用编辑公告API
      setAnnouncements(prev => 
        prev.map(announcement => 
          announcement.id === editingAnnouncement.id 
            ? { ...announcement, ...formData, updated_at: new Date().toISOString() }
            : announcement
        )
      );
      setEditingAnnouncement(null);
      setFormData({
        title: '',
        content: '',
        type: 'global',
        priority: 'normal',
        tags: []
      });
    } catch (error) {
      logger.error('编辑公告失败:', error);
      replaceAlert.error('编辑失败，请重试');
    }
  }, [editingAnnouncement, formData]);

  const handleDeleteAnnouncement = useCallback(async (announcementId: string) => {
    const confirmed = await dialogService.confirm('确定要删除这条公告吗？', { title: '确认操作', type: 'warning' }); if (!confirmed) { return; }try {
      // 这里应该调用删除公告API
      setAnnouncements(prev => prev.filter(announcement => announcement.id !== announcementId));
    } catch (error) {
      logger.error('删除公告失败:', error);
      replaceAlert.error('删除失败，请重试');
    }
  }, []);

  const togglePin = useCallback(async (announcementId: string) => {
    try {
      // 这里应该调用置顶API
      setAnnouncements(prev => 
        prev.map(announcement => 
          announcement.id === announcementId 
            ? { ...announcement, is_pinned: !announcement.is_pinned }
            : announcement
        )
      );
    } catch (error) {
      logger.error('操作失败:', error);
    }
  }, []);

  const toggleStar = useCallback(async (announcementId: string) => {
    try {
      // 这里应该调用收藏API
      setAnnouncements(prev => 
        prev.map(announcement => 
          announcement.id === announcementId 
            ? { ...announcement, is_starred: !announcement.is_starred }
            : announcement
        )
      );
    } catch (error) {
      logger.error('操作失败:', error);
    }
  }, []);



  const getPriorityColor = useCallback((priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'normal': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'low': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  }, []);

  const getTypeIcon = useCallback((type: string) => {
    switch (type) {
      case 'global': return <Globe className="w-4 h-4" />;
      case 'alliance': return <Crown className="w-4 h-4" />;
      case 'system': return <AlertTriangle className="w-4 h-4" />;
      case 'event': return <Calendar className="w-4 h-4" />;
      case 'maintenance': return <Info className="w-4 h-4" />;
      default: return <Megaphone className="w-4 h-4" />;
    }
  }, []);

  const getTypeColor = useCallback((type: string) => {
    switch (type) {
      case 'global': return 'bg-blue-100 text-blue-700';
      case 'alliance': return 'bg-purple-100 text-purple-700';
      case 'system': return 'bg-red-100 text-red-700';
      case 'event': return 'bg-green-100 text-green-700';
      case 'maintenance': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  }, []);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Megaphone className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">请先登录以查看公告</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 顶部操作栏 */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">公告中心</h2>
          {(userRole === 'admin' || userRole === 'leader') && (
            <Button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              发布公告
            </Button>
          )}
        </div>

        {/* 搜索和过滤 */}
        <div className="flex items-center space-x-3">
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索公告..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
            />
          </div>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">所有优先级</option>
            <option value="urgent">紧急</option>
            <option value="high">高</option>
            <option value="normal">普通</option>
            <option value="low">低</option>
          </select>
        </div>
      </div>


      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-gray-500 text-sm">加载中...</p>
              </div>
            </div>
          ) : (logger.debug('渲染条件检查:', { loading, filteredLength: filteredAnnouncements.length, filteredAnnouncements }), filteredAnnouncements.length === 0) ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Megaphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">暂无公告</p>
                <p className="text-gray-400 text-sm">当前没有符合条件的公告</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
{/* 开始渲染公告列表，数量: ${filteredAnnouncements.length} */}
              {filteredAnnouncements.map((announcement) => (
                <Card key={announcement.id} className={`transition-all duration-200 hover:shadow-md ${
                  announcement.is_pinned ? 'border-l-4 border-l-yellow-500 bg-yellow-50' : ''
                }`}>
                  <CardContent className="p-4">
                    {/* 公告头部 */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className={`p-2 rounded-lg ${getTypeColor(announcement.type)}`}>
                          {getTypeIcon(announcement.type)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{announcement.title}</h3>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(announcement.priority)}`}>
                              {announcement.priority === 'urgent' ? '紧急' :
                               announcement.priority === 'high' ? '高' :
                               announcement.priority === 'normal' ? '普通' : '低'}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(announcement.type)}`}>
                              {announcement.type === 'global' ? '全局' :
                               announcement.type === 'alliance' ? '联盟' :
                               announcement.type === 'system' ? '系统' :
                               announcement.type === 'event' ? '活动' : '维护'}
                            </span>
                            {announcement.is_pinned && (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full flex items-center">
                                <Pin className="w-3 h-3 mr-1" />
                                置顶
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => toggleStar(announcement.id)}
                          className={`p-2 rounded-lg transition-colors ${
                            announcement.is_starred
                              ? 'text-yellow-500 bg-yellow-50'
                              : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'
                          }`}
                        >
                          <Star className={`w-4 h-4 ${announcement.is_starred ? 'fill-current' : ''}`} />
                        </button>
                        {(userRole === 'admin' || userRole === 'leader') && (
                          <>
                            <button
                              onClick={() => togglePin(announcement.id)}
                              className={`p-2 rounded-lg transition-colors ${
                                announcement.is_pinned
                                  ? 'text-yellow-500 bg-yellow-50'
                                  : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'
                              }`}
                            >
                              <Pin className={`w-4 h-4 ${announcement.is_pinned ? 'fill-current' : ''}`} />
                            </button>
                            <button
                              onClick={() => {
                                setEditingAnnouncement(announcement);
                                setFormData({
                                  title: announcement.title,
                                  content: announcement.content,
                                  type: announcement.type,
                                  priority: announcement.priority,
                                  tags: announcement.tags,
                                  target_alliance_id: announcement.target_alliance_id || undefined
                                });
                              }}
                              className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteAnnouncement(announcement.id)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 公告内容 */}
                    <div className="mb-3">
                      <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                        {announcement.content}
                      </p>
                    </div>

                    {/* 标签 */}
                    {announcement.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {announcement.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 公告底部信息 */}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center space-x-4">
                        <span>发布者: {announcement.created_by}</span>
                        <span>发布时间: {new Date(announcement.created_at).toLocaleString('zh-CN')}</span>
                        {announcement.expires_at && (
                          <span>过期时间: {new Date(announcement.expires_at).toLocaleString('zh-CN')}</span>
                        )}
                        <span>阅读: {announcement.read_count}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {announcement.status === 'draft' && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                            草稿
                          </span>
                        )}
                        {announcement.status === 'archived' && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                            已归档
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 创建/编辑公告弹窗 */}
      <AnimatePresence>
        {(showCreateForm || editingAnnouncement) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {editingAnnouncement ? '编辑公告' : '发布公告'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">标题</label>
                                     <input
                     type="text"
                     value={formData.title}
                     onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                     placeholder="输入公告标题"
                     className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                   />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">内容</label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="输入公告内容"
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">类型</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="global">全局</option>
                      <option value="alliance">联盟</option>
                      <option value="system">系统</option>
                      <option value="event">活动</option>
                      <option value="maintenance">维护</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">优先级</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="low">低</option>
                      <option value="normal">普通</option>
                      <option value="high">高</option>
                      <option value="urgent">紧急</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">标签（用逗号分隔）</label>
                                     <input
                     type="text"
                     value={formData.tags.join(', ')}
                     onChange={(e) => setFormData(prev => ({ 
                       ...prev, 
                       tags: e.target.value.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag)
                     }))}
                     placeholder="输入标签，用逗号分隔"
                     className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                   />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">过期时间（可选）</label>
                  <input
                    type="datetime-local"
                    value={formData.expires_at || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, expires_at: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 mt-6">
                <Button
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingAnnouncement(null);
                    setFormData({
                      title: '',
                      content: '',
                      type: 'global',
                      priority: 'normal',
                      tags: []
                    });
                  }}
                  variant="outline"
                >
                  取消
                </Button>
                <Button
                  onClick={editingAnnouncement ? handleEditAnnouncement : handleCreateAnnouncement}
                  disabled={!formData.title.trim() || !formData.content.trim()}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  {editingAnnouncement ? '保存修改' : '发布公告'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}