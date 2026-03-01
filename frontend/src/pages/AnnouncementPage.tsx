import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { config } from '../config/env';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Calendar,
  Users,
  Globe,
  Shield,
  ArrowLeft,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  Clock,
  Filter
} from 'lucide-react';
import { AuthService } from '../services/auth';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { dialogService } from '../services/dialogService';
import { useToast } from '../components/ui/Toast';

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'global' | 'system' | 'alliance';
  status: 'draft' | 'published' | 'archived';
  created_by: string;
  created_at: string;
  updated_at: string;
  alliance_id?: string;
  priority: 'low' | 'medium' | 'high';
  expires_at?: string;
  is_pinned: boolean;
}

interface AnnouncementPageProps {
  onBack: () => void;
}

export default function AnnouncementPage({ onBack }: AnnouncementPageProps) {
  const toast = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'global' | 'system' | 'alliance'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'published' | 'archived'>('all');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userAlliance, setUserAlliance] = useState<any>(null);

  // 表单状态
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'global' as 'global' | 'system' | 'alliance',
    priority: 'medium' as 'low' | 'medium' | 'high',
    expires_at: '',
    is_pinned: false
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [filterType, filterStatus]);

  const loadInitialData = useCallback(async () => {
    try {
      // 获取用户信息
      let user = null;
      try {
        // 首先尝试异步获取完整用户信息
        user = await AuthService.getCurrentUser();
        if (!user) {
          // 如果失败，尝试获取用户ID
          const userId = AuthService.getUserId();
          if (userId) {
            user = { id: userId };
          } else {
            // 最后尝试从localStorage获取
            const userStr = localStorage.getItem('funnypixels_user');
            if (userStr) {
              user = JSON.parse(userStr);
            }
          }
        }
      } catch (error) {
        logger.error('获取用户信息失败:', error);
        // 降级处理：尝试获取用户ID
        const userId = AuthService.getUserId();
        if (userId) {
          user = { id: userId };
        }
      }
      setCurrentUser(user);
      
      // 获取用户联盟信息
      if (user) {
        const allianceResponse = await fetch(`${config.API_BASE_URL}/api/alliances/user/alliance`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (allianceResponse.ok) {
          const allianceData = await allianceResponse.json();
          setUserAlliance(allianceData.alliance);
        }
      }
    } catch (error) {
      logger.error('加载初始数据失败:', error);
    }
  }, []);

  const loadAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      
      let url = `${config.API_BASE_URL}/api/announcements`;
      
      if (filterType === 'global') {
        url += '/global';
      } else if (filterType === 'system') {
        url += '/system';
      } else if (filterType === 'alliance' && userAlliance) {
        url += `/alliance/${userAlliance.id}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        let filteredAnnouncements = data.announcements || [];
        
        // 前端过滤状态
        if (filterStatus !== 'all') {
          filteredAnnouncements = filteredAnnouncements.filter((ann: Announcement) => ann.status === filterStatus);
        }
        
        setAnnouncements(filteredAnnouncements);
      }
    } catch (error) {
      logger.error('加载公告失败:', error);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus, userAlliance]);

  const handleCreateAnnouncement = useCallback(async () => {
    try {
      const payload = {
        ...formData,
        alliance_id: formData.type === 'alliance' ? userAlliance?.id : undefined
      };

      const response = await fetch(`${config.API_BASE_URL}/api/announcements`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        setAnnouncements(prev => [data.announcement, ...prev]);
        setShowCreateForm(false);
        resetForm();
      } else {
        const errorData = await response.json();
        toast.error(`创建公告失败: ${errorData.message || '未知错误'}`);
      }
    } catch (error) {
      logger.error('创建公告失败:', error);
      toast.error('创建公告失败，请重试');
    }
  }, [formData, userAlliance]);

  const handleUpdateAnnouncement = useCallback(async () => {
    if (!editingAnnouncement) return;

    try {
      const payload = {
        ...formData,
        alliance_id: formData.type === 'alliance' ? userAlliance?.id : undefined
      };

      const response = await fetch(`${config.API_BASE_URL}/api/announcements/${editingAnnouncement.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        setAnnouncements(prev => prev.map(ann => 
          ann.id === editingAnnouncement.id ? data.announcement : ann
        ));
        setEditingAnnouncement(null);
        resetForm();
      } else {
        const errorData = await response.json();
        toast.error(`更新公告失败: ${errorData.message || '未知错误'}`);
      }
    } catch (error) {
      logger.error('更新公告失败:', error);
      toast.error('更新公告失败，请重试');
    }
  }, [formData, editingAnnouncement, userAlliance]);

  const handleDeleteAnnouncement = useCallback(async (announcementId: string) => {
    const confirmed = await dialogService.confirmDelete('这个公告');
    if (!confirmed) return;

    try {
      const response = await fetch(`${config.API_BASE_URL}/api/announcements/${announcementId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setAnnouncements(prev => prev.filter(ann => ann.id !== announcementId));
        if (selectedAnnouncement?.id === announcementId) {
          setSelectedAnnouncement(null);
        }
      } else {
        const errorData = await response.json();
        toast.error(`删除公告失败: ${errorData.message || '未知错误'}`);
      }
    } catch (error) {
      logger.error('删除公告失败:', error);
      toast.error('删除公告失败，请重试');
    }
  }, [selectedAnnouncement]);

  const resetForm = useCallback(() => {
    setFormData({
      title: '',
      content: '',
      type: 'global',
      priority: 'medium',
      expires_at: '',
      is_pinned: false
    });
  }, []);

  const openEditForm = useCallback((announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      type: announcement.type,
      priority: announcement.priority,
      expires_at: announcement.expires_at || '',
      is_pinned: announcement.is_pinned
    });
  }, []);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'global': return <Globe className="w-4 h-4" />;
      case 'system': return <Shield className="w-4 h-4" />;
      case 'alliance': return <Users className="w-4 h-4" />;
      default: return <Globe className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'global': return '全局';
      case 'system': return '系统';
      case 'alliance': return '联盟';
      default: return '未知';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-500 bg-red-50';
      case 'medium': return 'text-yellow-500 bg-yellow-50';
      case 'low': return 'text-green-500 bg-green-50';
      default: return 'text-gray-500 bg-gray-50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'text-green-500 bg-green-50';
      case 'draft': return 'text-yellow-500 bg-yellow-50';
      case 'archived': return 'text-gray-500 bg-gray-50';
      default: return 'text-gray-500 bg-gray-50';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  const canCreateGlobal = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const canCreateSystem = currentUser?.role === 'super_admin';

  return (
    <div className="w-full h-full bg-gray-50">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 bg-white border-b">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" onClick={onBack} className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">公告管理</h1>
        </div>
        
        {canCreateGlobal && (
          <Button 
            onClick={() => setShowCreateForm(true)}
            className="flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>创建公告</span>
          </Button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* 过滤器 */}
        <div className="flex space-x-4">
          <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="选择类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="global">全局公告</SelectItem>
              <SelectItem value="system">系统公告</SelectItem>
              <SelectItem value="alliance">联盟公告</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="选择状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="draft">草稿</SelectItem>
              <SelectItem value="published">已发布</SelectItem>
              <SelectItem value="archived">已归档</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 公告列表 */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-gray-500 text-sm mt-2">加载中...</p>
            </div>
          ) : announcements.length === 0 ? (
            <Card className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 font-medium mb-2">暂无公告</p>
              <p className="text-gray-400 text-sm">创建第一条公告开始吧！</p>
            </Card>
          ) : (
            announcements.map((announcement) => (
              <Card 
                key={announcement.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedAnnouncement(announcement)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        {announcement.is_pinned && (
                          <span className="text-red-500">📌</span>
                        )}
                        <h3 className="font-semibold text-gray-900 truncate">
                          {announcement.title}
                        </h3>
                      </div>
                      
                      <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                        {announcement.content}
                      </p>
                      
                      <div className="flex items-center space-x-3 text-xs">
                        <div className="flex items-center space-x-1">
                          {getTypeIcon(announcement.type)}
                          <span className="text-gray-500">
                            {getTypeLabel(announcement.type)}
                          </span>
                        </div>
                        
                        <span className={`px-2 py-1 rounded-full ${getPriorityColor(announcement.priority)}`}>
                          {announcement.priority === 'high' ? '高' : announcement.priority === 'medium' ? '中' : '低'}优先级
                        </span>
                        
                        <span className={`px-2 py-1 rounded-full ${getStatusColor(announcement.status)}`}>
                          {announcement.status === 'published' ? '已发布' : announcement.status === 'draft' ? '草稿' : '已归档'}
                        </span>
                        
                        <div className="flex items-center space-x-1 text-gray-500">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(announcement.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-1 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e?.stopPropagation();
                          openEditForm(announcement);
                        }}
                        className="p-1"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e?.stopPropagation();
                          handleDeleteAnnouncement(announcement.id);
                        }}
                        className="p-1 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* 创建/编辑表单弹窗 */}
      <AnimatePresence>
        {(showCreateForm || editingAnnouncement) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowCreateForm(false);
              setEditingAnnouncement(null);
              resetForm();
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">
                  {editingAnnouncement ? '编辑公告' : '创建公告'}
                </h2>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingAnnouncement(null);
                    resetForm();
                  }}
                  className="p-2"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    标题 *
                  </label>
                  <Input
                    value={formData.title}
                    onChange={(value) => setFormData(prev => ({ ...prev, title: value }))}
                    placeholder="输入公告标题"
                    maxLength={100}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    内容 *
                  </label>
                  <Textarea
                    value={formData.content}
                    onChange={(value) => setFormData(prev => ({ ...prev, content: value }))}
                    placeholder="输入公告内容"
                    rows={6}
                    maxLength={1000}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      类型 *
                    </label>
                    <Select 
                      value={formData.type} 
                      onValueChange={(value: any) => setFormData(prev => ({ ...prev, type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {canCreateGlobal && <SelectItem value="global">全局公告</SelectItem>}
                        {canCreateSystem && <SelectItem value="system">系统公告</SelectItem>}
                        {userAlliance && <SelectItem value="alliance">联盟公告</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      优先级
                    </label>
                    <Select 
                      value={formData.priority} 
                      onValueChange={(value: any) => setFormData(prev => ({ ...prev, priority: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">低</SelectItem>
                        <SelectItem value="medium">中</SelectItem>
                        <SelectItem value="high">高</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    过期时间 (可选)
                  </label>
                  <Input
                    type="datetime-local"
                    value={formData.expires_at}
                    onChange={(value) => setFormData(prev => ({ ...prev, expires_at: value }))}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_pinned"
                    checked={formData.is_pinned}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_pinned: e.target.checked }))}
                    className="rounded"
                  />
                  <label htmlFor="is_pinned" className="text-sm text-gray-700">
                    置顶公告
                  </label>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreateForm(false);
                      setEditingAnnouncement(null);
                      resetForm();
                    }}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={editingAnnouncement ? handleUpdateAnnouncement : handleCreateAnnouncement}
                    disabled={!formData.title.trim() || !formData.content.trim()}
                  >
                    {editingAnnouncement ? '更新' : '创建'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 公告详情弹窗 */}
      <AnimatePresence>
        {selectedAnnouncement && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedAnnouncement(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">公告详情</h2>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedAnnouncement(null)}
                  className="p-2"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  {selectedAnnouncement.is_pinned && (
                    <span className="text-red-500">📌</span>
                  )}
                  <h3 className="text-lg font-semibold">{selectedAnnouncement.title}</h3>
                </div>

                <div className="flex items-center space-x-3 text-sm">
                  <div className="flex items-center space-x-1">
                    {getTypeIcon(selectedAnnouncement.type)}
                    <span className="text-gray-500">
                      {getTypeLabel(selectedAnnouncement.type)}
                    </span>
                  </div>
                  
                  <span className={`px-2 py-1 rounded-full ${getPriorityColor(selectedAnnouncement.priority)}`}>
                    {selectedAnnouncement.priority === 'high' ? '高' : selectedAnnouncement.priority === 'medium' ? '中' : '低'}优先级
                  </span>
                  
                  <span className={`px-2 py-1 rounded-full ${getStatusColor(selectedAnnouncement.status)}`}>
                    {selectedAnnouncement.status === 'published' ? '已发布' : selectedAnnouncement.status === 'draft' ? '草稿' : '已归档'}
                  </span>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedAnnouncement.content}</p>
                </div>

                <div className="text-sm text-gray-500 space-y-1">
                  <div>创建时间: {formatDate(selectedAnnouncement.created_at)}</div>
                  <div>更新时间: {formatDate(selectedAnnouncement.updated_at)}</div>
                  {selectedAnnouncement.expires_at && (
                    <div>过期时间: {formatDate(selectedAnnouncement.expires_at)}</div>
                  )}
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedAnnouncement(null)}
                  >
                    关闭
                  </Button>
                  <Button
                    onClick={() => {
                      openEditForm(selectedAnnouncement);
                      setSelectedAnnouncement(null);
                    }}
                  >
                    编辑
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}