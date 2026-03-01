/**
 * 用户密码重置工具
 * 
 * 用法:
 *   node src/scripts/reset-user-password.js <username> [new_password]
 * 
 * 示例:
 *   node src/scripts/reset-user-password.js testuser password123
 *   node src/scripts/reset-user-password.js bbb  (将使用默认密码 'password123')
 */

const { db } = require('../config/database');
const bcrypt = require('bcryptjs');

async function resetUserPassword(username, newPassword = 'password123') {
    try {
        console.log(`\n🔧 正在重置用户密码...`);
        console.log(`   用户名: ${username}`);
        console.log(`   新密码: ${newPassword}`);

        // 1. 查找用户
        const user = await db('users')
            .where('username', username)
            .first();

        if (!user) {
            console.error(`\n❌ 错误: 用户 "${username}" 不存在`);
            console.log(`\n💡 提示: 可用的用户列表:`);
            const users = await db('users')
                .select('username', 'email', 'created_at')
                .orderBy('created_at', 'desc')
                .limit(10);
            users.forEach(u => {
                console.log(`   - ${u.username} (${u.email})`);
            });
            process.exit(1);
        }

        console.log(`\n✅ 找到用户:`);
        console.log(`   ID: ${user.id}`);
        console.log(`   用户名: ${user.username}`);
        console.log(`   邮箱: ${user.email}`);
        console.log(`   显示名: ${user.display_name || '(未设置)'}`);

        // 2. 生成新密码哈希
        console.log(`\n🔐 正在生成密码哈希...`);
        const passwordHash = await bcrypt.hash(newPassword, 10);

        // 3. 更新密码
        await db('users')
            .where('id', user.id)
            .update({
                password_hash: passwordHash,
                updated_at: db.fn.now()
            });

        console.log(`\n✅ 密码重置成功!`);
        console.log(`\n📋 登录信息:`);
        console.log(`   用户名: ${user.username}`);
        console.log(`   密码: ${newPassword}`);
        console.log(`   邮箱: ${user.email}`);

        // 4. 验证新密码
        console.log(`\n🔍 验证新密码...`);
        const updatedUser = await db('users').where('id', user.id).first();
        const isValid = await bcrypt.compare(newPassword, updatedUser.password_hash);

        if (isValid) {
            console.log(`✅ 密码验证成功，可以正常登录`);
        } else {
            console.error(`❌ 密码验证失败，请重试`);
            process.exit(1);
        }

        process.exit(0);
    } catch (error) {
        console.error(`\n❌ 重置密码失败:`, error.message);
        console.error(error);
        process.exit(1);
    }
}

// 批量重置所有测试用户密码
async function resetAllTestUsers(password = 'password123') {
    try {
        console.log(`\n🔧 批量重置所有测试用户密码...`);
        console.log(`   新密码: ${password}`);

        const passwordHash = await bcrypt.hash(password, 10);

        const testUsers = await db('users')
            .whereIn('username', ['testuser', 'testuser1', 'testuser2', 'abcabc', 'bcd'])
            .orWhere('email', 'like', '%@example.com');

        console.log(`\n找到 ${testUsers.length} 个测试用户:`);
        testUsers.forEach(u => {
            console.log(`   - ${u.username} (${u.email})`);
        });

        const updated = await db('users')
            .whereIn('id', testUsers.map(u => u.id))
            .update({
                password_hash: passwordHash,
                updated_at: db.fn.now()
            });

        console.log(`\n✅ 成功重置 ${updated} 个用户的密码`);
        console.log(`\n📋 统一密码: ${password}`);

        process.exit(0);
    } catch (error) {
        console.error(`\n❌ 批量重置失败:`, error.message);
        process.exit(1);
    }
}

// 主函数
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log(`
📖 用户密码重置工具

用法:
  node src/scripts/reset-user-password.js <username> [new_password]
  node src/scripts/reset-user-password.js --all [new_password]

示例:
  # 重置单个用户密码（使用默认密码 'password123'）
  node src/scripts/reset-user-password.js testuser

  # 重置单个用户密码（指定新密码）
  node src/scripts/reset-user-password.js testuser myNewPassword

  # 批量重置所有测试用户密码
  node src/scripts/reset-user-password.js --all

  # 批量重置所有测试用户密码（指定新密码）
  node src/scripts/reset-user-password.js --all myNewPassword
    `);
        process.exit(0);
    }

    if (args[0] === '--all') {
        await resetAllTestUsers(args[1]);
    } else {
        const username = args[0];
        const newPassword = args[1] || 'password123';
        await resetUserPassword(username, newPassword);
    }
}

main();
