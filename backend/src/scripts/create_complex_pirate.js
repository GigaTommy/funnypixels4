/**
 * 创建complex_pirate pattern到pattern_assets表
 */

// 设置环境变量
process.env.LOCAL_VALIDATION = 'true';

const { db } = require('../config/database');

async function createPiratePattern() {
  try {
    console.log('🏴‍☠️ 开始创建complex_pirate Pattern...\n');

    // 检查数据库连接
    await db.raw('SELECT 1');
    console.log('✅ 数据库连接成功\n');

    // 检查是否已存在
    const existing = await db('pattern_assets')
      .where('key', 'complex_pirate')
      .first();

    if (existing) {
      console.log('⚠️ complex_pirate Pattern已存在，跳过创建');
      return;
    }

    // 创建pattern
    const pattern = {
      key: 'complex_pirate',
      name: '海盗图案',
      description: '海盗主题复杂图案',
      category: 'complex',
      render_type: 'complex',
      payload: JSON.stringify({
        type: 'complex',
        theme: 'pirate',
        description: '海盗旗图案'
      }),
      width: 32,
      height: 32,
      encoding: 'rle',
      verified: true,
      is_public: true,
      created_at: db.fn.now(),
      updated_at: db.fn.now()
    };

    await db('pattern_assets').insert(pattern);
    console.log('✅ complex_pirate Pattern创建成功\n');

    // 验证创建结果
    const created = await db('pattern_assets')
      .where('key', 'complex_pirate')
      .first();

    if (created) {
      console.log('✅ 验证成功，Pattern已创建:');
      console.log(`  - key: ${created.key}`);
      console.log(`  - name: ${created.name}`);
      console.log(`  - render_type: ${created.render_type}`);
      console.log(`  - category: ${created.category}\n`);
    }

  } catch (error) {
    console.error('❌ 创建complex_pirate Pattern失败:', error);
    throw error;
  } finally {
    await db.destroy();
  }
}

// 运行
createPiratePattern();