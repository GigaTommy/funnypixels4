/**
 * 设备适配使用示例
 * 展示如何在现有组件中集成设备类型检测和屏幕适配
 */

import React from 'react';
import { useDeviceAdaptation, useDeviceStyles, useDeviceLayout } from '../hooks/useDeviceAdaptation';
import { DeviceAdaptiveContainer, DeviceAdaptiveButton, DeviceAdaptiveText } from '../components/ui/DeviceAdaptiveContainer';

/**
 * 示例1：基础设备检测
 */
export const BasicDeviceDetectionExample: React.FC = () => {
  const { 
    deviceInfo, 
    isMobile, 
    isTablet, 
    isDesktop, 
    isTouchDevice,
    orientation,
    screenSize 
  } = useDeviceAdaptation();

  return (
    <DeviceAdaptiveContainer padding="medium" gap="small">
      <DeviceAdaptiveText variant="title">设备信息</DeviceAdaptiveText>
      
      <DeviceAdaptiveContainer layout="flex" direction="row" gap="medium">
        <DeviceAdaptiveText variant="normal">设备类型:</DeviceAdaptiveText>
        <DeviceAdaptiveText variant="normal" color="#007bff">
          {isMobile ? '📱 移动端' : isTablet ? '📱 平板' : '💻 桌面端'}
        </DeviceAdaptiveText>
      </DeviceAdaptiveContainer>

      <DeviceAdaptiveContainer layout="flex" direction="row" gap="medium">
        <DeviceAdaptiveText variant="normal">屏幕方向:</DeviceAdaptiveText>
        <DeviceAdaptiveText variant="normal" color="#28a745">
          {orientation === 'landscape' ? '🔄 横屏' : '📱 竖屏'}
        </DeviceAdaptiveText>
      </DeviceAdaptiveContainer>

      <DeviceAdaptiveContainer layout="flex" direction="row" gap="medium">
        <DeviceAdaptiveText variant="normal">触摸设备:</DeviceAdaptiveText>
        <DeviceAdaptiveText variant="normal" color={isTouchDevice ? '#28a745' : '#dc3545'}>
          {isTouchDevice ? '✅ 是' : '❌ 否'}
        </DeviceAdaptiveText>
      </DeviceAdaptiveContainer>

      {screenSize && (
        <DeviceAdaptiveContainer layout="flex" direction="row" gap="medium">
          <DeviceAdaptiveText variant="normal">屏幕尺寸:</DeviceAdaptiveText>
          <DeviceAdaptiveText variant="normal" color="#6c757d">
            {screenSize.width} × {screenSize.height}
          </DeviceAdaptiveText>
        </DeviceAdaptiveContainer>
      )}
    </DeviceAdaptiveContainer>
  );
};

/**
 * 示例2：响应式布局
 */
export const ResponsiveLayoutExample: React.FC = () => {
  const { isMobile, isTablet, isDesktop } = useDeviceAdaptation();
  const deviceLayout = useDeviceLayout();

  return (
    <DeviceAdaptiveContainer padding="large" gap="medium">
      <DeviceAdaptiveText variant="title">响应式布局</DeviceAdaptiveText>
      
      {/* 根据设备类型显示不同的布局 */}
      <DeviceAdaptiveContainer 
        layout="grid" 
        gap="medium"
        padding="medium"
        style={{ backgroundColor: '#f8f9fa', borderRadius: '8px' }}
      >
        <DeviceAdaptiveContainer 
          padding="medium" 
          style={{ backgroundColor: '#e3f2fd', borderRadius: '4px' }}
        >
          <DeviceAdaptiveText variant="large" weight="bold">卡片 1</DeviceAdaptiveText>
          <DeviceAdaptiveText variant="small">
            网格列数: {deviceLayout.grid.columns}
          </DeviceAdaptiveText>
        </DeviceAdaptiveContainer>

        <DeviceAdaptiveContainer 
          padding="medium" 
          style={{ backgroundColor: '#f3e5f5', borderRadius: '4px' }}
        >
          <DeviceAdaptiveText variant="large" weight="bold">卡片 2</DeviceAdaptiveText>
          <DeviceAdaptiveText variant="small">
            设备类型: {isMobile ? '移动端' : isTablet ? '平板' : '桌面端'}
          </DeviceAdaptiveText>
        </DeviceAdaptiveContainer>

        <DeviceAdaptiveContainer 
          padding="medium" 
          style={{ backgroundColor: '#e8f5e8', borderRadius: '4px' }}
        >
          <DeviceAdaptiveText variant="large" weight="bold">卡片 3</DeviceAdaptiveText>
          <DeviceAdaptiveText variant="small">
            间距: {deviceLayout.grid.gap}px
          </DeviceAdaptiveText>
        </DeviceAdaptiveContainer>
      </DeviceAdaptiveContainer>
    </DeviceAdaptiveContainer>
  );
};

/**
 * 示例3：设备特定的UI组件
 */
