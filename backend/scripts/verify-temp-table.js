const { db } = require('../src/config/database');

/**
 * 验证临时图案存储表是否已创建
 */
async function verifyTempTable() {
  try {
    console.log('🔍 验证 temp_pattern_storage 表...');
    
    // 检查表是否存在
    const tables = await db.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'temp_pattern_storage'
    `);
    
    if (tables.rows.length > 0) {
      console.log('✅ temp_pattern_storage 表已创建');
      
      // 获取表结构
      const columns = await db.raw(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'temp_pattern_storage' 
        ORDER BY ordinal_position
      `);
      
      console.log('\n📊 表结构:');
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''} ${col.column_default ? `(默认: ${col.column_default})` : ''}`);
      });
      
      // 检查索引
      const indexes = await db.raw(`
        SELECT indexname, indexdef
        FROM pg_indexes 
        WHERE tablename = 'temp_pattern_storage'
      `);
      
      console.log('\n🔍 索引:');
      indexes.rows.forEach(idx => {
        console.log(`  - ${idx.indexname}: ${idx.indexdef}`);
      });
      
    } else {
      console.log('❌ temp_pattern_storage 表未创建');
    }
    
  } catch (error) {
    console.error('❌ 验证失败:', error);
  } finally {
    await db.destroy();
  }
}

// 运行验证
if (require.main === module) {
  verifyTempTable();
}

module.exports = { verifyTempTable };
