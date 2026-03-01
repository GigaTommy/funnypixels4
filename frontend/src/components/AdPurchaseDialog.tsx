import React, { useState, useRef } from 'react';
import { logger } from '../utils/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { Badge } from './ui/Badge';
import { Loader2, Upload, Image, Palette, X, Check, Sparkles, AlertCircle, Target, Clock, MapPin } from 'lucide-react';
import { api } from '../services/api';
import { replaceAlert } from '../utils/toastHelper';
import { ImageProcessor } from '../utils/imageProcessor';
import {
  dialogBackdropStyle,
  dialogMediumStyle,
  dialogHeaderStyle,
  closeButtonStyle,
  infoPanelBlueStyle,
  labelStyle,
  labelRequiredStyle,
  errorPanelStyle,
  featurePanelStyle,
  warningPanelStyle,
  cancelButtonStyle,
  primaryButtonBlueStyle,
  headerIconBgBlueStyle,
  gridTwoColumnStyle,
  COLORS,
  spacingYStyle
} from '../styles/dialogStyles';

interface AdPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  adItem: {
    id: string;
    name: string;
    description: string;
    price: number;
    width?: number;
    height?: number;
    size_type?: string;
  } | null;
}

interface AdFormData {
  adTitle: string;
  adDescription: string;
  imageData: string;
  imageFile: File | null;
  pixelPoints?: any[]; // 添加像素点数据
  targetLocation: {
    lat: number;
    lng: number;
  };
  radius: number;
  duration: number;
}

