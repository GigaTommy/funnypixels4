import React, { useState, useRef, useCallback, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Image, Settings, Eye, Save, Send, RotateCcw, Palette, Grid } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface PatternEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (patternData: PatternData) => void;
}

interface PatternData {
  name: string;
  description: string;
  imageData: string;
  width: number;
  height: number;
  colorCount: number;
  processingParams: ProcessingParams;
}

interface ProcessingParams {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  targetSize: '32x32' | '64x64' | '128x128';
  colorLimit: 64 | 128 | 256;
}

export const PatternEditor: React.FC<PatternEditorProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'process' | 'preview' | 'adjust'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);
  const [pixelatedImageUrl, setPixelatedImageUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 图案信息
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  // 处理参数
  const [processingParams, setProcessingParams] = useState<ProcessingParams>({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    sharpness: 0,
    targetSize: '64x64',
    colorLimit: 256
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    setOriginalImageUrl(url);
    
    // 自动切换到处理标签
    setActiveTab('process');
  }, []);

  // 处理图片
  const processImage = useCallback(async () => {
    if (!selectedFile || !canvasRef.current) return;

    setIsProcessing(true);
    setError(null);

    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('无法获取Canvas上下文');

      // 创建图片对象
      const img = new window.Image();
      img.onload = () => {
        // 设置Canvas尺寸
        const [width, height] = processingParams.targetSize.split('x').map(Number);
        canvas.width = width;
        canvas.height = height;

        // 绘制并处理图片
        ctx.drawImage(img, 0, 0, width, height);
        
        // 应用图像处理参数
        applyImageFilters(ctx, width, height);
        
        // 生成处理后的图片URL
        const processedUrl = canvas.toDataURL('image/png');
        setProcessedImageUrl(processedUrl);
        
        // 生成像素化预览
        generatePixelatedPreview(canvas, width, height);
        
        setIsProcessing(false);
        setActiveTab('preview');
      };
      
      img.src = URL.createObjectURL(selectedFile);
    } catch (error) {
      logger.error('图片处理失败:', error);
      setError('图片处理失败，请重试');
      setIsProcessing(false);
    }
  }, [selectedFile, processingParams]);

  // 应用图像滤镜
  const applyImageFilters = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // 应用亮度、对比度、饱和度调整
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // 亮度调整
      if (processingParams.brightness !== 0) {
        const factor = 1 + processingParams.brightness / 100;
        r = Math.min(255, Math.max(0, r * factor));
        g = Math.min(255, Math.max(0, g * factor));
        b = Math.min(255, Math.max(0, b * factor));
      }

      // 对比度调整
      if (processingParams.contrast !== 0) {
        const factor = 1 + processingParams.contrast / 100;
        r = Math.min(255, Math.max(0, (r - 128) * factor + 128));
        g = Math.min(255, Math.max(0, (g - 128) * factor + 128));
        b = Math.min(255, Math.max(0, (b - 128) * factor + 128));
      }

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }

    ctx.putImageData(imageData, 0, 0);
  };

  // 生成像素化预览
  const generatePixelatedPreview = (canvas: HTMLCanvasElement, width: number, height: number) => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // 颜色量化（减少颜色数量）
    const colorMap = new Map<string, number[]>();
    const colors: number[][] = [];

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      const colorKey = `${r},${g},${b},${a}`;
      
      if (!colorMap.has(colorKey)) {
        if (colors.length < processingParams.colorLimit) {
          colorMap.set(colorKey, [r, g, b, a]);
          colors.push([r, g, b, a]);
        }
      }
    }

    // 重新绘制像素化效果
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // 找到最接近的颜色
      let minDistance = Infinity;
      let closestColor = [r, g, b, a];

      for (const color of colors) {
        const distance = Math.sqrt(
          Math.pow(r - color[0], 2) +
          Math.pow(g - color[1], 2) +
          Math.pow(b - color[2], 2) +
          Math.pow(a - color[3], 2)
        );

        if (distance < minDistance) {
          minDistance = distance;
          closestColor = color;
        }
      }

      data[i] = closestColor[0];
      data[i + 1] = closestColor[1];
      data[i + 2] = closestColor[2];
      data[i + 3] = closestColor[3];
    }

    ctx.putImageData(imageData, 0, 0);
    
    // 生成像素化预览URL
    const pixelatedUrl = canvas.toDataURL('image/png');
    setPixelatedImageUrl(pixelatedUrl);
  };

  // 保存图案
  const handleSave = useCallback(() => {
    if (!processedImageUrl || !name.trim()) {
      setError('请填写图案名称并处理图片');
      return;
    }

    const patternData: PatternData = {
      name: name.trim(),
      description: description.trim(),
      imageData: processedImageUrl,
      width: parseInt(processingParams.targetSize.split('x')[0]),
      height: parseInt(processingParams.targetSize.split('x')[1]),
      colorCount: processingParams.colorLimit,
      processingParams
    };

    onSave(patternData);
  }, [processedImageUrl, name, description, processingParams, onSave]);

  // 重置编辑器
  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setOriginalImageUrl(null);
    setProcessedImageUrl(null);
    setPixelatedImageUrl(null);
    setName('');
    setDescription('');
    setProcessingParams({
      brightness: 0,
      contrast: 0,
      saturation: 0,
      sharpness: 0,
      targetSize: '64x64',
      colorLimit: 256
    });
    setActiveTab('upload');
    setError(null);
  }, []);

  // 清理资源
  useEffect(() => {
    return () => {
      if (originalImageUrl) {
        URL.revokeObjectURL(originalImageUrl);
      }
    };
  }, [originalImageUrl]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col"
      >
        {/* 头部 */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold">图案编辑器</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} icon={RotateCcw}>
              重置
            </Button>
            <Button variant="ghost" onClick={onClose}>
              ✕
            </Button>
          </div>
        </div>

        {/* 标签栏 */}
        <div className="flex border-b">
          {[
            { key: 'upload', label: '上传', icon: Upload },
            { key: 'process', label: '处理', icon: Settings },
            { key: 'preview', label: '预览', icon: Eye },
            { key: 'adjust', label: '调整', icon: Palette }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === 'upload' && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="p-6 h-full"
              >
                <Card>
                  <CardHeader>
                    <h3 className="text-lg font-semibold">上传图片</h3>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-lg">
                      <Upload size={48} className="text-gray-400 mb-4" />
                      <p className="text-gray-600 mb-4">点击选择图片或拖拽到此处</p>
                      <Button onClick={() => fileInputRef.current?.click()}>
                        选择图片
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </div>
                    {error && (
                      <p className="text-red-500 mt-4">{error}</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {activeTab === 'process' && (
              <motion.div
                key="process"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="p-6 h-full"
              >
                <div className="grid grid-cols-2 gap-6 h-full">
                  {/* 原始图片 */}
                  <Card>
                    <CardHeader>
                      <h3 className="text-lg font-semibold">原始图片</h3>
                    </CardHeader>
                    <CardContent>
                      {originalImageUrl && (
                        <img
                          src={originalImageUrl}
                          alt="原始图片"
                          className="w-full h-auto max-h-64 object-contain"
                        />
                      )}
                    </CardContent>
                  </Card>

                  {/* 处理参数 */}
                  <Card>
                    <CardHeader>
                      <h3 className="text-lg font-semibold">处理参数</h3>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">目标尺寸</label>
                        <select
                          value={processingParams.targetSize}
                          onChange={(e) => setProcessingParams(prev => ({
                            ...prev,
                            targetSize: e.target.value as any
                          }))}
                          className="w-full p-2 border rounded-md"
                        >
                          <option value="32x32">32x32</option>
                          <option value="64x64">64x64</option>
                          <option value="128x128">128x128</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">颜色数量</label>
                        <select
                          value={processingParams.colorLimit}
                          onChange={(e) => setProcessingParams(prev => ({
                            ...prev,
                            colorLimit: parseInt(e.target.value) as any
                          }))}
                          className="w-full p-2 border rounded-md"
                        >
                          <option value={64}>64色</option>
                          <option value={128}>128色</option>
                          <option value={256}>256色</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">
                          亮度: {processingParams.brightness}
                        </label>
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          value={processingParams.brightness}
                          onChange={(e) => setProcessingParams(prev => ({
                            ...prev,
                            brightness: parseInt(e.target.value)
                          }))}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">
                          对比度: {processingParams.contrast}
                        </label>
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          value={processingParams.contrast}
                          onChange={(e) => setProcessingParams(prev => ({
                            ...prev,
                            contrast: parseInt(e.target.value)
                          }))}
                          className="w-full"
                        />
                      </div>

                      <Button
                        onClick={processImage}
                        loading={isProcessing}
                        className="w-full"
                      >
                        {isProcessing ? '处理中...' : '处理图片'}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            )}

            {activeTab === 'preview' && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="p-6 h-full"
              >
                <div className="grid grid-cols-3 gap-6 h-full">
                  {/* 原始图片 */}
                  <Card>
                    <CardHeader>
                      <h3 className="text-lg font-semibold">原始图片</h3>
                    </CardHeader>
                    <CardContent>
                      {originalImageUrl && (
                        <img
                          src={originalImageUrl}
                          alt="原始图片"
                          className="w-full h-auto max-h-48 object-contain"
                        />
                      )}
                    </CardContent>
                  </Card>

                  {/* 处理后图片 */}
                  <Card>
                    <CardHeader>
                      <h3 className="text-lg font-semibold">处理后图片</h3>
                    </CardHeader>
                    <CardContent>
                      {processedImageUrl && (
                        <img
                          src={processedImageUrl}
                          alt="处理后图片"
                          className="w-full h-auto max-h-48 object-contain"
                        />
                      )}
                    </CardContent>
                  </Card>

                  {/* 像素化预览 */}
                  <Card>
                    <CardHeader>
                      <h3 className="text-lg font-semibold">像素化预览</h3>
                    </CardHeader>
                    <CardContent>
                      {pixelatedImageUrl && (
                        <img
                          src={pixelatedImageUrl}
                          alt="像素化预览"
                          className="w-full h-auto max-h-48 object-contain"
                        />
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* 图案信息 */}
                <div className="mt-6">
                  <Card>
                    <CardHeader>
                      <h3 className="text-lg font-semibold">图案信息</h3>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">图案名称 *</label>
                        <Input
                          value={name}
                          onChange={(value) => setName(value)}
                          placeholder="请输入图案名称"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">描述</label>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="请输入图案描述"
                          className="w-full p-2 border rounded-md h-20 resize-none"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            )}

            {activeTab === 'adjust' && (
              <motion.div
                key="adjust"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="p-6 h-full"
              >
                <Card>
                  <CardHeader>
                    <h3 className="text-lg font-semibold">高级调整</h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600">高级调整功能正在开发中...</p>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 底部操作栏 */}
        <div className="flex justify-between items-center p-6 border-t">
          <div className="text-sm text-gray-500">
            {activeTab === 'upload' && '请选择要处理的图片'}
            {activeTab === 'process' && '调整处理参数并处理图片'}
            {activeTab === 'preview' && '预览处理结果并填写图案信息'}
            {activeTab === 'adjust' && '进行高级调整'}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            {activeTab === 'preview' && (
              <Button onClick={handleSave} icon={Save}>
                保存图案
              </Button>
            )}
          </div>
        </div>

        {/* 隐藏的Canvas用于图片处理 */}
        <canvas ref={canvasRef} className="hidden" />
      </motion.div>
    </div>
  );
};
