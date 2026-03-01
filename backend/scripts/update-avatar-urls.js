/**
 * 更新数据库中的头像URL - 替换旧IP为新IP
 * 用于开发环境IP地址变更时更新历史数据
 *
 * 使用方法:
 * node scripts/update-avatar-urls.js
 */

const { db } = require('../src/config/database');
const logger = require('../src/utils/logger');

// 配置
const OLD_IP = '192.168.0.3:3001';
const NEW_IP = '192.168.1.15:3001';

async function updateAvatarUrls() {
  try {
    logger.info('🔧 开始更新头像URL...');
    logger.info(`   替换规则: ${OLD_IP} → ${NEW_IP}`);

    // 1. 查询所有包含旧IP的头像URL
    const users = await db('users')
      .whereNotNull('avatar_url')
      .where('avatar_url', 'like', `%${OLD_IP}%`)
      .select('id', 'username', 'avatar_url');

    logger.info(`📊 找到 ${users.length} 个需要更新的用户`);

    if (users.length === 0) {
      logger.info('✅ 没有需要更新的数据');
      return;
    }

    // 2. 批量更新
    let updated = 0;
    let failed = 0;

    for (const user of users) {
      try {
        const oldUrl = user.avatar_url;
        const newUrl = oldUrl.replace(OLD_IP, NEW_IP);

        await db('users')
          .where('id', user.id)
          .update({
            avatar_url: newUrl,
            updated_at: db.fn.now()
          });

        updated++;
        logger.debug(`   ✓ [${user.username}] ${oldUrl} → ${newUrl}`);
      } catch (error) {
        failed++;
        logger.error(`   ✗ [${user.username}] 更新失败:`, error.message);
      }
    }

    // 3. 输出结果
    logger.info('');
    logger.info('📊 更新结果统计:');
    logger.info(`   ✅ 成功: ${updated} 个`);
    logger.info(`   ❌ 失败: ${failed} 个`);
    logger.info('');
    logger.info('🎉 头像URL更新完成！');

    // 4. 显示更新后的样例
    if (updated > 0) {
      const samples = await db('users')
        .whereNotNull('avatar_url')
        .where('avatar_url', 'like', `%${NEW_IP}%`)
        .limit(3)
        .select('username', 'avatar_url');

      logger.info('');
      logger.info('📸 更新后的样例:');
      samples.forEach(s => {
        logger.info(`   ${s.username}: ${s.avatar_url}`);
      });
    }

  } catch (error) {
    logger.error('❌ 更新头像URL失败:', error);
    throw error;
  } finally {
    // 关闭数据库连接
    await db.destroy();
  }
}

// 执行更新
updateAvatarUrls()
  .then(() => {
    logger.info('✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('❌ 脚本执行失败:', error);
    process.exit(1);
  });
