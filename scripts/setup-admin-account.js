#!/usr/bin/env node

/**
 * 设置或重置管理员账号
 * 用于确保有可用的管理员账号来调用管理后台 API
 */

// 必须先切换目录，然后 require
const path = require('path');
const backendPath = path.join(__dirname, '../backend');
process.chdir(backendPath);

// 现在可以 require backend 的模块
const bcrypt = require(path.join(backendPath, 'node_modules/bcrypt'));
const { v4: uuidv4 } = require(path.join(backendPath, 'node_modules/uuid'));
const { db: knex } = require(path.join(backendPath, 'src/config/database'));

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123'; // 可以修改为你想要的密码
const SALT_ROUNDS = 10;

async function setupAdminAccount() {
    try {
        console.log('🔧 开始设置管理员账号...\n');

        // 检查是否已存在 admin 账号
        const existingAdmin = await knex('users')
            .where('username', ADMIN_USERNAME)
            .first();

        if (existingAdmin) {
            console.log(`✅ 发现现有管理员账号: ${ADMIN_USERNAME}`);
            console.log(`   ID: ${existingAdmin.id}`);
            console.log(`   角色: ${existingAdmin.role}`);

            // 重置密码
            console.log('\n🔄 正在重置密码...');
            const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);

            await knex('users')
                .where('id', existingAdmin.id)
                .update({
                    password_hash: hashedPassword,
                    role: 'super_admin', // 确保角色正确
                    updated_at: new Date()
                });

            console.log('✅ 密码已重置！');
        } else {
            console.log('📝 未找到管理员账号，正在创建...');

            // 创建新的管理员账号
            const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);
            const adminId = uuidv4();

            await knex('users').insert({
                id: adminId,
                username: ADMIN_USERNAME,
                email: 'admin@funnypixels.com',
                password_hash: hashedPassword,
                role: 'super_admin',
                level: 99,
                points: 1000000,
                total_pixels: 0,
                created_at: new Date(),
                updated_at: new Date()
            });

            console.log('✅ 管理员账号创建成功！');
            console.log(`   ID: ${adminId}`);
        }

        console.log('\n✅ 管理员账号设置完成！');
        console.log('');
        console.log('📋 登录凭据:');
        console.log(`   用户名: ${ADMIN_USERNAME}`);
        console.log(`   密码: ${ADMIN_PASSWORD}`);
        console.log('');
        console.log('🔐 请妥善保管这些凭据，建议生产环境使用更强的密码！');
        console.log('');
        console.log('🚀 下一步: 运行活动创建脚本');
        console.log('   node scripts/admin-create-event-gdut.js');

        process.exit(0);
    } catch (error) {
        console.error('❌ 设置管理员账号失败:', error);
        process.exit(1);
    }
}

setupAdminAccount();
