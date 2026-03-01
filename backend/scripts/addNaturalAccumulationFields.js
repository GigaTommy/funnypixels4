const { db } = require('../src/config/database');

/**
 * 添加自然累计相关字段到user_pixel_states表
 */
async function addNaturalAccumulationFields() {
  try {
    console.log('🔧 开始添加自然累计相关字段...');

    // 检查字段是否已存在
    const columns = await db.raw(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_pixel_states' 
      AND column_name IN ('last_activity_time', 'is_in_natural_accumulation')
    `);

    const existingColumns = columns.rows.map(row => row.column_name);
    console.log('现有字段:', existingColumns);

    // 添加last_activity_time字段
    if (!existingColumns.includes('last_activity_time')) {
      console.log('添加 last_activity_time 字段...');
      await db.raw(`
        ALTER TABLE user_pixel_states 
        ADD COLUMN last_activity_time BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())
      `);
      console.log('✅ last_activity_time 字段添加成功');
    } else {
      console.log('⚠️ last_activity_time 字段已存在');
    }

    // 添加is_in_natural_accumulation字段
    if (!existingColumns.includes('is_in_natural_accumulation')) {
      console.log('添加 is_in_natural_accumulation 字段...');
      await db.raw(`
        ALTER TABLE user_pixel_states 
        ADD COLUMN is_in_natural_accumulation BOOLEAN DEFAULT FALSE
      `);
      console.log('✅ is_in_natural_accumulation 字段添加成功');
    } else {
      console.log('⚠️ is_in_natural_accumulation 字段已存在');
    }

    // 更新现有记录的last_activity_time字段
    console.log('更新现有记录的last_activity_time字段...');
    await db.raw(`
      UPDATE user_pixel_states 
      SET last_activity_time = EXTRACT(EPOCH FROM NOW())
      WHERE last_activity_time IS NULL
    `);
    console.log('✅ 现有记录更新完成');

    console.log('🎉 自然累计字段添加完成！');
  } catch (error) {
    console.error('❌ 添加自然累计字段失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  addNaturalAccumulationFields()
    .then(() => {
      console.log('✅ 迁移完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 迁移失败:', error);
      process.exit(1);
    });
}

module.exports = addNaturalAccumulationFields;
