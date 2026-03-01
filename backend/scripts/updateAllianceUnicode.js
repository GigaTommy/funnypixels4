const { db } = require('../src/config/database');

/**
 * 为现有联盟添加UNICODE编码信息
 */
async function updateAllianceUnicode() {
  try {
    console.log('🔧 开始为现有联盟添加UNICODE编码信息...');
    
    // 获取所有联盟
    const alliances = await db('alliances').select('*');
    console.log(`📊 找到 ${alliances.length} 个联盟`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const alliance of alliances) {
      if (!alliance.flag_pattern_id) {
        console.log(`⚠️ 跳过联盟 ${alliance.name}: 没有旗帜图案ID`);
        skippedCount++;
        continue;
      }
      
      try {
        // 获取图案的UNICODE信息
        let patternAsset = null;
        
        // 检查是否是基础颜色或emoji图案
        const isBasicColor = alliance.flag_pattern_id.startsWith('color_');
        const isEmojiPattern = alliance.flag_pattern_id.startsWith('emoji_');
        
        if (isBasicColor || isEmojiPattern) {
          // 从pattern_assets表获取UNICODE信息
          patternAsset = await db('pattern_assets')
            .where('key', alliance.flag_pattern_id)
            .select('unicode_char', 'render_type')
            .first();
        } else {
          // 对于复杂图案，也尝试获取UNICODE信息
          patternAsset = await db('pattern_assets')
            .where('id', alliance.flag_pattern_id)
            .select('unicode_char', 'render_type')
            .first();
        }
        
        if (patternAsset) {
          // 更新联盟的UNICODE信息
          await db('alliances')
            .where('id', alliance.id)
            .update({
              flag_unicode_char: patternAsset.unicode_char,
              flag_render_type: patternAsset.render_type || 'complex',
              updated_at: db.fn.now()
            });
          
          console.log(`✅ 更新联盟 ${alliance.name}: ${alliance.flag_pattern_id} -> ${patternAsset.unicode_char} (${patternAsset.render_type})`);
          updatedCount++;
        } else {
          console.log(`⚠️ 跳过联盟 ${alliance.name}: 未找到图案 ${alliance.flag_pattern_id} 的UNICODE信息`);
          skippedCount++;
        }
      } catch (error) {
        console.error(`❌ 更新联盟 ${alliance.name} 失败:`, error);
        skippedCount++;
      }
    }
    
    console.log(`🎉 更新完成！`);
    console.log(`✅ 更新了 ${updatedCount} 个联盟`);
    console.log(`⚠️ 跳过了 ${skippedCount} 个联盟`);
    
  } catch (error) {
    console.error('❌ 更新联盟UNICODE编码失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  updateAllianceUnicode()
    .then(() => {
      console.log('✅ 脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = updateAllianceUnicode;
