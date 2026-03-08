import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
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

// 🆕 使用新的路由系统（Landing + Game App）
ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <Suspense fallback={
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontSize: '24px',
        fontWeight: 'bold'
      }}>
        <div>
          <div style={{ marginBottom: '20px', textAlign: 'center' }}>
            <div className="animate-spin" style={{
              width: '48px',
              height: '48px',
              border: '4px solid rgba(255,255,255,0.3)',
              borderTop: '4px solid white',
              borderRadius: '50%',
              margin: '0 auto'
            }}></div>
          </div>
          Loading FunnyPixels...
        </div>
      </div>
    }>
      <RouterProvider router={router} />
    </Suspense>
  </ErrorBoundary>,
);