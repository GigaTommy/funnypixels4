/**
 * 检查颜色和emoji旗帜的完整初始化状态
 */

const { db } = require('./src/config/database');

async function checkFlagCoverage() {
  try {
    console.log('╔════════════════════════════════════════╗');
    console.log('║       旗帜图案初始化状态检查            ║');
    console.log('╚════════════════════════════════════════╝\n');

    // 定义应该有的颜色旗帜
    const expectedColorFlags = [
      { key: 'color_red', name: '红色', color: '#FF0000', emoji: '🔴' },
      { key: 'color_yellow', name: '黄色', color: '#FFFF00', emoji: '🟡' },
      { key: 'color_green', name: '绿色', color: '#00FF00', emoji: '🟢' },
      { key: 'color_blue', name: '蓝色', color: '#0000FF', emoji: '🔵' },
      { key: 'color_magenta', name: '洋红', color: '#FF00FF', emoji: '🟣' },
      { key: 'color_cyan', name: '青色', color: '#00FFFF', emoji: '🔷' },
      { key: 'color_white', name: '白色', color: '#FFFFFF', emoji: '⚪' },
      { key: 'color_black', name: '黑色', color: '#000000', emoji: '⚫' },
      { key: 'color_orange', name: '橙色', color: '#FFA500', emoji: '🟠' },
      { key: 'color_purple', name: '紫色', color: '#800080', emoji: '🟪' },
      { key: 'color_pink', name: '粉色', color: '#FFC0CB', emoji: '🩷' },
      { key: 'color_brown', name: '棕色', color: '#A52A2A', emoji: '🟤' },
      { key: 'color_gray', name: '灰色', color: '#808080', emoji: '🔘' },
      { key: 'color_lime', name: '青柠', color: '#00FF00', emoji: '🟩' },
      { key: 'color_maroon', name: '栗色', color: '#800000', emoji: '🟫' }
    ];

    // 定义应该有的emoji旗帜
    const expectedEmojiFlags = [
      { key: 'emoji_sun', name: '太阳', emoji: '☀️' },
      { key: 'emoji_moon', name: '月亮', emoji: '🌙' },
      { key: 'emoji_star', name: '星星', emoji: '⭐' },
      { key: 'emoji_fire', name: '火焰', emoji: '🔥' },
      { key: 'emoji_heart', name: '爱心', emoji: '❤️' },
      { key: 'emoji_skull', name: '骷髅', emoji: '💀' },
      { key: 'emoji_crown', name: '皇冠', emoji: '👑' },
      { key: 'emoji_sword', name: '剑', emoji: '⚔️' },
      { key: 'emoji_shield', name: '盾牌', emoji: '🛡️' },
      { key: 'emoji_dragon', name: '龙', emoji: '🐉' },
      { key: 'emoji_eagle', name: '鹰', emoji: '🦅' },
      { key: 'emoji_lightning', name: '闪电', emoji: '⚡' },
      { key: 'emoji_snowflake', name: '雪花', emoji: '❄️' },
      { key: 'emoji_cherry_blossom', name: '樱花', emoji: '🌺' },
      { key: 'emoji_maple_leaf', name: '枫叶', emoji: '🍁' }
    ];

    // 获取数据库中已有的图案
    const existingAssets = await db('pattern_assets')
      .select('key', 'name', 'category', 'render_type');
    const existingKeys = new Set(existingAssets.map(a => a.key));

    // 检查颜色旗帜
    console.log('📊 颜色旗帜状态:\n');
    let colorExists = 0;
    let colorMissing = [];

    for (const flag of expectedColorFlags) {
      const exists = existingKeys.has(flag.key);
      if (exists) {
        colorExists++;
        console.log(`  ✅ ${flag.key.padEnd(18)} ${flag.emoji} ${flag.name}`);
      } else {
        colorMissing.push(flag);
        console.log(`  ❌ ${flag.key.padEnd(18)} ${flag.emoji} ${flag.name} [缺失]`);
      }
    }

    console.log(`\n  颜色旗帜: ${colorExists}/${expectedColorFlags.length} 已初始化`);

    if (colorMissing.length > 0) {
      console.log(`  ⚠️  缺失: ${colorMissing.length} 个`);
    }

    // 检查emoji旗帜
    console.log('\n📊 Emoji旗帜状态:\n');
    let emojiExists = 0;
    let emojiMissing = [];

    for (const flag of expectedEmojiFlags) {
      const exists = existingKeys.has(flag.key);
      if (exists) {
        emojiExists++;
        console.log(`  ✅ ${flag.key.padEnd(22)} ${flag.emoji} ${flag.name}`);
      } else {
        emojiMissing.push(flag);
        console.log(`  ❌ ${flag.key.padEnd(22)} ${flag.emoji} ${flag.name} [缺失]`);
      }
    }

    console.log(`\n  Emoji旗帜: ${emojiExists}/${expectedEmojiFlags.length} 已初始化`);

    if (emojiMissing.length > 0) {
      console.log(`  ⚠️  缺失: ${emojiMissing.length} 个`);
    }

    // 总结
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║               总结                     ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(`🎨 颜色旗帜: ${colorExists}/${expectedColorFlags.length} (${Math.round(colorExists/expectedColorFlags.length*100)}%)`);
    console.log(`😀 Emoji旗帜: ${emojiExists}/${expectedEmojiFlags.length} (${Math.round(emojiExists/expectedEmojiFlags.length*100)}%)`);
    console.log(`📊 总体进度: ${colorExists + emojiExists}/${expectedColorFlags.length + expectedEmojiFlags.length} (${Math.round((colorExists + emojiExists)/(expectedColorFlags.length + expectedEmojiFlags.length)*100)}%)`);

    if (colorMissing.length > 0 || emojiMissing.length > 0) {
      console.log('\n⚠️  需要初始化旗帜图案');
      return { colorMissing, emojiMissing, complete: false };
    } else {
      console.log('\n✅ 所有旗帜图案已完整初始化');
      return { colorMissing: [], emojiMissing: [], complete: true };
    }

  } catch (error) {
    console.error('❌ 检查失败:', error);
    process.exit(1);
  }
}

checkFlagCoverage();
