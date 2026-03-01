/**
 * 联盟旗帜增量初始化脚本
 *
 * 为没有 flag_payload 的联盟从 pattern_assets 表加载旗帜数据
 */

const { db } = require('./src/config/database');

async function initializeAllianceFlags() {
  try {
    console.log('🚀 开始联盟旗帜增量初始化...\n');

    // 1. 查找没有 flag_payload 的联盟
    const alliances = await db('alliances')
      .whereNull('flag_payload')
      .orWhere('flag_payload', '')
      .select('*');

    if (alliances.length === 0) {
      console.log('✅ 所有联盟都已初始化旗帜');
      process.exit(0);
    }

    console.log(`📊 找到 ${alliances.length} 个需要初始化旗帜的联盟:\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const alliance of alliances) {
      console.log(`处理联盟: [${alliance.id}] ${alliance.name}`);
      console.log(`  flag_pattern_id: ${alliance.flag_pattern_id}`);
      console.log(`  flag_render_type: ${alliance.flag_render_type}`);

      try {
        // 从 pattern_assets 表获取旗帜数据
        const patternAsset = await db('pattern_assets')
          .where('key', alliance.flag_pattern_id)
          .select('payload', 'render_type', 'unicode_char')
          .first();

        if (!patternAsset) {
          console.log(`  ⚠️  未找到图案资源: ${alliance.flag_pattern_id}`);

          // 尝试通过 id 查找
          const patternById = await db('pattern_assets')
            .where('id', alliance.flag_pattern_id)
            .select('payload', 'render_type', 'unicode_char')
            .first();

          if (patternById) {
            console.log(`  ✅ 通过 ID 找到图案资源`);
            await updateAllianceFlag(alliance.id, patternById);
            successCount++;
          } else {
            console.log(`  ❌ 无法找到图案资源，跳过`);
            skipCount++;
          }
        } else {
          console.log(`  ✅ 找到图案资源`);
          console.log(`  - render_type: ${patternAsset.render_type || 'color'}`);
          console.log(`  - unicode_char: ${patternAsset.unicode_char || 'N/A'}`);
          console.log(`  - has_payload: ${!!patternAsset.payload}`);

          // 更新联盟的 flag_payload
          await updateAllianceFlag(alliance.id, patternAsset);
          successCount++;
        }

      } catch (err) {
        console.log(`  ❌ 初始化失败: ${err.message}`);
        errorCount++;
      }

      console.log('');
    }

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║           初始化完成                    ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(`✅ 成功: ${successCount}`);
    console.log(`⚠️  跳过: ${skipCount}`);
    console.log(`❌ 失败: ${errorCount}`);
    console.log(`📊 总计: ${alliances.length}`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 初始化失败:', error);
    process.exit(1);
  }
}

async function updateAllianceFlag(allianceId, patternAsset) {
  const updateData = {
    flag_payload: patternAsset.payload,
    flag_unicode_char: patternAsset.unicode_char,
    flag_render_type: patternAsset.render_type || 'color',
    updated_at: new Date()
  };

  await db('alliances')
    .where('id', allianceId)
    .update(updateData);

  console.log(`  ✅ 旗帜已更新`);
}

initializeAllianceFlags();
