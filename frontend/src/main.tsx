import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

// 导入logger
import { logger } from "./utils/logger";
import { initializeProductionLogger } from "./utils/productionLoggerOptimizer";

// 立即导入应用初始化工具
import { quickInitialize } from "./utils/appInitializer";

// 初始化生产环境日志优化
initializeProductionLogger({
  enableConsoleOverride: true,
  logLevelThreshold: import.meta.env.PROD ? 'error' : 'debug',
  maxLogPerSecond: import.meta.env.PROD ? 10 : 100,
  enableLogBatching: import.meta.env.PROD
});

// 快速兼容性检查
const isCompatible = quickInitialize();
if (!isCompatible) {
  logger.error('❌ 应用兼容性检查失败，可能存在功能问题');
}

// 延迟加载其他模块，避免阻塞应用启动
setTimeout(() => {
  try {
    // 必须在所有其他导入之前加载，确保 __publicField 辅助函数可用
    import("./helpers/publicFieldHelper");
    import("./utils/setupLogging");
    import("./styles/fonts.css");
    import("./styles/flags.css");

    // 预加载 MapLibre GL - 使用异步方式，不阻塞应用启动
    import("./services/mapLibreFactory").then((module) => {
      module.preloadMapLibreGL().catch((error) => {
        logger.error('[Main] MapLibre GL 预加载失败:', error);
      });
    });
  } catch (error) {
    logger.error('[Main] 延迟加载模块失败:', error);
  }
}, 200); // 延迟200ms，让应用先启动
// AMap imports removed - migrating to MapLibre GL
// import { initializeAmapSecurity } from "./config/env";
// import { checkAmapEnvironment } from "./utils/amapDiagnostics";

// PWA支持 - 暂时禁用以解决缓存问题
// import { initPWA } from "./utils/pwa";

// AMap initialization removed - migrating to MapLibre GL
// initializeAmapSecurity();

// 预加载 MapLibre GL - 使用异步方式，不阻塞应用启动
// 注释：已在上面第17-21行的模块导入中处理

// 在开发环境下检查高德地图环境 - removed
// checkAmapEnvironment();

// 初始化PWA功能（Service Worker、安装提示等）- 暂时禁用
// initPWA().catch((error) => {
//   console.error('[Main] PWA initialization failed:', error);
// });

// 简化渲染，避免可能的组件问题
ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);