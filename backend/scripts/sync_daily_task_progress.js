#!/usr/bin/env node
/**
 * 同步每日任务进度脚本
 *
 * 功能：根据实际绘制数据重新计算并更新今日任务进度
 *
 * 使用方法：
 * node sync_daily_task_progress.js --user-id=123
 * node sync_daily_task_progress.js --all  # 同步所有用户
 * node sync_daily_task_progress.js --date=2026-02-24  # 指定日期
 */

const { db, initDatabase } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function syncDailyTaskProgress(userId, targetDate = null) {
    const today = targetDate || new Date().toISOString().split('T')[0];

    try {
        logger.info(`开始同步用户 ${userId} 在 ${today} 的任务进度...`);

        // 1. 确保今日任务已生成
        const existingTasks = await db('user_daily_tasks')
            .where({ user_id: userId, task_date: today });

        if (existingTasks.length === 0) {
            logger.warn(`  用户 ${userId} 今日任务尚未生成，跳过`);
            return { userId, skipped: true };
        }

        // 2. 查询今日所有已完成的会话
        const sessions = await db('drawing_sessions')
            .where('user_id', userId)
            .whereRaw("DATE(created_at) = ?", [today])
            .where('status', 'completed')
            .select('id', 'metadata', 'created_at');

        logger.info(`  找到 ${sessions.length} 个已完成会话`);

        // 3. 统计像素数和会话数
        let totalPixels = 0;
        let validSessions = 0;

        for (const session of sessions) {
            const pixelCount = session.metadata?.statistics?.pixelCount || 0;
            if (pixelCount > 0) {
                totalPixels += pixelCount;
                validSessions++;
            }
        }

        logger.info(`  统计结果: ${totalPixels} 个像素, ${validSessions} 个有效会话`);

        // 4. 更新 draw_pixels 任务
        const drawPixelsTask = existingTasks.find(t => t.type === 'draw_pixels');
        if (drawPixelsTask) {
            const isCompleted = totalPixels >= drawPixelsTask.target;
            await db('user_daily_tasks')
                .where({ id: drawPixelsTask.id })
                .update({
                    current: totalPixels,
                    is_completed: isCompleted,
                    updated_at: db.fn.now()
                });

            logger.info(`  ✅ 更新 draw_pixels: ${totalPixels}/${drawPixelsTask.target} (${isCompleted ? '已完成' : '进行中'})`);
        }

        // 5. 更新 draw_sessions 任务
        const drawSessionsTask = existingTasks.find(t => t.type === 'draw_sessions');
        if (drawSessionsTask) {
            const isCompleted = validSessions >= drawSessionsTask.target;
            await db('user_daily_tasks')
                .where({ id: drawSessionsTask.id })
                .update({
                    current: validSessions,
                    is_completed: isCompleted,
                    updated_at: db.fn.now()
                });

            logger.info(`  ✅ 更新 draw_sessions: ${validSessions}/${drawSessionsTask.target} (${isCompleted ? '已完成' : '进行中'})`);
        }

        // 6. 检查是否有其他类型的任务需要更新
        const otherTasks = existingTasks.filter(t =>
            t.type !== 'draw_pixels' && t.type !== 'draw_sessions'
        );

        if (otherTasks.length > 0) {
            logger.info(`  ℹ️  发现 ${otherTasks.length} 个其他类型任务（暂不更新）: ${otherTasks.map(t => t.type).join(', ')}`);
        }

        return {
            userId,
            date: today,
            totalPixels,
            validSessions,
            success: true
        };

    } catch (error) {
        logger.error(`❌ 同步用户 ${userId} 的任务进度失败:`, error);
        return {
            userId,
            date: today,
            error: error.message,
            success: false
        };
    }
}

async function syncAllUsers(targetDate = null) {
    const today = targetDate || new Date().toISOString().split('T')[0];

    logger.info(`开始同步所有用户在 ${today} 的任务进度...`);

    // 查询今日有任务的所有用户
    const users = await db('user_daily_tasks')
        .where({ task_date: today })
        .distinct('user_id')
        .select('user_id');

    logger.info(`找到 ${users.length} 个用户有今日任务`);

    const results = [];
    for (const user of users) {
        const result = await syncDailyTaskProgress(user.user_id, targetDate);
        results.push(result);
    }

    // 统计结果
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const skipped = results.filter(r => r.skipped).length;

    logger.info('\n' + '='.repeat(60));
    logger.info(`同步完成: 成功 ${successful}, 失败 ${failed}, 跳过 ${skipped}`);
    logger.info('='.repeat(60));

    return results;
}

// 命令行参数解析
async function main() {
    await initDatabase();

    const args = process.argv.slice(2);
    const options = {};

    for (const arg of args) {
        if (arg.startsWith('--')) {
            const [key, value] = arg.substring(2).split('=');
            options[key] = value || true;
        }
    }

    try {
        if (options['user-id']) {
            // 同步单个用户
            const userId = parseInt(options['user-id']);
            const result = await syncDailyTaskProgress(userId, options.date);

            if (result.success) {
                console.log(`\n✅ 同步成功: 用户 ${userId}`);
                console.log(`   像素: ${result.totalPixels}, 会话: ${result.validSessions}`);
            } else if (result.skipped) {
                console.log(`\n⚠️  跳过: 用户 ${userId} 今日任务尚未生成`);
            } else {
                console.log(`\n❌ 同步失败: ${result.error}`);
                process.exit(1);
            }
        } else if (options.all) {
            // 同步所有用户
            await syncAllUsers(options.date);
        } else {
            // 显示帮助信息
            console.log('使用方法:');
            console.log('  node sync_daily_task_progress.js --user-id=123');
            console.log('  node sync_daily_task_progress.js --all');
            console.log('  node sync_daily_task_progress.js --user-id=123 --date=2026-02-24');
            process.exit(0);
        }

        process.exit(0);
    } catch (error) {
        logger.error('脚本执行失败:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { syncDailyTaskProgress, syncAllUsers };
