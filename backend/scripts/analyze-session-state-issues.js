const { db } = require('./src/config/database');

async function analyzeSessionStateIssues() {
  console.log('🔍 分析会话状态管理的异常情况处理问题...\n');

  try {
    // 1. 检查当前活跃会话的状态
    console.log('📋 1. 检查当前活跃会话状态...');
    const activeSessions = await db('drawing_sessions')
      .where({ status: 'active' })
      .select('id', 'user_id', 'session_name', 'start_time', 'updated_at');

    console.log(`发现 ${activeSessions.length} 个活跃会话`);

    for (const session of activeSessions) {
      const sessionAge = Date.now() - new Date(session.start_time).getTime();
      const sessionAgeMinutes = Math.floor(sessionAge / 1000 / 60);
      const lastUpdateAge = Date.now() - new Date(session.updated_at).getTime();
      const lastUpdateMinutes = Math.floor(lastUpdateAge / 1000 / 60);

      console.log(`   会话 ${session.id.slice(0, 8)}...`);
      console.log(`     用户: ${session.user_id.slice(0, 8)}...`);
      console.log(`     名称: ${session.session_name}`);
      console.log(`     开始时间: ${session.start_time} (${sessionAgeMinutes}分钟前)`);
      console.log(`     最后更新: ${session.updated_at} (${lastUpdateMinutes}分钟前)`);

      // 检查是否有相关的pixels_history记录
      const historyCount = await db('pixels_history')
        .where({ session_id: session.id })
        .count('* as count')
        .first();

      console.log(`     关联的历史记录: ${historyCount.count}`);
      console.log('');
    }

    // 2. 模拟用户关闭浏览器场景的问题
    console.log('📋 2. 分析用户关闭浏览器的场景问题...');

    if (activeSessions.length > 0) {
      const sampleSession = activeSessions[0];
      const sessionAge = Date.now() - new Date(sampleSession.start_time).getTime();
      const sessionAgeMinutes = Math.floor(sessionAge / 1000 / 60);

      console.log('❌ 发现的问题:');
      console.log(`   - 用户关闭浏览器后，会话 ${sampleSession.id.slice(0, 8)}... 状态仍然为 'active'`);
      console.log(`   - 会话已存在 ${sessionAgeMinutes} 分钟，但没有正常结束`);
      console.log(`   - Redis缓存可能仍然保存着活跃会话状态`);
      console.log(`   - 用户重新打开应用时可能会继续使用旧的活跃会话`);
      console.log(`   - 这会导致会话统计数据不准确`);
      console.log('');

      // 3. 检查Redis缓存状态（如果可用）
      console.log('📋 3. 检查Redis缓存一致性...');

      for (const session of activeSessions) {
        const redisKey = `user_active_session:${session.user_id}`;
        console.log(`   检查Redis键: ${redisKey}`);

        // 注意：这里只是模拟检查，实际的Redis检查需要在有Redis的环境中进行
        console.log(`   ⚠️  需要验证Redis中的 ${redisKey} 是否仍然指向会话 ${session.id.slice(0, 8)}...`);
      }
      console.log('');

      // 4. 分析当前超时清理机制的问题
      console.log('📋 4. 分析当前超时清理机制...');
      console.log('❌ 当前清理机制的问题:');
      console.log('   - 清理间隔是24小时，太长了');
      console.log('   - 用户可能在几小时后重新打开应用，仍然使用旧会话');
      console.log('   - 没有心跳机制来检测连接状态');
      console.log('   - 没有客户端断开连接的主动处理');
      console.log('   - 没有WebSocket连接状态跟踪');
      console.log('');

      // 5. 检查统计数据准确性问题
      console.log('📋 5. 检查统计数据准确性...');

      for (const session of activeSessions) {
        const pixelCount = await db('pixels_history')
          .where({ session_id: session.id })
          .count('* as count')
          .first();

        const sessionInDb = await db('drawing_sessions')
          .where({ id: session.id })
          .first();

        const storedStats = sessionInDb.metadata?.statistics;

        console.log(`会话 ${session.id.slice(0, 8)}... 统计数据:`);
        console.log(`   实际历史记录数: ${pixelCount.count}`);
        console.log(`   数据库统计字段: ${storedStats ? JSON.stringify(storedStats) : '未计算'}`);

        if (storedStats && storedStats.pixelCount !== parseInt(pixelCount.count)) {
          console.log(`   ⚠️  统计数据不一致！实际: ${pixelCount.count}, 存储: ${storedStats.pixelCount}`);
        }
      }
      console.log('');

      // 6. 总结问题和建议
      console.log('📋 6. 问题总结和建议:');
      console.log('');
      console.log('🚨 关键问题:');
      console.log('   1. 无客户端断开检测');
      console.log('   2. 无心跳机制');
      console.log('   3. 超时时间过长（24小时）');
      console.log('   4. Redis缓存可能不一致');
      console.log('   5. 会话状态可能永久卡在active状态');
      console.log('');
      console.log('💡 建议解决方案:');
      console.log('   1. 实现客户端心跳机制');
      console.log('   2. 缩短超时时间到更合理的时间（如30分钟）');
      console.log('   3. 添加页面可见性检测');
      console.log('   4. 实现连接断开处理');
      console.log('   5. 添加会话状态定期检查');
      console.log('   6. 实现优雅的会话清理机制');

    } else {
      console.log('✅ 当前没有活跃会话，没有发现明显问题');
    }

  } catch (error) {
    console.error('❌ 分析过程中出错:', error);
  } finally {
    process.exit(0);
  }
}

analyzeSessionStateIssues();