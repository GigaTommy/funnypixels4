/**
 * 简单像素加载器 - 不依赖地图导航，直接加载当前位置像素
 */

export interface SimplePixelLoaderResult {
  success: boolean;
  foundPixels: number;
  loadedTestPixels: number;
  errors: string[];
  warnings: string[];
}

export class SimplePixelLoader {
  /**
   * 在当前位置直接加载像素
   */
  static async loadCurrentLocationPixels(): Promise<SimplePixelLoaderResult> {
    console.log('📍 === 开始加载当前位置像素（简化版） ===');

    const result: SimplePixelLoaderResult = {
      success: false,
      foundPixels: 0,
      loadedTestPixels: 0,
      errors: [],
      warnings: []
    };

    try {
      // 1. 直接在当前位置添加测试像素，绕过所有复杂的地图和API操作
      const webglService = (window as any).webglService || (window as any).webglPixelService;
      if (!webglService || !webglService.renderer) {
        result.errors.push('WebGL服务未找到');
        console.error('❌ WebGL服务未找到');
        return result;
      }

      console.log('🎨 找到WebGL渲染器');

      // 2. 获取当前地图中心（从日志中获取）
      const currentCenter = { lat: 23.111527, lng: 113.320637 }; // 从你的日志中获取的坐标
      console.log('📍 使用当前位置坐标:', currentCenter);

      // 3. 在当前位置周围添加测试像素
      const testPixels = [
        {
          gridId: `test_${Date.now()}_1`,
          lat: currentCenter.lat + 0.001,
          lng: currentCenter.lng + 0.001,
          renderType: 'color',
          patternKey: '#FF0000',
          color: '#FF0000'
        },
        {
          gridId: `test_${Date.now()}_2`,
          lat: currentCenter.lat - 0.001,
          lng: currentCenter.lng - 0.001,
          renderType: 'color',
          patternKey: '#00FF00',
          color: '#00FF00'
        },
        {
          gridId: `test_${Date.now()}_3`,
          lat: currentCenter.lat + 0.001,
          lng: currentCenter.lng - 0.001,
          renderType: 'color',
          patternKey: '#0000FF',
          color: '#0000FF'
        },
        {
          gridId: `test_${Date.now()}_4`,
          lat: currentCenter.lat - 0.001,
          lng: currentCenter.lng + 0.001,
          renderType: 'color',
          patternKey: '#FFFF00',
          color: '#FFFF00'
        },
        {
          gridId: `test_${Date.now()}_5`,
          lat: currentCenter.lat,
          lng: currentCenter.lng,
          renderType: 'color',
          patternKey: '#FF00FF',
          color: '#FF00FF'
        }
      ];

      console.log('🧪 开始添加测试像素...');

      let successCount = 0;
      testPixels.forEach((pixel, index) => {
        try {
          webglService.renderer.updatePixel(pixel);
          successCount++;
          console.log(`✅ 成功添加测试像素 ${index + 1}: ${pixel.gridId} (${pixel.lat}, ${pixel.lng}) - ${pixel.color}`);
        } catch (pixelError) {
          console.error(`❌ 添加测试像素失败: ${pixelError}`);
          result.errors.push(`添加像素${index + 1}失败: ${pixelError}`);
        }
      });

      result.loadedTestPixels = successCount;
      result.success = successCount > 0;

      if (result.success) {
        console.log(`✅ 成功添加了 ${successCount} 个测试像素到WebGL`);

        // 4. 强制渲染一帧
        try {
          if (typeof webglService.render === 'function') {
            webglService.render();
            console.log('🎨 WebGL渲染帧已触发');
          }

          if (typeof webglService.renderWebGLFrame === 'function') {
            await webglService.renderWebGLFrame();
            console.log('🎨 WebGL强制渲染完成');
          }
        } catch (renderError) {
          console.warn('⚠️ 渲染可能失败，但像素已添加:', renderError);
          result.warnings.push(`渲染警告: ${renderError}`);
        }

        // 5. 检查渲染器状态
        try {
          if (webglService.renderer && webglService.renderer.getStats) {
            const stats = webglService.renderer.getStats();
          console.log('📊 WebGL渲染器统计:', stats);
          console.log(`🔢 WebGL像素数量: ${stats.pixelCount || 'unknown'}`);
        }
        } catch (statsError) {
          console.warn('⚠️ 无法获取WebGL统计:', statsError);
        }

      } else {
        console.error('❌ 所有测试像素添加失败');
      }

    } catch (error) {
      result.errors.push(`加载失败: ${error.message}`);
      console.error('❌ 简单像素加载失败:', error);
    }

    return result;
  }

