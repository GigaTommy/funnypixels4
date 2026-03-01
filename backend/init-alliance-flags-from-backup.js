/**
 * 从备份数据重新初始化联盟旗帜图案
 * 参考: funnypixels-full-backup-2026-01-11T13-44-43.sql
 */

const { db } = require('./src/config/database');

async function initializeAllianceFlags() {
  try {
    console.log('╔════════════════════════════════════════╗');
    console.log('║    从备份数据初始化联盟旗帜图案         ║');
    console.log('╚════════════════════════════════════════╝\n');

    // 定义所有颜色旗帜 - 参考 init-all-flags.js
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

    // 定义所有emoji旗帜 - 参考备份数据
    const emojiFlags = [
      { key: 'emoji_sun', name: '太阳', emoji: '☀️', color: '#FFD700', description: '黄色太阳emoji', tags: '太阳,emoji,黄色,光明' },
      { key: 'emoji_moon', name: '月亮', emoji: '🌙', color: '#C0C0C0', description: '银色月亮emoji', tags: '月亮,emoji,银色,夜晚' },
      { key: 'emoji_star', name: '星星', emoji: '⭐', color: '#FFD700', description: '闪亮星星emoji', tags: '星星,emoji,闪亮,装饰' },
      { key: 'emoji_fire', name: '火焰', emoji: '🔥', color: '#FFA500', description: '橙色火焰emoji', tags: '火焰,emoji,橙色,能量' },
      { key: 'emoji_heart', name: '爱心', emoji: '❤️', color: '#FF0000', description: '红色爱心emoji', tags: '爱心,emoji,红色,情感' },
      { key: 'emoji_skull', name: '骷髅', emoji: '💀', color: '#FFFFFF', description: '白色骷髅emoji', tags: '骷髅,emoji,白色,危险' },
      { key: 'emoji_crown', name: '皇冠', emoji: '👑', color: '#FFD700', description: '金色皇冠emoji', tags: '皇冠,emoji,装饰,金色' },
      { key: 'emoji_sword', name: '剑', emoji: '⚔️', color: '#C0C0C0', description: '银色剑emoji', tags: '剑,emoji,武器,战斗' },
      { key: 'emoji_shield', name: '盾牌', emoji: '🛡️', color: '#8B4513', description: '棕色盾牌emoji', tags: '盾牌,emoji,防御,保护' },
      { key: 'emoji_dragon', name: '龙', emoji: '🐉', color: '#FF0000', description: '红色龙emoji', tags: '龙,emoji,神话,力量' },
      { key: 'emoji_eagle', name: '鹰', emoji: '🦅', color: '#8B4513', description: '棕色鹰emoji', tags: '鹰,emoji,鸟类,天空' },
      { key: 'emoji_lightning', name: '闪电', emoji: '⚡', color: '#FFD700', description: '金色闪电emoji', tags: '闪电,emoji,天气,能量' },
      { key: 'emoji_snowflake', name: '雪花', emoji: '❄️', color: '#ADD8E6', description: '蓝色雪花emoji', tags: '雪花,emoji,寒冷,冬天' },
      { key: 'emoji_cherry_blossom', name: '樱花', emoji: '🌺', color: '#FFB7C5', description: '粉色樱花emoji', tags: '樱花,emoji,花朵,春天' },
      { key: 'emoji_maple_leaf', name: '枫叶', emoji: '🍁', color: '#FF8C00', description: '橙色枫叶emoji', tags: '枫叶,emoji,秋天,自然' }
    ];

    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // 删除已存在的旗帜数据（避免重复）
    console.log('🗑️  清理旧数据...');
    const allKeys = [...colorFlags.map(f => f.key), ...emojiFlags.map(f => f.key)];
    const deletedCount = await db('pattern_assets')
      .whereIn('key', allKeys)
      .delete();
    console.log(`  ✅ 已删除 ${deletedCount} 条旧记录\n`);

    // 初始化颜色旗帜
    console.log('🎨 初始化颜色旗帜...\n');
    for (const flag of colorFlags) {
      try {
        await db('pattern_assets').insert({
          key: flag.key,
          name: flag.name,
          description: `${flag.name}，用于联盟旗帜`,
          category: 'color',
          render_type: 'color',
          unicode_char: flag.emoji,
          encoding: 'color',
          payload: JSON.stringify({ color: flag.color, type: 'color' }),
          color: flag.color,
          tags: [flag.key.replace('color_', ''), 'color', 'alliance_flag'],
          is_public: true,
          width: 32,
          height: 32,
          verified: true,
          created_at: new Date(),
          updated_at: new Date()
        });
        console.log(`  ✅ ${flag.key.padEnd(20)} ${flag.emoji} ${flag.name}`);
        createdCount++;
      } catch (err) {
        console.log(`  ❌ ${flag.key.padEnd(20)} ${flag.emoji} 错误: ${err.message}`);
        errorCount++;
      }
    }

    // 初始化emoji旗帜
    console.log('\n😀 初始化Emoji旗帜...\n');
    for (const flag of emojiFlags) {
      try {
        await db('pattern_assets').insert({
          key: flag.key,
          name: flag.name,
          description: flag.description,
          category: 'emoji',
          render_type: 'emoji',
          unicode_char: flag.emoji,
          encoding: 'emoji',
          payload: JSON.stringify({ emoji: flag.emoji, type: 'emoji' }),
          color: flag.color,
          tags: flag.tags.split(','),
          is_public: true,
          width: 32,
          height: 32,
          verified: true,
          created_at: new Date(),
          updated_at: new Date()
        });
        console.log(`  ✅ ${flag.key.padEnd(24)} ${flag.emoji} ${flag.name}`);
        createdCount++;
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

    // 验证示例数据
    console.log('\n📊 验证数据示例...');
    const sampleColor = await db('pattern_assets')
      .where('category', 'color')
      .where('key', 'color_red')
      .first();
    console.log('颜色旗帜示例 (color_red):', {
      key: sampleColor?.key,
      name: sampleColor?.name,
      category: sampleColor?.category,
      color: sampleColor?.color,
      unicode_char: sampleColor?.unicode_char
    });

    const sampleEmoji = await db('pattern_assets')
      .where('category', 'emoji')
      .where('key', 'emoji_sun')
      .first();
    console.log('Emoji旗帜示例 (emoji_sun):', {
      key: sampleEmoji?.key,
      name: sampleEmoji?.name,
      category: sampleEmoji?.category,
      color: sampleEmoji?.color,
      unicode_char: sampleEmoji?.unicode_char
    });

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 初始化失败:', error);
    process.exit(1);
  }
}

initializeAllianceFlags();
