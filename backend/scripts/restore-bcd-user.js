#!/usr/bin/env node
/**
 * 恢复bcd用户数据
 * - 重新添加到洋红色联盟
 * - 恢复默认头像（如果有备份的话）
 */

const { db } = require('../src/config/database');

async function restoreBcdUser() {
  try {
    console.log('🔧 开始恢复bcd用户数据...\n');

    // 1. 查找bcd用户
    const user = await db('users')
      .where('username', 'bcd')
      .first();

    if (!user) {
      console.error('❌ 用户bcd不存在！');
      process.exit(1);
    }

    console.log('✅ 找到用户:', user.id);

    // 2. 查找洋红色联盟（可能的名称）
    const alliances = await db('alliances')
      .where('color', 'like', '%magenta%')
      .orWhere('color', 'like', '%洋红%')
      .orWhere('name', 'like', '%洋红%')
      .select('*');

    console.log('\n🔍 查找洋红色联盟...');
    console.log(`找到 ${alliances.length} 个可能的联盟：`);
    alliances.forEach(a => {
      console.log(`  - ${a.name} (color: ${a.color}, id: ${a.id})`);
    });

    let targetAlliance = null;

    if (alliances.length === 0) {
      // 如果找不到，列出所有联盟
      console.log('\n未找到洋红色联盟，列出所有联盟：');
      const allAlliancesList = await db('alliances').select('*');
      allAlliancesList.forEach(a => {
        console.log(`  - ${a.name} (color: ${a.color}, id: ${a.id})`);
      });

      if (allAlliancesList.length > 0) {
        console.log('\n请手动指定alliance_id，或者先创建洋红色联盟');
        process.exit(1);
      }
    } else {
      targetAlliance = alliances[0];
      console.log(`\n✅ 选择联盟: ${targetAlliance.name}`);
    }

    // 3. 添加联盟成员关系
    if (targetAlliance) {
      const existing = await db('alliance_members')
        .where({
          user_id: user.id,
          alliance_id: targetAlliance.id
        })
        .first();

      if (existing) {
        console.log('\n⚠️  成员关系已存在，更新状态为active');
        await db('alliance_members')
          .where('id', existing.id)
          .update({
            status: 'active',
            updated_at: new Date()
          });
      } else {
        console.log('\n✅ 创建新的成员关系...');
        await db('alliance_members').insert({
          alliance_id: targetAlliance.id,
          user_id: user.id,
          role: 'member',
          status: 'active',
          joined_at: new Date(),
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      console.log('✅ 联盟成员关系已恢复！');
    }

    // 4. 检查是否需要恢复头像
    console.log('\n🔍 检查头像数据...');
    if (!user.avatar && !user.avatar_url) {
      console.log('⚠️  头像数据丢失');
      console.log('如果你有头像备份，请手动运行：');
      console.log(`  UPDATE users SET avatar = '...' WHERE id = '${user.id}';`);
    } else {
      console.log('✅ 头像数据存在');
    }

    console.log('\n✅ 恢复完成！');

  } catch (error) {
    console.error('❌ 恢复失败:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

restoreBcdUser();
