/**
 * 检查现有的 pattern_assets
 */

const { db } = require('./src/config/database');

async function checkPatternAssets() {
  try {
    console.log('🔍 检查 pattern_assets 表...\n');

    const assets = await db('pattern_assets')
      .select('id', 'key', 'name', 'category', 'render_type', 'unicode_char')
      .limit(30);

    console.log(`📊 找到 ${assets.length} 个图案资源:\n`);

    assets.forEach(asset => {
      console.log(`[${asset.id}] ${asset.key || '(no key)'}`);
      console.log(`  name: ${asset.name}`);
      console.log(`  category: ${asset.category}`);
      console.log(`  render_type: ${asset.render_type || 'N/A'}`);
      console.log(`  unicode_char: ${asset.unicode_char || 'N/A'}`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ 检查失败:', error);
    process.exit(1);
  }
}

checkPatternAssets();
