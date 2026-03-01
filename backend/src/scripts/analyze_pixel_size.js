/**
 * 像素尺寸差异分析
 */

console.log('📏 像素尺寸差异分析\n');
console.log('='.repeat(60));

console.log('\n🔍 发现的问题:\n');

console.log('1️⃣ test_place_ad_simple.js');
console.log('   PIXEL_SIZE = 0.00001° ≈ 1.1米');
console.log('   64x64 像素广告占地: 64 × 1.1m = 70.4米\n');

console.log('2️⃣ AdPixelRenderer.js (正式服务)');
console.log('   PIXEL_SIZE = 0.0001° ≈ 11米');
console.log('   64x64 像素广告占地: 64 × 11m = 704米\n');

console.log('3️⃣ 手动绘制 (前端)');
console.log('   应该也是 0.0001° ≈ 11米');

console.log('\n' + '='.repeat(60));
console.log('📊 尺寸对比:\n');

const testScriptSize = 0.00001;
const officialSize = 0.0001;
const ratio = officialSize / testScriptSize;

console.log(`测试脚本像素: ${testScriptSize}° ≈ ${(testScriptSize * 111000).toFixed(1)}米`);
console.log(`正式服务像素: ${officialSize}° ≈ ${(officialSize * 111000).toFixed(1)}米`);
console.log(`\n尺寸比例: ${ratio}:1 (正式服务的像素是测试脚本的 ${ratio} 倍)`);

console.log('\n64x64 广告的实际占地面积:');
console.log(`  测试脚本: ${(64 * testScriptSize * 111000 / 1000).toFixed(3)} km × ${(64 * testScriptSize * 111000 / 1000).toFixed(3)} km`);
console.log(`  正式服务: ${(64 * officialSize * 111000 / 1000).toFixed(3)} km × ${(64 * officialSize * 111000 / 1000).toFixed(3)} km`);

console.log('\n' + '='.repeat(60));
console.log('💡 为什么测试脚本的像素看起来小得多?\n');

console.log('因为 PIXEL_SIZE 差了 10 倍！');
console.log(`  ❌ 测试脚本: 0.00001° (每个像素只有 1.1米)`);
console.log(`  ✅ 正式服务: 0.0001° (每个像素是 11米)`);
console.log(`\n结果: 测试脚本生成的广告在地图上看起来只有正式广告的 1/10 大小`);

console.log('\n' + '='.repeat(60));
console.log('🔧 解决方案:\n');

console.log('修改 test_place_ad_simple.js 中的 PIXEL_SIZE:');
console.log('');
console.log('  ❌ 错误的:');
console.log('  const PIXEL_SIZE = 0.00001; // 约1米');
console.log('');
console.log('  ✅ 正确的:');
console.log('  const PIXEL_SIZE = 0.0001; // 约11米 (与正式服务一致)');

console.log('\n' + '='.repeat(60));
console.log('📐 网格系统标准:\n');

console.log('系统使用的标准网格尺寸: 0.0001°');
console.log('  - 纬度方向: 0.0001° ≈ 11.1 米');
console.log('  - 经度方向(赤道): 0.0001° ≈ 11.1 米');
console.log('  - 经度方向(广州23°N): 0.0001° ≈ 10.2 米');
console.log('');
console.log('所有像素相关的操作都应该使用 0.0001° 作为基准单位');
