import React, { useState, useRef } from 'react';
import { logger } from '../utils/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { Badge } from './ui/Badge';
import { Loader2, Upload, Image, Palette, X, Check, Sparkles, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { replaceAlert } from '../utils/toastHelper';
import {
  dialogBackdropStyle,
  dialogSmallStyle,
  dialogHeaderStyle,
  closeButtonStyle,
  infoPanelPurpleStyle,
  labelStyle,
  labelRequiredStyle,
  errorPanelStyle,
  featurePanelStyle,
  warningPanelStyle,
  cancelButtonStyle,
  primaryButtonPurpleStyle,
  headerIconBgPurpleStyle,
  COLORS,
  spacingYStyle
} from '../styles/dialogStyles';

interface CustomFlagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface CustomFlagFormData {
  patternName: string;
  patternDescription: string;
  imageData: string;
  imageFile: File | null;
}

export const CustomFlagDialog: React.FC<CustomFlagDialogProps> = ({
  open,
  onOpenChange,
  onSuccess
}) => {
  const [formData, setFormData] = useState<CustomFlagFormData>({
    patternName: '',
    patternDescription: '',
    imageData: '',
    imageFile: null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 重置表单
  const resetForm = () => {
    setFormData({
      patternName: '',
      patternDescription: '',
      imageData: '',
      imageFile: null
    });
    setPreviewUrl('');
    setError('');
  };

  // 处理对话框关闭
  const handleClose = () => {
    if (!isSubmitting) {
      resetForm();
      onOpenChange(false);
    }
  };

  // 处理文件选择
  const handleFileSelect = (file: File) => {
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

    // 读取文件并转换为base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setFormData(prev => ({
        ...prev,
        imageData: result,
        imageFile: file
      }));
      setPreviewUrl(result);
    };
    reader.readAsDataURL(file);
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 提交表单
  const handleSubmit = async () => {
    if (!formData.patternName.trim()) {
      setError('请输入图案名称');
      return;
    }

    if (formData.patternName.length < 2) {
      setError('图案名称至少需要2个字符');
      return;
    }

    if (formData.patternName.length > 20) {
      setError('图案名称不能超过20个字符');
      return;
    }

    if (!formData.imageData) {
      setError('请上传图片');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // 生成幂等键
      const idempotencyKey = `custom_flag_purchase_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // 通过商店购买API创建自定义旗帜订单
      const response = await api.post('/store-payment/buy', {
        itemId: 'custom_flag_999', // 使用shop_skus中的自定义旗帜商品ID
        quantity: 1,
        adTitle: formData.patternName.trim(),
        adDescription: formData.patternDescription.trim(),
        imageData: formData.imageData
      }, {
        headers: {
          'x-idempotency-key': idempotencyKey
        }
      });

      if (response.data.ok) {
        // 成功提示
        logger.info('✅ 自定义旗帜订单创建成功');
        
        // 调用成功回调
        if (onSuccess) {
          onSuccess();
        }
        
        // 关闭对话框
        handleClose();
        
        // 显示成功消息（可以集成到全局通知系统）
        replaceAlert.success('订单创建成功！客服将在1-3个工作日内处理您的订单。');
      } else {
        setError(response.data.error || '创建订单失败');
      }
    } catch (error: any) {
      logger.error('❌ 创建自定义旗帜订单失败:', error);
      setError(error.response?.data?.error || '创建订单失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          key="custom-flag-dialog"
          style={dialogBackdropStyle}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={dialogSmallStyle}
          >
            {/* 头部 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <div
                  style={{
                    ...headerIconBgPurpleStyle,
                    width: '40px',
                    height: '40px'
                  }}
                >
                  <Sparkles className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: '16px',
                      fontWeight: 600,
                      color: COLORS.textDark,
                      margin: '0'
                    }}
                  >
                    自定义联盟旗帜
                  </h3>
                  <p
                    style={{
                      fontSize: '12px',
                      color: COLORS.textMuted,
                      margin: '2px 0 0 0'
                    }}
                  >
                    上传图片，AI智能处理生成个性化旗帜
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

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              {/* 图案名称 */}
              <div>
                <label
                  style={{
                    ...labelStyle,
                    marginBottom: '8px'
                  }}
                >
                  图案名称{' '}
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
                    ({formData.patternName.length}/20)
                  </span>
                </label>
                <Input
                  value={formData.patternName}
                  onChange={(value: string) => {
                    if (value.length <= 20) {
                      setFormData(prev => ({ ...prev, patternName: value }));
                    }
                  }}
                  placeholder="为您的自定义旗帜起个名字（最多20个字符）"
                  disabled={isSubmitting}
                  maxLength={20}
                />
                {formData.patternName.length > 16 && (
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#b45309',
                      marginTop: '4px'
                    }}
                  >
                    ⚠️ 图案名称接近长度限制
                  </p>
                )}
                {formData.patternName.length === 20 && (
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#991b1b',
                      marginTop: '4px'
                    }}
                  >
                    ❌ 已达到最大长度限制
                  </p>
                )}
              </div>

              {/* 图案描述 */}
              <div>
                <label
                  style={{
                    ...labelStyle,
                    marginBottom: '8px'
                  }}
                >
                  图案描述{' '}
                  <span
                    style={{
                      color: COLORS.textMuted
                    }}
                  >
                    (可选)
                  </span>
                </label>
                <Textarea
                  value={formData.patternDescription}
                  onChange={(value: string) => setFormData(prev => ({ ...prev, patternDescription: value }))}
                  placeholder="描述您的图案设计理念或特殊含义..."
                  rows={2}
                  disabled={isSubmitting}
                />
              </div>

              {/* 图片上传区域 */}
              <div>
                <label
                  style={{
                    ...labelStyle,
                    marginBottom: '8px'
                  }}
                >
                  上传图片{' '}
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
                      padding: '16px',
                      textAlign: 'center',
                      transition: 'all 0.3s ease',
                      borderColor: dragActive ? COLORS.purple : COLORS.borderGray,
                      backgroundColor: dragActive ? COLORS.bgPurple : 'white'
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
                        gap: '10px'
                      }}
                    >
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
                      </div>
                      
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isSubmitting}
                      >
                        <Image className="w-4 h-4 mr-2" />
                        选择文件
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      position: 'relative'
                    }}
                  >
                    {/* 隐藏的文件输入元素，用于重新选择 */}
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

                    <div
                      style={{
                        border: `1px solid ${COLORS.borderGray}`,
                        borderRadius: '8px',
                        padding: '12px',
                        backgroundColor: '#f9fafb'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '10px'
                        }}
                      >
                        {/* 图片预览区域 */}
                        <div
                          style={{
                            position: 'relative'
                          }}
                        >
                          <div
                            style={{
                              border: `2px dashed ${COLORS.borderGray}`,
                              borderRadius: '8px',
                              backgroundColor: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '160px',
                              height: '160px',
                              maxWidth: '160px',
                              maxHeight: '160px'
                            }}
                          >
                            <img
                              src={previewUrl}
                              alt="预览"
                              style={{
                                maxWidth: '180px',
                                maxHeight: '180px',
                                objectFit: 'contain'
                              }}
                            />
                          </div>
                        </div>
                        {/* 操作按钮 */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
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


                        {/* 提示信息 */}
                        <div
                          style={{
                            textAlign: 'center'
                          }}
                        >
                          <p
                            style={{
                              fontSize: '12px',
                              color: COLORS.textMuted
                            }}
                          >
                            图片预览，确认无误后提交订单
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 错误信息 */}
              {error && (
                <div
                  style={{
                    ...errorPanelStyle
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
            </div>

            {/* 操作按钮 */}
            <div
              style={{
                display: 'flex',
                gap: '10px',
                marginTop: '12px'
              }}
            >
              <button
                onClick={handleClose}
                style={{
                  ...cancelButtonStyle,
                  flex: 1,
                  padding: '10px 12px',
                  fontSize: '13px'
                }}
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.patternName.trim() || formData.patternName.length < 2 || formData.patternName.length > 20 || !formData.imageData}
                style={{
                  ...primaryButtonPurpleStyle,
                  flex: 1,
                  padding: '10px 12px',
                  fontSize: '13px',
                  opacity: isSubmitting || !formData.patternName.trim() || formData.patternName.length < 2 || formData.patternName.length > 20 || !formData.imageData ? 0.5 : 1,
                  cursor: isSubmitting || !formData.patternName.trim() || formData.patternName.length < 2 || formData.patternName.length > 20 || !formData.imageData ? 'not-allowed' : 'pointer'
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
                    创建订单 (2000积分)
                  </span>
                )}
              </button>
            </div>

            {/* 警告信息 */}
            <div
              style={{
                ...warningPanelStyle,
                marginTop: '12px'
              }}
            >
              <p
                style={{
                  fontSize: '12px',
                  color: '#78350f'
                }}
              >
                ⚠️ 请确保上传的图片符合社区规范，审核通过后即可在创建联盟时使用。
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
