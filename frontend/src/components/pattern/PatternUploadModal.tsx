import React, { useState, useCallback } from 'react';
import { logger } from '../../utils/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { PatternUploadAPI } from '../../services/patternUpload';
import { replaceAlert } from '../../utils/toastHelper';
import { X, Upload, Image, AlertCircle } from 'lucide-react';

interface PatternUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (uploadId: string) => void;
}

export const PatternUploadModal: React.FC<PatternUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [serviceType, setServiceType] = useState<'free' | 'certified' | 'commercial'>('free');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 处理文件选择
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('不支持的文件格式，请选择 JPEG、PNG、GIF 或 WebP 格式的图片');
      return;
    }

    // 验证文件大小（5MB限制）
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('文件大小不能超过5MB');
      return;
    }

    setSelectedFile(file);
    setError(null);

    // 创建预览URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }, []);

  // 处理上传
  const handleUpload = useCallback(async () => {
    if (!selectedFile || !name.trim()) {
      setError('请选择图片文件并填写图案名称');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('name', name.trim());
      formData.append('description', description.trim());
      formData.append('service_type', serviceType);

      const response = await PatternUploadAPI.uploadPattern(formData);
      
      if (response.success) {
        onSuccess(response.upload?.id || '');
        onClose();
        // 重置表单
        setName('');
        setDescription('');
        setServiceType('free');
        setSelectedFile(null);
        setPreviewUrl(null);
      } else {
        setError(response.error || '上传失败');
      }
    } catch (error) {
      logger.error('上传失败:', error);
      setError('上传失败，请稍后重试');
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, name, description, serviceType, onSuccess, onClose]);

  // 清理预览URL
  const handleClose = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    onClose();
  }, [previewUrl, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        key="pattern-upload-modal"
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4"
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0, 0, 0, 0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 10000,
          padding: '16px'
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
          style={{ 
            backgroundColor: 'white', 
            borderRadius: '16px', 
            padding: '24px', 
            width: '100%', 
            maxWidth: '448px',
            maxHeight: '90vh',
            overflowY: 'auto',
            position: 'relative',
            zIndex: 10001
          }}
        >
          {/* 头部 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Upload className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">上传自定义图案</h3>
                <p className="text-sm text-gray-500">支持多种格式，AI智能处理</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              disabled={isUploading}
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          <div className="space-y-4">
          {/* 文件选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择图片文件
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="w-full p-2 border border-gray-300 rounded-md"
              disabled={isUploading}
            />
          </div>

          {/* 图片预览 */}
          {previewUrl && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                预览
              </label>
              <div className="border border-gray-300 rounded-md p-2">
                <img
                  src={previewUrl}
                  alt="预览"
                  className="max-w-full h-auto max-h-32 mx-auto"
                />
              </div>
            </div>
          )}

          {/* 图案名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              图案名称 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入图案名称"
              className="w-full p-2 border border-gray-300 rounded-md"
              disabled={isUploading}
            />
          </div>

          {/* 图案描述 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              图案描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请输入图案描述（可选）"
              rows={3}
              className="w-full p-2 border border-gray-300 rounded-md"
              disabled={isUploading}
            />
          </div>

          {/* 服务类型 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              服务类型
            </label>
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value as any)}
              className="w-full p-2 border border-gray-300 rounded-md"
              disabled={isUploading}
            >
              <option value="free">免费服务</option>
              <option value="certified">认证服务</option>
              <option value="commercial">商业服务</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {serviceType === 'free' && '免费存储，AI自动审核'}
              {serviceType === 'certified' && '付费认证，人工审核'}
              {serviceType === 'commercial' && '商业授权，专业审核'}
            </p>
          </div>

          {/* 错误信息 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-red-800">上传失败</p>
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleClose}
              className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              disabled={isUploading}
            >
              取消
            </button>
            <button
              onClick={handleUpload}
              disabled={isUploading || !selectedFile || !name.trim()}
              className="flex-1 py-3 px-4 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isUploading ? (
                <span className="flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  上传中...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <Upload className="w-4 h-4 mr-2" />
                  上传图案
                </span>
              )}
            </button>
          </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default PatternUploadModal;
