#!/usr/bin/env node

const { db } = require('../src/config/database');

async function updateCustomPatternsCategory() {
  try {
    console.log('🔧 更新自定义图案的category字段...');
    
    // 查找所有用户创建的自定义图案（通过user_custom_patterns表关联）
    const customPatterns = await db('user_custom_patterns')
      .join('pattern_assets', 'user_custom_patterns.pattern_id', 'pattern_assets.id')
      .whereNull('pattern_assets.category') // 查找category为null的图案
      .select('pattern_assets.id', 'pattern_assets.name', 'pattern_assets.category');
    
    console.log(`📋 找到 ${customPatterns.length} 个需要更新的自定义图案:`);
    customPatterns.forEach((pattern, index) => {
      console.log(`${index + 1}. ID: ${pattern.id}, 名称: ${pattern.name}, 当前category: ${pattern.category}`);
    });
    
    if (customPatterns.length > 0) {
      // 更新这些图案的category为'alliance_flag'
      const patternIds = customPatterns.map(p => p.id);
      
      const updatedCount = await db('pattern_assets')
        .whereIn('id', patternIds)
        .update({
          category: 'alliance_flag',
          updated_at: db.fn.now()
        });
      
      console.log(`✅ 成功更新 ${updatedCount} 个自定义图案的category字段`);
      
      // 验证更新结果
      const updatedPatterns = await db('pattern_assets')
        .whereIn('id', patternIds)
        .select('id', 'name', 'category');
      
      console.log('\n📋 更新后的图案信息:');
      updatedPatterns.forEach((pattern, index) => {
        console.log(`${index + 1}. ID: ${pattern.id}, 名称: ${pattern.name}, 新category: ${pattern.category}`);
      });
    } else {
      console.log('ℹ️ 没有找到需要更新的自定义图案');
    }
    
    console.log('\n🎉 更新完成！');
    
  } catch (error) {
    console.error('❌ 更新失败:', error);
  }
}

updateCustomPatternsCategory();
