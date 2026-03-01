import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../../utils/logger';
import { patternCache, PatternManifest } from '../../patterns/patternCache';
import { api } from '../../services/api';
import { replaceAlert } from '../../utils/toastHelper';

interface PatternSelectorProps {
  selectedPatternId?: string;
  onPatternSelect: (patternId: string) => void;
  className?: string;
  showOnlyOwned?: boolean; // 是否只显示拥有的图案
  showBasicColors?: boolean; // 是否显示基础颜色选择
}

interface UserInventory {
  id: number;
  quantity: number;
  pattern_id: string;
  name: string;
  type: string;
}

// 基础颜色定义
const BASIC_COLORS = [
  { id: 'color_red', name: '红色', hex: '#FF0000' },
  { id: 'color_blue', name: '蓝色', hex: '#0000FF' },
  { id: 'color_green', name: '绿色', hex: '#00FF00' },
  { id: 'color_yellow', name: '黄色', hex: '#FFFF00' },
  { id: 'color_orange', name: '橙色', hex: '#FFA500' },
  { id: 'color_purple', name: '紫色', hex: '#800080' },
  { id: 'color_pink', name: '粉色', hex: '#FFC0CB' },
  { id: 'color_brown', name: '棕色', hex: '#A52A2A' },
  { id: 'color_black', name: '黑色', hex: '#000000' },
  { id: 'color_white', name: '白色', hex: '#FFFFFF' },
  { id: 'color_gray', name: '灰色', hex: '#808080' },
  { id: 'color_cyan', name: '青色', hex: '#00FFFF' },
  { id: 'color_magenta', name: '洋红', hex: '#FF00FF' },
  { id: 'color_lime', name: '青柠', hex: '#00FF00' },
  { id: 'color_navy', name: '海军蓝', hex: '#000080' },
  { id: 'color_teal', name: '蓝绿', hex: '#008080' },
  { id: 'color_olive', name: '橄榄绿', hex: '#808000' },
  { id: 'color_maroon', name: '栗色', hex: '#800000' },
  { id: 'color_silver', name: '银色', hex: '#C0C0C0' },
  { id: 'color_gold', name: '金色', hex: '#FFD700' }
];

