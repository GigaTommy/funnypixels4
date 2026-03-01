/**
 * 清理emoji相关的所有缓存
 */

const materialRendererCache = require('../backend/src/services/materialRendererCache');
const { db } = require('../backend/src/config/database');

async function clearEmojiCache() {
  console.log('🧹 开始清理emoji相关缓存...\n');

  try {
    // 1. 清理material renderer缓存
    console.log('1️⃣ 清理material renderer缓存...');

    // 获取所有emoji的material_id
    const emojiPatterns = await db('pattern_assets')
      .where('key', 'like', 'emoji_%')
      .select('material_id');

    console.log(`找到 ${emojiPatterns.length} 个emoji patterns`);

    // 清理每个emoji的缓存
    for (const pattern of emojiPatterns) {
      if (pattern.material_id) {
        materialRendererCache.invalidateMaterial(pattern.material_id);
        materialRendererCache.invalidatePatternsByMaterial(pattern.material_id);
        console.log(`✅ 清理缓存: ${pattern.material_id}`);
      }
    }

    // 2. 清理所有emoji key的pattern缓存
    console.log('\n2️⃣ 清理emoji pattern缓存...');
    const emojiKeys = await db('pattern_assets')
      .where('key', 'like', 'emoji_%')
      .select('key');

    for (const emoji of emojiKeys) {
      materialRendererCache.invalidatePattern(emoji.key);
      console.log(`✅ 清理pattern缓存: ${emoji.key}`);
    }

    // 3. 全部清理（最保险）
    console.log('\n3️⃣ 执行全量缓存清理...');
    materialRendererCache.clear();
    console.log('✅ 全部缓存已清理');

    console.log('\n🎉 emoji缓存清理完成！');
    console.log('💡 现在重启服务器，emoji应该能正确渲染为彩色了');

  } catch (error) {
    console.error('❌ 清理缓存失败:', error);
    throw error;
  } finally {
    await db.destroy();
  }
}

// 运行清理
clearEmojiCache().catch(error => {
  console.error('💥 脚本执行失败:', error);
  process.exit(1);
});