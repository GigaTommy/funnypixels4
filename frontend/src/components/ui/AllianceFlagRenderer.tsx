import React, { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { patternCache, PatternData } from '../../patterns/patternCache';
import { materialLoaderService } from '../../services/materialLoaderService';

interface AllianceFlagRendererProps {
  patternId?: string;
  color?: string;
  emoji?: string;
  renderType?: 'color' | 'emoji' | 'complex' | 'image';
  payload?: string;
  encoding?: string;
  materialId?: string;
  materialMetadata?: any;
  size?: 'sm' | 'md' | 'lg' | number; // 支持数字像素值
  className?: string;
  // 新增：参考地图渲染逻辑的选项
  enableDynamicScaling?: boolean;
  containerSize?: number; // 容器大小（像素）
}

/**
 * 统一的联盟旗帜渲染器
 * 参考地图上的渲染逻辑，确保与地图显示一致
 */
export const AllianceFlagRenderer: React.FC<AllianceFlagRendererProps> = ({
  patternId,
  color,
  emoji,
  renderType = 'color',
  payload,
  encoding,
  materialId,
  materialMetadata,
  size = 'md',
  className = '',
  enableDynamicScaling = false,
  containerSize
}) => {
  const [patternData, setPatternData] = useState<PatternData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false); // 追踪Material加载失败

  // 计算实际渲染尺寸
  const calculateRenderSize = () => {
    // 如果指定了容器大小，使用容器大小
    if (containerSize) {
      return containerSize;
    }

    // 如果是数字，直接使用
    if (typeof size === 'number') {
      return size;
    }

    // 使用预设尺寸映射
    const sizeMap = {
      sm: 32,   // 小尺寸
      md: 40,   // 标准尺寸，匹配旗帜框
      lg: 48    // 大尺寸
    };

    return sizeMap[size];
  };

  // 动态emoji字体大小计算 - 参考地图逻辑
  const calculateEmojiFontSize = (containerSize: number) => {
    // 参考地图上的 fontSize = emojiSize * 0.8
    const fontSize = Math.max(12, Math.min(36, containerSize * 0.8));
    return fontSize;
  };

  // 动态emoji大小计算 - 参考地图逻辑
  const calculateEmojiSize = (containerSize: number) => {
    // 参考地图上的 emojiSize = Math.min(18, Math.max(4, Math.round(gridScreenSize * 0.85)))
    // 但这里简化为容器大小的85%
    const emojiSize = Math.max(8, Math.round(containerSize * 0.85));
    return emojiSize;
  };

  useEffect(() => {
    const loadPatternData = async () => {
      if (!patternId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setLoadError(false); // 重置加载错误状态

        logger.info('🎨 AllianceFlagRenderer: 开始加载图案，ID:', patternId);

        // 使用统一的图案缓存获取图案数据
        const pattern = await patternCache.getPattern(patternId);

        if (pattern) {
          logger.info('🎨 AllianceFlagRenderer: 成功获取图案数据:', {
            id: pattern.id,
            render_type: pattern.render_type,
            encoding: pattern.encoding,
            color: pattern.color,
            unicode_char: pattern.unicode_char,
            material_id: pattern.material_id
          });

          // 预加载Material系统图片
          if (pattern.material_id) {
            try {
              await materialLoaderService.preloadMaterials([pattern.material_id], 'sprite_sheet');
            } catch (error) {
              logger.warn('🎨 Material图片预加载失败:', error);
            }
          }

          setPatternData(pattern);
        }
      } catch (err) {
        logger.error('🎨 AllianceFlagRenderer: 加载图案数据失败:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPatternData();
  }, [patternId]);

  // 获取渲染信息
  const getRenderInfo = () => {
    const renderSize = calculateRenderSize();

    // 如果有直接提供的渲染类型，使用它
    if (renderType === 'emoji' && emoji) {
      return {
        type: 'emoji',
        emoji,
        fontSize: calculateEmojiFontSize(renderSize),
        emojiSize: calculateEmojiSize(renderSize)
      };
    }

    if (renderType === 'color' && color) {
      return {
        type: 'color',
        color
      };
    }

    // 从patternData中获取渲染信息
    if (patternData) {
      switch (patternData.render_type) {
        case 'color':
          return {
            type: 'color',
            color: patternData.color
          };
        case 'emoji':
          return {
            type: 'emoji',
            emoji: patternData.unicode_char || '🏴',
            fontSize: calculateEmojiFontSize(renderSize),
            emojiSize: calculateEmojiSize(renderSize)
          };
        case 'complex':
          return {
            type: 'complex',
            pattern: patternData
          };
        default:
          // Fallback: 检查unicode_char
          if (patternData.unicode_char) {
            return {
              type: 'emoji',
              emoji: patternData.unicode_char,
              fontSize: calculateEmojiFontSize(renderSize),
              emojiSize: calculateEmojiSize(renderSize)
            };
          }
          // 否则使用color
          if (patternData.color) {
            return {
              type: 'color',
              color: patternData.color
            };
          }
      }
    }

    // 默认fallback
    return {
      type: 'color',
      color: '#4F46E5' // 默认联盟旗帜颜色
    };
  };

  const renderContent = () => {
    const renderSize = calculateRenderSize();
    const renderInfo = getRenderInfo();

    const containerStyle: React.CSSProperties = {
      width: `${renderSize}px`,
      height: `${renderSize}px`,
      borderRadius: '6px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden'
    };

    switch (renderInfo.type) {
      case 'emoji':
        return (
          <div style={containerStyle}>
            <span
              style={{
                fontSize: `${renderInfo.fontSize}px`,
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {renderInfo.emoji}
            </span>
          </div>
        );

      case 'color':
        return (
          <div
            style={{
              ...containerStyle,
              background: renderInfo.color,
              imageRendering: 'pixelated'
            }}
          />
        );

      case 'complex':
        // 🔥 处理Material系统和复杂图案
        const pattern = renderInfo.pattern;

        // 优先使用Material系统（但要检查是否已经加载失败）
        if (pattern?.material_id && !loadError) {
          logger.info('🎨 AllianceFlagRenderer: 使用Material系统渲染，material_id:', pattern.material_id);
          try {
            const materialImageElement = materialLoaderService.getMaterialImageSync(pattern.material_id, 'sprite_sheet');

            if (materialImageElement) {
              logger.info('🎨 AllianceFlagRenderer: Material图片已加载，使用Material渲染');
              return (
                <div style={containerStyle}>
                  <img
                    src={materialImageElement.src}
                    alt={pattern.key || pattern.name || 'Material图案'}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      borderRadius: '4px',
                      imageRendering: 'pixelated'
                    }}
                    onError={(e) => {
                      // Material加载失败，设置错误状态以触发降级渲染
                      logger.warn(`🎨 AllianceFlagRenderer: Material ${pattern.material_id} 图片加载失败，降级到payload渲染`);
                      setLoadError(true);
                      e.currentTarget.style.display = 'none'; // 隐藏失败的图片
                    }}
                  />
                </div>
              );
            } else {
              logger.warn('🎨 AllianceFlagRenderer: Material图片未加载，降级到fallback渲染');
            }
          } catch (error) {
            logger.error('🎨 AllianceFlagRenderer: Material系统渲染失败:', error);
            setLoadError(true);
          }
        }

        // Fallback: 使用CustomPatternRenderer处理其他复杂图案
        if (pattern) {
          // 如果是因为Material加载失败而降级，记录日志
          if (loadError && pattern.material_id) {
            logger.info(`🎨 AllianceFlagRenderer: Material失败后降级渲染 - 使用${pattern.color ? 'color' : 'emoji'}作为fallback`);
          }

          return (
            <div style={containerStyle}>
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '4px',
                  backgroundColor: pattern.color || '#4F46E5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {/* 降级策略：优先color → emoji → 默认旗帜 */}
                {pattern.color ? (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: pattern.color,
                      borderRadius: '4px'
                    }}
                  />
                ) : pattern.emoji ? (
                  <span
                    style={{
                      fontSize: `${calculateEmojiFontSize(renderSize)}px`,
                      lineHeight: 1
                    }}
                  >
                    {pattern.emoji}
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: `${calculateEmojiFontSize(renderSize)}px`,
                      lineHeight: 1
                    }}
                  >
                    🏴
                  </span>
                )}
              </div>
            </div>
          );
        }

        // 最终fallback
        return (
          <div
            style={{
              ...containerStyle,
              backgroundColor: '#4F46E5'
            }}
          />
        );

      default:
        return (
          <div
            style={{
              ...containerStyle,
              backgroundColor: '#4F46E5',
              imageRendering: 'pixelated'
            }}
          />
        );
    }
  };

  if (loading) {
    const renderSize = calculateRenderSize();

    return (
      <div
        className={`rounded-sm bg-gray-200 animate-pulse ${className}`}
        style={{
          width: `${renderSize}px`,
          height: `${renderSize}px`,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
      />
    );
  }

  return (
    <div className={className}>
      {renderContent()}
    </div>
  );
};

export default AllianceFlagRenderer;