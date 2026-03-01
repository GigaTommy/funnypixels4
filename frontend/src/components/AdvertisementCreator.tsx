import React, { useState } from 'react';
import { logger } from '../utils/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image, Target, Clock, Calendar, Upload } from 'lucide-react';

interface AdvertisementCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  adItem: any;
  onCreateAd: (adData: any) => void;
}

export default function AdvertisementCreator({ isOpen, onClose, adItem, onCreateAd }: AdvertisementCreatorProps) {
  const [adData, setAdData] = useState({
    title: '',
    description: '',
    x: 0,
    y: 0,
    width: 64,
    height: 64,
    startDate: '',
    endDate: '',
    schedule: {
      interval_sec: 30,
      duration_sec: 10,
      freeze_sec: 5
    }
  });
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateAd = async () => {
    if (isCreating) return;
    
    try {
      setIsCreating(true);
      await onCreateAd(adData);
      onClose();
    } catch (error) {
      logger.error('创建广告失败:', error);
    } finally {
      setIsCreating(false);
    }
  };

  if (!adItem) return null;

  const metadata = adItem.metadata || {};
  const maxSize = metadata.max_size || '64x64';
  const durationHours = metadata.duration_hours || 168;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            {/* 头部 */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                  <Image className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">创建广告</h3>
                  <p className="text-sm text-gray-500">{adItem.name}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* 广告信息 */}
            <div className="bg-blue-50 rounded-2xl p-4 mb-6">
              <p className="text-sm text-blue-700 mb-2">{adItem.description}</p>
              <div className="flex items-center space-x-4 text-xs text-blue-600">
                <div className="flex items-center space-x-1">
                  <Target className="w-3 h-3" />
                  <span>最大尺寸: {maxSize}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>有效期: {durationHours}小时</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 基本信息 */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900">基本信息</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">广告标题</label>
                  <input
                    type="text"
                    value={adData.title}
                    onChange={(e) => setAdData({...adData, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="输入广告标题"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">广告描述</label>
                  <textarea
                    value={adData.description}
                    onChange={(e) => setAdData({...adData, description: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="输入广告描述"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">上传图片</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-400 transition-colors">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">点击上传广告图片</p>
                    <p className="text-xs text-gray-400 mt-1">支持 PNG, JPG 格式</p>
                  </div>
                </div>
              </div>

              {/* 位置和设置 */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900">位置设置</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">X 坐标</label>
                    <input
                      type="number"
                      min="0"
                      max="999"
                      value={adData.x}
                      onChange={(e) => setAdData({...adData, x: parseInt(e.target.value) || 0})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Y 坐标</label>
                    <input
                      type="number"
                      min="0"
                      max="999"
                      value={adData.y}
                      onChange={(e) => setAdData({...adData, y: parseInt(e.target.value) || 0})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">宽度</label>
                    <input
                      type="number"
                      min="1"
                      max="128"
                      value={adData.width}
                      onChange={(e) => setAdData({...adData, width: parseInt(e.target.value) || 1})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">高度</label>
                    <input
                      type="number"
                      min="1"
                      max="128"
                      value={adData.height}
                      onChange={(e) => setAdData({...adData, height: parseInt(e.target.value) || 1})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <h4 className="font-semibold text-gray-900 mt-6">时间设置</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
                    <input
                      type="datetime-local"
                      value={adData.startDate}
                      onChange={(e) => setAdData({...adData, startDate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
                    <input
                      type="datetime-local"
                      value={adData.endDate}
                      onChange={(e) => setAdData({...adData, endDate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 预览 */}
            <div className="bg-gray-50 rounded-2xl p-4 mt-6">
              <h4 className="font-semibold text-gray-900 mb-3">广告预览</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <p>• 位置: ({adData.x}, {adData.y})</p>
                <p>• 尺寸: {adData.width} x {adData.height}</p>
                <p>• 标题: {adData.title || '未设置'}</p>
                <p>• 时间: {adData.startDate ? new Date(adData.startDate).toLocaleString() : '未设置'} - {adData.endDate ? new Date(adData.endDate).toLocaleString() : '未设置'}</p>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex space-x-3 mt-6">
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-2xl font-semibold hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateAd}
                disabled={isCreating || !adData.title || !adData.startDate}
                className="flex-1 py-3 px-4 bg-blue-500 text-white rounded-2xl font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>创建中...</span>
                  </div>
                ) : (
                  '创建广告'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
