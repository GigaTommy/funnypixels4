#!/usr/bin/env node

const { db } = require('../src/config/database');

async function updateCustomFlagKeys() {
  try {
    console.log('🔧 更新自定义图案的key格式...');
    
    // 查找所有自定义图案（key以custom_开头且包含用户ID的）
    const customPatterns = await db('pattern_assets')
      .where('key', 'like', 'custom_%')
      .where('category', 'alliance_flag')
      .select('id', 'key', 'name', 'created_by');
    
    console.log(`📋 找到 ${customPatterns.length} 个需要更新的自定义图案:`);
    customPatterns.forEach((pattern, index) => {
      console.log(`${index + 1}. ID: ${pattern.id}, 当前key: ${pattern.key}, 名称: ${pattern.name}`);
    });
    
    if (customPatterns.length > 0) {
      console.log('\n🔄 开始更新key格式...');
      
      for (const pattern of customPatterns) {
        // 生成新的短key
        const newKey = `custom_${Math.random().toString(36).substr(2, 6)}`;
        
        // 检查新key是否已存在
        const existingPattern = await db('pattern_assets')
          .where('key', newKey)
          .first();
        
        if (existingPattern) {
          console.log(`⚠️ 新key ${newKey} 已存在，跳过更新 ${pattern.key}`);
          continue;
        }
        
        // 更新key
        await db('pattern_assets')
          .where('id', pattern.id)
          .update({
            key: newKey,
            updated_at: db.fn.now()
          });
        
        console.log(`✅ 更新成功: ${pattern.key} -> ${newKey}`);
      }
      
      // 验证更新结果
      console.log('\n📋 更新后的自定义图案:');
      const updatedPatterns = await db('pattern_assets')
        .where('key', 'like', 'custom_%')
        .where('category', 'alliance_flag')
        .select('id', 'key', 'name')
        .orderBy('updated_at', 'desc');
      
      updatedPatterns.forEach((pattern, index) => {
        console.log(`${index + 1}. ID: ${pattern.id}, 新key: ${pattern.key}, 名称: ${pattern.name}`);
      });
    } else {
      console.log('ℹ️ 没有找到需要更新的自定义图案');
    }
    
    console.log('\n🎉 更新完成！');
    
  } catch (error) {
    console.error('❌ 更新失败:', error);
  }
}

updateCustomFlagKeys();