export const AdPurchaseDialog: React.FC<AdPurchaseDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
  adItem
}) => {
  const [formData, setFormData] = useState<AdFormData>({
    adTitle: '',
    adDescription: '',
    imageData: '',
    imageFile: null,
    targetLocation: { lat: 39.9042, lng: 116.4074 }, // 默认北京坐标
    radius: 1000,
    duration: 24
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [pixelPreview, setPixelPreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 重置表单
  const resetForm = () => {
    setFormData({
      adTitle: '',
      adDescription: '',
      imageData: '',
      imageFile: null,
      targetLocation: { lat: 39.9042, lng: 116.4074 },
      radius: 1000,
      duration: 24
    });
    setPreviewUrl('');
    setPixelPreview('');
    setError('');
  };

  // 处理对话框关闭
  const handleClose = () => {
    if (!isSubmitting) {
      resetForm();
      onOpenChange(false);
    }
  };

  // 完整的图片处理流程 - 块平均 + 抖动 + 颜色量化
  const processImage = async (file: File): Promise<{ compressed: string; pixelated: string; pixelPoints: any[] }> => {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img');

      img.onload = async () => {
        try {
          // 设置目标尺寸
          const targetWidth = adItem?.width || 64;
          const targetHeight = adItem?.height || 64;
          
          logger.info(`🖼️ 开始完整图片处理: ${img.width}x${img.height} -> ${targetWidth}x${targetHeight}`);

          // 创建压缩版本（用于预览）
          const compressedCanvas = document.createElement('canvas');
          const compressedCtx = compressedCanvas.getContext('2d', { willReadFrequently: true });
          compressedCanvas.width = targetWidth;
          compressedCanvas.height = targetHeight;
          compressedCtx?.drawImage(img, 0, 0, targetWidth, targetHeight);
          const compressedDataUrl = compressedCanvas.toDataURL('image/png', 0.8);

          // 获取原始图片数据
          const originalCanvas = document.createElement('canvas');
          const originalCtx = originalCanvas.getContext('2d', { willReadFrequently: true });
          originalCanvas.width = img.width;
          originalCanvas.height = img.height;
          originalCtx?.drawImage(img, 0, 0);
          const originalImageData = originalCtx?.getImageData(0, 0, img.width, img.height);
          
          if (!originalImageData) {
            reject(new Error('无法处理图片数据'));
            return;
          }

          // 使用新的ImageProcessor进行完整处理
          const pixelPoints = await ImageProcessor.processImage(
            originalImageData, 
            targetWidth, 
            targetHeight
          );

          // 将像素点转换为ImageData用于显示
          const pixelatedImageData = ImageProcessor.pixelPointsToImageData(
            pixelPoints, 
            targetWidth, 
            targetHeight
          );

          // 创建像素化Canvas
          const pixelCanvas = document.createElement('canvas');
          const pixelCtx = pixelCanvas.getContext('2d', { willReadFrequently: true });
          pixelCanvas.width = targetWidth;
          pixelCanvas.height = targetHeight;
          pixelCtx?.putImageData(pixelatedImageData, 0, 0);
          const pixelatedDataUrl = pixelCanvas.toDataURL('image/png', 0.8);

          logger.info(`✅ 完整图片处理完成: ${targetWidth}x${targetHeight}, ${pixelPoints.length}个有效像素`);

          // 清理临时Canvas
          originalCanvas.width = 0;
          originalCanvas.height = 0;
          compressedCanvas.width = 0;
          compressedCanvas.height = 0;
          pixelCanvas.width = 0;
          pixelCanvas.height = 0;

          resolve({
            compressed: compressedDataUrl,
            pixelated: pixelatedDataUrl,
            pixelPoints: pixelPoints
          });
          
        } catch (error) {
          logger.error('❌ 图片处理失败:', error);
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = URL.createObjectURL(file);
    });
  };

  // 处理文件选择
  const handleFileSelect = async (file: File) => {
    if (!file) return;

    // 验证文件类型
    const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!supportedTypes.includes(file.type)) {
      setError('不支持的文件格式，请选择 JPG、PNG 或 GIF 格式的图片');
      return;
    }

    // 验证文件大小（5MB）
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('文件大小不能超过 5MB');
      return;
    }

    setError('');

    try {
      setIsProcessing(true);
      setProcessingProgress(0);
      
      // 处理图片 - 现在包含完整的像素点数据
      const { compressed, pixelated, pixelPoints } = await processImage(file);
      
      setFormData(prev => ({
        ...prev,
        imageData: compressed,
        imageFile: file,
        pixelPoints: pixelPoints // 存储像素点数据用于提交
      }));
      setPreviewUrl(compressed);
      setPixelPreview(pixelated);
      
      logger.info(`🎨 图片处理完成: ${pixelPoints.length}个像素点`);
    } catch (error) {
      setError('图片处理失败，请重试');
      logger.error('图片处理错误:', error);
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  };

  // 处理拖拽
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  // 处理文件输入
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  // 移除图片
  const removeImage = () => {
    setFormData(prev => ({
      ...prev,
      imageData: '',
      imageFile: null
    }));
    setPreviewUrl('');
    setPixelPreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 提交表单
  const handleSubmit = async () => {
    if (!formData.adTitle.trim()) {
      setError('请输入广告标题');
      return;
    }

    if (formData.adTitle.length < 2) {
      setError('广告标题至少需要2个字符');
      return;
    }

    if (formData.adTitle.length > 20) {
      setError('广告标题不能超过20个字符');
      return;
    }

    if (!formData.imageData) {
      setError('请上传广告图片');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // 生成幂等键
      const idempotencyKey = `ad_purchase_${adItem?.id}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      const response = await api.post('/store-payment/buy', {
        itemId: adItem?.id,
        quantity: 1,
        adTitle: formData.adTitle.trim(),
        adDescription: formData.adDescription.trim(),
        imageData: formData.imageData
      }, {
        headers: {
          'x-idempotency-key': idempotencyKey
        }
      });

      if (response.data.ok) {
        logger.info('✅ 广告订单创建成功');
        
        if (onSuccess) {
          onSuccess();
        }
        
        handleClose();
        replaceAlert.success('广告订单创建成功！您的广告将在审核通过后投放。');
      } else {
        setError(response.data.error || '创建订单失败');
      }
    } catch (error: any) {
      logger.error('❌ 创建广告订单失败:', error);
      setError(error.response?.data?.error || '创建订单失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!adItem) return null;

  return (
    <AnimatePresence>
      {open && (
        <div
          key="ad-purchase-dialog"
          style={dialogBackdropStyle}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={dialogMediumStyle}
          >
            {/* 头部 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <div style={headerIconBgBlueStyle}>
                  <Target className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: '18px',
                      fontWeight: 600,
                      color: COLORS.textDark
                    }}
                  >
                    {adItem.name}
                  </h3>
                  <p
                    style={{
                      fontSize: '14px',
                      color: COLORS.textMuted,
                      marginTop: '4px'
                    }}
                  >
                    尺寸: {adItem.width}×{adItem.height} 像素
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                style={closeButtonStyle}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 费用信息 */}
            <div style={infoPanelBlueStyle}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: '14px',
                      color: COLORS.textMuted
                    }}
                  >
                    费用:
                  </span>
                  <span
                    style={{
                      marginLeft: '8px',
                      fontWeight: 500,
                      color: COLORS.blue
                    }}
                  >
                    {adItem.price.toLocaleString()} 积分
                  </span>
                </div>
                <div>
                  <span
                    style={{
                      fontSize: '14px',
                      color: COLORS.textMuted
                    }}
                  >
                    投放时长:
                  </span>
                  <span
                    style={{
                      marginLeft: '8px',
                      fontWeight: 500
                    }}
                  >
                    {formData.duration} 小时
                  </span>
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '24px'
              }}
            >
              {/* 左侧：表单 */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}
              >
                {/* 广告标题 */}
                <div>
                  <label
                    style={{
                      ...labelStyle,
                      marginBottom: '8px'
                    }}
                  >
                    广告标题{' '}
                    <span
                      style={{
                        color: '#ef4444'
                      }}
                    >
                      *
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        color: COLORS.textMuted,
                        marginLeft: '8px'
                      }}
                    >
                      ({formData.adTitle.length}/20)
                    </span>
                  </label>
                  <Input
                    value={formData.adTitle}
                    onChange={(value: string) => {
                      if (value.length <= 20) {
                        setFormData(prev => ({ ...prev, adTitle: value }));
                      }
                    }}
                    placeholder="为您的广告起个吸引人的标题"
                    disabled={isSubmitting}
                    maxLength={20}
                  />
                </div>

                {/* 广告描述 */}
                <div>
                  <label
                    style={{
                      ...labelStyle,
                      marginBottom: '8px'
                    }}
                  >
                    广告描述{' '}
                    <span
                      style={{
                        color: COLORS.textMuted
                      }}
                    >
                      (可选)
                    </span>
                  </label>
                  <Textarea
                    value={formData.adDescription}
                    onChange={(value: string) => setFormData(prev => ({ ...prev, adDescription: value }))}
                    placeholder="描述您的广告内容..."
                    rows={3}
                    disabled={isSubmitting}
                  />
                </div>

                {/* 投放设置 */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <h4
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: COLORS.textDark
                    }}
                  >
                    投放设置
                  </h4>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '14px',
                        color: '#4b5563',
                        marginBottom: '4px'
                      }}
                    >
                      投放时长 (小时)
                    </label>
                    <select
                      value={formData.duration}
                      onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: `1px solid ${COLORS.borderGray}`,
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                      disabled={isSubmitting}
                    >
                      <option value={24}>24小时</option>
                      <option value={48}>48小时</option>
                      <option value={72}>72小时</option>
                      <option value={168}>7天</option>
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '14px',
                        color: '#4b5563',
                        marginBottom: '4px'
                      }}
                    >
                      投放半径 (米)
                    </label>
                    <select
                      value={formData.radius}
                      onChange={(e) => setFormData(prev => ({ ...prev, radius: parseInt(e.target.value) }))}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: `1px solid ${COLORS.borderGray}`,
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                      disabled={isSubmitting}
                    >
                      <option value={500}>500米</option>
                      <option value={1000}>1公里</option>
                      <option value={2000}>2公里</option>
                      <option value={5000}>5公里</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 右侧：图片上传和预览 */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}
              >
                {/* 图片上传区域 */}
                <div>
                  <label
                    style={{
                      ...labelStyle,
                      marginBottom: '8px'
                    }}
                  >
                    上传广告图片{' '}
                    <span
                      style={{
                        color: '#ef4444'
                      }}
                    >
                      *
                    </span>
                  </label>
                  
                  {!previewUrl ? (
                    <div
                      style={{
                        position: 'relative',
                        border: '2px dashed',
                        borderRadius: '8px',
                        padding: '24px',
                        textAlign: 'center',
                        transition: 'all 0.3s ease',
                        borderColor: dragActive ? COLORS.blue : COLORS.borderGray,
                        backgroundColor: dragActive ? COLORS.bgBlue : 'white'
                      }}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/gif"
                        onChange={handleFileInput}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          width: '100%',
                          height: '100%',
                          opacity: 0,
                          cursor: 'pointer'
                        }}
                        disabled={isSubmitting}
                      />
                      
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}
                      >
                        {isProcessing ? (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '12px'
                            }}
                          >
                            <div
                              style={{
                                margin: '0 auto',
                                width: '40px',
                                height: '40px',
                                backgroundColor: '#dbeafe',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <div
                                style={{
                                  width: '20px',
                                  height: '20px',
                                  border: '2px solid #3b82f6',
                                  borderTopColor: 'transparent',
                                  borderRadius: '50%',
                                  animation: 'spin 0.8s linear infinite'
                                }}
                              />
                            </div>

                            <div
                              style={{
                                textAlign: 'center'
                              }}
                            >
                              <p
                                style={{
                                  fontSize: '14px',
                                  fontWeight: 500,
                                  color: COLORS.textDark
                                }}
                              >
                                正在处理图片...
                              </p>
                              <p
                                style={{
                                  fontSize: '12px',
                                  color: COLORS.textMuted,
                                  marginTop: '4px'
                                }}
                              >
                                请稍候，正在应用块平均算法和抖动处理
                              </p>

                              {/* 进度条 */}
                              <div
                                style={{
                                  marginTop: '12px',
                                  width: '100%',
                                  backgroundColor: '#e5e7eb',
                                  borderRadius: '9999px',
                                  height: '8px'
                                }}
                              >
                                <div
                                  style={{
                                    backgroundColor: COLORS.blue,
                                    height: '8px',
                                    borderRadius: '9999px',
                                    transition: 'width 0.3s ease-out',
                                    width: `${processingProgress}%`
                                  }}
                                />
                              </div>
                              <p
                                style={{
                                  fontSize: '12px',
                                  color: COLORS.blue,
                                  marginTop: '4px'
                                }}
                              >
                                {processingProgress}% 完成
                              </p>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div
                              style={{
                                margin: '0 auto',
                                width: '40px',
                                height: '40px',
                                backgroundColor: '#f3f4f6',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Upload className="w-5 h-5 text-gray-400" />
                            </div>

                            <div>
                              <p
                                style={{
                                  fontSize: '14px',
                                  fontWeight: 500,
                                  color: COLORS.textDark
                                }}
                              >
                                点击上传或拖拽图片到此处
                              </p>
                              <p
                                style={{
                                  fontSize: '12px',
                                  color: COLORS.textMuted,
                                  marginTop: '4px'
                                }}
                              >
                                支持 JPG、PNG、GIF 格式，最大 5MB
                              </p>
                              <p
                                style={{
                                  fontSize: '12px',
                                  color: COLORS.blue,
                                  marginTop: '4px'
                                }}
                              >
                                将自动压缩至 {adItem.width}×{adItem.height} 像素
                              </p>
                            </div>
                            
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isSubmitting || isProcessing}
                            >
                              <Image className="w-4 h-4 mr-2" />
                              选择文件
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px'
                      }}
                    >
                      {/* 隐藏的文件输入元素 */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/gif"
                        onChange={handleFileInput}
                        style={{
                          display: 'none'
                        }}
                        disabled={isSubmitting}
                      />

                      {/* 原始图片预览 */}
                      <div
                        style={{
                          border: `1px solid ${COLORS.borderGray}`,
                          borderRadius: '8px',
                          padding: '16px',
                          backgroundColor: '#f9fafb'
                        }}
                      >
                        <h5
                          style={{
                            fontSize: '14px',
                            fontWeight: 500,
                            color: COLORS.textDark,
                            marginBottom: '8px'
                          }}
                        >
                          原始图片
                        </h5>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'center'
                          }}
                        >
                          <img
                            src={previewUrl}
                            alt="原始图片"
                            style={{
                              maxWidth: '100%',
                              maxHeight: '128px',
                              objectFit: 'contain',
                              border: `1px solid ${COLORS.borderGray}`,
                              borderRadius: '4px'
                            }}
                          />
                        </div>
                      </div>

                      {/* 像素化预览 */}
                      {pixelPreview && (
                        <div
                          style={{
                            border: `1px solid ${COLORS.borderGray}`,
                            borderRadius: '8px',
                            padding: '16px',
                            backgroundColor: '#f9fafb'
                          }}
                        >
                          <h5
                            style={{
                              fontSize: '14px',
                              fontWeight: 500,
                              color: COLORS.textDark,
                              marginBottom: '8px'
                            }}
                          >
                            像素化效果
                          </h5>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'center'
                            }}
                          >
                            <img
                              src={pixelPreview}
                              alt="像素化效果"
                              style={{
                                maxWidth: '100%',
                                maxHeight: '128px',
                                objectFit: 'contain',
                                border: `1px solid ${COLORS.borderGray}`,
                                borderRadius: '4px'
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* 操作按钮 */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px'
                        }}
                      >
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isSubmitting}
                        >
                          <Image className="w-4 h-4 mr-2" />
                          重新选择
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={removeImage}
                          disabled={isSubmitting}
                        >
                          <X className="w-4 h-4 mr-2" />
                          删除
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 错误信息 */}
            {error && (
              <div
                style={{
                  ...errorPanelStyle,
                  marginTop: '16px'
                }}
              >
                <AlertCircle
                  className="w-5 h-5"
                  style={{
                    color: '#991b1b',
                    flexShrink: 0
                  }}
                />
                <div>
                  <p
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#7f1d1d'
                    }}
                  >
                    提交失败
                  </p>
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#991b1b'
                    }}
                  >
                    {error}
                  </p>
                </div>
              </div>
            )}

            {/* 功能特色说明 */}
            <div
              style={{
                padding: '12px',
                backgroundColor: '#f0fdf4',
                border: `1px solid #dcfce7`,
                borderRadius: '8px',
                marginTop: '16px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  marginBottom: '8px'
                }}
              >
                <Check
                  className="w-5 h-5"
                  style={{
                    color: '#16a34a',
                    flexShrink: 0
                  }}
                />
                <div>
                  <p
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#15803d'
                    }}
                  >
                    广告特色
                  </p>
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#16a34a'
                    }}
                  >
                    智能像素化 • 精准投放 • 实时展示 • 自动压缩优化
                  </p>
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div
              style={{
                display: 'flex',
                gap: '12px',
                marginTop: '24px'
              }}
            >
              <button
                onClick={handleClose}
                style={{
                  ...cancelButtonStyle,
                  flex: 1
                }}
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.adTitle.trim() || formData.adTitle.length < 2 || formData.adTitle.length > 20 || !formData.imageData}
                style={{
                  ...primaryButtonBlueStyle,
                  flex: 1,
                  opacity: isSubmitting || !formData.adTitle.trim() || formData.adTitle.length < 2 || formData.adTitle.length > 20 || !formData.imageData ? 0.5 : 1,
                  cursor: isSubmitting || !formData.adTitle.trim() || formData.adTitle.length < 2 || formData.adTitle.length > 20 || !formData.imageData ? 'not-allowed' : 'pointer'
                }}
              >
                {isSubmitting ? (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid white',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                        marginRight: '8px'
                      }}
                    />
                    创建订单中...
                  </span>
                ) : (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Check
                      className="w-4 h-4"
                      style={{
                        marginRight: '8px'
                      }}
                    />
                    创建订单 ({adItem.price.toLocaleString()}积分)
                  </span>
                )}
              </button>
            </div>

            {/* 警告信息 */}
            <div
              style={{
                marginTop: '16px',
                padding: '12px',
                backgroundColor: '#fef3c7',
                borderRadius: '8px'
              }}
            >
              <p
                style={{
                  fontSize: '12px',
                  color: '#78350f'
                }}
              >
                ⚠️ 请确保广告内容符合社区规范，审核通过后将在指定区域投放展示。
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
