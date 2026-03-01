#!/usr/bin/env node

/**
 * 重置道具冷却时间的脚本
 * 用于测试使用道具功能
 */

const knex = require('knex');
const fs = require('fs');
const path = require('path');

async function resetCooldown() {
  try {
    console.log('🔍 开始重置道具冷却时间...');
    
    // 读取生产环境配置
    console.log('\n1️⃣ 读取生产环境配置...');
    const configPath = path.join(__dirname, '..', 'config', 'production-database.json');
    
    if (!fs.existsSync(configPath)) {
      console.error('❌ 错误: 找不到生产环境配置文件');
      return;
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('✅ 配置文件读取成功');
    
    // 创建数据库连接
    console.log('\n2️⃣ 创建生产环境数据库连接...');
    const db = knex({
      client: 'postgresql',
      connection: {
        host: config.database.host,
        port: config.database.port,
        user: config.database.user,
        password: config.database.password,
        database: config.database.database,
        ssl: {
          rejectUnauthorized: false
        }
      },
      pool: {
        min: 2,
        max: 10
      }
    });
    
    // 测试连接
    console.log('\n3️⃣ 测试数据库连接...');
    await db.raw('SELECT 1 as test');
    console.log('✅ 数据库连接成功');
    
    // 查找测试用户
    console.log('\n4️⃣ 查找测试用户...');
    const testUser = await db('users')
      .where('username', 'user_8000')
      .first();
    
    if (!testUser) {
      console.error('❌ 错误: 找不到测试用户 user_8000');
      return;
    }
    
    console.log('✅ 找到测试用户:', {
      id: testUser.id,
      username: testUser.username
    });
    
    // 查找用户的炸弹道具
    console.log('\n5️⃣ 查找用户的炸弹道具...');
    const bombInventory = await db('user_inventory')
      .join('store_items', 'user_inventory.item_id', 'store_items.id')
      .where('user_inventory.user_id', testUser.id)
      .where('store_items.item_type', 'special')
      .where('store_items.name', 'like', '%炸弹%')
      .select(
        'user_inventory.id',
        'user_inventory.quantity',
        'user_inventory.last_used_at',
        'store_items.name',
        'store_items.metadata'
      );
    
    console.log('📋 用户的炸弹道具:');
    bombInventory.forEach(item => {
      console.log(`  - ${item.name}:`);
      console.log(`    数量: ${item.quantity}`);
      console.log(`    上次使用: ${item.last_used_at || '从未使用'}`);
      console.log(`    冷却时间: ${item.metadata?.cooldown_minutes || 0}分钟`);
    });
    
    // 重置冷却时间
    console.log('\n6️⃣ 重置冷却时间...');
    for (const item of bombInventory) {
      await db('user_inventory')
        .where('id', item.id)
        .update({
          last_used_at: null // 重置为null，表示从未使用
        });
      
      console.log(`✅ 已重置 ${item.name} 的冷却时间`);
    }
    
    // 验证重置结果
    console.log('\n7️⃣ 验证重置结果...');
    const updatedInventory = await db('user_inventory')
      .join('store_items', 'user_inventory.item_id', 'store_items.id')
      .where('user_inventory.user_id', testUser.id)
      .where('store_items.item_type', 'special')
      .where('store_items.name', 'like', '%炸弹%')
      .select(
        'user_inventory.id',
        'user_inventory.quantity',
        'user_inventory.last_used_at',
        'store_items.name'
      );
    
    console.log('📋 重置后的道具状态:');
    updatedInventory.forEach(item => {
      console.log(`  - ${item.name}:`);
      console.log(`    数量: ${item.quantity}`);
      console.log(`    上次使用: ${item.last_used_at || '从未使用'}`);
    });
    
    // 关闭连接
    await db.destroy();
    console.log('\n✅ 冷却时间重置完成');
    
    // 提供测试建议
    console.log('\n📋 测试建议:');
    console.log('1. 测试使用炸弹道具:');
    console.log('   node scripts/test-use-item.js');
    console.log('');
    console.log('2. 现在应该可以正常使用道具了');
    
  } catch (error) {
    console.error('\n❌ 重置冷却时间失败:');
    console.error('错误类型:', error.constructor.name);
    console.error('错误消息:', error.message);
    console.error('错误代码:', error.code);
    console.error('错误详情:', error);
  }
}

resetCooldown();
