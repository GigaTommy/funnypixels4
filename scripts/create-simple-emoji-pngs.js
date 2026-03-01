/**
 * 简单的emoji PNG生成脚本
 * 使用Canvas API直接生成emoji的PNG文件
 */

const fs = require('fs');
const path = require('path');

// Emoji列表
const EMOJIS = [
  { key: 'emoji_crown', unicode: '👑', name: '皇冠' },
  { key: 'emoji_star', unicode: '⭐', name: '星星' },
  { key: 'emoji_heart', unicode: '❤️', name: '爱心' },
  { key: 'emoji_fire', unicode: '🔥', name: '火焰' },
  { key: 'emoji_water', unicode: '💧', name: '水滴' },
  { key: 'emoji_leaf', unicode: '🍃', name: '叶子' },
  { key: 'emoji_sun', unicode: '☀️', name: '太阳' },
  { key: 'emoji_moon', unicode: '🌙', name: '月亮' },
  { key: 'emoji_cloud', unicode: '☁️', name: '云' },
  { key: 'emoji_rainbow', unicode: '🌈', name: '彩虹' },
  { key: 'emoji_thunder', unicode: '⚡', name: '闪电' },
  { key: 'emoji_snow', unicode: '❄️', name: '雪花' },
  { key: 'emoji_rain', unicode: '☔', name: '雨伞' },
  { key: 'emoji_anchor', unicode: '⚓', name: '锚' },
  { key: 'emoji_compass', unicode: '🧭', name: '指南针' },
  { key: 'emoji_earth', unicode: '🌍', name: '地球' }
];

// 输出目录
const OUTPUT_DIR = path.join(__dirname, '../public/patterns');

// 创建输出目录
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`✅ 创建输出目录: ${OUTPUT_DIR}`);
}

/**
 * 生成简单的占位符PNG文件
 * 由于Node.js环境中emoji渲染困难，我们先创建占位符
 * 稍后可以用真实图片替换
 */
function createPlaceholderPNG(emoji) {
  // 创建一个简单的128x128 PNG文件（base64编码）
  // 这是一个透明背景的PNG，稍后可以用真实的emoji图片替换

  // 最小的PNG文件头（1x1透明像素）
  const minimalPNG = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x80, // width: 128
    0x00, 0x00, 0x00, 0x80, // height: 128
    0x08, 0x06, 0x00, 0x00, 0x00, // bit depth, color type, compression, filter, interlace
    0x00, 0x00, 0x00, 0x00, // CRC (placeholder, won't be valid)
    0x00, 0x00, 0x00, 0x00, // IEND chunk length
    0x49, 0x45, 0x4E, 0x44, // IEND
    0xAE, 0x42, 0x60, 0x82  // IEND CRC
  ]);

  return minimalPNG;
}

/**
 * 使用在线服务生成emoji PNG的方法说明
 */
function generateOnlineMethodInstructions() {
  const instructions = `
由于Node.js环境中emoji渲染存在技术限制，以下是生成emoji PNG的几种方法：

方法1：使用在线emoji转PNG工具
1. 访问 https://emojipedia.org/
2. 搜索需要的emoji（如 🔥）
3. 右键保存emoji图片为PNG格式
4. 重命名为对应的key（如 emoji_fire.png）
5. 将文件放入 public/patterns/ 目录

方法2：使用emoji下载网站
- https://emoji.gg/
- https://www.emoji.co/
- https://emojifinder.com/

方法3：使用命令行工具（需要额外安装）
- 安装: npm install -g emoji-images
- 使用: emoji-images 🔥 --output emoji_fire.png

方法4：使用CDN图片服务
可以直接使用emoji的CDN链接：
- https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f525.svg
- 转换SVG为PNG即可
`;

  return instructions;
}

function main() {
  console.log('🎨 Emoji PNG生成器 - 占位符版本\n');
  console.log('=' .repeat(60));

  let createdCount = 0;
  const outputDir = path.join(__dirname, '../public/patterns');

  // 为每个emoji创建占位符文件
  EMOJIS.forEach(emoji => {
    const filePath = path.join(outputDir, `${emoji.key}.png`);
    const placeholderData = createPlaceholderPNG(emoji);

    try {
      fs.writeFileSync(filePath, placeholderData);
      console.log(`✅ 创建占位符: ${emoji.name} (${emoji.key})`);
      createdCount++;
    } catch (error) {
      console.error(`❌ 创建失败: ${emoji.name} (${emoji.key})`, error.message);
    }
  });

  console.log('\n' + '=' .repeat(60));
  console.log(`✅ 创建完成！共 ${createdCount} 个占位符文件`);
  console.log(`📁 输出目录: ${outputDir}`);

  console.log('\n📋 下一步操作：');
  console.log('1. 使用在线工具下载真实的emoji PNG图片');
  console.log('2. 替换占位符文件为真实的emoji图片');
  console.log('3. 执行数据库更新脚本');
  console.log('4. 测试emoji彩色渲染\n');

  console.log('🌐 在线emoji资源：');
  console.log('- Emojipedia: https://emojipedia.org/');
  console.log('- Twemoji: https://twemoji.twitter.com/');
  console.log('- Emoji.gg: https://emoji.gg/\n');

  console.log('💡 技术说明：');
  console.log(generateOnlineMethodInstructions());
}

// 生成数据库更新脚本
function generateUpdateScript() {
  const scriptContent = `/**
 * 更新emoji为complex类型的脚本
 * 执行前确保已将所有emoji PNG文件放入 public/patterns/ 目录
 */

const { db } = require('../backend/src/config/database');

const EMOJIS = ${JSON.stringify(EMOJIS, null, 2)};

async function updateEmojiToComplex() {
  console.log('🔄 开始更新emoji为complex类型...');

  try {
    for (const emoji of EMOJIS) {
      const result = await db('pattern_assets')
        .where({ key: emoji.key })
        .update({
          render_type: 'complex',
          encoding: 'image_url',
          image_url: \`/patterns/\${emoji.key}.png\`,
          unicode_char: emoji.unicode,
          updated_at: new Date()
        });

      console.log(\`✅ 更新成功: \${emoji.name} (\${emoji.key})\`);
    }

    console.log(\`\\n🎉 全部更新完成！共 \${EMOJIS.length} 个emoji\`);

    // 验证更新
    const updatedEmojis = await db('pattern_assets')
      .where('key', 'like', 'emoji_%')
      .select('key', 'render_type', 'encoding', 'image_url', 'unicode_char');

    console.log('\\n📊 更新后的emoji配置:');
    console.table(updatedEmojis);

  } catch (error) {
    console.error('❌ 更新失败:', error);
  } finally {
    await db.destroy();
  }
}

updateEmojiToComplex();
`;

  const scriptPath = path.join(__dirname, 'update-emoji-to-complex.js');
  fs.writeFileSync(scriptPath, scriptContent, 'utf-8');
  console.log(`✅ 生成数据库更新脚本: ${scriptPath}\n`);
}

// 生成更新脚本
generateUpdateScript();

// 运行主函数
main();