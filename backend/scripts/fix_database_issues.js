const { Pool } = require('pg');

// 数据库配置 - 使用生产环境配置
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://funnypixels:QLpdpDGojmcxRNdMsoTmcuspnaQBls4y@dpg-d2tfm0ndiees73879o80-a.singapore-postgres.render.com/funnypixels_postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

async function fixDatabaseIssues() {
  const client = await pool.connect();

  try {
    console.log('🔧 开始修复数据库问题...');

    // 1. 创建 store_orders 统一视图
    console.log('📝 创建 store_orders 统一视图...');
    await client.query(`
      CREATE OR REPLACE VIEW store_orders AS

      -- 广告订单
      SELECT
        id,
        user_id,
        'advertisement' as order_type,
        title as product_name,
        description,
        status,
        price,
        created_at,
        updated_at
      FROM ad_orders

      UNION ALL

      -- 自定义旗帜订单
      SELECT
        id,
        user_id,
        'custom_flag' as order_type,
        pattern_name as product_name,
        pattern_description as description,
        status,
        price,
        created_at,
        updated_at
      FROM custom_flag_orders

      UNION ALL

      -- 充值订单
      SELECT
        id,
        user_id,
        'recharge' as order_type,
        CONCAT('充值订单: ', points, '积分') as product_name,
        CONCAT('充值金额: ', amount_rmb, '元') as description,
        status,
        NULL as price,
        created_at,
        updated_at
      FROM recharge_orders;
    `);

    console.log('✅ store_orders 视图创建成功');

    // 2. 检查并添加缺失的索引
    console.log('📝 检查索引...');

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);',
      'CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);',
      'CREATE INDEX IF NOT EXISTS idx_advertisements_status ON advertisements(status);',
      'CREATE INDEX IF NOT EXISTS idx_advertisements_user_id ON advertisements(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_custom_flag_orders_status ON custom_flag_orders(status);',
      'CREATE INDEX IF NOT EXISTS idx_custom_flag_orders_user_id ON custom_flag_orders(user_id);',
    ];

    for (const indexSql of indexes) {
      await client.query(indexSql);
    }

    console.log('✅ 索引检查完成');

    // 3. 验证关键表的存在
    console.log('📝 验证表结构...');

    const tables = ['reports', 'advertisements', 'custom_flag_orders', 'ad_orders', 'recharge_orders', 'users'];
    for (const table of tables) {
      const result = await client.query(`SELECT to_regclass('${table}')`);
      if (result.rows[0].to_regclass) {
        console.log(`✅ 表 ${table} 存在`);
      } else {
        console.log(`❌ 表 ${table} 不存在`);
      }
    }

    // 4. 验证视图
    const viewResult = await client.query(`SELECT to_regclass('store_orders')`);
    if (viewResult.rows[0].to_regclass) {
      console.log('✅ store_orders 视图创建成功');
    } else {
      console.log('❌ store_orders 视图创建失败');
    }

    console.log('🎉 数据库问题修复完成！');

  } catch (error) {
    console.error('❌ 修复数据库问题时出错:', error);
    throw error;
  } finally {
    client.release();
  }
}

// 执行修复
if (require.main === module) {
  fixDatabaseIssues()
    .then(() => {
      console.log('✅ 修复完成，正在退出...');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 修复失败:', error);
      process.exit(1);
    });
}

module.exports = { fixDatabaseIssues };