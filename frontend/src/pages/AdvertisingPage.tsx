import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';
import { motion } from 'framer-motion';
import { 
  Megaphone, 
  MapPin, 
  Calendar, 
  Target, 
  DollarSign,
  Plus,
  Trash2,
  Eye,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { StoreAPI } from '../services/store';
import { toast } from 'react-hot-toast';

interface Advertisement {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  targetLocation: {
    lat: number;
    lng: number;
  };
  radius: number;
  duration: number;
  budget: number;
  startTime: string;
  endTime: string;
  status: 'pending' | 'active' | 'paused' | 'completed' | 'rejected';
  createdAt: string;
}

interface AdCredits {
  total: number;
  used: number;
  available: number;
}

export default function AdvertisingPage() {
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [adCredits, setAdCredits] = useState<AdCredits>({ total: 0, used: 0, available: 0 });
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadAdvertisingData();
  }, []);

  const loadAdvertisingData = useCallback(async () => {
    try {
      setLoading(true);
      const [adsResponse, creditsResponse] = await Promise.all([
        StoreAPI.getUserAdvertisements(),
        StoreAPI.getAdCredits()
      ]);
      
      setAdvertisements(adsResponse.data || []);
      setAdCredits(creditsResponse.data || { total: 0, used: 0, available: 0 });
    } catch (error) {
      logger.error('加载广告数据失败:', error);
      toast.error('加载广告数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCreateAdvertisement = useCallback(async (adData: any) => {
    if (creating) return;
    
    try {
      setCreating(true);
      const response = await StoreAPI.createAdvertisement(adData);
      
      if (response.success) {
        toast.success('广告创建成功，等待审核');
        setShowCreateModal(false);
        await loadAdvertisingData();
      }
    } catch (error) {
      logger.error('创建广告失败:', error);
      toast.error('创建广告失败');
    } finally {
      setCreating(false);
    }
  }, [creating, loadAdvertisingData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'paused':
        return 'bg-gray-100 text-gray-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'active':
        return <CheckCircle className="w-4 h-4" />;
      case 'paused':
        return <XCircle className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '审核中';
      case 'active':
        return '投放中';
      case 'paused':
        return '已暂停';
      case 'completed':
        return '已完成';
      case 'rejected':
        return '已拒绝';
      default:
        return '未知';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">广告投放</h1>
          <p className="text-gray-600">管理您的广告投放活动</p>
        </div>

        {/* 广告额度统计 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">总广告额度</p>
                <p className="text-2xl font-bold text-gray-900">{adCredits.total}</p>
              </div>
              <Megaphone className="w-8 h-8 text-orange-500" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">已使用</p>
                <p className="text-2xl font-bold text-red-600">{adCredits.used}</p>
              </div>
              <Target className="w-8 h-8 text-red-500" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">可用额度</p>
                <p className="text-2xl font-bold text-green-600">{adCredits.available}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">广告列表</h2>
            <p className="text-sm text-gray-500">共 {advertisements.length} 个广告</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={adCredits.available <= 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              adCredits.available > 0
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Plus className="w-4 h-4" />
            创建广告
          </button>
        </div>

        {/* 广告列表 */}
        {advertisements.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow-sm">
            <Megaphone className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无广告</h3>
            <p className="text-gray-500 mb-4">
              {adCredits.available > 0 
                ? '您还没有创建任何广告，点击上方按钮开始创建吧！'
                : '您的广告额度已用完，请先购买广告道具'
              }
            </p>
            {adCredits.available <= 0 && (
              <button
                onClick={() => window.location.href = '/store'}
                className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition-colors"
              >
                购买广告道具
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {advertisements.map((ad) => (
              <motion.div
                key={ad.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-6 shadow-sm"
              >
                {/* 广告头部 */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{ad.title}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2">{ad.description}</p>
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(ad.status)}`}>
                    {getStatusIcon(ad.status)}
                    {getStatusText(ad.status)}
                  </div>
                </div>

                {/* 广告图片 */}
                {ad.imageUrl && (
                  <div className="mb-4">
                    <img
                      src={ad.imageUrl}
                      alt={ad.title}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  </div>
                )}

                {/* 广告信息 */}
                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">
                      ({ad.targetLocation.lat.toFixed(4)}, {ad.targetLocation.lng.toFixed(4)})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">半径 {ad.radius}m</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{ad.duration} 天</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">预算 {ad.budget}</span>
                  </div>
                </div>

                {/* 时间信息 */}
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-gray-500">开始时间</p>
                      <p className="font-medium">{new Date(ad.startTime).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">结束时间</p>
                      <p className="font-medium">{new Date(ad.endTime).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-2">
                  <button className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors">
                    <Eye className="w-4 h-4" />
                    查看详情
                  </button>
                  {ad.status === 'active' && (
                    <button className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-yellow-50 text-yellow-600 rounded-lg text-sm font-medium hover:bg-yellow-100 transition-colors">
                      <Clock className="w-4 h-4" />
                      暂停
                    </button>
                  )}
                  {ad.status === 'pending' && (
                    <button className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors">
                      <Trash2 className="w-4 h-4" />
                      删除
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* 创建广告模态框 */}
      {showCreateModal && (
        <CreateAdvertisementModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreateAd={handleCreateAdvertisement}
          creating={creating}
          availableCredits={adCredits.available}
        />
      )}
    </div>
  );
}

// 创建广告模态框组件
interface CreateAdvertisementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateAd: (adData: any) => void;
  creating: boolean;
  availableCredits: number;
}

function CreateAdvertisementModal({ 
  isOpen, 
  onClose, 
  onCreateAd, 
  creating, 
  availableCredits 
}: CreateAdvertisementModalProps) {
  const [adData, setAdData] = useState({
    title: '',
    description: '',
    imageUrl: '',
    targetLocation: {
      lat: 35.676423,
      lng: 139.650027
    },
    radius: 100,
    duration: 7,
    budget: 100,
    startTime: '',
    endTime: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateAd(adData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">创建广告</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <XCircle className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 基本信息 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              广告标题 *
            </label>
            <input
              type="text"
              required
              value={adData.title}
              onChange={(e) => setAdData({ ...adData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="输入广告标题"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              广告描述 *
            </label>
            <textarea
              required
              value={adData.description}
              onChange={(e) => setAdData({ ...adData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="输入广告描述"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              图片URL
            </label>
            <input
              type="url"
              value={adData.imageUrl}
              onChange={(e) => setAdData({ ...adData, imageUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="https://example.com/image.jpg"
            />
          </div>

          {/* 位置信息 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                纬度
              </label>
              <input
                type="number"
                step="any"
                value={adData.targetLocation.lat}
                onChange={(e) => setAdData({
                  ...adData,
                  targetLocation: { ...adData.targetLocation, lat: parseFloat(e.target.value) }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                经度
              </label>
              <input
                type="number"
                step="any"
                value={adData.targetLocation.lng}
                onChange={(e) => setAdData({
                  ...adData,
                  targetLocation: { ...adData.targetLocation, lng: parseFloat(e.target.value) }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 投放参数 */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                投放半径 (m)
              </label>
              <input
                type="number"
                min="10"
                max="1000"
                value={adData.radius}
                onChange={(e) => setAdData({ ...adData, radius: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                投放天数
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={adData.duration}
                onChange={(e) => setAdData({ ...adData, duration: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                预算
              </label>
              <input
                type="number"
                min="10"
                value={adData.budget}
                onChange={(e) => setAdData({ ...adData, budget: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 时间设置 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                开始时间 *
              </label>
              <input
                type="datetime-local"
                required
                value={adData.startTime}
                onChange={(e) => setAdData({ ...adData, startTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                结束时间 *
              </label>
              <input
                type="datetime-local"
                required
                value={adData.endTime}
                onChange={(e) => setAdData({ ...adData, endTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 额度信息 */}
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-orange-700">可用广告额度</span>
              <span className="text-lg font-semibold text-orange-700">{availableCredits}</span>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={creating || availableCredits <= 0}
              className="flex-1 py-3 px-4 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? (
                <span className="flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  创建中...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <Megaphone className="w-4 h-4 mr-2" />
                  创建广告
                </span>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
