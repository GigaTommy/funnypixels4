import React, { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { patternCache } from '../../patterns/patternCache';
import { shouldLoadFlagPatternFromAPI } from '../../config/flag-patterns';

interface FlagIconProps {
  countryCode: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// 导入国旗数据
import countryFlagMapping from '../../data/country-flag-mapping.json';

export const FlagIcon: React.FC<FlagIconProps> = ({ 
  countryCode, 
  size = 'md',
  className = '' 
}) => {
  const [flagData, setFlagData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // 获取 emoji 国旗作为备选
  const getFlagEmoji = (countryCode: string) => {
    const lowerCode = countryCode.toLowerCase();
    const mapping = countryFlagMapping[lowerCode as keyof typeof countryFlagMapping];
    return mapping?.emoji || '🏳️';
  };

  // 从生成的国旗数据中获取信息
  useEffect(() => {
    const loadFlagData = async () => {
      const lowerCode = countryCode.toLowerCase();
      const mapping = countryFlagMapping[lowerCode as keyof typeof countryFlagMapping];

      if (mapping && shouldLoadFlagPatternFromAPI(lowerCode, mapping.key)) {
        setLoading(true);

        // 设置超时机制，2秒后自动降级到emoji
        const timeoutId = setTimeout(() => {
          logger.info(`Flag pattern loading timeout for ${mapping.key}, falling back to emoji`);
          setLoading(false);
        }, 2000);

        try {
          // 通过 patternCache 获取国旗数据
          const patternData = await patternCache.getPattern(mapping.key);
          if (patternData) {
            clearTimeout(timeoutId);
            setFlagData(patternData);
          }
        } catch (error) {
          clearTimeout(timeoutId);
          // 只在非预期错误时记录日志
          if (!(error as Error).message.includes('404')) {
            logger.warn('加载国旗数据失败:', error);
          }
          // 降级到emoji显示，不设置flagData
        } finally {
          clearTimeout(timeoutId);
          setLoading(false);
        }
      } else {
        // 如果配置不加载API数据，直接设置为非加载状态
        setLoading(false);
      }
    };

    loadFlagData();
  }, [countryCode]);


  // 如果有国旗数据，优先使用
  if (flagData && !loading) {
    return (
      <div 
        className={`${className} flex items-center justify-center`}
        style={{
          width: '28px',
          height: '28px',
          fontSize: '20px',
          imageRendering: 'pixelated',
          borderRadius: '6px'
        }}
        title={`${countryCode} flag`}
      >
        {flagData.unicode_char || getFlagEmoji(countryCode)}
      </div>
    );
  }

  // 备选方案：显示 emoji 国旗
  return (
    <div 
      className={`${className} flex items-center justify-center`}
      style={{
        width: '28px',
        height: '28px',
        fontSize: '20px',
        imageRendering: 'pixelated',
        borderRadius: '6px'
      }}
      title={`${countryCode} flag`}
    >
      {getFlagEmoji(countryCode)}
    </div>
  );
};

export default FlagIcon;
