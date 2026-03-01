const bcrypt = require('bcryptjs');
const { db } = require('../src/config/database');

async function resetAdminPassword() {
  try {
    const adminUsername = 'admin';
    const newPassword = 'admin123';

    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 更新管理员密码
    const updatedUser = await db('users')
      .where({ username: adminUsername })
      .update({
        password_hash: hashedPassword,
        role: 'super_admin',
        updated_at: new Date()
      })
      .returning('*');

    if (updatedUser.length > 0) {
      console.log('✅ 管理员密码重置成功!');
      console.log('📝 登录信息:');
      console.log('   用户名: admin');
      console.log('   密码: admin123');
      console.log('   角色: 超级管理员');
    } else {
      console.log('⚠️ 未找到管理员用户,正在创建...');
      
      const ADMIN_USER_ID = 'b16dceb6-5237-4134-a97b-d8893136db2d';
      
      // 检查ID是否冲突
      const conflictUser = await db('users').where('id', ADMIN_USER_ID).first();
      let insertId = ADMIN_USER_ID;
      if (conflictUser) {
          console.log(`⚠️ ID ${ADMIN_USER_ID} 已被占用，生成新ID`);
          const { v4: uuidv4 } = require('uuid');
          // 如果没有 uuid 库，可能需要 fallback。但 backend 通常会有。
          // 暂时假设不冲突，或者 admin 用户就是特定 ID。
          // 如果冲突是因为 admin 已经存在但 username 不是 admin？
          // 这里简单处理：如果 conflictUser 存在， update conflictUser
           await db('users')
            .where({ id: ADMIN_USER_ID })
            .update({
                username: adminUsername,
                password_hash: hashedPassword,
                role: 'super_admin',
                updated_at: new Date()
            });
           console.log('✅ 已更新现有用户 ID 为 admin');
           return;
      }

      await db('users').insert({
          id: ADMIN_USER_ID,
          username: adminUsername,
          email: 'admin@funnypixels.com',
          password_hash: hashedPassword,
          display_name: 'System Admin',
          role: 'super_admin',
          level: 100,
          experience: 999999,
          coins: 999999,
          gems: 999999,
          is_guest: false,
          motto: 'System Administrator',
          privacy_mode: false,
          total_pixels: 0,
          current_pixels: 999999,
          created_at: new Date(),
          updated_at: new Date(),
          last_login: new Date(),
          is_online: false,
          is_banned: false
      });
      
      console.log('✅ 管理员用户创建成功!');
      console.log('📝 登录信息:');
      console.log('   用户名: admin');
      console.log('   密码: admin123');
      console.log('   角色: 超级管理员');
    }

  } catch (error) {
    console.error('❌ 重置密码失败:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

resetAdminPassword();