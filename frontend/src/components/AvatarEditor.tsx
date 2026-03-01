import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, Palette, Grid, Download, RotateCcw, Check, X } from 'lucide-react';
import { Card, CardHeader, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';
import { logger } from '../utils/logger';

interface AvatarEditorProps {
  currentAvatar?: string;
  onSave: (avatarData: string) => void;
  onCancel: () => void;
  isOpen: boolean;
}

interface PixelData {
  x: number;
  y: number;
  color: string;
}

const AVATAR_SIZE = 32; // 32x32像素头像
const PIXEL_SIZE = 8; // 每个像素8px

const PRESET_COLORS = [
  // 第一行：红色系
  '#FF1744', '#FF5252', '#FF6E40', '#FF9100',
  // 第二行：黄色系
  '#FFD600', '#FFEA00', '#FFF000', '#FFEB3B',
  // 第三行：绿色系
  '#76FF03', '#00E676', '#00C853', '#1DE9B6',
  // 第四行：青色系
  '#00E5FF', '#00B8D4', '#0097A7', '#00838F',
  // 第五行：蓝色系
  '#2196F3', '#1976D2', '#1565C0', '#0D47A1',
  // 第六行：深蓝和紫色系
  '#512DA8', '#6A1B9A', '#7B1FA2', '#8E24AA',
  // 第七行：紫红色系
  '#AD1457', '#C2185B', '#E91E63', '#F06292',
  // 第八行：粉色系
  '#F48FB1', '#F8BBD0', '#FCE4EC', '#FFCCDD',
  // 第九行：橙色系
  '#FF6F00', '#E65100', '#D84315', '#BF360C',
  // 第十行：棕色系
  '#795548', '#6D4C41', '#5D4037', '#4E342E',
  // 第十一行：灰色系
  '#EEEEEE', '#E0E0E0', '#BDBDBD', '#9E9E9E',
  '#757575', '#616161', '#424242', '#212121',
  // 第十二行：中性色
  '#FFFFFF', '#F5F5F5', '#F0F0F0', '#E8E8E8',
  '#808080', '#666666', '#555555', '#333333',
  '#000000', '#1A1A1A', '#0D0D0D', '#050505'
];

export default function AvatarEditor({ currentAvatar, onSave, onCancel, isOpen }: AvatarEditorProps) {
  const toast = useToast();
  const [mode, setMode] = useState<'draw' | 'upload'>('draw');
  const [pixels, setPixels] = useState<PixelData[]>([]);
  const [selectedColor, setSelectedColor] = useState('#FF6B6B');
  const [isDrawing, setIsDrawing] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初始化像素网格
  const initializePixels = useCallback(() => {
    logger.debug('🔄 开始初始化像素网格，尺寸:', AVATAR_SIZE, 'x', AVATAR_SIZE);
    const newPixels: PixelData[] = [];
    for (let y = 0; y < AVATAR_SIZE; y++) {
      for (let x = 0; x < AVATAR_SIZE; x++) {
        newPixels.push({ x, y, color: '#FFFFFF' });
      }
    }
    logger.debug('✅ 像素网格初始化完成，像素数量:', newPixels.length);
    setPixels(newPixels);
  }, []);

  // 从现有头像加载像素数据
  const loadFromAvatar = useCallback((avatarUrl: string) => {
    logger.debug('🔄 开始从头像加载像素数据:', avatarUrl);
    
    if (!avatarUrl) {
      logger.warn('⚠️ 头像URL为空，使用默认初始化');
      initializePixels();
      return;
    }

    // 检查是否为压缩的像素数组数据
    if (avatarUrl.includes(',')) {
      logger.debug('🔄 检测到压缩的像素数组数据，开始解析...');
      try {
        const colorArray = avatarUrl.split(',');
        if (colorArray.length === AVATAR_SIZE * AVATAR_SIZE) {
          const newPixels: PixelData[] = [];
          for (let y = 0; y < AVATAR_SIZE; y++) {
            for (let x = 0; x < AVATAR_SIZE; x++) {
              const index = y * AVATAR_SIZE + x;
              const color = colorArray[index] || '#FFFFFF';
              newPixels.push({ x, y, color });
            }
          }
          logger.debug('✅ 压缩像素数据解析完成，像素数量:', newPixels.length);
          setPixels(newPixels);
          return;
        }
      } catch (error) {
        logger.warn('⚠️ 压缩数据解析失败，尝试作为图片URL加载:', error);
      }
    }

    // 如果不是压缩数据，按原来的方式加载图片
    logger.debug('🔄 按图片URL方式加载头像...');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      logger.debug('✅ 头像图片加载成功，尺寸:', img.width, 'x', img.height);
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        logger.error('❌ 无法获取Canvas上下文');
        initializePixels();
        return;
      }

      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;
      ctx.drawImage(img, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

      const imageData = ctx.getImageData(0, 0, AVATAR_SIZE, AVATAR_SIZE);
      const newPixels: PixelData[] = [];

      for (let y = 0; y < AVATAR_SIZE; y++) {
        for (let x = 0; x < AVATAR_SIZE; x++) {
          const index = (y * AVATAR_SIZE + x) * 4;
          const r = imageData.data[index];
          const g = imageData.data[index + 1];
          const b = imageData.data[index + 2];
          const color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          newPixels.push({ x, y, color });
        }
      }
      
      logger.debug('✅ 头像像素数据加载完成，像素数量:', newPixels.length);
      setPixels(newPixels);
    };
    
    img.onerror = () => {
      logger.error('❌ 头像图片加载失败，使用默认初始化');
      initializePixels();
    };
    
    img.src = avatarUrl;
  }, [initializePixels]);

  // 处理像素点击
  const handlePixelClick = useCallback((x: number, y: number) => {
    setPixels(prev => prev.map(pixel => 
      pixel.x === x && pixel.y === y ? { ...pixel, color: selectedColor } : pixel
    ));
  }, [selectedColor]);

  // 处理鼠标拖拽绘制
  const handleMouseDown = useCallback((x: number, y: number) => {
    setIsDrawing(true);
    handlePixelClick(x, y);
  }, [handlePixelClick]);

  const handleMouseEnter = useCallback((x: number, y: number) => {
    if (isDrawing) {
      handlePixelClick(x, y);
    }
  }, [isDrawing, handlePixelClick]);

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
  }, []);

  // 处理文件上传
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件类型和大小
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB限制
      toast.error('图片大小不能超过5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setUploadedImage(result);
      
      // 自动转换为像素头像
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        canvas.width = AVATAR_SIZE;
        canvas.height = AVATAR_SIZE;
        ctx.drawImage(img, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

        const imageData = ctx.getImageData(0, 0, AVATAR_SIZE, AVATAR_SIZE);
        const newPixels: PixelData[] = [];

        for (let y = 0; y < AVATAR_SIZE; y++) {
          for (let x = 0; x < AVATAR_SIZE; x++) {
            const index = (y * AVATAR_SIZE + x) * 4;
            const r = imageData.data[index];
            const g = imageData.data[index + 1];
            const b = imageData.data[index + 2];
            const color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            newPixels.push({ x, y, color });
          }
        }
        setPixels(newPixels);
        setMode('draw');
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  }, []);

  // 生成头像数据URL
  const generateAvatarDataURL = useCallback(() => {
    logger.info('🔄 开始生成头像数据URL，像素数量:', pixels.length);
    
    // 检查像素数据是否有效
    if (!pixels || pixels.length === 0) {
      logger.error('❌ 像素数据为空，无法生成头像');
      return '';
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      logger.error('❌ 无法获取Canvas上下文');
      return '';
    }

    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;

    // 填充白色背景
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);

    // 绘制像素
    pixels.forEach(pixel => {
      if (pixel && pixel.color && pixel.x !== undefined && pixel.y !== undefined) {
        ctx.fillStyle = pixel.color;
        ctx.fillRect(pixel.x, pixel.y, 1, 1);
      }
    });

    try {
      const dataURL = canvas.toDataURL('image/png');
      logger.info('✅ 头像数据URL生成成功，长度:', dataURL.length);
      return dataURL;
    } catch (error) {
      logger.error('❌ 生成头像数据URL失败:', error);
      return '';
    }
  }, [pixels]);

  // 生成高效压缩的像素数据
  const generateEfficientPixelData = useCallback(() => {
    const compressedData: string[] = [];
    for (let y = 0; y < AVATAR_SIZE; y++) {
      for (let x = 0; x < AVATAR_SIZE; x++) {
        const pixel = pixels.find(p => p.x === x && p.y === y);
        if (pixel) {
          compressedData.push(pixel.color);
        } else {
          compressedData.push('#FFFFFF'); // 默认白色
        }
      }
    }
    return compressedData.join(',');
  }, [pixels]);

  // 保存头像
  const handleSave = useCallback(async () => {
    logger.info('🔄 开始保存头像...');
    try {
      // 生成压缩的像素数组数据用于保存
      const compressedPixelData = generateEfficientPixelData();
      
      // 检查压缩数据是否有效
      if (!compressedPixelData || compressedPixelData === '') {
        logger.error('❌ 压缩头像数据生成失败，数据为空');
        toast.error('头像数据生成失败，请重试');
        return;
      }
      
      logger.debug('✅ 压缩头像数据生成完成，长度:', compressedPixelData.length);
      logger.debug('📊 压缩数据格式: 像素数组字符串');
      logger.debug('📊 压缩数据前100字符:', compressedPixelData.substring(0, 100));
      
      if (onSave && typeof onSave === 'function') {
        logger.debug('🔄 调用onSave回调函数...');
        logger.debug('📤 传递给onSave的数据类型:', typeof compressedPixelData);
        logger.debug('📤 传递给onSave的数据长度:', compressedPixelData.length);
        await onSave(compressedPixelData);
        logger.debug('✅ onSave回调函数执行完成');
      } else {
        logger.error('❌ onSave回调函数未定义或不是函数');
      }
    } catch (error) {
      logger.error('❌ 保存头像过程中发生错误:', error);
      toast.error('保存头像失败，请重试');
    }
  }, [generateEfficientPixelData, onSave]);

  // 重置头像
  const handleReset = useCallback(() => {
    if (currentAvatar) {
      loadFromAvatar(currentAvatar);
    } else {
      initializePixels();
    }
  }, [currentAvatar, loadFromAvatar, initializePixels]);

  // 清空头像
  const handleClear = useCallback(() => {
    initializePixels();
  }, [initializePixels]);

  // 处理取消
  const handleCancel = useCallback(() => {
    logger.info('🔄 用户点击取消按钮');
    if (onCancel && typeof onCancel === 'function') {
      onCancel();
    } else {
      logger.error('❌ onCancel回调函数未定义或不是函数');
    }
  }, [onCancel]);

  // 初始化
  React.useEffect(() => {
    logger.info('🔄 AvatarEditor 初始化，当前头像:', currentAvatar);
    
    if (currentAvatar && currentAvatar.trim() !== '') {
      logger.info('🔄 加载现有头像');
      loadFromAvatar(currentAvatar);
    } else {
      logger.info('🔄 使用默认像素网格初始化');
      initializePixels();
    }
  }, [currentAvatar, loadFromAvatar, initializePixels]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          key="avatar-editor-modal"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '16px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCancel();
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 30 }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 300,
              duration: 0.4
            }}
            style={{
              backgroundColor: 'white',
              borderRadius: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #f3f4f6',
              width: '100%',
              maxWidth: '1024px',
              maxHeight: '75vh',
              minHeight: '520px',
              overflow: 'hidden',
              position: 'relative',
              zIndex: 100000,
              marginBottom: '80px',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '24px',
              borderBottom: '1px solid #e5e7eb',
              backgroundColor: 'white',
              background: 'white'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: '#4f46e5',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Palette size={24} color="white" />
                </div>
                <div>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: 600,
                    color: '#111827',
                    margin: '0'
                  }}>编辑头像</h3>
                  <p style={{
                    fontSize: '14px',
                    color: '#9ca3af',
                    margin: '4px 0 0 0'
                  }}>创建你的像素风格头像</p>
                </div>
              </div>
              <button
                onClick={handleCancel}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#f3f4f6',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e5e7eb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                }}
              >
                <X size={20} color="#6b7280" />
              </button>
            </div>

            {/* 弹窗内容 - 可滚动区域 */}
            <div
              style={{
                padding: '20px 24px',
                overflowY: 'auto',
                flex: 1,
                minHeight: '0'
              }}
            >
              {/* 模式切换 */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '10px'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    backgroundColor: '#4f46e5',
                    borderRadius: '50%'
                  }}></div>
                  <h4 style={{
                    fontWeight: 600,
                    color: '#111827',
                    margin: '0',
                    fontSize: '14px'
                  }}>编辑模式</h4>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      logger.info('🔄 切换到像素绘制模式');
                      setMode('draw');
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      backgroundColor: mode === 'draw' ? '#4f46e5' : '#f3f4f6',
                      color: mode === 'draw' ? 'white' : '#6b7280',
                      boxShadow: mode === 'draw' ? '0 3px 10px rgba(79,70,229,0.15)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                    onMouseEnter={(e) => {
                      if (mode !== 'draw') {
                        e.currentTarget.style.backgroundColor = '#e5e7eb';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (mode !== 'draw') {
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                      }
                    }}
                  >
                    <Grid size={14} />
                    绘制
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      logger.info('🔄 切换到上传图片模式');
                      setMode('upload');
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      backgroundColor: mode === 'upload' ? '#4f46e5' : '#f3f4f6',
                      color: mode === 'upload' ? 'white' : '#6b7280',
                      boxShadow: mode === 'upload' ? '0 3px 10px rgba(79,70,229,0.15)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                    onMouseEnter={(e) => {
                      if (mode !== 'upload') {
                        e.currentTarget.style.backgroundColor = '#e5e7eb';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (mode !== 'upload') {
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                      }
                    }}
                  >
                    <Upload size={14} />
                    上传
                  </button>
                </div>
              </div>

              {/* 主要内容区域 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 280px',
                gap: '20px',
                alignItems: 'start'
              }}>
                {/* 左侧：绘制区域 */}
                <div>
                  {mode === 'draw' ? (
                    <div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '12px'
                      }}>
                        <div style={{
                          width: '8px',
                          height: '8px',
                          backgroundColor: '#16a34a',
                          borderRadius: '50%'
                        }}></div>
                        <h4 style={{
                          fontWeight: 600,
                          color: '#111827',
                          margin: '0',
                          fontSize: '14px'
                        }}>像素画布</h4>
                      </div>

                      {/* 工具按钮 */}
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            logger.info('🔄 重置按钮被点击');
                            handleReset();
                          }}
                          style={{
                            borderRadius: '10px',
                            backgroundColor: '#f3f4f6',
                            color: '#6b7280',
                            transition: 'all 0.2s ease',
                            padding: '8px 14px',
                            fontSize: '13px',
                            fontWeight: 600,
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#e5e7eb';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <RotateCcw size={14} />
                          重置
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            logger.info('🔄 清空按钮被点击');
                            handleClear();
                          }}
                          style={{
                            borderRadius: '10px',
                            backgroundColor: '#f3f4f6',
                            color: '#6b7280',
                            transition: 'all 0.2s ease',
                            padding: '8px 14px',
                            fontSize: '13px',
                            fontWeight: 600,
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#e5e7eb';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <X size={14} />
                          清空
                        </button>
                      </div>
                      
                      {/* 像素画布 */}
                      <div
                        style={{
                          width: AVATAR_SIZE * PIXEL_SIZE,
                          height: AVATAR_SIZE * PIXEL_SIZE,
                          border: '2px solid #d1d5db',
                          borderRadius: '50%',
                          overflow: 'hidden',
                          backgroundColor: 'white',
                          position: 'relative',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                          margin: '0 auto'
                        }}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                      >
                        {pixels.map((pixel, index) => (
                          <div
                            key={`pixel-${pixel.x}-${pixel.y}-${index}`}
                            style={{
                              position: 'absolute',
                              border: '1px solid #f3f4f6',
                              left: pixel.x * PIXEL_SIZE,
                              top: pixel.y * PIXEL_SIZE,
                              width: PIXEL_SIZE,
                              height: PIXEL_SIZE,
                              backgroundColor: pixel.color,
                              cursor: 'pointer'
                            }}
                            onClick={() => handlePixelClick(pixel.x, pixel.y)}
                            onMouseDown={() => handleMouseDown(pixel.x, pixel.y)}
                            onMouseEnter={() => handleMouseEnter(pixel.x, pixel.y)}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '16px'
                      }}>
                        <div style={{
                          width: '8px',
                          height: '8px',
                          backgroundColor: '#dc2626',
                          borderRadius: '50%'
                        }}></div>
                        <h4 style={{
                          fontWeight: 600,
                          color: '#111827',
                          margin: '0'
                        }}>图片上传</h4>
                      </div>

                      <div style={{
                        border: '2px dashed #d1d5db',
                        borderRadius: '16px',
                        padding: '32px',
                        textAlign: 'center',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#9ca3af';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#d1d5db';
                      }}>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          style={{ display: 'none' }}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            logger.info('🔄 选择图片按钮被点击');
                            fileInputRef.current?.click();
                          }}
                          style={{
                            display: 'inline-flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '24px',
                            borderRadius: '12px',
                            backgroundColor: '#f3f4f6',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#e5e7eb';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <Upload size={48} color="#9ca3af" />
                          <div>
                            <p style={{
                              fontSize: '18px',
                              fontWeight: 600,
                              color: '#374151',
                              margin: '0'
                            }}>选择图片</p>
                            <p style={{
                              fontSize: '14px',
                              color: '#9ca3af',
                              margin: '4px 0 0 0'
                            }}>支持 JPG、PNG 格式</p>
                          </div>
                        </button>
                      </div>

                      {uploadedImage && (
                        <div style={{ marginTop: '16px', textAlign: 'center' }}>
                          <p style={{
                            fontSize: '14px',
                            color: '#6b7280',
                            marginBottom: '12px'
                          }}>上传的图片将自动转换为32x32像素</p>
                          <img
                            src={uploadedImage}
                            alt="上传预览"
                            style={{
                              width: '128px',
                              height: '128px',
                              objectFit: 'cover',
                              borderRadius: '12px',
                              border: '2px solid #d1d5db',
                              margin: '0 auto',
                              display: 'block'
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 右侧：颜色选择器和预览 */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  width: '280px'
                }}>
                  {/* 颜色选择器 - 现代化紧凑设计 */}
                  <div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '12px'
                    }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        backgroundColor: '#4f46e5',
                        borderRadius: '50%'
                      }}></div>
                      <h4 style={{
                        fontWeight: 600,
                        color: '#111827',
                        margin: '0',
                        fontSize: '14px'
                      }}>颜色选择</h4>
                    </div>

                    {/* 预设颜色网格 - 8列高效显示64色 */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(8, 1fr)',
                      gap: '4px'
                    }}>
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setSelectedColor(color)}
                          title={color}
                          style={{
                            width: '100%',
                            aspectRatio: '1',
                            borderRadius: '6px',
                            border: selectedColor === color ? '2px solid #4f46e5' : '1px solid #e5e7eb',
                            backgroundColor: color,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            transform: selectedColor === color ? 'scale(1.05)' : 'scale(1)',
                            boxShadow: selectedColor === color ? '0 2px 8px rgba(79,70,229,0.2)' : 'none',
                            padding: '0'
                          }}
                          onMouseEnter={(e) => {
                            if (selectedColor !== color) {
                              e.currentTarget.style.transform = 'scale(1.05)';
                              e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = selectedColor === color ? 'scale(1.05)' : 'scale(1)';
                            e.currentTarget.style.boxShadow = selectedColor === color ? '0 2px 8px rgba(79,70,229,0.2)' : 'none';
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* 预览 */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '12px',
                      width: '100%'
                    }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        backgroundColor: '#4f46e5',
                        borderRadius: '50%'
                      }}></div>
                      <h4 style={{
                        fontWeight: 600,
                        color: '#111827',
                        margin: '0',
                        fontSize: '14px'
                      }}>预览效果</h4>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      width: '100%'
                    }}>
                      <div
                        style={{
                          borderRadius: '50%',
                          overflow: 'hidden',
                          boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
                          border: '4px solid white',
                          width: previewMode ? '120px' : '96px',
                          height: previewMode ? '120px' : '96px',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        <img
                          src={generateAvatarDataURL()}
                          alt="头像预览"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                      </div>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      marginTop: '12px',
                      gap: '8px',
                      width: '100%'
                    }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          logger.info('🔄 预览模式切换按钮被点击');
                          setPreviewMode(false);
                        }}
                        style={{
                          borderRadius: '8px',
                          backgroundColor: !previewMode ? '#4f46e5' : '#f3f4f6',
                          color: !previewMode ? 'white' : '#6b7280',
                          transition: 'all 0.2s ease',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          border: 'none',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          if (previewMode) {
                            e.currentTarget.style.backgroundColor = '#e5e7eb';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (previewMode) {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                          }
                        }}
                      >
                        常规
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          logger.info('🔄 预览模式切换按钮被点击');
                          setPreviewMode(true);
                        }}
                        style={{
                          borderRadius: '8px',
                          backgroundColor: previewMode ? '#4f46e5' : '#f3f4f6',
                          color: previewMode ? 'white' : '#6b7280',
                          transition: 'all 0.2s ease',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          border: 'none',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          if (!previewMode) {
                            e.currentTarget.style.backgroundColor = '#e5e7eb';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!previewMode) {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                          }
                        }}
                      >
                        放大
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 弹窗底部操作按钮 - 固定位置 */}
            <div style={{
              display: 'flex',
              gap: '12px',
              padding: '24px',
              borderTop: '1px solid #e5e7eb',
              backgroundColor: 'white',
              flexShrink: 0
            }}>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  logger.info('🔄 取消按钮被点击');
                  handleCancel();
                }}
                style={{
                  flex: 1,
                  borderRadius: '12px',
                  backgroundColor: '#f3f4f6',
                  color: '#6b7280',
                  transition: 'all 0.3s ease',
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e5e7eb';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  logger.info('🔄 保存按钮被点击');
                  handleSave();
                }}
                style={{
                  flex: 1,
                  borderRadius: '12px',
                  backgroundColor: '#16a34a',
                  color: 'white',
                  transition: 'all 0.3s ease',
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(22,163,74,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#15803d';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(22,163,74,0.3)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#16a34a';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(22,163,74,0.2)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <Check size={18} />
                保存头像
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
