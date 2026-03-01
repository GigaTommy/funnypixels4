/**
 * 漂流瓶功能配置文件
 *
 * 集中管理所有漂流瓶相关的配置参数
 */

export const DRIFT_BOTTLE_CONFIG = {
  // ==================== 地图渲染配置 ====================

  /** 标记层级（确保高于像素格子） */
  MARKER_ZINDEX: 1500,

  /** 聚合标记层级 */
  CLUSTER_ZINDEX: 1600,

  /** 最小可见缩放等级 */
  MIN_ZOOM_LEVEL: 12,

  /** 最大可见缩放等级 */
  MAX_ZOOM_LEVEL: 20,

  /** 是否启用标记聚合 */
  ENABLE_CLUSTERING: true,

  /** 聚合半径（像素） */
  CLUSTER_RADIUS: 50,

  /** 视口内最大标记数量 */
  MAX_MARKERS_IN_VIEWPORT: 100,

  /** 是否启用标记动画 */
  ENABLE_ANIMATION: true,

  /** 地图更新节流时间（毫秒） */
  UPDATE_THROTTLE_MS: 300,

  // ==================== 搜索和加载配置 ====================

  /** 默认搜索半径（公里） */
  DEFAULT_SEARCH_RADIUS_KM: 50,

  /** 最小搜索半径（公里） */
  MIN_SEARCH_RADIUS_KM: 1,

  /** 最大搜索半径（公里） */
  MAX_SEARCH_RADIUS_KM: 200,

  /** 自动刷新间隔（毫秒） */
  AUTO_REFRESH_INTERVAL_MS: 30000, // 30秒

  /** 是否在GPS模式下自动加载 */
  AUTO_LOAD_IN_GPS_MODE: true,

  // ==================== GPS自动拾取配置 ====================

  /** GPS自动拾取检测范围（公里） */
  GPS_PICKUP_DETECTION_RADIUS_KM: 0.0001, // 约10米

  /** GPS自动拾取距离阈值（米） */
  GPS_PICKUP_DISTANCE_THRESHOLD_M: 15,

  /** GPS拾取动画延迟（毫秒） */
  GPS_PICKUP_ANIMATION_DELAY_MS: 500,

  /** 拾取成功动画持续时间（毫秒） */
  PICKUP_SUCCESS_ANIMATION_DURATION_MS: 1500,

  /** 拾取失败动画持续时间（毫秒） */
  PICKUP_FAILURE_ANIMATION_DURATION_MS: 1000,

  // ==================== UI显示配置 ====================

  /** 标记大小（像素） */
  MARKER_SIZE: {
    SINGLE: 48,
    CLUSTER: 60
  },

  /** 标记颜色 */
  MARKER_COLORS: {
    SINGLE: {
      PRIMARY: '#3B82F6', // 蓝色
      SECONDARY: '#60A5FA'
    },
    CLUSTER: {
      PRIMARY: '#8B5CF6', // 紫色
      SECONDARY: '#A78BFA'
    }
  },

  /** 消息徽章颜色 */
  MESSAGE_BADGE_COLOR: '#EF4444', // 红色

  /** 动画效果 */
  ANIMATIONS: {
    /** 脉冲动画时长（秒） */
    PULSE_DURATION: 2,
    /** 浮动动画时长（秒） */
    FLOAT_DURATION: 3,
    /** 旋转动画时长（秒） */
    ROTATE_DURATION: 20
  },

  // ==================== 弹窗配置 ====================

  /** 弹窗最大高度（视口百分比） */
  MODAL_MAX_HEIGHT_PERCENT: 90,

  /** 弹窗最大宽度（像素） */
  MODAL_MAX_WIDTH_PX: 512,

  /** 消息列表最大显示数量 */
  MODAL_MAX_MESSAGES_DISPLAY: 10,

  /** 弹窗动画时长（毫秒） */
  MODAL_ANIMATION_DURATION_MS: 300,

  // ==================== 性能优化配置 ====================

  /** 是否启用视口剔除 */
  ENABLE_VIEWPORT_CULLING: true,

  /** 是否启用标记池复用 */
  ENABLE_MARKER_POOLING: true,

  /** 是否启用懒加载 */
  ENABLE_LAZY_LOADING: true,

  /** 视口剔除扩展比例 */
  VIEWPORT_CULLING_PADDING: 0.1, // 10%扩展

  /** 批量渲染大小 */
  BATCH_RENDER_SIZE: 20,

  /** 渲染帧率限制（FPS） */
  MAX_RENDER_FPS: 60,

  // ==================== 调试配置 ====================

  /** 是否启用调试日志 */
  ENABLE_DEBUG_LOGGING: true,

  /** 是否显示性能统计 */
  SHOW_PERFORMANCE_STATS: true,

  /** 是否在地图上显示标记边界 */
  SHOW_MARKER_BOUNDS: false,

  // ==================== Toast提示配置 ====================

  /** Toast显示位置 */
  TOAST_POSITION: 'top-center' as const,

  /** Toast默认持续时间（毫秒） */
  TOAST_DURATION: {
    INFO: 2000,
    SUCCESS: 3000,
    ERROR: 4000
  },

  /** GPS拾取成功Toast样式 */
  GPS_PICKUP_SUCCESS_TOAST_STYLE: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    fontWeight: 'bold',
    padding: '16px',
    borderRadius: '12px'
  }
};

