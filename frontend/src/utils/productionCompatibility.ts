/**
 * productionCompatibility.ts - 生产环境兼容性检查
 *
 * 检查应用在不同环境和平台上的兼容性
 */

import { BrowserEnvironment, isBrowser, isLinuxPlatform, getPlatformInfo } from './browserEnvironment';

// ========== 兼容性检查结果接口 ==========

export interface CompatibilityIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'browser' | 'platform' | 'feature' | 'performance';
  code: string;
  message: string;
  suggestion?: string;
  platform?: string;
}

export interface CompatibilityReport {
  platform: string;
  userAgent: string;
  isCompatible: boolean;
  issues: CompatibilityIssue[];
  score: number; // 0-100
  recommendations: string[];
}

// ========== 兼容性检查器 ==========

class ProductionCompatibilityChecker {
  private checks: Map<string, () => CompatibilityIssue[]> = new Map();

  constructor() {
    this.initializeChecks();
  }

  /**
   * 初始化所有兼容性检查
   */
  private initializeChecks() {
    // 浏览器API检查
    this.checks.set('browser-apis', () => this.checkBrowserAPIs());

    // 平台特定检查
    this.checks.set('platform-specific', () => this.checkPlatformSpecific());

    // 功能支持检查
    this.checks.set('features', () => this.checkFeatures());

    // 性能相关检查
    this.checks.set('performance', () => this.checkPerformance());
  }

  /**
   * 检查浏览器API可用性
   */
  private checkBrowserAPIs(): CompatibilityIssue[] {
    const issues: CompatibilityIssue[] = [];

    // 检查关键API
    const criticalAPIs = [
      { name: 'MapLibre GL', check: () => BrowserEnvironment.safeGetWindowProperty('maplibregl'), required: true },
      { name: 'WebSocket', check: () => BrowserEnvironment.isWebSocketAvailable(), required: true },
      { name: 'localStorage', check: () => BrowserEnvironment.safeGetLocalStorage(), required: true },
      { name: 'sessionStorage', check: () => BrowserEnvironment.safeGetSessionStorage(), required: true },
      { name: 'Geolocation', check: () => BrowserEnvironment.isGeolocationAvailable(), required: false },
      { name: 'Canvas', check: () => BrowserEnvironment.isCanvasAvailable(), required: true }
    ];

    criticalAPIs.forEach(api => {
      if (!api.check()) {
        issues.push({
          severity: api.required ? 'error' : 'warning',
          category: 'browser',
          code: `missing-${api.name.toLowerCase().replace(' ', '-')}`,
          message: `${api.name} API不可用`,
          suggestion: api.required
            ? `请确保浏览器支持${api.name} API`
            : `${api.name}功能将被禁用，但不影响基本使用`
        });
      }
    });

    return issues;
  }

  /**
   * 检查平台特定问题
   */
  private checkPlatformSpecific(): CompatibilityIssue[] {
    const issues: CompatibilityIssue[] = [];
    const { platform, userAgent } = BrowserEnvironment.getPlatformInfo();

    // Linux特定检查
    if (BrowserEnvironment.isLinuxPlatform()) {
      // 检查已知问题
      const linuxIssues = this.checkLinuxSpecific(userAgent);
      issues.push(...linuxIssues);
    }

    // 移动设备检查
    const deviceInfo = BrowserEnvironment.getDeviceInfo();
    if (deviceInfo.isMobile) {
      issues.push({
        severity: 'warning',
        category: 'platform',
        code: 'mobile-platform',
        message: '检测到移动设备平台',
        suggestion: '移动设备上地图性能可能受限，建议使用Wi-Fi连接'
      });
    }

    return issues;
  }

  /**
   * Linux平台特定检查
   */
  private checkLinuxSpecific(userAgent: string): CompatibilityIssue[] {
    const issues: CompatibilityIssue[] = [];

    // 检查浏览器类型
    if (userAgent.includes('Firefox')) {
      issues.push({
        severity: 'info',
        category: 'platform',
        code: 'linux-firefox',
        message: 'Linux Firefox环境',
        suggestion: 'Firefox在Linux上表现良好，无需特殊配置'
      });
    } else if (userAgent.includes('Chrome')) {
      issues.push({
        severity: 'info',
        category: 'platform',
        code: 'linux-chrome',
        message: 'Linux Chrome环境',
        suggestion: 'Chrome在Linux上支持所有功能'
      });
    } else {
      issues.push({
        severity: 'warning',
        category: 'platform',
        code: 'linux-unknown-browser',
        message: 'Linux平台使用未知浏览器',
        suggestion: '建议使用Chrome或Firefox以获得最佳兼容性'
      });
    }

    return issues;
  }

  /**
   * 检查功能支持
   */
  private checkFeatures(): CompatibilityIssue[] {
    const issues: CompatibilityIssue[] = [];

    // 检查ES6+支持（不使用eval，使用功能检测）
    try {
      // 测试箭头函数
      const arrowFunctionTest = () => true;
      // 测试解构赋值
      const testObj = { a: 1 };
      const { a } = testObj;

      if (!arrowFunctionTest() || a !== 1) {
        throw new Error('ES6语法不支持');
      }
    } catch (error) {
      issues.push({
        severity: 'error',
        category: 'feature',
        code: 'es6-support',
        message: '浏览器不支持ES6+语法',
        suggestion: '请使用现代浏览器或升级浏览器版本'
      });
    }

    // 检查Promise支持
    if (typeof Promise === 'undefined') {
      issues.push({
        severity: 'error',
        category: 'feature',
        code: 'promise-support',
        message: '浏览器不支持Promise',
        suggestion: '请使用支持Promise的现代浏览器'
      });
    }

    // 检查async/await支持（通过特征检测而非eval）
    if (typeof window !== 'undefined' && 'AsyncFunction' in window) {
      // async/await 支持检测通过
    } else {
      // 在不支持AsyncFunction的环境中，可能不支持async/await
      issues.push({
        severity: 'warning',
        category: 'feature',
        code: 'async-support',
        message: '浏览器可能不支持async/await语法',
        suggestion: '部分功能可能无法正常工作，建议升级浏览器'
      });
    }

    return issues;
  }