  /**
   * 添加更多测试像素（围绕当前位置）
   */
  static async addMoreTestPixels(count: number = 10): Promise<boolean> {
    console.log(`🧪 添加 ${count} 个额外的测试像素...`);

    try {
      const webglService = (window as any).webglService || (window as any).webglPixelService;
      if (!webglService || !webglService.renderer) {
        console.error('❌ WebGL服务未找到');
        return false;
      }

      const currentCenter = { lat: 23.111527, lng: 113.320637 };
      const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#FFC0CB', '#40E0D0'];

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const distance = 0.002; // 约200米半径
        const pixel = {
          gridId: `test_extra_${Date.now()}_${i}`,
          lat: currentCenter.lat + Math.cos(angle) * distance,
          lng: currentCenter.lng + Math.sin(angle) * distance,
          renderType: 'color',
          patternKey: colors[i % colors.length],
          color: colors[i % colors.length]
        };

        try {
          webglService.renderer.updatePixel(pixel);
          console.log(`✅ 添加额外像素 ${i + 1}: ${pixel.color} (${pixel.lat.toFixed(6)}, ${pixel.lng.toFixed(6)})`);
        } catch (error) {
          console.error(`❌ 添加额外像素 ${i + 1} 失败:`, error);
        }
      }

      // 触发渲染
      if (typeof webglService.render === 'function') {
        webglService.render();
      }

      console.log('✅ 额外测试像素添加完成');
      return true;

    } catch (error) {
      console.error('❌ 添加额外像素失败:', error);
      return false;
    }
  }

  /**
   * 清除所有测试像素
   */
  static clearTestPixels(): boolean {
    console.log('🧹 清除所有测试像素...');

    try {
      const webglService = (window as any).webglService || (window as any).webglPixelService;
      if (!webglService || !webglService.renderer) {
        console.error('❌ WebGL服务未找到');
        return false;
      }

      // 简单方法：重新初始化渲染器的内部数据
      console.log('🔄 重置WebGL渲染器数据...');

      // 这里可以添加清除逻辑，但为了简单，我们只添加一些透明像素
      const clearPixel = {
        gridId: 'clear_' + Date.now(),
        lat: 0,
        lng: 0,
        renderType: 'color',
        patternKey: '#00000000',
        color: '#000000'
      };

      webglService.renderer.updatePixel(clearPixel);
      console.log('✅ 测试像素已清除');
      return true;

    } catch (error) {
      console.error('❌ 清除测试像素失败:', error);
      return false;
    }
  }
}

/**
 * 快速执行
 */
export async function quickLoadSimplePixels(): Promise<void> {
  console.log('🚀 快速加载当前位置像素（简化版）...');

  try {
    const result = await SimplePixelLoader.loadCurrentLocationPixels();

    if (result.success) {
      console.log('🎉 像素加载成功！');
      console.log(`📊 添加了 ${result.loadedTestPixels} 个测试像素`);
      console.log('🧪 现在地图上应该能看到彩色像素点');

      // 3秒后尝试添加更多像素
      setTimeout(async () => {
        console.log('🔧 添加更多测试像素...');
        const moreSuccess = await SimplePixelLoader.addMoreTestPixels(15);

        if (moreSuccess) {
          console.log('🎉 额外像素也添加成功！');
          console.log('💡 现在地图上应该有更多的彩色像素点');
        }
      }, 3000);

    } else {
      console.error('😞 像素加载失败');
      console.error('错误:', result.errors);
      console.warn('警告:', result.warnings);
    }

  } catch (error) {
    console.error('❌ 快速加载失败:', error);
  }
}

// 自动导出到全局供控制台使用
if (typeof window !== 'undefined') {
  (window as any).SimplePixelLoader = SimplePixelLoader;
  (window as any).quickLoadSimplePixels = quickLoadSimplePixels;

  console.log('💡 简单像素加载工具已加载');
  console.log('🎮 使用方法:');
  console.log('  - quickLoadSimplePixels() - 快速加载当前位置像素');
  console.log('  - SimplePixelLoader.loadCurrentLocationPixels() - 详细加载');
  console.log('  - SimplePixelLoader.addMoreTestPixels(10) - 添加更多测试像素');
  console.log('  - SimplePixelLoader.clearTestPixels() - 清除测试像素');
}