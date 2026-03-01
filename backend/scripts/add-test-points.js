#!/usr/bin/env node

/**
 * 给测试用户添加积分的脚本
 * 用于测试积分扣除功能
 */

const knex = require('knex');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

async function addTestPoints() {
  try {
    console.log('🔍 开始给测试用户添加积分...');
    
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
      username: testUser.username,
      email: testUser.email
    });
    
    // 检查用户当前积分
    console.log('\n5️⃣ 检查用户当前积分...');
    const userPoints = await db('user_points')
      .where('user_id', testUser.id)
      .first();
    
    if (userPoints) {
      console.log('📋 当前积分:', userPoints.total_points);
    } else {
      console.log('⚠️ 用户没有积分记录，创建积分记录...');
      await db('user_points').insert({
        user_id: testUser.id,
        total_points: 0,
        created_at: new Date(),
        updated_at: new Date()
      });
      console.log('✅ 已创建积分记录');
    }
    
    // 添加积分
    console.log('\n6️⃣ 添加积分...');
    const pointsToAdd = 5000; // 添加5000积分用于测试
    
    await db.transaction(async (trx) => {
      // 更新用户积分
      await trx('user_points')
        .where('user_id', testUser.id)
        .increment('total_points', pointsToAdd);
      
      // 记录账本
      await trx('wallet_ledger').insert({
        id: uuidv4(),
        user_id: testUser.id,
        delta_points: pointsToAdd,
        reason: '测试积分',
        ref_id: 'test_points'
      });
    });
    
    console.log(`✅ 已添加 ${pointsToAdd} 积分`);
    
    // 验证积分添加结果
    console.log('\n7️⃣ 验证积分添加结果...');
    const updatedUserPoints = await db('user_points')
      .where('user_id', testUser.id)
      .first();
    
    console.log('📋 更新后积分:', updatedUserPoints.total_points);
    
    // 检查账本记录
    const ledgerRecord = await db('wallet_ledger')
      .where('user_id', testUser.id)
      .where('reason', '测试积分')
      .orderBy('created_at', 'desc')
      .first();
    
    if (ledgerRecord) {
      console.log('📋 账本记录:', {
        delta_points: ledgerRecord.delta_points,
        reason: ledgerRecord.reason,
        created_at: ledgerRecord.created_at
      });
    }
    
    // 关闭连接
    await db.destroy();
    console.log('\n✅ 积分添加完成');
    
    // 提供测试建议
    console.log('\n📋 测试建议:');
    console.log('1. 测试积分扣除功能:');
    console.log('   node scripts/test-points-deduction.js');
    console.log('');
    console.log('2. 测试购买功能:');
    console.log('   node scripts/test-correct-item-id.js');
    
  } catch (error) {
    console.error('\n❌ 添加测试积分失败:');
    console.error('错误类型:', error.constructor.name);
    console.error('错误消息:', error.message);
    console.error('错误代码:', error.code);
    console.error('错误详情:', error);
  }
}

addTestPoints();
