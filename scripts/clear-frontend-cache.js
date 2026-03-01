/**
 * 清理前端MaterialLoaderService缓存
 * 在浏览器控制台执行
 */

// 清理MaterialLoaderService缓存
if (window.materialLoaderService) {
  console.log('🧹 清理MaterialLoaderService缓存...');

  // 清理图片缓存
  window.materialLoaderService.clearCache();

  // 清理所有缓存的materials
  const stats = window.materialLoaderService.getStats();
  console.log('清理前的缓存统计:', stats);

  console.log('✅ 前端MaterialLoaderService缓存已清理');
} else {
  console.log('⚠️ MaterialLoaderService未找到，可能需要先访问地图页面');
}

// 清理WebGL纹理缓存
if (window.webglService && window.webglService.renderer) {
  console.log('🧹 清理WebGL纹理缓存...');

  // 清理纹理图集
  const textureAtlas = window.webglService.renderer.getTextureAtlas();
  if (textureAtlas && textureAtlas.clear) {
    textureAtlas.clear();
    console.log('✅ WebGL纹理图集已清理');
  }

  // 强制重新初始化WebGL
  window.webglService.initialize().then(() => {
    console.log('✅ WebGL已重新初始化');
  });
}

// 清理localStorage中的相关缓存
const keysToRemove = [];
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  if (key && (key.includes('material') || key.includes('emoji') || key.includes('pattern'))) {
    keysToRemove.push(key);
  }
}

keysToRemove.forEach(key => {
  localStorage.removeItem(key);
  console.log(`✅ 清理localStorage: ${key}`);
});

console.log('🎉 前端缓存清理完成！');
console.log('💡 现在刷新页面，emoji应该能正确渲染为彩色了');

// 提示刷新页面
setTimeout(() => {
  if (confirm('前端缓存已清理完成，是否立即刷新页面？')) {
    window.location.reload();
  }
}, 1000);