const { Client } = require('pg');

// 开发环境数据库配置（使用localhost）
const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'password',
  database: 'funnypixels_postgres'
});

async function clearPixels() {
  try {
    console.log('🧹 开始清理pixels表（开发环境 - localhost）...\n');
    
    // 1. 连接数据库
    console.log('📋 步骤 1: 连接开发环境数据库...');
    await client.connect();
    console.log('✅ 数据库连接成功');
    
    // 2. 检查pixels表当前记录数
    console.log('\n📋 步骤 2: 检查当前pixels表记录数...');
    const countResult = await client.query('SELECT COUNT(*) as total FROM pixels');
    const currentCount = parseInt(countResult.rows[0].total);
    console.log(`📊 当前pixels表记录数: ${currentCount}`);
    
    if (currentCount === 0) {
      console.log('✅ pixels表已经是空的，无需清理');
      return;
    }
    
    // 3. 显示要删除的记录详情
    console.log('\n📋 步骤 3: 显示要删除的记录详情...');
    const pixelsResult = await client.query('SELECT id, grid_id, latitude, longitude, color, pattern_id, created_at FROM pixels ORDER BY id');
    
    console.log('🗑️ 将要删除的记录:');
    pixelsResult.rows.forEach((pixel, index) => {
      console.log(`  ${index + 1}. ID: ${pixel.id}, Grid: ${pixel.grid_id}, 坐标: (${pixel.latitude}, ${pixel.longitude}), 颜色: ${pixel.color}, Pattern: ${pixel.pattern_id}`);
    });
    
    // 4. 确认删除操作
    console.log('\n⚠️ 警告: 即将删除所有像素记录！');
    console.log('这个操作是不可逆的，请确认您真的要删除所有像素数据。');
    
    // 5. 执行删除操作
    console.log('\n📋 步骤 4: 执行删除操作...');
    const deleteResult = await client.query('DELETE FROM pixels');
    console.log(`✅ 成功删除 ${deleteResult.rowCount} 条记录`);
    
    // 6. 验证删除结果
    console.log('\n📋 步骤 5: 验证删除结果...');
    const finalCountResult = await client.query('SELECT COUNT(*) as total FROM pixels');
    const finalCount = parseInt(finalCountResult.rows[0].total);
    console.log(`📊 删除后pixels表记录数: ${finalCount}`);
    
    if (finalCount === 0) {
      console.log('✅ 清理完成！pixels表现在是空的');
    } else {
      console.log('❌ 清理可能不完整，还有记录剩余');
    }
    
    // 7. 重置自增ID
    console.log('\n📋 步骤 6: 重置自增ID...');
    await client.query('ALTER SEQUENCE pixels_id_seq RESTART WITH 1');
    console.log('✅ 自增ID已重置为1');
    
  } catch (error) {
    console.error('❌ 清理pixels表失败:', error);
  } finally {
    // 关闭数据库连接
    await client.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

// 执行清理
clearPixels();
