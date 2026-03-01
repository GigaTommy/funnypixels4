/**
 * Z-Index 层级规范配置
 *
 * 按照UI设计规范，所有z-index值都应该使用此配置
 * 禁止在组件中硬编码z-index数值
 *
 * 层级原则：
 * 1. 基础层：地图底图、Canvas绘制层
 * 2. 交互层：用户可交互的UI控件
 * 3. 信息层：信息展示、卡片、面板
 * 4. 模态层：弹窗、对话框、覆盖层
 * 5. 系统层：系统级UI、通知、调试工具
 */

export const Z_INDEX = {
  // ===== 基础层 (1-99) =====
  // 地图底图和基础绘制层
  MAP_BASE: 1,                    // 地图底图
  TILE_OVERLAYS: 20,              // 瓦片覆盖层

  // 基础UI装饰
  LOADING_INDICATOR: 30,          // 加载提示
  DECORATIVE_ELEMENTS: 40,        // 装饰性元素

  // ===== 地图绘制层 (100-899) =====
  // Canvas和地图覆盖物层
  MAP_SEARCH_BAR: 100,            // 地图搜索栏
  MINI_INFO_DISPLAY: 110,         // 小型信息显示
  CANVAS_LAYER: 700,              // Canvas绘制层（像素格子）- 必须高于网格线
  EMOJI_PIXELS: 800,              // Emoji像素元素
  GRID_LINES: 500,                // 网格线
  PENDING_TILE_LAYER: 610,        // 待处理瓦片层

  // ===== 交互层 (900-999) =====
  // 用户可交互的基础控件
  MAP_MARKERS_BASE: 900,          // 基础地图标记

  // 地图标记和信息（相对于Canvas层）
  MAP_MARKERS: 750,               // 地图标记 - 高于Canvas层
  MARKER_HOVER_INFO: 760,         // 标记悬停信息
  MARKER_CLICK_INFO: 770,         // 标记点击详情

  // GPS相关标记
  GPS_MARKER: 780,                // GPS定位标记
  GPS_ACCURACY_CIRCLE: 770,       // GPS精度圆圈

  // 工具栏和导航栏
  DRAWING_TOOLBAR: 300,           // 绘制工具栏
  MAP_CONTROLS: 310,              // 地图工具栏
  BOTTOM_NAVIGATION: 320,         // 底部导航栏

  // ===== 信息层 (1000-4999) =====
  // 信息展示卡片和面板
  PIXEL_INFO_CARD: 1000,          // 像素信息卡片
  BACKPACK_PANEL: 1010,           // 百宝箱面板
  SIDE_PANELS: 1020,              // 侧边面板

  // 状态和提示信息
  STATUS_PANELS: 1100,            // 状态面板
  NOTIFICATION_TOASTS: 1110,      // 通知提示

  // ===== 模态层 (5000-8999) =====
  // 弹窗和对话框
  MODAL_BACKDROP: 5000,           // 模态背景
  BASIC_MODALS: 5010,             // 基础弹窗
  INPUT_MODALS: 5020,              // 输入弹窗
  CONFIRMATION_MODALS: 5030,      // 确认弹窗
  SCANNER_MODALS: 5040,           // 扫描器弹窗

  // 特殊功能弹窗
  EDITOR_MODALS: 5100,            // 编辑器弹窗
  AVATAR_EDITOR: 5110,            // 头像编辑器
  PATTERN_UPLOAD: 5120,           // 图案上传

  // ===== 系统层 (9000-9999) =====
  // 系统级UI和调试工具
  SYSTEM_OVERLAYS: 9000,          // 系统覆盖层
  DEBUG_TOOLS: 9100,              // 调试工具
  NETWORK_STATUS: 9200,           // 网络状态

  // 全屏覆盖层
  FULLSCREEN_OVERLAYS: 9600,      // 全屏覆盖层
} as const;

/**
 * 获取z-index值的工具函数
 */
export const getZIndex = (layer: keyof typeof Z_INDEX): number => {
  return Z_INDEX[layer];
};

/**
 * 验证z-index值是否在规范范围内
 */
export const validateZIndex = (zIndex: number): boolean => {
  return zIndex >= 1 && zIndex <= 9999;
};

/**
 * 组件z-index配置快捷方式
 */
export const COMPONENT_Z_INDEX = {
  // 地图相关
  amapCanvas: Z_INDEX.CANVAS_LAYER,
  mapSearchBar: Z_INDEX.MAP_SEARCH_BAR,
  mapControls: Z_INDEX.MAP_CONTROLS,
  bottomNavigation: Z_INDEX.BOTTOM_NAVIGATION,

  // 信息卡片
  pixelInfoCard: Z_INDEX.PIXEL_INFO_CARD,
  mapMarkerInfo: Z_INDEX.MARKER_CLICK_INFO,
  backpackPanel: Z_INDEX.BACKPACK_PANEL,

  // 模态框
  inputDialog: Z_INDEX.INPUT_MODALS,
  confirmDialog: Z_INDEX.CONFIRMATION_MODALS,
  scannerModal: Z_INDEX.SCANNER_MODALS,

  // 系统
  networkStatus: Z_INDEX.NETWORK_STATUS,
} as const;

export default Z_INDEX;