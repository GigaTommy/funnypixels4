import React from 'react';
import { logger } from '../../utils/logger';
import { materialLoaderService } from '../../services/materialLoaderService';

interface CustomPatternRendererProps {
  encoding: string;
  payload: string;
  name: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  materialId?: string;  // 🔥 Material系统支持
  materialMetadata?: any;  // 🔥 Material元数据
}

export const CustomPatternRenderer: React.FC<CustomPatternRendererProps> = ({
  encoding,
  payload,
  name,
  className = '',
  size = 'md',
  materialId,  // 🔥 Material系统支持
  materialMetadata  // 🔥 Material元数据
}) => {
  // 🔧 统一尺寸与颜色旗帜一致
  const sizeClasses = {
    sm: 'w-5 h-5',      // 20px - 与颜色旗帜sm一致
    md: 'w-10 h-10',    // 40px - 与颜色旗帜md一致，匹配旗帜框
    lg: 'w-12 h-12'     // 48px - 与颜色旗帜lg一致
  };

  const renderPattern = () => {
    logger.info('🎨 CustomPatternRenderer: 开始渲染图案', {
      encoding,
      name,
      hasPayload: !!payload,
      hasMaterialId: !!materialId
    });

    // 🔥 优先处理Material系统
    if (materialId) {
      logger.info('🎨 CustomPatternRenderer: 检测到Material系统，material_id:', materialId);
      const materialImageElement = materialLoaderService.getMaterialImageSync(materialId, 'sprite_sheet');

      if (materialImageElement) {
        logger.info('🎨 CustomPatternRenderer: Material图片已加载，使用Material渲染');
        // getMaterialImageSync返回的是HTMLImageElement，获取其src
        return renderMaterialImage(materialImageElement.src);
      } else {
        logger.warn('🎨 CustomPatternRenderer: Material图片未加载，降级到fallback渲染');
        // 继续使用 fallback payload 渲染
      }
    }

    if (!payload) {
      logger.info('🎨 CustomPatternRenderer: 没有payload，显示默认图案');
      return renderDefaultPattern();
    }

    try {
      // ✅ 改进：处理Material System的preview数据
      // Material System存储preview数据，需要根据payload格式来判断编码类型
      if (encoding === 'material') {
        logger.info('🎨 CustomPatternRenderer: 处理Material System preview数据');

        // 判断payload格式
        if (payload.startsWith('data:image/') || /^[A-Za-z0-9+/=]+$/.test(payload)) {
          // 看起来像base64图像
          logger.info('🎨 CustomPatternRenderer: Material preview检测为base64格式');
          return renderBase64Image();
        } else if (payload.startsWith('[') || payload.startsWith('{')) {
          // 看起来像JSON（RLE或Hybrid）
          try {
            JSON.parse(payload);
            logger.info('🎨 CustomPatternRenderer: Material preview检测为JSON格式');
            return renderRLEPattern();
          } catch (e) {
            logger.warn('🎨 CustomPatternRenderer: Material preview JSON解析失败');
            return renderDefaultPattern();
          }
        } else {
          logger.info('🎨 CustomPatternRenderer: Material preview格式未知，显示默认图案');
          return renderDefaultPattern();
        }
      }

      switch (encoding) {
        case 'png_base64':
          return renderBase64Image();

        case 'rle':
          return renderRLEPattern();

        case 'hybrid':
          return renderHybridPattern();

        default:
          logger.info('🎨 CustomPatternRenderer: 未知编码类型，显示默认图案');
          return renderDefaultPattern();
      }
    } catch (error) {
      logger.error('🎨 CustomPatternRenderer: 渲染失败:', error);
      return renderDefaultPattern();
    }
  };

  const renderMaterialImage = (materialImage: string) => {
    logger.info('🎨 CustomPatternRenderer: 渲染Material图片');

    // 🔧 统一尺寸映射，与颜色旗帜一致
    const sizePixels = {
      sm: '20px',   // 与颜色旗帜sm一致
      md: '24px',   // 与颜色旗帜md一致
      lg: '32px'    // 与颜色旗帜lg一致
    };

    return (
      <img
        src={materialImage}
        alt={name}
        className={`${sizeClasses[size]} rounded-lg object-contain ${className}`}
        style={{
          imageRendering: 'pixelated',
          minWidth: sizePixels[size],
          minHeight: sizePixels[size],
          maxWidth: sizePixels[size],
          maxHeight: sizePixels[size],
          border: '1px solid rgba(0,0,0,0.1)'
        }}
        onLoad={() => logger.info('🎨 CustomPatternRenderer: Material图片加载成功')}
        onError={(e) => {
          logger.error('🎨 CustomPatternRenderer: Material图片加载失败:', e);
        }}
      />
    );
  };

  const renderBase64Image = () => {
    logger.info('🎨 CustomPatternRenderer: 渲染base64图像');

    // 确保base64数据格式正确
    let imageSrc = payload;
    if (!payload.startsWith('data:image/')) {
      imageSrc = `data:image/png;base64,${payload}`;
    }

    // 🔧 统一尺寸映射，与颜色旗帜一致
    const sizePixels = {
      sm: '20px',   // 与颜色旗帜sm一致
      md: '24px',   // 与颜色旗帜md一致
      lg: '32px'    // 与颜色旗帜lg一致
    };

    return (
      <img
        src={imageSrc}
        alt={name}
        className={`${sizeClasses[size]} rounded-lg object-contain ${className}`}
        style={{
          imageRendering: 'pixelated',
          minWidth: sizePixels[size],
          minHeight: sizePixels[size],
          maxWidth: sizePixels[size],
          maxHeight: sizePixels[size],
          border: '1px solid rgba(0,0,0,0.1)'
        }}
        onLoad={() => logger.info('🎨 CustomPatternRenderer: base64图像加载成功')}
        onError={(e) => {
          logger.error('🎨 CustomPatternRenderer: base64图像加载失败:', e);
          // 图像加载失败时的处理
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';

          // 创建默认显示元素
          const fallback = document.createElement('div');
          fallback.className = `${sizeClasses[size]} rounded-lg bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold`;
          fallback.textContent = name.charAt(0).toUpperCase();
          fallback.title = `${name} (图像加载失败)`;

          target.parentNode?.insertBefore(fallback, target.nextSibling);
        }}
      />
    );
  };

  const renderRLEPattern = () => {
    logger.info('🎨 CustomPatternRenderer: 渲染RLE图案');
    try {
      const rleData = JSON.parse(payload);
      if (!Array.isArray(rleData) || rleData.length === 0) {
        logger.info('🎨 CustomPatternRenderer: RLE数据格式无效');
        return renderDefaultPattern();
      }

      // 🔧 统一尺寸映射，与颜色旗帜一致
      const sizePixels = {
        sm: '20px',   // 与颜色旗帜sm一致
        md: '24px',   // 与颜色旗帜md一致
        lg: '32px'    // 与颜色旗帜lg一致
      };

      // 假设是64x64的图案，根据显示尺寸调整像素大小
      const width = 64;
      const height = 64;
      const displaySize = parseInt(sizePixels[size]);
      const pixelSize = displaySize / width;  // 每个格子的实际像素大小

      // 创建像素网格
      const pixels = [];
      let pixelIndex = 0;

      for (const segment of rleData) {
        const { color, count } = segment;
        for (let i = 0; i < count && pixelIndex < width * height; i++) {
          pixels.push({
            color: color === 'transparent' ? 'transparent' : color,
            x: pixelIndex % width,
            y: Math.floor(pixelIndex / width)
          });
          pixelIndex++;
        }
      }

      logger.info('🎨 CustomPatternRenderer: RLE像素数量:', pixels.length);

      return (
        <div
          className={`${sizeClasses[size]} rounded-lg border border-gray-400 overflow-hidden ${className}`}
          style={{
            minWidth: sizePixels[size],
            minHeight: sizePixels[size],
            maxWidth: sizePixels[size],
            maxHeight: sizePixels[size],
            display: 'grid',
            gridTemplateColumns: `repeat(${width}, ${pixelSize}px)`,
            gridTemplateRows: `repeat(${height}, ${pixelSize}px)`,
            gap: '0'
          }}
          title={`${name} (RLE图案)`}
        >
          {pixels.map((pixel, index) => (
            <div
              key={index}
              style={{
                width: `${pixelSize}px`,
                height: `${pixelSize}px`,
                backgroundColor: pixel.color === 'transparent' ? 'transparent' : pixel.color,
                gridColumn: pixel.x + 1,
                gridRow: pixel.y + 1
              }}
            />
          ))}
        </div>
      );
    } catch (error) {
      logger.error('🎨 CustomPatternRenderer: 解析RLE数据失败:', error);
      return renderDefaultPattern();
    }
  };

  const renderHybridPattern = () => {
    logger.info('🎨 CustomPatternRenderer: 渲染hybrid图案');
    try {
      const hybridData = JSON.parse(payload);

      // 🔧 统一尺寸映射，与颜色旗帜一致
      const sizePixels = {
        sm: '20px',   // 与颜色旗帜sm一致
        md: '24px',   // 与颜色旗帜md一致
        lg: '32px'    // 与颜色旗帜lg一致
      };

      // 优先显示base64图像
      if (hybridData.base64Image) {
        return (
          <img
            src={hybridData.base64Image}
            alt={name}
            className={`${sizeClasses[size]} rounded-lg object-contain ${className}`}
            style={{
              imageRendering: 'pixelated',
              minWidth: sizePixels[size],
              minHeight: sizePixels[size],
              maxWidth: sizePixels[size],
              maxHeight: sizePixels[size]
            }}
            onLoad={() => logger.info('🎨 CustomPatternRenderer: hybrid图像加载成功')}
            onError={(e) => {
              logger.error('🎨 CustomPatternRenderer: hybrid图像加载失败:', e);
              return renderDefaultPattern();
            }}
          />
        );
      }

      // 如果有RLE数据，渲染RLE图案
      if (hybridData.rleData && Array.isArray(hybridData.rleData)) {
        const colorStats: { [key: string]: number } = {};
        hybridData.rleData.forEach((segment: { color: string; count: number }) => {
          if (segment.color && segment.color !== 'transparent') {
            colorStats[segment.color] = (colorStats[segment.color] || 0) + segment.count;
          }
        });

        const dominantColor = Object.keys(colorStats).reduce((a, b) => 
          colorStats[a] > colorStats[b] ? a : b, '#000000'
        );

        return (
          <div
            className={`${sizeClasses[size]} rounded-lg border border-gray-400 ${className}`}
            style={{
              backgroundColor: dominantColor,
              minWidth: sizePixels[size],
              minHeight: sizePixels[size],
              maxWidth: sizePixels[size],
              maxHeight: sizePixels[size]
            }}
            title={`${name} (Hybrid图案)`}
          />
        );
      }

      logger.info('🎨 CustomPatternRenderer: hybrid数据格式无效');
      return renderDefaultPattern();
    } catch (error) {
      logger.error('🎨 CustomPatternRenderer: 解析hybrid数据失败:', error);
      return renderDefaultPattern();
    }
  };

  const renderDefaultPattern = () => {
    logger.info('🎨 CustomPatternRenderer: 渲染默认图案');

    // 🔧 统一尺寸映射，与颜色旗帜一致
    const sizePixels = {
      sm: '20px',   // 与颜色旗帜sm一致
      md: '24px',   // 与颜色旗帜md一致
      lg: '32px'    // 与颜色旗帜lg一致
    };

    return (
      <div
        className={`${sizeClasses[size]} rounded-lg bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold ${className}`}
        style={{
          minWidth: sizePixels[size],
          minHeight: sizePixels[size],
          maxWidth: sizePixels[size],
          maxHeight: sizePixels[size]
        }}
        title={name}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  };

  return renderPattern();
};

export default CustomPatternRenderer;