/**
 * 漂流瓶标记样式配置
 */
export const DRIFT_BOTTLE_MARKER_STYLES = {
  /** 单个瓶子标记样式 */
  single: {
    container: {
      position: 'relative' as const,
      width: `${DRIFT_BOTTLE_CONFIG.MARKER_SIZE.SINGLE}px`,
      height: `${DRIFT_BOTTLE_CONFIG.MARKER_SIZE.SINGLE}px`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
    },
    background: {
      position: 'absolute' as const,
      width: '40px',
      height: '40px',
      background: `linear-gradient(135deg, ${DRIFT_BOTTLE_CONFIG.MARKER_COLORS.SINGLE.PRIMARY}, ${DRIFT_BOTTLE_CONFIG.MARKER_COLORS.SINGLE.SECONDARY})`,
      borderRadius: '50%',
      border: '3px solid white',
      boxShadow: `0 0 20px rgba(59, 130, 246, 0.6)`
    },
    icon: {
      position: 'relative' as const,
      fontSize: '24px',
      zIndex: 2
    }
  },

  /** 聚合标记样式 */
  cluster: {
    container: {
      position: 'relative' as const,
      width: `${DRIFT_BOTTLE_CONFIG.MARKER_SIZE.CLUSTER}px`,
      height: `${DRIFT_BOTTLE_CONFIG.MARKER_SIZE.CLUSTER}px`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))'
    },
    background: {
      position: 'absolute' as const,
      width: '100%',
      height: '100%',
      background: `linear-gradient(135deg, ${DRIFT_BOTTLE_CONFIG.MARKER_COLORS.CLUSTER.PRIMARY}, ${DRIFT_BOTTLE_CONFIG.MARKER_COLORS.CLUSTER.SECONDARY})`,
      borderRadius: '50%',
      border: '4px solid white',
      boxShadow: `0 0 30px rgba(139, 92, 246, 0.7)`
    }
  }
};

/**
 * 漂流瓶动画配置
 */
export const DRIFT_BOTTLE_ANIMATIONS = {
  /** 标记入场动画 */
  markerEntrance: {
    initial: { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { duration: 0.3, type: 'spring', stiffness: 300, damping: 20 }
  },

  /** 标记退场动画 */
  markerExit: {
    exit: { scale: 0, opacity: 0 },
    transition: { duration: 0.2 }
  },

  /** 弹窗入场动画 */
  modalEntrance: {
    initial: { opacity: 0, scale: 0.9, y: 20 },
    animate: { opacity: 1, scale: 1, y: 0 },
    transition: { duration: 0.3, type: 'spring', stiffness: 300, damping: 25 }
  },

  /** 弹窗退场动画 */
  modalExit: {
    exit: { opacity: 0, scale: 0.9, y: 20 },
    transition: { duration: 0.2 }
  },

  /** GPS拾取特效动画 */
  gpsPickupEffect: {
    background: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.3 }
    },
    bottle: {
      initial: { scale: 0, rotate: -180 },
      animate: {
        scale: [0, 1.2, 1],
        rotate: [-180, 10, 0]
      },
      transition: {
        duration: 0.8,
        ease: [0.34, 1.56, 0.64, 1] // spring效果
      }
    },
    particles: {
      count: 12,
      distance: 150
    }
  }
};

/**
 * 性能阈值配置
 */
export const DRIFT_BOTTLE_PERFORMANCE_THRESHOLDS = {
  /** 警告：标记数量 */
  WARNING_MARKER_COUNT: 80,

  /** 错误：标记数量 */
  ERROR_MARKER_COUNT: 150,

  /** 警告：渲染时间（毫秒） */
  WARNING_RENDER_TIME_MS: 50,

  /** 错误：渲染时间（毫秒） */
  ERROR_RENDER_TIME_MS: 100,

  /** 强制聚合：标记数量阈值 */
  FORCE_CLUSTERING_THRESHOLD: 50
};

/**
 * 获取配置项（支持环境变量覆盖）
 */
export const getDriftBottleConfig = () => {
  return {
    ...DRIFT_BOTTLE_CONFIG,
    // 可以通过环境变量覆盖配置
    DEFAULT_SEARCH_RADIUS_KM: Number(
      import.meta.env.VITE_DRIFT_BOTTLE_SEARCH_RADIUS
    ) || DRIFT_BOTTLE_CONFIG.DEFAULT_SEARCH_RADIUS_KM,

    ENABLE_DEBUG_LOGGING: import.meta.env.VITE_DRIFT_BOTTLE_DEBUG === 'true' ||
      DRIFT_BOTTLE_CONFIG.ENABLE_DEBUG_LOGGING
  };
};

export default DRIFT_BOTTLE_CONFIG;
