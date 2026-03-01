/**
 * 主种子编排器 - 按依赖关系顺序执行所有种子
 *
 * 重要：此文件是唯一入口，使用 knex seed:run --specific=000_main_seed.js 执行
 * 不要直接运行 knex seed:run（会按字母顺序执行所有文件导致冲突）
 *
 * 修复记录：
 * - 2026-02-17: 修复并发执行 Bug（所有 require().seed() 立即执行），
 *   改为延迟调用确保顺序执行
 * - 2026-02-17: 加入之前遗漏的种子文件（system_configs, regions,
 *   alliance_flags, personal_color_patterns, achievement_definitions,
 *   achievement_translations）
 * - 2026-02-17: 末尾添加序列号同步步骤
 */
exports.seed = async function (knex) {
  console.log('🌱 开始运行所有种子数据...\n');

  // 按依赖关系分阶段执行
  // 每个阶段内的种子按顺序逐个执行（不再并发）
  const stages = [
    // === 阶段 1: 基础配置（无外键依赖） ===
    {
      name: '基础配置',
      seeds: [
        { file: './001_default_system_configs.js', desc: '系统配置（协议/隐私政策）' },
        { file: './003_seed_regions.js', desc: '区域/城市数据' },
      ]
    },
    // === 阶段 2: 核心数据（用户、图案资产） ===
    {
      name: '核心数据',
      seeds: [
        { file: './002_users.js', desc: '用户' },
        { file: './004_pattern_assets.js', desc: '图案资产（基础色+Emoji）' },
        { file: './008_personal_color_patterns.js', desc: '个人色彩图案' },
      ]
    },
    // === 阶段 3: 商业数据（依赖用户和图案） ===
    // 重要顺序: store_items → shop_skus(全删+基础SKU) → alliance_flags(追加联盟SKU)
    {
      name: '商业数据',
      seeds: [
        { file: './002_store_items.js', desc: '商店商品' },
        { file: './006_shop_skus.js', desc: '商店 SKU（基础旗帜颜色）' },
        { file: './007_alliance_flags.js', desc: '联盟旗帜图案 + SKU（追加）' },
        { file: './008_advertisements.js', desc: '广告（清空）' },
        { file: './009_ad_products.js', desc: '广告产品' },
      ]
    },
    // === 阶段 4: 成就系统 ===
    {
      name: '成就系统',
      seeds: [
        { file: './007_achievements.js', desc: '成就（旧表）' },
        { file: './017_achievement_definitions_expanded.js', desc: '成就定义（新表）' },
        { file: './025_achievement_translations.js', desc: '成就翻译' },
      ]
    },
    // === 阶段 5: 用户关联数据（依赖用户） ===
    {
      name: '用户关联数据',
      seeds: [
        { file: './003_alliances.js', desc: '联盟' },
        { file: './009_user_points.js', desc: '用户积分' },
        { file: './010_user_inventory.js', desc: '用户背包（清空）' },
        { file: './011_user_items.js', desc: '用户物品（清空）' },
        { file: './012_user_pixel_states.js', desc: '用户像素状态' },
        { file: './014_alliance_members.js', desc: '联盟成员' },
        { file: './015_alliance_applications.js', desc: '联盟申请（清空）' },
        { file: './016_user_achievements.js', desc: '用户成就（清空）' },
        { file: './017_user_ad_credits.js', desc: '用户广告积分（清空）' },
        { file: './018_user_shares.js', desc: '用户分享（清空）' },
      ]
    },
    // === 阶段 6: 内容数据（依赖用户） ===
    {
      name: '内容数据',
      seeds: [
        { file: './013_pixels.js', desc: '像素数据' },
        { file: './019_chat_messages.js', desc: '聊天消息' },
        { file: './020_notifications.js', desc: '通知（清空）' },
        { file: './021_recharge_orders.js', desc: '充值订单' },
        { file: './022_wallet_ledger.js', desc: '钱包流水' },
      ]
    },
  ];

  let totalSeeds = 0;
  let failedSeeds = [];

  for (const stage of stages) {
    console.log(`\n📦 阶段: ${stage.name}`);
    for (const { file, desc } of stage.seeds) {
      totalSeeds++;
      try {
        // 关键修复：延迟调用 .seed(knex)，确保上一个种子完成后才执行下一个
        await require(file).seed(knex);
        console.log(`  ✅ ${desc}`);
      } catch (err) {
        failedSeeds.push({ file, desc, error: err.message });
        console.error(`  ❌ ${desc}: ${err.message}`);
      }
    }
  }

  // === 阶段 7: 修复序列号（硬编码 ID 导致序列不同步） ===
  console.log('\n🔧 修复序列号同步...');
  // 注意：仅包含使用 serial/integer ID 的表（UUID 主键的表不需要序列同步）
  const sequences = [
    { table: 'store_items', seq: 'store_items_id_seq' },
    { table: 'shop_skus', seq: 'shop_skus_id_seq' },
    { table: 'achievements', seq: 'achievements_id_seq' },
    { table: 'user_pixel_states', seq: 'user_pixel_states_id_seq' },
    { table: 'chat_messages', seq: 'chat_messages_id_seq' },
  ];

  for (const { table, seq } of sequences) {
    try {
      await knex.raw(`SELECT setval(?, COALESCE((SELECT MAX(id) FROM ??), 0) + 1, false)`, [seq, table]);
      console.log(`  ✅ ${seq} synced`);
    } catch (err) {
      console.log(`  ⚠️ ${seq}: ${err.message}`);
    }
  }

  // === 总结 ===
  console.log(`\n🎉 种子执行完成: ${totalSeeds - failedSeeds.length}/${totalSeeds} 成功`);
  if (failedSeeds.length > 0) {
    console.error('\n⚠️ 失败的种子:');
    failedSeeds.forEach(f => console.error(`  - ${f.desc} (${f.file}): ${f.error}`));
  }
};
