import React from 'react';
import AllianceFlagRenderer from './AllianceFlagRenderer';

interface AllianceFlagIconProps {
  allianceFlagKey?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const AllianceFlagIcon: React.FC<AllianceFlagIconProps> = ({
  allianceFlagKey,
  size = 'md',
  className = ''
}) => {
  // 直接使用统一的渲染器，参考地图渲染逻辑
  return (
    <AllianceFlagRenderer
      patternId={allianceFlagKey}
      size={size}
      className={className}
      enableDynamicScaling={true}
    />
  );
};

export default AllianceFlagIcon;
