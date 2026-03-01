import React, { useState } from 'react';
import { X, Upload, Loader2 } from 'lucide-react';
import { logger } from '../../utils/logger';

import { replaceAlert } from '../../utils/toastHelper';
import { ImageUploadService } from '../../services/imageUploadService';

interface ThrowBottleModalProps {
  onClose: () => void;
  onThrow: (data: ThrowBottleData) => Promise<void>;
}

export interface ThrowBottleData {
  title: string;
  content: string;
  image?: string; // 现在保存的是URL而不是base64
}

export const ThrowBottleModal: React.FC<ThrowBottleModalProps> = ({
  onClose,
  onThrow
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 基本验证
      if (file.size > 5 * 1024 * 1024) {
        replaceAlert.error('图片大小不能超过5MB');
        return;
      }

      setImageFile(file);
      setUploadedImageUrl('');

      // 先显示本地预览
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // 异步上传图片
      setIsUploading(true);
      try {
        logger.info('开始上传漂流瓶图片', {
          fileName: file.name,
          fileSize: file.size
        });

        const uploadResult = await ImageUploadService.smartUpload(file);

        logger.info('漂流瓶图片上传成功', {
          imageUrl: uploadResult.imageUrl,
          compressedSize: uploadResult.compressedSize
        });

        setUploadedImageUrl(uploadResult.imageUrl);

      } catch (error) {
        logger.error('漂流瓶图片上传失败:', error);
        alert(`图片上传失败: ${error instanceof Error ? error.message : '未知错误'}`);

        // 上传失败时清除预览
        setImagePreview('');
        setImageFile(null);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      replaceAlert.error('请输入标题');
      return;
    }
    if (!content.trim()) {
      replaceAlert.error('请输入内容');
      return;
    }

    // 如果有图片但还在上传中，等待上传完成
    if (imageFile && isUploading) {
      replaceAlert.error('图片正在上传中，请稍候...');
      return;
    }

    // 如果有图片但上传失败，不允许提交
    if (imageFile && !uploadedImageUrl) {
      replaceAlert.error('图片上传失败，请重新选择图片或移除图片');
      return;
    }

    setIsSubmitting(true);
    try {
      logger.info('开始抛出漂流瓶', {
        title: title.trim(),
        hasImage: !!uploadedImageUrl,
        imageUrl: uploadedImageUrl
      });

      await onThrow({
        title: title.trim(),
        content: content.trim(),
        image: uploadedImageUrl || undefined // 现在使用上传后的URL而不是base64
      });

      logger.info('漂流瓶抛出成功');
      onClose();
    } catch (error) {
      logger.error('抛出漂流瓶失败:', error);
      replaceAlert.error('抛出失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '75vh',
        height: 'auto',
        overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        marginBottom: '60px'
      }}>
        {/* 标题栏 */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#1f2937',
            margin: 0
          }}>🍾 抛出漂流瓶</h3>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#f3f4f6',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
          >
            <X size={18} />
          </button>
        </div>

        {/* 内容区域 */}
        <div style={{ padding: '16px 20px 20px 20px' }}>
          {/* 标题输入 */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '6px'
            }}>
              <label style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                margin: 0
              }}>
                标题 *
              </label>
              <span style={{
                fontSize: '12px',
                color: '#9ca3af'
              }}>
                {title.length}/50
              </span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={50}
              placeholder="给你的漂流瓶起个名字..."
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#6366f1'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            />
          </div>

          {/* 内容输入 */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '6px'
            }}>
              <label style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                margin: 0
              }}>
                内容 *
              </label>
              <span style={{
                fontSize: '12px',
                color: '#9ca3af'
              }}>
                {content.length}/200
              </span>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={200}
              placeholder="写下你想说的话，让它随着漂流瓶去旅行..."
              rows={5}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#6366f1'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            />
          </div>

          {/* 图片上传 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '6px'
            }}>
              图片（可选）
            </label>

            {imagePreview ? (
              <div style={{ position: 'relative' }}>
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{
                    width: '100%',
                    maxHeight: '200px',
                    objectFit: 'contain',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    opacity: isUploading ? 0.6 : 1
                  }}
                />

                {/* 上传状态指示器 */}
                {isUploading && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.9)',
                    padding: '16px',
                    borderRadius: '8px'
                  }}>
                    <Loader2 size={24} style={{ color: '#6366f1', animation: 'spin 1s linear infinite' }} />
                    <span style={{
                      fontSize: '12px',
                      color: '#374151',
                      marginTop: '8px'
                    }}>
                      上传中...
                    </span>
                  </div>
                )}

                {/* 上传成功指示器 */}
                {!isUploading && uploadedImageUrl && (
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    backgroundColor: 'rgba(34,197,94,0.9)',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    ✓ 上传成功
                  </div>
                )}

                <button
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview('');
                    setUploadedImageUrl('');
                  }}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <label style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 20px',
                border: '2px dashed #d1d5db',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                backgroundColor: '#f9fafb'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#6366f1';
                e.currentTarget.style.backgroundColor = '#f0f9ff';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = '#d1d5db';
                e.currentTarget.style.backgroundColor = '#f9fafb';
              }}
              >
                <Upload size={32} style={{ color: '#9ca3af', marginBottom: '8px' }} />
                <span style={{ fontSize: '14px', color: '#6b7280' }}>
                  点击上传图片
                </span>
                <span style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                  支持 JPG, PNG（最大5MB）
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: 'none' }}
                />
              </label>
            )}
          </div>

          {/* 提交按钮 */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim() || !content.trim()}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '16px',
              fontWeight: '600',
              color: 'white',
              background: isSubmitting || !title.trim() || !content.trim()
                ? '#9ca3af'
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '10px',
              cursor: isSubmitting || !title.trim() || !content.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
            }}
            onMouseOver={(e) => {
              if (!isSubmitting && title.trim() && content.trim()) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
            }}
          >
            {isSubmitting ? '抛出中...' : '🌊 抛入大海'}
          </button>
        </div>
      </div>
    </div>
  );
};
