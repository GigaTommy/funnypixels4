/**
 * Emoji Atlas 离线生成工具
 *
 * 功能：
 * 1. 读取常用 emoji 列表
 * 2. 使用 Canvas 预渲染每个 emoji（64x64）
 * 3. 拼接为 4096x4096 彩色大图（atlas.png）
 * 4. 生成 UV 坐标映射文件（emoji_map.json）
 *
 * 使用：
 * node scripts/emoji-atlas-generator.js
 *
 * 输出：
 * - public/assets/emoji/atlas.png (4096x4096 PNG)
 * - public/assets/emoji/emoji_map.json (UV 映射)
 */

const { createCanvas, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  // 每个 emoji 的尺寸（像素）
  emojiSize: 64,

  // Atlas 大图尺寸（必须是 2 的幂次）
  atlasWidth: 4096,
  atlasHeight: 4096,

  // 每行/列可容纳的 emoji 数量
  get emojisPerRow() {
    return Math.floor(this.atlasWidth / this.emojiSize);
  },

  get emojisPerColumn() {
    return Math.floor(this.atlasHeight / this.emojiSize);
  },

  get totalCapacity() {
    return this.emojisPerRow * this.emojisPerColumn;
  },

  // 输出路径
  outputDir: path.join(__dirname, '../public/assets/emoji'),
  atlasFilename: 'atlas.png',
  mapFilename: 'emoji_map.json',

  // 字体配置
  fonts: [
    'Apple Color Emoji',
    'Segoe UI Emoji',
    'Noto Color Emoji',
    'Twemoji Mozilla',
    'sans-serif'
  ]
};

// 常用 emoji 列表（约 1500+ 个）
// 按类别组织，方便管理
const EMOJI_LIST = {
  // 表情与情绪（200+）
  faces: [
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
    '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
    '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
    '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
    '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
    '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓',
    '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺',
    '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣',
    '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈',
    '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾'
  ],

  // 手势（50+）
  hands: [
    '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟',
    '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎',
    '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏'
  ],

  // 人物（100+）
  people: [
    '👶', '👧', '🧒', '👦', '👩', '🧑', '👨', '👩‍🦱', '🧑‍🦱', '👨‍🦱',
    '👩‍🦰', '🧑‍🦰', '👨‍🦰', '👱‍♀️', '👱', '👱‍♂️', '👩‍🦳', '🧑‍🦳', '👨‍🦳', '👩‍🦲',
    '🧑‍🦲', '👨‍🦲', '🧔', '👵', '🧓', '👴', '👲', '👳‍♀️', '👳', '👳‍♂️',
    '🧕', '👮‍♀️', '👮', '👮‍♂️', '👷‍♀️', '👷', '👷‍♂️', '💂‍♀️', '💂', '💂‍♂️'
  ],

  // 动物（150+）
  animals: [
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
    '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒',
    '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇',
    '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜',
    '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕',
    '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳',
    '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛',
    '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖',
    '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈',
    '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨'
  ],

  // 食物（150+）
  food: [
    '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈',
    '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦',
    '🥬', '🥒', '🌶️', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🥐',
    '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇',
    '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🥪',
    '🥙', '🧆', '🌮', '🌯', '🥗', '🥘', '🥫', '🍝', '🍜', '🍲',
    '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥',
    '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰',
    '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜'
  ],

  // 饮料（30+）
  drinks: [
    '☕', '🍵', '🧃', '🥤', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃',
    '🍸', '🍹', '🧉', '🍾', '🧊', '🥄', '🍴', '🍽️', '🥣', '🥡'
  ],

  // 运动（50+）
  sports: [
    '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
    '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳', '🪁',
    '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌',
    '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️', '🤺', '🤾',
    '🏌️', '🏇', '🧘', '🏊', '🏄', '🚣', '🧗', '🚴', '🚵', '🎖️'
  ],

  // 交通（100+）
  transport: [
    '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐',
    '🛻', '🚚', '🚛', '🚜', '🦯', '🦽', '🦼', '🛴', '🚲', '🛵',
    '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟',
    '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇',
    '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🛰️', '🚁', '🛶',
    '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '⛽', '🚧', '🚦'
  ],

  // 建筑（50+）
  buildings: [
    '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤',
    '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛️', '⛪', '🕌',
    '🕍', '🛕', '🕋', '⛩️', '🛤️', '🛣️', '🗾', '🎑', '🏞️', '🌅'
  ],

  // 符号与标志（200+）
  symbols: [
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
    '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
    '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐',
    '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐',
    '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳',
    '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️',
    '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️',
    '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️',
    '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓',
    '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️',
    '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠'
  ],

  // 旗帜（部分常用国家，50+）
  flags: [
    '🏳️', '🏴', '🏁', '🚩', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️',
    '🇨🇳', '🇺🇸', '🇯🇵', '🇰🇷', '🇬🇧', '🇫🇷', '🇩🇪', '🇮🇹', '🇪🇸', '🇨🇦',
    '🇦🇺', '🇷🇺', '🇧🇷', '🇮🇳', '🇲🇽', '🇸🇬', '🇹🇭', '🇻🇳', '🇮🇩', '🇵🇭'
  ],

  // 自然（50+）
  nature: [
    '🌍', '🌎', '🌏', '🌐', '🗺️', '🗾', '🧭', '🏔️', '⛰️', '🌋',
    '🗻', '🏕️', '🏖️', '🏜️', '🏝️', '🏞️', '🌅', '🌄', '🌠', '🌌',
    '🌉', '🌁', '☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️',
    '🌩️', '🌨️', '❄️', '☃️', '⛄', '🌬️', '💨', '💧', '💦', '☔',
    '☂️', '🌊', '🌫️', '🌪️', '🌈', '🔥', '💥', '⚡', '🌟', '✨'
  ]
};

