#!/usr/bin/env node
/**
 * 检查每日任务数据一致性
 *
 * 功能：验证任务进度与实际绘制数据是否一致
 *
 * 使用方法：
 * node check_task_consistency.js --user-id=123
 * node check_task_consistency.js --username=bcd
 */

const { db, initDatabase } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function checkUserTaskConsistency(userId, username = null) {
    const today = new Date().toISOString().split('T')[0];

    console.log('\n' + '='.repeat(80));
    console.log(`检查用户 ${username || userId} 在 ${today} 的任务数据一致性`);
    console.log('='.repeat(80));

    try {
        // 1. 查询今日任务进度
        console.log('\n📋 每日任务进度 (user_daily_tasks):');
        const tasks = await db('user_daily_tasks')
            .where({ user_id: userId, task_date: today })
            .orderBy('type', 'asc');

        if (tasks.length === 0) {
            console.log('  ⚠️  今日任务尚未生成');
        } else {
            for (const task of tasks) {
                const status = task.is_completed ? '✅ 已完成' : '⏳ 进行中';
                console.log(`  ${task.type.padEnd(20)} ${task.current}/${task.target} ${status}`);
            }
        }

        // 2. 查询今日实际会话统计
        console.log('\n📊 今日实际会话统计 (drawing_sessions):');
        const sessions = await db('drawing_sessions')
            .where('user_id', userId)
            .whereRaw("DATE(created_at) = ?", [today])
            .select('id', 'session_name', 'status', 'metadata', 'created_at')
            .orderBy('created_at', 'asc');

        console.log(`  总会话数: ${sessions.length}`);

        let totalPixels = 0;
        let validSessions = 0;
        let zeroPixelSessions = [];

        for (const session of sessions) {
            const pixelCount = session.metadata?.statistics?.pixelCount || 0;
            const status = session.status === 'completed' ? '✓' : '○';

            console.log(`  ${status} Session ${session.id}: ${pixelCount} 像素 (${session.session_name || '未命名'})`);

            if (session.status === 'completed') {
                if (pixelCount > 0) {
                    totalPixels += pixelCount;
                    validSessions++;
                } else {
                    zeroPixelSessions.push(session.id);
                }
            }
        }

        console.log(`\n  有效会话: ${validSessions} (pixelCount > 0)`);
        console.log(`  总像素数: ${totalPixels}`);

        if (zeroPixelSessions.length > 0) {
            console.log(`  ⚠️  ${zeroPixelSessions.length} 个会话的 pixelCount = 0: ${zeroPixelSessions.join(', ')}`);
        }

        // 3. 查询 pixels_history 统计
        console.log('\n📈 像素历史统计 (pixels_history):');
        const pixelHistory = await db('pixels_history')
            .where({ user_id: userId, history_date: today })
            .count('* as count')
            .first();

        const actualPixels = parseInt(pixelHistory?.count || 0);
        console.log(`  实际像素数: ${actualPixels}`);

        // 4. 查询 /stats/today API 返回的数据（模拟）
        console.log('\n🌐 /stats/today API 统计:');
        const todayStats = await db('drawing_sessions')
            .where('user_id', userId)
            .whereRaw("DATE(created_at) = ?", [today])
            .select(
                db.raw('COUNT(*) as today_sessions'),
                db.raw("COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(end_time, NOW()) - start_time))), 0)::int as today_duration")
            )
            .first();

        console.log(`  会话数: ${todayStats.today_sessions}`);
        console.log(`  总时长: ${todayStats.today_duration} 秒 (${Math.floor(todayStats.today_duration / 60)} 分钟)`);
        console.log(`  像素数: ${actualPixels} (从 pixels_history)`);

        // 5. 数据一致性检查
        console.log('\n✔️  数据一致性检查:');

        const drawPixelsTask = tasks.find(t => t.type === 'draw_pixels');
        const drawSessionsTask = tasks.find(t => t.type === 'draw_sessions');

        let hasIssues = false;

        if (drawPixelsTask) {
            if (drawPixelsTask.current !== totalPixels) {
                console.log(`  ❌ 像素任务不一致: 任务显示 ${drawPixelsTask.current}, 实际统计 ${totalPixels}`);
                hasIssues = true;
            } else {
                console.log(`  ✅ 像素任务一致: ${drawPixelsTask.current}`);
            }
        }

        if (drawSessionsTask) {
            if (drawSessionsTask.current !== validSessions) {
                console.log(`  ❌ 会话任务不一致: 任务显示 ${drawSessionsTask.current}, 实际统计 ${validSessions}`);
                hasIssues = true;
            } else {
                console.log(`  ✅ 会话任务一致: ${drawSessionsTask.current}`);
            }
        }

        if (actualPixels !== totalPixels) {
            console.log(`  ⚠️  pixels_history (${actualPixels}) 与会话统计 (${totalPixels}) 不一致`);
        }

        // 6. 修复建议
        if (hasIssues || zeroPixelSessions.length > 0) {
            console.log('\n💡 修复建议:');

            if (zeroPixelSessions.length > 0) {
                console.log(`  1. 运行会话统计修复脚本:`);
                console.log(`     node scripts/recalculate_session_stats.js --session-ids=${zeroPixelSessions.join(',')}`);
            }

            if (hasIssues) {
                console.log(`  2. 运行任务进度同步脚本:`);
                console.log(`     node scripts/sync_daily_task_progress.js --user-id=${userId}`);
            }
        } else {
            console.log('\n✅ 数据一致，无需修复');
        }

        console.log('\n' + '='.repeat(80));

        return {
            userId,
            date: today,
            hasIssues,
            taskProgress: {
                pixels: drawPixelsTask?.current || 0,
                sessions: drawSessionsTask?.current || 0
            },
            actualStats: {
                pixels: totalPixels,
                sessions: validSessions
            }
        };

    } catch (error) {
        logger.error('检查失败:', error);
        throw error;
    }
}

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
        let userId = null;
        let username = null;

        if (options['user-id']) {
            userId = parseInt(options['user-id']);
        } else if (options.username) {
            username = options.username;
            // 根据用户名查询 user_id
            const user = await db('users')
                .where('username', username)
                .orWhere('email', username)
                .first('id', 'username');

            if (!user) {
                console.error(`❌ 用户不存在: ${username}`);
                process.exit(1);
            }

            userId = user.id;
            username = user.username;
        } else {
            console.log('使用方法:');
            console.log('  node check_task_consistency.js --user-id=123');
            console.log('  node check_task_consistency.js --username=bcd');
            process.exit(0);
        }

        await checkUserTaskConsistency(userId, username);
        process.exit(0);

    } catch (error) {
        logger.error('脚本执行失败:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { checkUserTaskConsistency };
