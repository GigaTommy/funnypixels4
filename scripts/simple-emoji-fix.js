/**
 * 简化的emoji修复脚本
 * 只为emoji创建material_assets记录，不创建variants
 */

const { db } = require('../backend/src/config/database');

// Emoji列表
const EMOJIS = [
  { key: 'emoji_crown', name: '皇冠' },
  { key: 'emoji_star', name: '星星' },
  { key: 'emoji_heart', name: '爱心' },
  { key: 'emoji_fire', name: '火焰' },
  { key: 'emoji_water', name: '水滴' },
  { key: 'emoji_leaf', name: '叶子' },
  { key: 'emoji_sun', name: '太阳' },
  { key: 'emoji_moon', name: '月亮' },
  { key: 'emoji_cloud', name: '云' },
  { key: 'emoji_rainbow', name: '彩虹' },
  { key: 'emoji_thunder', name: '闪电' },
  { key: 'emoji_snow', name: '雪花' },
  { key: 'emoji_rain', name: '雨伞' },
  { key: 'emoji_anchor', name: '锚' },
  { key: 'emoji_compass', name: '指南针' },
  { key: 'emoji_earth', name: '地球' }
];

/**
 * 生成UUID
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 简单修复函数
 */
async function simpleFix() {
  console.log('🔧 开始简单修复emoji material_id...\n');

  try {
    for (const emoji of EMOJIS) {
      console.log(`📋 处理: ${emoji.name} (${emoji.key})`);

      // 1. 检查是否已有material_assets记录
      const existingMaterial = await db('material_assets')
        .where({ key: emoji.key })
        .first();

      let materialId;

      if (existingMaterial) {
        materialId = existingMaterial.id;
        console.log(`✅ 已有material_assets记录: ${materialId}`);
      } else {
        // 2. 创建简化的material_assets记录
        materialId = generateUUID();

        await db('material_assets').insert({
          id: materialId,
          key: emoji.key,
          display_name: `${emoji.name} (${emoji.key})`,
          material_type: 'emoji_image',
          source_type: 'cdn_download',
          status: 'ready',
          version: 1,
          created_at: new Date(),
          updated_at: new Date()
        });

        console.log(`✅ 创建material_assets记录: ${materialId}`);
      }

      // 3. 更新pattern_assets的material_id
      const updateResult = await db('pattern_assets')
        .where({ key: emoji.key })
        .update({
          material_id: materialId,
          material_version: 1,
          updated_at: new Date()
        });

      if (updateResult > 0) {
        console.log(`✅ 更新pattern_assets.material_id: ${materialId}`);
      } else {
        console.log(`⚠️ pattern_assets记录不存在: ${emoji.key}`);
      }
    }

    // 4. 验证修复结果
    console.log('\n' + '=' .repeat(60));
    console.log('🔍 验证修复结果...\n');

    const updatedEmojis = await db('pattern_assets')
      .where('key', 'like', 'emoji_%')
      .select('key', 'render_type', 'encoding', 'image_url', 'material_id', 'material_version');

    console.log('📊 修复后的emoji配置:');
    console.table(updatedEmojis);

    // 特别检查emoji_fire
    const fireEmoji = updatedEmojis.find(e => e.key === 'emoji_fire');
    if (fireEmoji && fireEmoji.material_id) {
      console.log(`\n🎉 emoji_fire修复成功！`);
      console.log(`   material_id: ${fireEmoji.material_id}`);
      console.log(`   render_type: ${fireEmoji.render_type}`);
      console.log(`   image_url: ${fireEmoji.image_url}`);
      console.log(`   material_version: ${fireEmoji.material_version}`);
    } else {
      console.log(`\n❌ emoji_fire修复失败！`);
    }

    console.log('\n💡 下一步检查后端渲染逻辑...');

    // 检查是否有现有的complex类型材质可以参考
    const existingComplex = await db('pattern_assets')
      .where('render_type', 'complex')
      .whereNotNull('material_id')
      .select('key', 'material_id')
      .limit(3);

    if (existingComplex.length > 0) {
      console.log('\n📊 参考的complex类型配置:');
      console.table(existingComplex);
    }

  } catch (error) {
    console.error('❌ 修复失败:', error);
    throw error;
  } finally {
    await db.destroy();
  }
}

// 运行修复
simpleFix().catch(error => {
  console.error('💥 脚本执行失败:', error);
  process.exit(1);
});