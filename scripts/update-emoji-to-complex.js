/**
 * 更新emoji为complex类型的脚本
 * 执行前确保已将所有emoji PNG文件放入 public/patterns/ 目录
 */

const { db } = require('../backend/src/config/database');

const EMOJIS = [
  {
    "key": "emoji_crown",
    "unicode": "👑",
    "codepoint": "1f451",
    "name": "皇冠"
  },
  {
    "key": "emoji_star",
    "unicode": "⭐",
    "codepoint": "2b50",
    "name": "星星"
  },
  {
    "key": "emoji_heart",
    "unicode": "❤️",
    "codepoint": "2764-fe0f",
    "name": "爱心"
  },
  {
    "key": "emoji_fire",
    "unicode": "🔥",
    "codepoint": "1f525",
    "name": "火焰"
  },
  {
    "key": "emoji_water",
    "unicode": "💧",
    "codepoint": "1f4a7",
    "name": "水滴"
  },
  {
    "key": "emoji_leaf",
    "unicode": "🍃",
    "codepoint": "1f343",
    "name": "叶子"
  },
  {
    "key": "emoji_sun",
    "unicode": "☀️",
    "codepoint": "2600-fe0f",
    "name": "太阳"
  },
  {
    "key": "emoji_moon",
    "unicode": "🌙",
    "codepoint": "1f319",
    "name": "月亮"
  },
  {
    "key": "emoji_cloud",
    "unicode": "☁️",
    "codepoint": "2601-fe0f",
    "name": "云"
  },
  {
    "key": "emoji_rainbow",
    "unicode": "🌈",
    "codepoint": "1f308",
    "name": "彩虹"
  },
  {
    "key": "emoji_thunder",
    "unicode": "⚡",
    "codepoint": "26a1",
    "name": "闪电"
  },
  {
    "key": "emoji_snow",
    "unicode": "❄️",
    "codepoint": "2744-fe0f",
    "name": "雪花"
  },
  {
    "key": "emoji_rain",
    "unicode": "☔",
    "codepoint": "2614-fe0f",
    "name": "雨伞"
  },
  {
    "key": "emoji_anchor",
    "unicode": "⚓",
    "codepoint": "2693",
    "name": "锚"
  },
  {
    "key": "emoji_compass",
    "unicode": "🧭",
    "codepoint": "1f9ed",
    "name": "指南针"
  },
  {
    "key": "emoji_earth",
    "unicode": "🌍",
    "codepoint": "1f30d",
    "name": "地球"
  }
];

async function updateEmojiToComplex() {
  console.log('🔄 开始更新emoji为complex类型...');

  try {
    for (const emoji of EMOJIS) {
      const result = await db('pattern_assets')
        .where({ key: emoji.key })
        .update({
          render_type: 'complex',
          encoding: 'image_url',
          image_url: `/patterns/${emoji.key}.png`,
          unicode_char: emoji.unicode,
          updated_at: new Date()
        });

      console.log(`✅ 更新成功: ${emoji.name} (${emoji.key})`);
    }

    console.log(`\n🎉 全部更新完成！共 ${EMOJIS.length} 个emoji`);

    // 验证更新
    const updatedEmojis = await db('pattern_assets')
      .where('key', 'like', 'emoji_%')
      .select('key', 'render_type', 'encoding', 'image_url', 'unicode_char');

    console.log('\n📊 更新后的emoji配置:');
    console.table(updatedEmojis);

  } catch (error) {
    console.error('❌ 更新失败:', error);
  } finally {
    await db.destroy();
  }
}

updateEmojiToComplex();
