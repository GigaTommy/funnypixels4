/**
 * 统一的对话框和模态框样式常量库
 * 用于保持整个应用中所有对话框的风格一致
 */

// ============ 字体定义 ============
const FONT_FAMILY = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", "思源黑体", "Noto Sans CJK SC", "Noto Sans SC", Roboto, sans-serif'
};

// ============ 背景蒙版样式 ============
export const dialogBackdropStyle = {
  position: 'fixed' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  zIndex: 10000,
  padding: '16px'
};

// ============ 对话框容器样式 ============
export const dialogContainerStyle = {
  backgroundColor: 'white',
  borderRadius: '16px',
  padding: '24px',
  width: '100%',
  maxHeight: '90vh',
  overflowY: 'auto' as const,
  position: 'relative' as const,
  zIndex: 10001,
  fontFamily: FONT_FAMILY.system
};

// 小尺寸对话框 (自定义旗帜等单列表单)
export const dialogSmallStyle = {
  ...dialogContainerStyle,
  maxWidth: '512px'
};

// 中等尺寸对话框 (广告购买等两列表单)
export const dialogMediumStyle = {
  ...dialogContainerStyle,
  maxWidth: '768px'
};

// 大尺寸对话框 (管理员审批面板等复杂表单)
export const dialogLargeStyle = {
  ...dialogContainerStyle,
  maxWidth: '1024px'
};

// ============ 头部样式 ============
export const dialogHeaderStyle = {
  display: 'flex' as const,
  alignItems: 'center' as const,
  justifyContent: 'space-between' as const,
  marginBottom: '16px'
};

export const dialogTitleStyle = {
  fontSize: '18px',
  fontWeight: 600,
  color: '#1f2937'
};

export const dialogSubtitleStyle = {
  fontSize: '14px',
  color: '#6b7280',
  marginTop: '4px'
};

export const closeButtonStyle = {
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  backgroundColor: '#f3f4f6',
  display: 'flex' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  border: 'none',
  cursor: 'pointer',
  transition: 'background-color 0.3s ease',
  color: '#4b5563'
};

// ============ 信息面板样式 ============
// 费用信息面板 - 紫色 (自定义旗帜)
export const infoPanelPurpleStyle = {
  backgroundColor: '#faf5ff',
  borderRadius: '12px',
  padding: '16px',
  marginBottom: '16px',
  border: '1px solid #e9d5ff'
};

// 费用信息面板 - 蓝色 (广告)
export const infoPanelBlueStyle = {
  backgroundColor: '#eff6ff',
  borderRadius: '12px',
  padding: '16px',
  marginBottom: '16px',
  border: '1px solid #bfdbfe'
};

// 错误信息面板
export const errorPanelStyle = {
  padding: '12px',
  backgroundColor: '#fee2e2',
  border: '1px solid #fecaca',
  borderRadius: '8px',
  display: 'flex' as const,
  alignItems: 'flex-start' as const,
  gap: '8px',
  marginTop: '16px'
};

// 成功/特色说明面板
export const featurePanelStyle = {
  padding: '12px',
  backgroundColor: '#f0fdf4',
  border: '1px solid #dcfce7',
  borderRadius: '8px',
  marginTop: '16px'
};

// 警告/提示面板
export const warningPanelStyle = {
  padding: '12px',
  backgroundColor: '#fef3c7',
  borderRadius: '8px',
  marginTop: '16px'
};

// ============ 表单标签样式 ============
export const labelStyle = {
  display: 'block' as const,
  fontSize: '14px',
  fontWeight: 500,
  color: '#374151',
  marginBottom: '8px'
};

export const labelRequiredStyle = {
  color: '#ef4444'
};

export const labelOptionalStyle = {
  color: '#6b7280'
};

// ============ 文件上传区域样式 ============
export const uploadAreaActiveStyle = {
  borderColor: '#a855f7',
  backgroundColor: '#faf5ff'
};

export const uploadAreaInactiveStyle = {
  borderColor: '#d1d5db',
  backgroundColor: 'white'
};

export const uploadIconStyle = {
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  backgroundColor: '#f3f4f6',
  display: 'flex' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const
};

// ============ 按钮样式 ============
// 取消按钮
export const cancelButtonStyle = {
  flex: 1,
  padding: '12px 16px',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 500,
  color: '#6b7280',
  backgroundColor: 'white',
  cursor: 'pointer',
  transition: 'all 0.3s ease'
};

