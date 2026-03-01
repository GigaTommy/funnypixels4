/**
 * 联盟旗帜初始化脚本 - 创建缺失的 pattern_assets 并更新联盟
 */

const { db } = require('./src/config/database');

async function initializeAllianceFlagsWithAssets() {
  try {
    console.log('🚀 开始联盟旗帜初始化...\n');

    // 定义需要创建的图案资源
    const requiredPatterns = [
      {
        key: 'emoji_sun',
        name: '太阳旗帜',
        description: '太阳表情符号旗帜',
        category: 'alliance_flag',
        render_type: 'emoji',
        unicode_char: '☀️',
        encoding: 'emoji',
        payload: JSON.stringify({
          emoji: '☀️',
          type: 'emoji'
        }),
        tags: ['sun', 'emoji', 'bright'],
        is_public: true
      },
      {
        key: 'color_magenta',
        name: '洋红色旗帜',
        description: '洋红色纯色旗帜',
        category: 'alliance_flag',
        render_type: 'color',
        unicode_char: '🌺',
        encoding: 'color',
        payload: JSON.stringify({
          color: '#FF00FF',
          type: 'color'
        }),
        tags: ['magenta', 'pink', 'color'],
        is_public: true
      }
    ];

    console.log('📝 创建图案资源...');
    const createdPatterns = [];

    for (const pattern of requiredPatterns) {
      // 检查是否已存在
      const existing = await db('pattern_assets')
        .where('key', pattern.key)
        .first();

      if (existing) {
        console.log(`  ℹ️  图案已存在: ${pattern.key}`);
        createdPatterns.push(existing);
      } else {
        const [created] = await db('pattern_assets')
          .insert({
            ...pattern,
            created_at: new Date(),
            updated_at: new Date()
          })
          .returning('*');
        console.log(`  ✅ 创建图案: ${pattern.key}`);
        createdPatterns.push(created);
      }
    }

    console.log('\n📝 更新联盟旗帜...');
    let successCount = 0;
    let errorCount = 0;

    // 获取需要更新旗帜的联盟
    const alliances = await db('alliances')
      .whereNull('flag_payload')
      .orWhere('flag_payload', '')
      .select('*');

    for (const alliance of alliances) {
      console.log(`  处理: [${alliance.id}] ${alliance.name}`);

      // 查找对应的图案
      const pattern = createdPatterns.find(p => p.key === alliance.flag_pattern_id);

      if (!pattern) {
        console.log(`    ⚠️  未找到图案: ${alliance.flag_pattern_id}`);
        errorCount++;
        continue;
      }

      try {
        await db('alliances')
          .where('id', alliance.id)
          .update({
            flag_payload: pattern.payload,
            flag_unicode_char: pattern.unicode_char,
            flag_render_type: pattern.render_type,
            updated_at: new Date()
          });

        console.log(`    ✅ 旗帜已更新`);
        successCount++;
      } catch (err) {
        console.log(`    ❌ 更新失败: ${err.message}`);
        errorCount++;
      }
    }

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║           初始化完成                    ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(`✅ 成功: ${successCount}`);
    console.log(`❌ 失败: ${errorCount}`);
    console.log(`📊 总计: ${alliances.length}`);

    // 验证结果
    console.log('\n🔍 验证结果...');
    const updatedAlliances = await db('alliances')
      .whereIn('id', alliances.map(a => a.id))
      .select('id', 'name', 'flag_payload', 'flag_unicode_char');

    for (const alliance of updatedAlliances) {
      const hasPayload = !!alliance.flag_payload;
      console.log(`  ${hasPayload ? '✅' : '❌'} [${alliance.id}] ${alliance.name} - ${hasPayload ? '已初始化' : '未初始化'}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 初始化失败:', error);
    process.exit(1);
  }
}

initializeAllianceFlagsWithAssets();