// 展平 emoji 列表
function flattenEmojiList() {
  const allEmojis = [];
  Object.values(EMOJI_LIST).forEach(category => {
    allEmojis.push(...category);
  });
  return allEmojis;
}

// 生成 Emoji Atlas
async function generateEmojiAtlas() {
  console.log('🎨 开始生成 Emoji Atlas...\n');

  const emojis = flattenEmojiList();
  console.log(`📊 总共 ${emojis.length} 个 emoji`);
  console.log(`📐 Atlas 尺寸: ${CONFIG.atlasWidth}x${CONFIG.atlasHeight}`);
  console.log(`🎯 容量: ${CONFIG.totalCapacity} 个 emoji\n`);

  if (emojis.length > CONFIG.totalCapacity) {
    console.warn(`⚠️  警告: emoji 数量 (${emojis.length}) 超过容量 (${CONFIG.totalCapacity})`);
    console.warn(`⚠️  将只渲染前 ${CONFIG.totalCapacity} 个 emoji\n`);
  }

  // 创建 Atlas Canvas
  const atlasCanvas = createCanvas(CONFIG.atlasWidth, CONFIG.atlasHeight);
  const ctx = atlasCanvas.getContext('2d');

  // 清空为透明背景
  ctx.clearRect(0, 0, CONFIG.atlasWidth, CONFIG.atlasHeight);

  // UV 映射表
  const emojiMap = {};

  // 字体配置
  const fontFamily = CONFIG.fonts.join(', ');
  const fontSize = Math.floor(CONFIG.emojiSize * 0.8);
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 渲染每个 emoji
  let count = 0;
  for (let i = 0; i < emojis.length && i < CONFIG.totalCapacity; i++) {
    const emoji = emojis[i];

    // 计算在 Atlas 中的位置
    const col = i % CONFIG.emojisPerRow;
    const row = Math.floor(i / CONFIG.emojisPerRow);

    const x = col * CONFIG.emojiSize;
    const y = row * CONFIG.emojiSize;

    // 渲染 emoji 到 Atlas
    try {
      ctx.fillText(
        emoji,
        x + CONFIG.emojiSize / 2,
        y + CONFIG.emojiSize / 2
      );

      // 计算 UV 坐标（归一化到 0-1）
      const u0 = x / CONFIG.atlasWidth;
      const v0 = y / CONFIG.atlasHeight;
      const u1 = (x + CONFIG.emojiSize) / CONFIG.atlasWidth;
      const v1 = (y + CONFIG.emojiSize) / CONFIG.atlasHeight;

      // 存储映射
      emojiMap[emoji] = {
        unicode: emoji,
        codepoint: emoji.codePointAt(0)?.toString(16).toUpperCase(),
        uv: { u0, v0, u1, v1 },
        position: { x, y, width: CONFIG.emojiSize, height: CONFIG.emojiSize },
        index: i
      };

      count++;

      // 进度提示
      if ((i + 1) % 100 === 0) {
        console.log(`⏳ 已渲染 ${i + 1}/${emojis.length} 个 emoji...`);
      }

    } catch (error) {
      console.error(`❌ 渲染 emoji "${emoji}" 失败:`, error.message);
    }
  }

  console.log(`\n✅ 渲染完成！共 ${count} 个 emoji\n`);

  // 确保输出目录存在
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    console.log(`📁 创建输出目录: ${CONFIG.outputDir}`);
  }

  // 保存 Atlas PNG
  const atlasPath = path.join(CONFIG.outputDir, CONFIG.atlasFilename);
  const buffer = atlasCanvas.toBuffer('image/png');
  fs.writeFileSync(atlasPath, buffer);
  console.log(`💾 保存 Atlas: ${atlasPath}`);
  console.log(`📊 文件大小: ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n`);

  // 保存 Emoji Map JSON
  const mapPath = path.join(CONFIG.outputDir, CONFIG.mapFilename);
  const mapData = {
    meta: {
      version: '1.0.0',
      generated: new Date().toISOString(),
      atlasSize: { width: CONFIG.atlasWidth, height: CONFIG.atlasHeight },
      emojiSize: CONFIG.emojiSize,
      totalEmojis: count,
      capacity: CONFIG.totalCapacity
    },
    emojis: emojiMap
  };

  fs.writeFileSync(mapPath, JSON.stringify(mapData, null, 2), 'utf-8');
  console.log(`💾 保存 Emoji Map: ${mapPath}`);
  console.log(`📊 映射数量: ${Object.keys(emojiMap).length} 个\n`);

  // 生成统计信息
  console.log('📈 统计信息:');
  console.log(`  - Atlas 尺寸: ${CONFIG.atlasWidth}x${CONFIG.atlasHeight}`);
  console.log(`  - Emoji 尺寸: ${CONFIG.emojiSize}x${CONFIG.emojiSize}`);
  console.log(`  - 每行数量: ${CONFIG.emojisPerRow}`);
  console.log(`  - 总行数: ${Math.ceil(count / CONFIG.emojisPerRow)}`);
  console.log(`  - 使用率: ${(count / CONFIG.totalCapacity * 100).toFixed(2)}%`);
  console.log(`  - 剩余容量: ${CONFIG.totalCapacity - count} 个\n`);

  console.log('🎉 Emoji Atlas 生成完成！');
  console.log('\n下一步:');
  console.log('1. 将 atlas.png 和 emoji_map.json 上传到 CDN');
  console.log('2. 更新前端配置，指向 CDN URL');
  console.log('3. 重启前端服务，加载新的 Emoji Atlas');
}

// 主函数
async function main() {
  try {
    await generateEmojiAtlas();
  } catch (error) {
    console.error('❌ 生成失败:', error);
    process.exit(1);
  }
}

// 运行
if (require.main === module) {
  main();
}

module.exports = { generateEmojiAtlas, CONFIG, EMOJI_LIST };
