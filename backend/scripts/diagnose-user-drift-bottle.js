#!/usr/bin/env node
/**
 * 诊断用户的漂流瓶功能状态
 * 检查：配额API、认证、权限等
 */

const { db } = require('../src/config/database');
const { initializeRedis, closeRedis } = require('../src/config/redis');
const quotaService = require('../src/services/driftBottleQuotaService');
const jwt = require('jsonwebtoken');

async function diagnoseUser(username) {
  console.log(`🔍 诊断用户 "${username}" 的漂流瓶功能...\n`);

  try {
    // 初始化 Redis
    await initializeRedis();

    // 1. 查找用户
    const user = await db('users').where({ username }).first();

    if (!user) {
      console.log(`❌ 用户 "${username}" 不存在`);
      return;
    }

    console.log('👤 用户基本信息:');
    console.log(`   ID: ${user.id}`);
    console.log(`   用户名: ${user.username}`);
    console.log(`   邮箱: ${user.email || '未设置'}`);
    console.log(`   总像素: ${user.total_pixels}`);
    console.log(`   创建时间: ${user.created_at}\n`);

    // 2. 测试JWT Token生成
    console.log('🔑 生成测试Token:');
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    console.log(`   Token: ${token.substring(0, 50)}...`);
    console.log(`   有效期: 7天\n`);

    // 3. 测试配额API
    console.log('📊 测试配额API:');
    try {
      const quota = await quotaService.getQuota(user.id);
      console.log('   ✅ API调用成功');
      console.log(`   可抛瓶数: ${quota.total_throw_available}`);
      console.log(`   可拾取数: ${quota.total_pickup_available}`);
      console.log(`   每日免费: ${quota.daily_remaining}/${quota.daily_free}`);
      console.log(`   画像素奖励: ${quota.bonus_from_pixels}`);
      console.log(`   抛瓶奖励: ${quota.bonus_from_throw}\n`);

      // 4. 显示配额详情
      console.log('📋 配额计算详情:');
      console.log(`   总像素: ${user.total_pixels}`);
      console.log(`   已兑换: ${user.drift_bottle_pixels_redeemed || 0}`);
      console.log(`   未兑换: ${user.total_pixels - (user.drift_bottle_pixels_redeemed || 0)}`);
      console.log(`   每50像素 = 1瓶`);
      console.log(`   预期瓶数: ${Math.floor((user.total_pixels - (user.drift_bottle_pixels_redeemed || 0)) / 50)}\n`);

      // 5. 检查是否有漂流瓶
      const bottles = await db('drift_bottles')
        .where({ original_owner_id: user.id })
        .count('* as count')
        .first();

      console.log('🍾 漂流瓶统计:');
      console.log(`   已创建: ${bottles.count} 个\n`);

      // 6. 检查API路由配置
      console.log('🌐 API路由检查:');
      console.log(`   配额API: GET /api/drift-bottles/quota`);
      console.log(`   抛瓶API: POST /api/drift-bottles/throw`);
      console.log(`   遭遇API: GET /api/drift-bottles/encounter\n`);

      // 7. 生成测试curl命令
      console.log('🧪 测试命令:');
      console.log('\n1. 测试配额API:');
      console.log(`curl -X GET http://192.168.0.3:3001/api/drift-bottles/quota \\`);
      console.log(`  -H "Authorization: Bearer ${token}"\n`);

      console.log('2. 测试抛瓶API:');
      console.log(`curl -X POST http://192.168.0.3:3001/api/drift-bottles/throw \\`);
      console.log(`  -H "Authorization: Bearer ${token}" \\`);
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -d '{`);
      console.log(`    "content": "测试留言",`);
      console.log(`    "pixelSnapshot": [["#FF5733","#33FF57","#3357FF","#F333FF","#FF33F3"],["#33FFF3","#FFD700","#FFA500","#FF5733","#33FF57"],["#3357FF","#F333FF","#FF33F3","#33FFF3","#FFD700"],["#FFA500","#FF5733","#33FF57","#3357FF","#F333FF"],["#FF33F3","#33FFF3","#FFD700","#FFA500","#FF5733"]]`);
      console.log(`  }'\n`);

      // 8. APP显示问题诊断
      console.log('📱 APP显示诊断:');

      if (quota.total_throw_available > 0) {
        console.log('   ✅ 配额正常，用户应该能看到漂流瓶入口');
      } else {
        console.log('   ⚠️ 配额为0，但应该仍能看到入口（显示为灰色/禁用状态）');
      }

      console.log('\n可能原因：');
      console.log('   1. APP未正确加载配额');
      console.log('   2. Token过期或无效');
      console.log('   3. GPS绘制模式开启（漂流瓶入口会隐藏）');
      console.log('   4. 网络连接问题');
      console.log('   5. APP缓存问题\n');

      console.log('解决方案：');
      console.log('   1. 在APP中完全退出登录，重新登录');
      console.log('   2. 确认不在GPS绘制模式');
      console.log('   3. 检查地图Tab左侧是否有小船图标');
      console.log('   4. 使用上述curl命令测试API是否正常\n');

    } catch (apiError) {
      console.log('   ❌ API调用失败:', apiError.message);
      console.log('   这可能是Redis连接问题\n');
    }

  } catch (error) {
    console.error('❌ 诊断失败:', error);
    throw error;
  } finally {
    await closeRedis();
    await db.destroy();
  }
}

// 执行诊断
if (require.main === module) {
  const username = process.argv[2] || 'bcd';
  diagnoseUser(username)
    .then(() => {
      console.log('✅ 诊断完成\n');
      process.exit(0);
    })
    .catch(err => {
      console.error('💥 诊断出错:', err);
      process.exit(1);
    });
}

module.exports = { diagnoseUser };
