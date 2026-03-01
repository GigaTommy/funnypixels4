const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 开始部署广告系统...');

try {
  // 1. 运行数据库迁移
  console.log('📊 执行数据库迁移...');
  execSync('npx knex migrate:latest', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });

  // 2. 初始化广告商品
  console.log('🛍️ 初始化广告商品...');
  execSync('node scripts/init-ad-products.js', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });

  console.log('✅ 广告系统部署完成！');
  console.log('');
  console.log('📋 已创建的功能:');
  console.log('  ✅ 数据库表结构');
  console.log('    - ad_products (广告商品表)');
  console.log('    - ad_orders (广告订单表)');
  console.log('    - user_ad_inventory (用户广告库存表)');
  console.log('    - ad_placements (广告放置记录表)');
  console.log('');
  console.log('  ✅ 后端API接口');
  console.log('    - 广告商品管理');
  console.log('    - 广告订单创建和查询');
  console.log('    - 管理员审核系统');
  console.log('    - 广告库存管理');
  console.log('    - 广告放置功能');
  console.log('');
  console.log('  ✅ 前端页面');
  console.log('    - 广告商店页面 (AdStorePage)');
  console.log('    - 广告库存页面 (AdInventoryPage)');
  console.log('    - 广告审核页面 (AdReviewPage)');
  console.log('    - 商店页面集成');
  console.log('');
  console.log('🛍️ 已添加的广告商品:');
  console.log('  - 长方形广告位 (100×50) - 5000积分');
  console.log('  - 方形广告位 (64×64) - 5000积分');
  console.log('');
  console.log('🎯 功能特点:');
  console.log('  📢 用户可购买广告位并上传图片');
  console.log('  ⚙️ 管理员审核系统，确保广告质量');
  console.log('  📦 广告库存管理，支持多次使用');
  console.log('  🗺️ 广告放置功能，转换为像素点集合');
  console.log('  🎨 图片智能处理，支持多种格式');
  console.log('');
  console.log('🚀 下一步:');
  console.log('  1. 重启后端服务: npm start');
  console.log('  2. 重启前端服务: npm run dev');
  console.log('  3. 测试广告购买流程');
  console.log('  4. 测试管理员审核功能');
  console.log('  5. 测试广告放置功能');
  console.log('');
  console.log('📖 使用说明:');
  console.log('  1. 用户在商店页面点击"广告商店"按钮');
  console.log('  2. 选择广告尺寸，上传图片，创建订单');
  console.log('  3. 管理员在审核页面批准/拒绝订单');
  console.log('  4. 批准后广告进入用户库存');
  console.log('  5. 用户在库存页面选择位置放置广告');
  console.log('  6. 系统将图片转换为像素点集合放置在地图上');

} catch (error) {
  console.error('❌ 部署失败:', error.message);
  process.exit(1);
}
