#!/usr/bin/env node

/**
 * 给测试用户添加炸弹道具的脚本
 * 用于测试使用炸弹功能
 */

const knex = require('knex');
const fs = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');

async function addBombItem() {
  try {
    logger.info('🔍 开始给测试用户添加炸弹道具...');

    // 读取生产环境配置
    logger.info('\n1️⃣ 读取生产环境配置...');
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
    
    // 查找炸弹道具
    console.log('\n5️⃣ 查找炸弹道具...');
    const bombItems = await db('store_items')
      .where('item_type', 'special')
      .where('name', 'like', '%炸弹%')
      .select('id', 'name', 'price_points', 'metadata');
    
    console.log('📋 找到的炸弹道具:');
    bombItems.forEach(item => {
      console.log(`  - ${item.name} (ID: ${item.id}, 价格: ${item.price_points}积分)`);
    });
    
    if (bombItems.length === 0) {
      console.error('❌ 错误: 没有找到炸弹道具');
      return;
    }
    
    // 选择第一个炸弹道具
    const bombItem = bombItems[0];
    console.log(`\n6️⃣ 添加炸弹道具: ${bombItem.name}...`);
    
    // 检查用户是否已有该道具
    const existingInventory = await db('user_inventory')
      .where({
        user_id: testUser.id,
        item_id: bombItem.id
      })
      .first();
    
    if (existingInventory) {
      console.log('📋 用户已有该道具，增加数量...');
      await db('user_inventory')
        .where({
          user_id: testUser.id,
          item_id: bombItem.id
        })
        .increment('quantity', 1);
      
      console.log('✅ 已增加道具数量');
    } else {
      console.log('📋 用户没有该道具，创建新记录...');
      await db('user_inventory').insert({
        user_id: testUser.id,
        item_id: bombItem.id,
        quantity: 1,
        consumed: false,
        acquired_at: new Date()
      });
      
      console.log('✅ 已创建道具记录');
    }
    
    // 验证添加结果
    console.log('\n7️⃣ 验证添加结果...');
    const updatedInventory = await db('user_inventory')
      .join('store_items', 'user_inventory.item_id', 'store_items.id')
      .where('user_inventory.user_id', testUser.id)
      .where('user_inventory.item_id', bombItem.id)
      .select(
        'user_inventory.quantity',
        'user_inventory.acquired_at',
        'store_items.name',
        'store_items.metadata'
      )
      .first();
    
    if (updatedInventory) {
      console.log('📋 道具信息:', {
        name: updatedInventory.name,
        quantity: updatedInventory.quantity,
        acquired_at: updatedInventory.acquired_at,
        metadata: updatedInventory.metadata
      });
    }
    
    // 关闭连接
    await db.destroy();
    console.log('\n✅ 炸弹道具添加完成');
    
    // 提供测试建议
    console.log('\n📋 测试建议:');
    console.log('1. 测试使用炸弹道具:');
    console.log('   node scripts/test-use-item.js');
    console.log('');
    console.log('2. 或者等待冷却时间结束后再测试');
    
  } catch (error) {
    console.error('\n❌ 添加炸弹道具失败:');
    console.error('错误类型:', error.constructor.name);
    console.error('错误消息:', error.message);
    console.error('错误代码:', error.code);
    console.error('错误详情:', error);
  }
}

addBombItem();
