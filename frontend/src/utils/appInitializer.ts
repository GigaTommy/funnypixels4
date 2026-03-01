/**
 * appInitializer.ts - 应用初始化工具
 *
 * 确保应用在不同环境中安全启动
 */

import { compatibilityChecker, quickCompatibilityCheck, getPlatformInfoForProduction } from './productionCompatibility';
import { BrowserEnvironment, isBrowser, safeGetWindow } from './browserEnvironment';
import { logger } from './logger';

// ========== 初始化状态 ==========

interface InitializationState {
  isInitialized: boolean;
  platformInfo: any;
  compatibilityReport: any;
  errors: string[];
  warnings: string[];
}

let initialState: InitializationState = {
  isInitialized: false,
  platformInfo: null,
  compatibilityReport: null,
  errors: [],
  warnings: []
};

// ========== 初始化函数 ==========

/**
 * 初始化应用
 */
export async function initializeApp(): Promise<InitializationState> {
  if (initialState.isInitialized) {
    return initialState;
  }

  logger.info('🚀 开始应用初始化...');

  try {
    // 1. 环境检测
    const platformInfo = getPlatformInfoForProduction();
    logger.info('📋 平台信息:', platformInfo);

    // 2. 兼容性检查
    const compatibilityReport = compatibilityChecker.runFullCheck();
    logger.info('🔍 兼容性检查完成:', {
      score: compatibilityReport.score,
      issues: compatibilityReport.issues.length,
      isCompatible: compatibilityReport.isCompatible
    });

    // 3. 错误和警告收集
    const errors: string[] = [];
    const warnings: string[] = [];

    compatibilityReport.issues.forEach(issue => {
      const message = `[${issue.category.toUpperCase()}] ${issue.message}`;
      if (issue.severity === 'error') {
        errors.push(message);
      } else if (issue.severity === 'warning') {
        warnings.push(message);
      }
    });

    // 4. 处理关键错误
    if (errors.length > 0) {
      logger.error('❌ 发现关键兼容性问题:', errors);
      // 在生产环境中，关键错误应该阻止应用继续运行
      if (isBrowser && !process.env.NODE_ENV?.includes('dev')) {
        showCompatibilityErrors(errors);
        return {
          ...initialState,
          platformInfo,
          compatibilityReport,
          errors,
          warnings
        };
      }
    }

    // 5. 显示警告（开发环境）
    if (warnings.length > 0 && process.env.NODE_ENV?.includes('dev')) {
      logger.warn('⚠️ 兼容性警告:', warnings);
    }

    // 6. 设置全局错误处理
    setupGlobalErrorHandling();

    // 7. 初始化完成
    initialState = {
      isInitialized: true,
      platformInfo,
      compatibilityReport,
      errors,
      warnings
    };

    logger.info('✅ 应用初始化完成');
    return initialState;

  } catch (error) {
    logger.error('❌ 应用初始化失败:', error);

    initialState = {
      ...initialState,
      errors: [`初始化失败: ${error instanceof Error ? error.message : '未知错误'}`]
    };

    return initialState;
  }
}

/**
 * 设置全局错误处理
 */
function setupGlobalErrorHandling(): void {
  if (!isBrowser) {
    return;
  }

  // 捕获未处理的Promise拒绝
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('未处理的Promise拒绝:', event.reason);
    event.preventDefault();
  });

  // 捕获全局错误
  window.addEventListener('error', (event) => {
    logger.error('全局错误:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    });
  });
}

/**
 * 显示兼容性错误
 */
function showCompatibilityErrors(errors: string[]): void {
  if (!isBrowser) {
    return;
  }

  // 创建错误提示界面
  const errorContainer = document.createElement('div');
  errorContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  const errorContent = document.createElement('div');
  errorContent.style.cssText = `
    background: white;
    color: black;
    padding: 2rem;
    border-radius: 8px;
    max-width: 500px;
    text-align: center;
  `;

  errorContent.innerHTML = `
    <h2 style="color: #dc3545; margin-top: 0;">🚫 浏览器兼容性问题</h2>
    <p>您的浏览器存在以下兼容性问题：</p>
    <ul style="text-align: left; color: #dc3545;">
      ${errors.map(error => `<li>${error}</li>`).join('')}
    </ul>
    <p>建议：</p>
    <ul style="text-align: left;">
      <li>升级到最新版本的 Chrome 或 Firefox 浏览器</li>
      <li>确保JavaScript已启用</li>
      <li>检查网络连接是否正常</li>
    </ul>
    <button onclick="window.location.reload()" style="
      background: #007bff;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 1rem;
    ">重新加载</button>
  `;

  errorContainer.appendChild(errorContent);
  document.body.appendChild(errorContainer);
}

/**
 * 快速初始化（用于生产环境）
 */
export function quickInitialize(): boolean {
  try {
    if (!isBrowser) {
      return true;
    }

    // 快速兼容性检查
    const isCompatible = quickCompatibilityCheck();
    if (!isCompatible) {
      logger.error('快速兼容性检查失败');
      return false;
    }

    // 基本初始化
    setupGlobalErrorHandling();

    logger.info('✅ 快速初始化完成');
    return true;

  } catch (error) {
    logger.error('快速初始化失败:', error);
    return false;
  }
}

/**
 * 获取初始化状态
 */
export function getInitializationState(): InitializationState {
  return initialState;
}

/**
 * 重置初始化状态（用于测试）
 */
export function resetInitialization(): void {
  initialState = {
    isInitialized: false,
    platformInfo: null,
    compatibilityReport: null,
    errors: [],
    warnings: []
  };
}

// ========== 自动初始化（浏览器环境） ==========

if (isBrowser) {
  // 延迟初始化，确保DOM加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initializeApp, 100);
    });
  } else {
    setTimeout(initializeApp, 100);
  }
}

// ========== 开发环境调试工具 ==========

if (isBrowser && process.env.NODE_ENV?.includes('dev')) {
  // 在开发环境暴露调试工具到window
  (window as any).appInitializer = {
    initializeApp,
    quickInitialize,
    getInitializationState,
    resetInitialization,
    compatibilityChecker,
    quickCompatibilityCheck
  };
}