export const DeviceSpecificUIExample: React.FC = () => {
  const { isMobile, isTablet, isDesktop } = useDeviceAdaptation();
  const deviceStyles = useDeviceStyles();

  return (
    <DeviceAdaptiveContainer padding="large" gap="medium">
      <DeviceAdaptiveText variant="title">设备特定UI</DeviceAdaptiveText>
      
      {/* 按钮组 - 根据设备类型调整大小 */}
      <DeviceAdaptiveContainer layout="flex" direction="row" gap="small" align="center">
        <DeviceAdaptiveButton 
          variant="primary" 
          size={isMobile ? 'small' : isTablet ? 'medium' : 'large'}
        >
          主要按钮
        </DeviceAdaptiveButton>
        
        <DeviceAdaptiveButton 
          variant="outline" 
          size={isMobile ? 'small' : 'medium'}
        >
          次要按钮
        </DeviceAdaptiveButton>
      </DeviceAdaptiveContainer>

      {/* 文本大小示例 */}
      <DeviceAdaptiveContainer gap="small">
        <DeviceAdaptiveText variant="small">小号文本 (设备适配)</DeviceAdaptiveText>
        <DeviceAdaptiveText variant="normal">正常文本 (设备适配)</DeviceAdaptiveText>
        <DeviceAdaptiveText variant="large">大号文本 (设备适配)</DeviceAdaptiveText>
        <DeviceAdaptiveText variant="title">标题文本 (设备适配)</DeviceAdaptiveText>
      </DeviceAdaptiveContainer>

      {/* 条件显示内容 */}
      <DeviceAdaptiveContainer 
        padding="medium" 
        style={{ backgroundColor: '#fff3cd', borderRadius: '8px' }}
        showOnlyOnMobile
      >
        <DeviceAdaptiveText variant="normal" weight="bold">
          📱 仅在移动端显示的内容
        </DeviceAdaptiveText>
      </DeviceAdaptiveContainer>

      <DeviceAdaptiveContainer 
        padding="medium" 
        style={{ backgroundColor: '#d1ecf1', borderRadius: '8px' }}
        showOnlyOnDesktop
      >
        <DeviceAdaptiveText variant="normal" weight="bold">
          💻 仅在桌面端显示的内容
        </DeviceAdaptiveText>
      </DeviceAdaptiveContainer>
    </DeviceAdaptiveContainer>
  );
};

/**
 * 示例4：地图组件适配
 */
export const MapAdaptationExample: React.FC = () => {
  const { config, isMobile, isTablet, isDesktop } = useDeviceAdaptation();

  return (
    <DeviceAdaptiveContainer padding="large" gap="medium">
      <DeviceAdaptiveText variant="title">地图适配配置</DeviceAdaptiveText>
      
      <DeviceAdaptiveContainer 
        padding="medium" 
        style={{ backgroundColor: '#f8f9fa', borderRadius: '8px' }}
      >
        <DeviceAdaptiveText variant="large" weight="bold">地图配置</DeviceAdaptiveText>
        
        <DeviceAdaptiveContainer layout="flex" direction="row" gap="medium">
          <DeviceAdaptiveText variant="normal">默认缩放:</DeviceAdaptiveText>
          <DeviceAdaptiveText variant="normal" color="#007bff">
            {config.mapZoom}级
          </DeviceAdaptiveText>
        </DeviceAdaptiveContainer>

        <DeviceAdaptiveContainer layout="flex" direction="row" gap="medium">
          <DeviceAdaptiveText variant="normal">控制按钮大小:</DeviceAdaptiveText>
          <DeviceAdaptiveText variant="normal" color="#28a745">
            {config.controlSize}px
          </DeviceAdaptiveText>
        </DeviceAdaptiveContainer>

        <DeviceAdaptiveContainer layout="flex" direction="row" gap="medium">
          <DeviceAdaptiveText variant="normal">紧凑模式:</DeviceAdaptiveText>
          <DeviceAdaptiveText variant="normal" color={config.isCompactMode ? '#28a745' : '#dc3545'}>
            {config.isCompactMode ? '✅ 启用' : '❌ 禁用'}
          </DeviceAdaptiveText>
        </DeviceAdaptiveContainer>

        <DeviceAdaptiveContainer layout="flex" direction="row" gap="medium">
          <DeviceAdaptiveText variant="normal">触摸手势:</DeviceAdaptiveText>
          <DeviceAdaptiveText variant="normal" color={config.enableTouchGestures ? '#28a745' : '#dc3545'}>
            {config.enableTouchGestures ? '✅ 启用' : '❌ 禁用'}
          </DeviceAdaptiveText>
        </DeviceAdaptiveContainer>
      </DeviceAdaptiveContainer>
    </DeviceAdaptiveContainer>
  );
};

/**
 * 主示例组件
 */
export const DeviceAdaptationExample: React.FC = () => {
  return (
    <DeviceAdaptiveContainer padding="large" gap="large" fullWidth>
      <DeviceAdaptiveText variant="title" align="center">
        设备适配系统示例
      </DeviceAdaptiveText>
      
      <BasicDeviceDetectionExample />
      <ResponsiveLayoutExample />
      <DeviceSpecificUIExample />
      <MapAdaptationExample />
    </DeviceAdaptiveContainer>
  );
};
