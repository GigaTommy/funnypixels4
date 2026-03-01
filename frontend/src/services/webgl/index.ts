/**
 * WebGL渲染系统入口
 */

export { WebGLPixelService, type WebGLServiceConfig } from './WebGLPixelService';
export { WebGLPixelRenderer, type PixelData, type RenderOptions } from './WebGLPixelRenderer-v2';
export { UnifiedTextureAtlas, type TextureCoords } from './UnifiedTextureAtlas';
export { PatternPreprocessor, type PatternAsset } from './PatternPreprocessor';
export { createShaderProgram, getShaderLocations, type ShaderLocations } from './shaders';

/**
 * 检查WebGL支持
 */
export function checkWebGLSupport(): {
  supported: boolean;
  reason?: string;
  vendor?: string;
  renderer?: string;
  maxTextureSize?: number;
} {
  try {
    const canvas = document.createElement('canvas');
    // 🔧 关键修复：必须设置canvas尺寸
    canvas.width = 1;
    canvas.height = 1;

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;

    if (!gl) {
      return {
        supported: false,
        reason: 'WebGL不可用（浏览器不支持或已禁用硬件加速）',
      };
    }

    // 获取GPU信息
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    let vendor = '未知';
    let renderer = '未知';

    if (debugInfo) {
      vendor = gl.getParameter((debugInfo as any).UNMASKED_VENDOR_WEBGL) || '未知';
      renderer = gl.getParameter((debugInfo as any).UNMASKED_RENDERER_WEBGL) || '未知';
    }

    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;

    return {
      supported: true,
      vendor,
      renderer,
      maxTextureSize,
    };
  } catch (error) {
    return {
      supported: false,
      reason: `WebGL检测失败: ${error}`,
    };
  }
}
