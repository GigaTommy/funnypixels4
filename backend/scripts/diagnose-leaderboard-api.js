#!/usr/bin/env node

/**
 * 诊断排行榜API问题
 */

const fs = require('fs');
const path = require('path');
const knex = require('knex');

async function diagnoseLeaderboardAPI() {
  console.log('🔍 诊断排行榜API问题...');

  // 生产环境配置
  let productionConfig = {
    client: 'postgresql',
    connection: {
      host: process.env.PROD_DB_HOST || 'localhost',
      port: process.env.PROD_DB_PORT || 5432,
      user: process.env.PROD_DB_USER || 'postgres',
      password: process.env.PROD_DB_PASSWORD || '',
      database: process.env.PROD_DB_NAME || 'funnypixels_prod',
      ssl: process.env.PROD_DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    }
  };

  const prodConfigPath = path.join(__dirname, '../config/production-database.json');
  if (fs.existsSync(prodConfigPath)) {
    const prodConfig = JSON.parse(fs.readFileSync(prodConfigPath, 'utf8'));
    productionConfig = {
      client: 'postgresql',
      connection: {
        host: prodConfig.database.host,
        port: prodConfig.database.port,
        user: prodConfig.database.user,
        password: prodConfig.database.password,
        database: prodConfig.database.database,
        ssl: prodConfig.database.ssl ? { rejectUnauthorized: false } : false
      }
    };
  }

  const db = knex(productionConfig);

  try {
    console.log('\n📋 1. 检查关键排行榜表是否存在...');

    // 检查各个排行榜表
    const tables = ['leaderboards', 'leaderboard_personal', 'leaderboard_alliance'];
    const tableStatus = {};

    for (const table of tables) {
      const exists = await db.schema.hasTable(table);
      tableStatus[table] = exists;
      console.log(`  ${table}: ${exists ? '✅ 存在' : '❌ 不存在'}`);

      if (exists) {
        const count = await db(table).count('* as count').first();
        console.log(`    记录数: ${count.count}`);
      }
    }

    console.log('\n📋 2. 测试直接数据库查询...');

    // 测试leaderboard_personal查询
    if (tableStatus.leaderboard_personal) {
      try {
        const personalLeaderboard = await db('leaderboard_personal')
          .where('period', 'daily')
          .orderBy('rank', 'asc')
          .limit(5)
          .select('user_id', 'username', 'pixel_count', 'rank');

        console.log('✅ leaderboard_personal 查询成功:');
        personalLeaderboard.forEach((user, index) => {
          console.log(`  ${index + 1}. ${user.username} - 像素: ${user.pixel_count}, 排名: ${user.rank}`);
        });
      } catch (error) {
        console.error('❌ leaderboard_personal 查询失败:', error.message);
      }
    }

    // 测试leaderboard_alliance查询
    if (tableStatus.leaderboard_alliance) {
      try {
        const allianceLeaderboard = await db('leaderboard_alliance')
          .where('period', 'daily')
          .orderBy('rank', 'asc')
          .limit(5)
          .select('alliance_id', 'alliance_name', 'total_pixels', 'rank');

        console.log('\n✅ leaderboard_alliance 查询成功:');
        allianceLeaderboard.forEach((alliance, index) => {
          console.log(`  ${index + 1}. ${alliance.alliance_name} - 像素: ${alliance.total_pixels}, 排名: ${alliance.rank}`);
        });
      } catch (error) {
        console.error('❌ leaderboard_alliance 查询失败:', error.message);
      }
    }

    // 如果旧的leaderboards表存在，也测试一下
    if (tableStatus.leaderboards) {
      console.log('\n⚠️  发现旧的leaderboards表，这可能是问题所在！');
      try {
        const oldLeaderboard = await db('leaderboards')
          .where('type', 'user')
          .where('period', 'daily')
          .orderBy('date', 'desc')
          .limit(1)
          .first();

        if (oldLeaderboard) {
          console.log('旧表中的数据:', oldLeaderboard.date, oldLeaderboard.type, oldLeaderboard.period);
        } else {
          console.log('旧表中没有数据');
        }
      } catch (error) {
        console.error('旧表查询失败:', error.message);
      }
    }

    console.log('\n📋 3. 检查当前代码版本...');

    // 检查当前Leaderboard模型文件
    const leaderboardModelPath = path.join(__dirname, '../src/models/Leaderboard.js');
    if (fs.existsSync(leaderboardModelPath)) {
      const content = fs.readFileSync(leaderboardModelPath, 'utf8');

      // 检查是否包含修复后的代码
      const hasFixedCode = content.includes('leaderboard_personal') && content.includes('leaderboard_alliance');
      const hasOldCode = content.includes("db('leaderboards')");

      console.log(`Leaderboard模型文件状态:`);
      console.log(`  包含修复代码: ${hasFixedCode ? '✅ 是' : '❌ 否'}`);
      console.log(`  包含旧代码: ${hasOldCode ? '⚠️  是' : '✅ 否'}`);

      if (!hasFixedCode) {
        console.log('❌ 代码修复可能未部署到生产环境！');
      }
    }

    console.log('\n📋 4. 生成修复建议...');

    const issues = [];
    const solutions = [];

    if (!tableStatus.leaderboard_personal) {
      issues.push('缺少 leaderboard_personal 表');
      solutions.push('运行数据库迁移创建排行榜表');
    }

    if (!tableStatus.leaderboard_alliance) {
      issues.push('缺少 leaderboard_alliance 表');
      solutions.push('运行数据库迁移创建联盟排行榜表');
    }

    if (tableStatus.leaderboards && !tableStatus.leaderboard_personal) {
      issues.push('使用旧的排行榜表结构');
      solutions.push('更新代码以使用新的表结构或创建新表');
    }

    if (issues.length === 0) {
      console.log('✅ 数据库表结构正常');
      console.log('💡 可能的问题：');
      console.log('  1. 应用服务器未重启，仍在使用旧代码');
      console.log('  2. 代码修复未正确部署到生产环境');
      console.log('  3. 负载均衡器缓存了旧的响应');
    } else {
      console.log('❌ 发现问题:', issues.join(', '));
      console.log('💡 建议解决方案:', solutions.join(', '));
    }

    return {
      tableStatus,
      issues,
      solutions
    };

  } catch (error) {
    console.error('❌ 诊断失败:', error.message);
    console.error('📄 错误详情:', error);
    return null;
  } finally {
    await db.destroy();
  }
}

// 执行诊断
if (require.main === module) {
  diagnoseLeaderboardAPI()
    .then(result => {
      if (result) {
        console.log('\n🎯 诊断完成！请根据上述建议进行修复。');
        process.exit(0);
      } else {
        console.log('\n❌ 诊断失败！');
        process.exit(1);
      }
    });
}

module.exports = { diagnoseLeaderboardAPI };