export const PatternSelector: React.FC<PatternSelectorProps> = ({
  selectedPatternId,
  onPatternSelect,
  className = '',
  showOnlyOwned = false,
  showBasicColors = true // 默认显示基础颜色
}) => {
  const [patterns, setPatterns] = useState<PatternManifest[]>([]);
  const [userInventory, setUserInventory] = useState<UserInventory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 添加调试日志
  logger.info('PatternSelector 渲染:', {
    showBasicColors,
    showOnlyOwned,
    selectedPatternId,
    isLoading,
    patternsCount: patterns.length,
    userInventoryCount: userInventory.length
  });

  // 加载用户库存
  const loadUserInventory = useCallback(async () => {
    if (showBasicColors) {
      // 基础颜色模式下不需要加载用户库存
      logger.info('基础颜色模式：跳过用户库存加载');
      setUserInventory([]);
      return;
    }
    
    try {
      const response = await api.get('/store/inventory');
      setUserInventory(response.data || []);
    } catch (err) {
      logger.error('加载用户库存失败:', err);
      setUserInventory([]);
    }
  }, [showBasicColors]);

  // 加载图案清单
  const loadPatterns = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const manifest = await patternCache.getManifest();
      logger.info('加载图案清单成功:', manifest.length, '个图案');
      
      if (showOnlyOwned) {
        // 只显示用户拥有的图案
        const ownedPatternIds = new Set(userInventory.map(item => item.pattern_id));
        const ownedPatterns = manifest.filter(pattern => ownedPatternIds.has(pattern.id));
        setPatterns(ownedPatterns);
      } else {
        setPatterns(manifest);
      }
    } catch (err) {
      logger.error('加载图案失败:', err);
      setPatterns([]);
    } finally {
      setIsLoading(false);
    }
  }, [userInventory, showOnlyOwned]);

  // 选择图案
  const handlePatternSelect = useCallback((patternId: string) => {
    logger.info('选择图案:', patternId, 'showBasicColors:', showBasicColors);
    
    if (showBasicColors) {
      // 基础颜色模式下直接选择
      onPatternSelect(patternId);
      return;
    }
    
    // 检查用户是否拥有该图案
    const isOwned = userInventory.some(item => item.pattern_id === patternId);
    if (!isOwned) {
      replaceAlert.warning('您没有拥有该图案，请先购买');
      return;
    }
    onPatternSelect(patternId);
  }, [onPatternSelect, userInventory, showBasicColors]);

  // 检查用户是否拥有图案
  const isPatternOwned = useCallback((patternId: string) => {
    if (showBasicColors) return true; // 基础颜色都是免费的
    return userInventory.some(item => item.pattern_id === patternId);
  }, [userInventory, showBasicColors]);

  // 初始化
  useEffect(() => {
    logger.info('PatternSelector useEffect: showBasicColors =', showBasicColors);
    
    if (showBasicColors) {
      // 基础颜色模式：直接设置状态，不需要加载
      logger.info('基础颜色模式：设置初始状态');
      setUserInventory([]);
      setPatterns([]);
      setIsLoading(false);
    } else {
      logger.info('图案模式：开始加载用户库存');
      loadUserInventory();
    }
  }, [showBasicColors, loadUserInventory]);

  useEffect(() => {
    if (!showBasicColors && userInventory.length > 0) {
      loadPatterns();
    }
  }, [loadPatterns, userInventory, showBasicColors]);

  if (isLoading) {
    logger.info('PatternSelector: 显示加载状态');
    return (
      <div className={`pattern-selector ${className}`}>
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
        </div>
      </div>
    );
  }

  if (showOnlyOwned && patterns.length === 0 && !showBasicColors) {
    logger.info('PatternSelector: 显示无图案状态');
    return (
      <div className={`pattern-selector ${className}`}>
        <div className="text-center p-4 text-gray-500">
          您还没有拥有任何图案，请先购买
        </div>
      </div>
    );
  }

  logger.info('PatternSelector: 渲染主要内容，showBasicColors:', showBasicColors);

  return (
    <div className={`pattern-selector ${className}`}>
      {showBasicColors ? (
        /* 基础颜色选择模式 */
        <div className="p-4">
          <div className="mb-3">
            <h4 className="text-sm font-medium text-gray-700">基础颜色（免费使用）</h4>
            <p className="text-xs text-gray-500">选择基础颜色作为联盟旗帜</p>
          </div>
          <div className="grid grid-cols-8 gap-2">
            {BASIC_COLORS.map((color) => (
              <div
                key={color.id}
                className={`w-8 h-8 cursor-pointer transition-all rounded-sm border border-gray-300 ${
                  selectedPatternId === color.id
                    ? 'ring-2 ring-blue-500'
                    : 'hover:ring-1 hover:ring-gray-300'
                }`}
                onClick={() => handlePatternSelect(color.id)}
                title={color.name}
                style={{ 
                  backgroundColor: color.hex,
                  minWidth: '32px',
                  minHeight: '32px'
                }}
              />
            ))}
          </div>
          <div className="mt-4 text-xs text-gray-500">
            调试信息: 显示 {BASIC_COLORS.length} 个基础颜色
          </div>
        </div>
      ) : (
        /* 图案选择模式 */
        <div className="p-4">
          <div className="mb-3">
            <h4 className="text-sm font-medium text-gray-700">选择图案</h4>
            <p className="text-xs text-gray-500">选择您拥有的图案作为联盟旗帜</p>
          </div>
          <div className="grid grid-cols-8 gap-2">
            {patterns.map((pattern) => {
              const isOwned = isPatternOwned(pattern.id);
              return (
                <div
                  key={pattern.id}
                  className={`w-8 h-8 cursor-pointer transition-all rounded-sm ${
                    selectedPatternId === pattern.id
                      ? 'ring-2 ring-blue-500'
                      : isOwned
                        ? 'hover:ring-1 hover:ring-gray-300'
                        : 'opacity-50 cursor-not-allowed'
                  }`}
                  onClick={() => handlePatternSelect(pattern.id)}
                  title={`${pattern.key}${!isOwned ? ' (未拥有)' : ''}`}
                >
                  <PatternItem pattern={pattern} isOwned={isOwned} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// 极简图案项组件
interface PatternItemProps {
  pattern: PatternManifest;
  isOwned: boolean;
}

const PatternItem: React.FC<PatternItemProps> = ({ pattern, isOwned }) => {
  // 基础颜色映射
  const colorMap: { [key: string]: string } = {
    'red': '#FF0000',
    'blue': '#0000FF',
    'green': '#00FF00',
    'yellow': '#FFFF00',
    'orange': '#FFA500',
    'purple': '#800080',
    'pink': '#FFC0CB',
    'brown': '#A52A2A',
    'black': '#000000',
    'white': '#FFFFFF',
    'gray': '#808080',
    'cyan': '#00FFFF',
    'magenta': '#FF00FF',
    'lime': '#00FF00',
    'navy': '#000080',
    'teal': '#008080',
    'olive': '#808000',
    'maroon': '#800000',
    'silver': '#C0C0C0',
    'gold': '#FFD700'
  };

  // 检查是否是基础颜色
  if (pattern.key.startsWith('color_')) {
    const colorName = pattern.key.replace('color_', '');
    const color = colorMap[colorName] || '#CCCCCC';
    return (
      <div 
        className="w-full h-full rounded-sm"
        style={{ backgroundColor: color }}
      />
    );
  }

  // 其他图案显示为占位符
  return (
    <div className="w-full h-full bg-gray-200 rounded-sm flex items-center justify-center text-xs text-gray-600">
      图
    </div>
  );
};

export default PatternSelector;
