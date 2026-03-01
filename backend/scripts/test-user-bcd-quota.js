#!/usr/bin/env node
/**
 * 测试用户 bcd 的漂流瓶配额是否正确
 */

const { db } = require('../src/config/database');
const { initializeRedis, closeRedis, isConnected } = require('../src/config/redis');
const quotaService = require('../src/services/driftBottleQuotaService');
const Logger = require('../src/utils/logger');

async function testUserBcdQuota() {
  console.log('🧪 测试用户 bcd 的漂流瓶配额...\n');

  try {
    // 初始化 Redis 连接
    if (!isConnected) {
      console.log('🔌 连接 Redis...');
      await initializeRedis();
      console.log('✅ Redis 连接成功\n');
    }

    // 1. 获取用户 bcd
    const user = await db('users').where({ username: 'bcd' }).first();

    if (!user) {
      console.log('❌ 用户 bcd 不存在');
      return;
    }

    console.log('👤 用户信息:');
    console.log(`   用户名: ${user.username}`);
    console.log(`   ID: ${user.id}`);
    console.log(`   总像素数: ${user.total_pixels}`);
    console.log(`   已兑换像素: ${user.drift_bottle_pixels_redeemed || 0}`);

    const unredeemed = user.total_pixels - (user.drift_bottle_pixels_redeemed || 0);
    const expectedBottles = Math.floor(unredeemed / 50);

    console.log(`   未兑换像素: ${unredeemed}`);
    console.log(`   预期可用瓶子数: ${expectedBottles} (每50像素=1瓶)\n`);

    // 2. 测试配额服务
    console.log('📊 调用配额服务...');
    const quota = await quotaService.getQuota(user.id);

    console.log('\n🎯 配额服务返回结果:');
    console.log('='.repeat(60));
    console.log(`   每日免费次数: ${quota.daily_free}`);
    console.log(`   今日已使用: ${quota.daily_used}`);
    console.log(`   今日剩余: ${quota.daily_remaining}`);
    console.log(`   画像素奖励: ${quota.bonus_from_pixels} 个瓶子`);
    console.log(`   抛瓶奖励: ${quota.bonus_from_throw} 次拾取`);
    console.log(`   今日抛瓶次数: ${quota.throw_count_today}`);
    console.log(`   今日拾取次数: ${quota.pickup_count_today}`);
    console.log(`   总可拾取次数: ${quota.total_pickup_available}`);
    console.log(`   总可抛瓶数: ${quota.total_throw_available}`);
    console.log(`   距离下一个瓶子还需: ${quota.pixels_for_next_bottle} 像素`);
    console.log('='.repeat(60));

    // 3. 验证结果
    console.log('\n🔍 验证结果:');

    if (quota.total_throw_available === expectedBottles) {
      console.log(`✅ 成功！可抛瓶数正确: ${quota.total_throw_available} 个`);
    } else {
      console.log(`❌ 失败！预期 ${expectedBottles} 个瓶子，但获得 ${quota.total_throw_available} 个`);
    }

    if (quota.bonus_from_pixels === expectedBottles) {
      console.log(`✅ 画像素奖励计算正确: ${quota.bonus_from_pixels} 个`);
    } else {
      console.log(`❌ 画像素奖励错误: 预期 ${expectedBottles}，获得 ${quota.bonus_from_pixels}`);
    }

    // 4. 显示操作指南
    console.log('\n📖 用户操作指南:');
    console.log('   1. 用户 bcd 打开 APP，进入漂流瓶功能');
    console.log(`   2. 点击"抛瓶"按钮，应该显示有 ${quota.total_throw_available} 个瓶子可用`);
    console.log('   3. 填写留言内容（可选）');
    console.log('   4. 确认抛出，系统会消耗 50 像素，创建漂流瓶');
    console.log(`   5. 抛出后剩余: ${quota.total_throw_available - 1} 个瓶子\n`);

    // 5. API 测试建议
    console.log('🔧 API 测试建议:');
    console.log('   可以使用以下 API 测试抛瓶功能:');
    console.log('   POST /api/drift-bottles/throw');
    console.log('   Body: {');
    console.log('     "content": "测试留言",');
    console.log('     "pixelSnapshot": [[...]]  // 5x5 像素快照');
    console.log('   }\n');

  } catch (err) {
    console.error('❌ 测试失败:', err);
    throw err;
  } finally {
    await closeRedis();
    await db.destroy();
  }
}

// 执行测试
if (require.main === module) {
  testUserBcdQuota()
    .then(() => {
      console.log('✅ 测试完成\n');
      process.exit(0);
    })
    .catch(err => {
      console.error('💥 测试出错:', err);
      process.exit(1);
    });
}

module.exports = { testUserBcdQuota };
