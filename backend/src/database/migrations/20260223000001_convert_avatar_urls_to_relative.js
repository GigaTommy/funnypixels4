/**
 * 将avatar_url从完整URL转换为相对路径
 *
 * 目的：解决开发环境IP变更后头像URL失效的问题
 *
 * 转换规则：
 * - http://192.168.x.x:3001/uploads/materials/avatars/... → /uploads/materials/avatars/...
 * - https://cdn.example.com/uploads/materials/avatars/... → /uploads/materials/avatars/...
 *
 * 注意：运行时会自动根据环境动态构建完整URL
 */

exports.up = async function(knex) {
  const logger = console;

  try {
    logger.log('🔧 开始转换avatar_url为相对路径...');

    // 1. 查询所有包含完整URL的avatar_url
    const users = await knex('users')
      .whereNotNull('avatar_url')
      .where(function() {
        this.where('avatar_url', 'like', 'http://%')
          .orWhere('avatar_url', 'like', 'https://%');
      })
      .select('id', 'username', 'avatar_url');

    logger.log(`📊 找到 ${users.length} 个需要转换的用户`);

    if (users.length === 0) {
      logger.log('✅ 没有需要转换的数据');
      return;
    }

    // 2. 批量转换
    let converted = 0;
    let failed = 0;
    const errors = [];

    for (const user of users) {
      try {
        // 提取路径部分
        let relativePath;

        try {
          // 尝试使用URL解析
          const url = new URL(user.avatar_url);
          relativePath = url.pathname;
        } catch (urlError) {
          // 如果URL解析失败，尝试正则提取
          const match = user.avatar_url.match(/\/uploads\/materials\/.+$/);
          if (match) {
            relativePath = match[0];
          } else {
            throw new Error(`无法解析URL: ${user.avatar_url}`);
          }
        }

        // 更新数据库
        await knex('users')
          .where('id', user.id)
          .update({
            avatar_url: relativePath,
            updated_at: knex.fn.now()
          });

        converted++;
        logger.log(`   ✓ [${user.username}] ${user.avatar_url} → ${relativePath}`);
      } catch (error) {
        failed++;
        const errorMsg = `[${user.username}] ${error.message}`;
        errors.push(errorMsg);
        logger.error(`   ✗ ${errorMsg}`);
      }
    }

    // 3. 输出结果
    logger.log('');
    logger.log('📊 转换结果统计:');
    logger.log(`   ✅ 成功: ${converted} 个`);
    logger.log(`   ❌ 失败: ${failed} 个`);

    if (errors.length > 0) {
      logger.log('');
      logger.log('❌ 失败详情:');
      errors.forEach(err => logger.log(`   ${err}`));
    }

    logger.log('');
    logger.log('🎉 Avatar URL转换完成！');

    // 4. 显示转换后的样例
    if (converted > 0) {
      const samples = await knex('users')
        .whereNotNull('avatar_url')
        .where('avatar_url', 'like', '/uploads/%')
        .limit(3)
        .select('username', 'avatar_url');

      logger.log('');
      logger.log('📸 转换后的样例:');
      samples.forEach(s => {
        logger.log(`   ${s.username}: ${s.avatar_url}`);
      });
    }

  } catch (error) {
    logger.error('❌ 迁移失败:', error);
    throw error;
  }
};

exports.down = async function(knex) {
  const logger = console;

  logger.log('⚠️ 此迁移不支持回滚');
  logger.log('原因: 无法确定原始的baseUrl（IP地址可能已变更）');
  logger.log('如需回滚，请手动恢复数据库备份');

  // 不执行任何操作
};