  /**
   * 检查性能相关
   */
  private checkPerformance(): CompatibilityIssue[] {
    const issues: CompatibilityIssue[] = [];

    if (!isBrowser) {
      return issues;
    }

    // 检查设备内存
    const memory = (navigator as any).deviceMemory;
    if (memory && memory < 2) {
      issues.push({
        severity: 'warning',
        category: 'performance',
        code: 'low-memory',
        message: `设备内存较低 (${memory}GB)`,
        suggestion: '建议关闭其他标签页以获得更好性能'
      });
    }

    // 检查CPU核心数
    const cores = navigator.hardwareConcurrency;
    if (cores && cores < 2) {
      issues.push({
        severity: 'info',
        category: 'performance',
        code: 'low-cores',
        message: `CPU核心数较少 (${cores}核)`,
        suggestion: '复杂地图操作可能较慢'
      });
    }

    return issues;
  }

  /**
   * 运行完整的兼容性检查
   */
  public runFullCheck(): CompatibilityReport {
    if (!isBrowser) {
      return {
        platform: 'server',
        userAgent: 'N/A',
        isCompatible: true,
        issues: [{
          severity: 'info',
          category: 'platform',
          code: 'server-environment',
          message: '运行在服务器环境',
          suggestion: '这是正常的，应用在客户端运行'
        }],
        score: 100,
        recommendations: []
      };
    }

    const allIssues: CompatibilityIssue[] = [];

    // 运行所有检查
    this.checks.forEach((check, name) => {
      try {
        const issues = check();
        allIssues.push(...issues);
      } catch (error) {
        console.warn(`兼容性检查失败: ${name}`, error);
      }
    });

    // 计算兼容性分数
    const score = this.calculateScore(allIssues);
    const recommendations = this.generateRecommendations(allIssues);

    const { platform, userAgent } = BrowserEnvironment.getPlatformInfo();

    return {
      platform,
      userAgent,
      isCompatible: score >= 70, // 70分以上认为兼容
      issues: allIssues,
      score,
      recommendations
    };
  }

  /**
   * 计算兼容性分数
   */
  private calculateScore(issues: CompatibilityIssue[]): number {
    let score = 100;

    issues.forEach(issue => {
      switch (issue.severity) {
        case 'error':
          score -= 30;
          break;
        case 'warning':
          score -= 15;
          break;
        case 'info':
          score -= 5;
          break;
      }
    });

    return Math.max(0, score);
  }

  /**
   * 生成改进建议
   */
  private generateRecommendations(issues: CompatibilityIssue[]): string[] {
    const recommendations: string[] = [];
    const hasErrors = issues.some(i => i.severity === 'error');
    const hasWarnings = issues.some(i => i.severity === 'warning');

    if (hasErrors) {
      recommendations.push('存在严重兼容性问题，建议升级浏览器或更换平台');
    }

    if (hasWarnings) {
      recommendations.push('存在兼容性警告，部分功能可能受限');
    }

    if (BrowserEnvironment.isLinuxPlatform()) {
      recommendations.push('Linux用户推荐使用Chrome或Firefox浏览器');
    }

    if (BrowserEnvironment.getDeviceInfo().isMobile) {
      recommendations.push('移动设备建议使用Wi-Fi连接以获得更好体验');
    }

    const hasMapLibre = BrowserEnvironment.safeGetWindowProperty('maplibregl');
    if (!hasMapLibre) {
      recommendations.push('确保MapLibre GL库正确加载');
    }

    return recommendations;
  }
}

// ========== 导出 ==========

export const compatibilityChecker = new ProductionCompatibilityChecker();

/**
 * 快速兼容性检查
 */
export function quickCompatibilityCheck(): boolean {
  if (!isBrowser) {
    return true;
  }

  const criticalChecks = [
    () => !!BrowserEnvironment.safeGetWindowProperty('maplibregl'),
    () => BrowserEnvironment.isWebSocketAvailable(),
    () => BrowserEnvironment.safeGetLocalStorage() !== null,
    () => typeof Promise !== 'undefined'
  ];

  return criticalChecks.every(check => {
    try {
      return check();
    } catch {
      return false;
    }
  });
}

/**
 * 获取平台信息
 */
export function getPlatformInfoForProduction() {
  const { platform, userAgent, language } = BrowserEnvironment.getPlatformInfo();
  const deviceInfo = BrowserEnvironment.getDeviceInfo();

  return {
    platform,
    userAgent,
    language,
    deviceType: deviceInfo.isMobile ? 'mobile' : deviceInfo.isTablet ? 'tablet' : 'desktop',
    isLinux: BrowserEnvironment.isLinuxPlatform(),
    isGeolocationSupported: BrowserEnvironment.isGeolocationAvailable(),
    isWebSocketSupported: BrowserEnvironment.isWebSocketAvailable(),
    timestamp: new Date().toISOString()
  };
}

// 默认导出检查器
export default compatibilityChecker;