#!/usr/bin/env node
/**
 * 检查bcd用户的数据完整性
 */

const { db } = require('../src/config/database');

async function checkBcdUser() {
  try {
    console.log('🔍 检查bcd用户数据...\n');

    // 1. 检查用户基本信息
    const user = await db('users')
      .where('username', 'bcd')
      .first();

    if (!user) {
      console.log('❌ 用户bcd不存在！');
      process.exit(1);
    }

    console.log('✅ 用户基本信息：');
    console.log(JSON.stringify({
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar: user.avatar ? `${user.avatar.substring(0, 50)}...` : null,
      avatar_url: user.avatar_url,
      created_at: user.created_at
    }, null, 2));

    // 2. 检查联盟成员关系
    console.log('\n🔍 检查联盟成员关系...');
    const membership = await db('alliance_members')
      .where('user_id', user.id)
      .select('*');

    console.log(`找到 ${membership.length} 条成员关系记录：`);
    membership.forEach(m => {
      console.log(JSON.stringify({
        alliance_id: m.alliance_id,
        status: m.status,
        role: m.role,
        joined_at: m.joined_at
      }, null, 2));
    });

    // 3. 检查联盟信息
    if (membership.length > 0) {
      const activeMembership = membership.find(m => m.status === 'active');

      if (activeMembership) {
        console.log('\n✅ 活跃联盟成员关系存在');

        const alliance = await db('alliances')
          .where('id', activeMembership.alliance_id)
          .first();

        if (alliance) {
          console.log('✅ 联盟信息：');
          console.log(JSON.stringify({
            id: alliance.id,
            name: alliance.name,
            color: alliance.color,
            flag_pattern_id: alliance.flag_pattern_id
          }, null, 2));
        } else {
          console.log('❌ 联盟数据不存在！alliance_id:', activeMembership.alliance_id);
        }
      } else {
        console.log('❌ 没有活跃的联盟成员关系！');
        console.log('所有关系状态：', membership.map(m => m.status));
      }
    } else {
      console.log('❌ 用户没有任何联盟成员关系记录！');
    }

    // 4. 检查最近的数据变更
    console.log('\n🔍 检查最近的数据变更...');

    // 检查alliance_members的最近变更
    const recentChanges = await db('alliance_members')
      .where('user_id', user.id)
      .orderBy('updated_at', 'desc')
      .select('*');

    if (recentChanges.length > 0) {
      console.log('最近的成员关系变更：');
      recentChanges.forEach(change => {
        console.log({
          alliance_id: change.alliance_id,
          status: change.status,
          updated_at: change.updated_at
        });
      });
    }

  } catch (error) {
    console.error('❌ 检查失败:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

checkBcdUser();
