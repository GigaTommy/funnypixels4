/**
 * 完整初始化所有颜色和emoji旗帜图案
 */

const { db } = require('./src/config/database');

async function initializeAllFlags() {
  try {
    console.log('╔════════════════════════════════════════╗');
    console.log('║       完整初始化旗帜图案                ║');
    console.log('╚════════════════════════════════════════╝\n');

    // 定义所有颜色旗帜
    const colorFlags = [
      { key: 'color_red', name: '红色旗帜', color: '#FF0000', emoji: '🔴' },
      { key: 'color_yellow', name: '黄色旗帜', color: '#FFFF00', emoji: '🟡' },
      { key: 'color_green', name: '绿色旗帜', color: '#00FF00', emoji: '🟢' },
      { key: 'color_blue', name: '蓝色旗帜', color: '#0000FF', emoji: '🔵' },
      { key: 'color_magenta', name: '洋红色旗帜', color: '#FF00FF', emoji: '🟣' },
      { key: 'color_cyan', name: '青色旗帜', color: '#00FFFF', emoji: '🔷' },
      { key: 'color_white', name: '白色旗帜', color: '#FFFFFF', emoji: '⚪' },
      { key: 'color_black', name: '黑色旗帜', color: '#000000', emoji: '⚫' },
      { key: 'color_orange', name: '橙色旗帜', color: '#FFA500', emoji: '🟠' },
      { key: 'color_purple', name: '紫色旗帜', color: '#800080', emoji: '🟪' },
      { key: 'color_pink', name: '粉色旗帜', color: '#FFC0CB', emoji: '🩷' },
      { key: 'color_brown', name: '棕色旗帜', color: '#A52A2A', emoji: '🟤' },
      { key: 'color_gray', name: '灰色旗帜', color: '#808080', emoji: '🔘' },
      { key: 'color_lime', name: '青柠旗帜', color: '#00FF00', emoji: '🟩' },
      { key: 'color_maroon', name: '栗色旗帜', color: '#800000', emoji: '🟫' }
    ];

    // 定义所有emoji旗帜
    const emojiFlags = [
      { key: 'emoji_sun', name: '太阳旗帜', emoji: '☀️' },
      { key: 'emoji_moon', name: '月亮旗帜', emoji: '🌙' },
      { key: 'emoji_star', name: '星星旗帜', emoji: '⭐' },
      { key: 'emoji_fire', name: '火焰旗帜', emoji: '🔥' },
      { key: 'emoji_heart', name: '爱心旗帜', emoji: '❤️' },
      { key: 'emoji_skull', name: '骷髅旗帜', emoji: '💀' },
      { key: 'emoji_crown', name: '皇冠旗帜', emoji: '👑' },
      { key: 'emoji_sword', name: '剑旗帜', emoji: '⚔️' },
      { key: 'emoji_shield', name: '盾牌旗帜', emoji: '🛡️' },
      { key: 'emoji_dragon', name: '龙旗帜', emoji: '🐉' },
      { key: 'emoji_eagle', name: '鹰旗帜', emoji: '🦅' },
      { key: 'emoji_lightning', name: '闪电旗帜', emoji: '⚡' },
      { key: 'emoji_snowflake', name: '雪花旗帜', emoji: '❄️' },
      { key: 'emoji_cherry_blossom', name: '樱花旗帜', emoji: '🌺' },
      { key: 'emoji_maple_leaf', name: '枫叶旗帜', emoji: '🍁' }
    ];

    // 首先删除已存在的错误分类的图案
    console.log('🗑️  清理旧数据...');
    const deletedCount = await db('pattern_assets')
      .whereIn('key', [...colorFlags.map(f => f.key), ...emojiFlags.map(f => f.key)])
      .delete();
    console.log(`  ✅ 已删除 ${deletedCount} 条旧记录\n`);

    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // 初始化颜色旗帜
    console.log('🎨 初始化颜色旗帜...\n');
    for (const flag of colorFlags) {
      try {
        const existing = await db('pattern_assets').where('key', flag.key).first();
        if (existing) {
          console.log(`  ⏭️  ${flag.key.padEnd(20)} ${flag.emoji} 已存在`);
          skippedCount++;
        } else {
          await db('pattern_assets').insert({
            key: flag.key,
            name: flag.name,
            description: `${flag.name}，用于联盟旗帜`,
            category: 'color',
            render_type: 'color',
            unicode_char: flag.emoji,
            encoding: 'color',
            payload: JSON.stringify({ color: flag.color, type: 'color' }),
            tags: [flag.key.replace('color_', ''), 'color', 'alliance_flag'],
            is_public: true,
            created_at: new Date(),
            updated_at: new Date()
          });
          console.log(`  ✅ ${flag.key.padEnd(20)} ${flag.emoji} ${flag.name}`);
          createdCount++;
        }
      } catch (err) {
        console.log(`  ❌ ${flag.key.padEnd(20)} ${flag.emoji} 错误: ${err.message}`);
        errorCount++;
      }
    }

    // 初始化emoji旗帜
    console.log('\n😀 初始化Emoji旗帜...\n');
    for (const flag of emojiFlags) {
      try {
        const existing = await db('pattern_assets').where('key', flag.key).first();
        if (existing) {
          console.log(`  ⏭️  ${flag.key.padEnd(24)} ${flag.emoji} 已存在`);
          skippedCount++;
        } else {
          await db('pattern_assets').insert({
            key: flag.key,
            name: flag.name,
            description: `${flag.name}，用于联盟旗帜`,
            category: 'emoji',
            render_type: 'emoji',
            unicode_char: flag.emoji,
            encoding: 'emoji',
            payload: JSON.stringify({ emoji: flag.emoji, type: 'emoji' }),
            tags: [flag.key.replace('emoji_', ''), 'emoji', 'alliance_flag'],
            is_public: true,
            created_at: new Date(),
            updated_at: new Date()
          });
          console.log(`  ✅ ${flag.key.padEnd(24)} ${flag.emoji} ${flag.name}`);
          createdCount++;
        }
      } catch (err) {
        console.log(`  ❌ ${flag.key.padEnd(24)} ${flag.emoji} 错误: ${err.message}`);
        errorCount++;
      }
    }

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║               总结                     ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(`✅ 新创建: ${createdCount}`);
    console.log(`⏭️  已存在: ${skippedCount}`);
    console.log(`❌ 失败: ${errorCount}`);
    console.log(`📊 总计: ${colorFlags.length + emojiFlags.length}`);

    // 最终验证
    console.log('\n🔍 最终验证...');
    const colorCount = await db('pattern_assets')
      .where('category', 'color')
      .count('* as count')
      .first();
    const emojiCount = await db('pattern_assets')
      .where('category', 'emoji')
      .count('* as count')
      .first();

    console.log(`✅ color 图案总数: ${colorCount.count}`);
    console.log(`✅ emoji 图案总数: ${emojiCount.count}`);
    console.log(`✅ 图案总计: ${parseInt(colorCount.count) + parseInt(emojiCount.count)}`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 初始化失败:', error);
    process.exit(1);
  }
}

initializeAllFlags();
