/**
 * MapLibre GL 地图工厂
 *
 * 统一管理 MapLibre GL 的导入和配置
 * 提供多种导入方式的备用方案
 */

let maplibreInstance: any = null;

/**
 * 获取 MapLibre GL 实例
 * 使用 CDN 版本（全局变量）
 */
export async function getMapLibreGL(): Promise<any> {
  if (maplibreInstance) {
    return maplibreInstance;
  }

  // 等待 CDN 加载完成，最多等待 5 秒
  const maxWaitTime = 5000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    if (typeof window !== 'undefined' && (window as any).maplibregl) {
      maplibreInstance = (window as any).maplibregl;
      console.log('[MapLibreFactory] 使用 CDN 版本加载成功');
      return maplibreInstance;
    }

    // 等待 100ms 后重试
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // CDN 加载失败，但不抛出异常，返回 null
  console.warn('[MapLibreFactory] CDN 版本加载超时，将在使用时重试');
  return null;
}

/**
 * 预加载 MapLibre GL
 * 在应用启动时调用，确保地图库可用
 */
export async function preloadMapLibreGL(): Promise<void> {
  try {
    await getMapLibreGL();
    console.log('[MapLibreFactory] MapLibre GL 预加载成功');
  } catch (error) {
    console.warn('[MapLibreFactory] MapLibre GL 预加载失败，将在地图使用时重试:', error);
    // 不抛出异常，避免阻塞应用启动
  }
}

/**
 * 重置缓存实例（用于调试或重新加载）
 */
export function resetMapLibreInstance(): void {
  maplibreInstance = null;
  console.log('[MapLibreFactory] 实例缓存已重置');
}

/**
 * 检查 MapLibre GL 是否已加载
 */
export function isMapLibreLoaded(): boolean {
  return maplibreInstance !== null;
}

/**
 * 获取当前使用的导入方式信息
 */
export function getMapLibreInfo(): { loaded: boolean; source?: string; version?: string } {
  if (!maplibreInstance) {
    return { loaded: false };
  }

  let source = 'unknown';
  if (typeof window !== 'undefined' && (window as any).maplibregl === maplibreInstance) {
    source = 'global';
  } else {
    source = 'module';
  }

  const version = maplibreInstance.version || 'unknown';

  return { loaded: true, source, version };
}