// 主按钮 - 靛蓝色 (自定义旗帜、主操作)
export const primaryButtonPurpleStyle = {
  flex: 1,
  padding: '12px 16px',
  backgroundColor: '#4f46e5',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  boxShadow: '0 4px 12px rgba(79,70,229,0.2)'
};

// 主按钮 - 靛蓝色 (广告、主操作)
export const primaryButtonBlueStyle = {
  flex: 1,
  padding: '12px 16px',
  backgroundColor: '#4f46e5',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  boxShadow: '0 4px 12px rgba(79,70,229,0.2)'
};

// 主按钮 - 绿色 (充值/支付)
export const primaryButtonGreenStyle = {
  flex: 1,
  padding: '12px 16px',
  backgroundColor: '#16a34a',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'background-color 0.3s ease'
};

// ============ 网格布局样式 ============
export const gridTwoColumnStyle = {
  display: 'grid' as const,
  gridTemplateColumns: '1fr 1fr',
  gap: '24px'
};

// ============ 间距辅助 ============
export const spacingYStyle = (gap: number) => ({
  display: 'flex' as const,
  flexDirection: 'column' as const,
  gap: `${gap}px`
});

export const spacingXStyle = (gap: number) => ({
  display: 'flex' as const,
  flexDirection: 'row' as const,
  gap: `${gap}px`
});

// ============ 头部图标背景 ============
export const headerIconBgPurpleStyle = {
  width: '40px',
  height: '40px',
  backgroundColor: '#f3e8ff',
  borderRadius: '50%',
  display: 'flex' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const
};

export const headerIconBgBlueStyle = {
  width: '40px',
  height: '40px',
  backgroundColor: '#dbeafe',
  borderRadius: '50%',
  display: 'flex' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const
};

export const headerIconBgGreenStyle = {
  width: '40px',
  height: '40px',
  backgroundColor: '#dcfce7',
  borderRadius: '50%',
  display: 'flex' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const
};

// ============ 动画样式 ============
export const spinnerStyle = {
  display: 'flex' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  gap: '8px'
};

// ============ 颜色定义 ============
export const COLORS = {
  // 主色系
  purple: '#a855f7',
  blue: '#3b82f6',
  green: '#16a34a',

  // 背景色
  bgPurple: '#faf5ff',
  bgBlue: '#eff6ff',
  bgGreen: '#f0fdf4',
  bgGray: '#f9fafb',
  bgRed: '#fee2e2',
  bgYellow: '#fef3c7',

  // 边框色
  borderPurple: '#e9d5ff',
  borderBlue: '#bfdbfe',
  borderGreen: '#dcfce7',
  borderGray: '#d1d5db',
  borderRed: '#fecaca',

  // 文字色
  textDark: '#1f2937',
  textMuted: '#6b7280',
  textLight: '#9ca3af',
  textError: '#7f1d1d'
};

// ============ 辅助函数 ============
export const getDialogSizeStyle = (size: 'small' | 'medium' | 'large' = 'medium') => {
  switch (size) {
    case 'small':
      return dialogSmallStyle;
    case 'large':
      return dialogLargeStyle;
    default:
      return dialogMediumStyle;
  }
};

export const getPrimaryButtonStyle = (color: 'purple' | 'blue' | 'green' = 'blue') => {
  switch (color) {
    case 'purple':
      return primaryButtonPurpleStyle;
    case 'green':
      return primaryButtonGreenStyle;
    default:
      return primaryButtonBlueStyle;
  }
};

export const getHeaderIconBgStyle = (color: 'purple' | 'blue' | 'green' = 'blue') => {
  switch (color) {
    case 'purple':
      return headerIconBgPurpleStyle;
    case 'green':
      return headerIconBgGreenStyle;
    default:
      return headerIconBgBlueStyle;
  }
};

export const getInfoPanelStyle = (color: 'purple' | 'blue' = 'blue') => {
  return color === 'purple' ? infoPanelPurpleStyle : infoPanelBlueStyle;
};

// ============ 预设组合 ============
export const dialogPresets = {
  customFlag: {
    size: 'small',
    color: 'purple',
    infoPanelColor: 'purple'
  },
  advertisement: {
    size: 'medium',
    color: 'blue',
    infoPanelColor: 'blue'
  },
  recharge: {
    size: 'small',
    color: 'green',
    infoPanelColor: 'green'
  }
};
