import React, { useState, useEffect } from 'react';
import { logger } from '../utils/logger';
import { config } from '../config/env';
import { CustomPatternRenderer } from './ui/CustomPatternRenderer';
import AllianceFlagRenderer from './ui/AllianceFlagRenderer';
import { patternCache, PatternData as CachePatternData } from '../patterns/patternCache';
import { materialLoaderService } from '../services/materialLoaderService';

interface AllianceFlagProps {
  flagPatternId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// 使用统一的PatternData类型
type PatternData = CachePatternData;

// PatternInfo接口已不再需要，因为使用统一的PatternData

export const AllianceFlag: React.FC<AllianceFlagProps> = ({
  flagPatternId,
  size = 'md',
  className = ''
}) => {
  // 直接使用统一的渲染器，参考地图渲染逻辑
  return (
    <AllianceFlagRenderer
      patternId={flagPatternId}
      size={size}
      className={className}
      enableDynamicScaling={true}
    />
  );
};
