/**
 * WebGL诊断工具
 * 用于检测和调试WebGL相关问题
 */

export interface WebGLDiagnosticResult {
  isSupported: boolean;
  contextType: string | null;
  rendererInfo: string;
  vendorInfo: string;
  versionInfo: string;
  extensions: string[];
  maxTextureSize: number;
  maxViewportDims: number[];
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

/**
 * 运行完整的WebGL诊断
 */
export function runWebGLDiagnostic(): WebGLDiagnosticResult {
  const result: WebGLDiagnosticResult = {
    isSupported: false,
    contextType: null,
    rendererInfo: 'Unknown',
    vendorInfo: 'Unknown',
    versionInfo: 'Unknown',
    extensions: [],
    maxTextureSize: 0,
    maxViewportDims: [0, 0],
    errors: [],
    warnings: [],
    recommendations: []
  };

  const canvas = document.createElement('canvas');
  const contextTypes = ['webgl2', 'webgl', 'experimental-webgl'];

  // 先检查WebGL2支持（MapLibre GL需要）- 使用强制高性能参数
  const webgl2Context = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    powerPreference: 'high-performance',
    failIfMajorPerformanceCaveat: false,
    preserveDrawingBuffer: false,
    premultipliedAlpha: false
  }) as WebGL2RenderingContext;
  if (webgl2Context) {
    result.isSupported = true;
    result.contextType = 'webgl2';

    // 获取WebGL2详细信息
    const debugInfo = webgl2Context.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      result.rendererInfo = webgl2Context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      result.vendorInfo = webgl2Context.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    } else {
      result.rendererInfo = webgl2Context.getParameter(webgl2Context.RENDERER) || 'Unknown';
      result.vendorInfo = webgl2Context.getParameter(webgl2Context.VENDOR) || 'Unknown';
    }

    result.versionInfo = webgl2Context.getParameter(webgl2Context.VERSION) || 'Unknown';
    result.maxTextureSize = webgl2Context.getParameter(webgl2Context.MAX_TEXTURE_SIZE);
    result.maxViewportDims = webgl2Context.getParameter(webgl2Context.MAX_VIEWPORT_DIMS);

    const extensions = webgl2Context.getSupportedExtensions();
    if (extensions) {
      result.extensions = extensions;
    }

    return result;
  }

  // 尝试创建WebGL上下文
  for (const contextType of contextTypes) {
    try {
      const gl = canvas.getContext(contextType) as WebGLRenderingContext | WebGL2RenderingContext;
      if (gl) {
        result.isSupported = true;
        result.contextType = contextType;

        // 获取基本信息
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          result.rendererInfo = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          result.vendorInfo = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        } else {
          result.rendererInfo = gl.getParameter(gl.RENDERER) || 'Unknown';
          result.vendorInfo = gl.getParameter(gl.VENDOR) || 'Unknown';
        }

        result.versionInfo = gl.getParameter(gl.VERSION) || 'Unknown';
        result.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        result.maxViewportDims = gl.getParameter(gl.MAX_VIEWPORT_DIMS);

        // 获取扩展
        const extensions = gl.getSupportedExtensions();
        if (extensions) {
          result.extensions = extensions;
        }

        break;
      }
    } catch (error) {
      result.errors.push(`${contextType} 上下文创建失败: ${error}`);
    }
  }

  // 分析和建议
  if (!result.isSupported) {
    result.errors.push('WebGL不支持或被禁用');
    result.recommendations.push('更新浏览器到最新版本');
    result.recommendations.push('检查显卡驱动是否最新');
    result.recommendations.push('在浏览器设置中启用硬件加速');
    result.recommendations.push('尝试使用Chrome、Firefox或Edge浏览器');
  } else {
    // 检查性能警告
    if (result.maxTextureSize < 4096) {
      result.warnings.push(`最大纹理尺寸较小 (${result.maxTextureSize})，可能影响性能`);
    }

    // 检查关键扩展
    const criticalExtensions = ['OES_texture_float', 'OES_element_index_uint', 'WEBGL_depth_texture'];
    for (const ext of criticalExtensions) {
      if (!result.extensions.includes(ext)) {
        result.warnings.push(`缺少关键扩展: ${ext}`);
      }
    }

    // 检查已知问题
    const lowerRenderer = result.rendererInfo.toLowerCase();
    const lowerVendor = result.vendorInfo.toLowerCase();

    if (lowerRenderer.includes('software') || lowerRenderer.includes('microsoft software')) {
      result.warnings.push('检测到软件渲染，性能较差');
      result.recommendations.push('启用硬件加速');
    }

    if (lowerRenderer.includes('intel') && lowerRenderer.includes('hd graphics')) {
      result.warnings.push('Intel HD Graphics可能存在兼容性问题');
      result.recommendations.push('更新显卡驱动到最新版本');
    }
  }

  return result;
}

/**
 * 获取浏览器和系统信息
 */
export function getBrowserInfo() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as any).deviceMemory,
    screen: {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth
    },
    webgl: runWebGLDiagnostic()
  };
}

/**
 * 格式化诊断结果为可读字符串
 */
export function formatDiagnosticResult(result: WebGLDiagnosticResult): string {
  let output = '';

  output += '=== WebGL 诊断报告 ===\n\n';
  output += `WebGL 支持: ${result.isSupported ? '✅ 是' : '❌ 否'}\n`;
  output += `上下文类型: ${result.contextType || '无'}\n\n`;

  output += '=== 显卡信息 ===\n';
  output += `供应商: ${result.vendorInfo}\n`;
  output += `渲染器: ${result.rendererInfo}\n`;
  output += `版本: ${result.versionInfo}\n`;
  output += `最大纹理尺寸: ${result.maxTextureSize}\n`;
  output += `最大视口尺寸: ${result.maxViewportDims.join(' x ')}\n\n`;

  if (result.warnings.length > 0) {
    output += '=== 警告 ===\n';
    result.warnings.forEach(warning => {
      output += `⚠️ ${warning}\n`;
    });
    output += '\n';
  }

  if (result.errors.length > 0) {
    output += '=== 错误 ===\n';
    result.errors.forEach(error => {
      output += `❌ ${error}\n`;
    });
    output += '\n';
  }

  if (result.recommendations.length > 0) {
    output += '=== 建议 ===\n';
    result.recommendations.forEach(rec => {
      output += `💡 ${rec}\n`;
    });
  }

  return output;
}

/**
 * 运行快速WebGL检测（仅检查支持性）
 */
export function quickWebGLCheck(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') as WebGLRenderingContext || canvas.getContext('experimental-webgl') as WebGLRenderingContext);
  } catch {
    return false;
  }
}

export default {
  runWebGLDiagnostic,
  getBrowserInfo,
  formatDiagnosticResult,
  quickWebGLCheck
};