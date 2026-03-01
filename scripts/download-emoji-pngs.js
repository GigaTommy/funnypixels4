/**
 * 从Twemoji CDN下载emoji PNG图片
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Emoji到Twemoji代码点的映射
const EMOJIS = [
  { key: 'emoji_crown', unicode: '👑', codepoint: '1f451', name: '皇冠' },
  { key: 'emoji_star', unicode: '⭐', codepoint: '2b50', name: '星星' },
  { key: 'emoji_heart', unicode: '❤️', codepoint: '2764-fe0f', name: '爱心' },
  { key: 'emoji_fire', unicode: '🔥', codepoint: '1f525', name: '火焰' },
  { key: 'emoji_water', unicode: '💧', codepoint: '1f4a7', name: '水滴' },
  { key: 'emoji_leaf', unicode: '🍃', codepoint: '1f343', name: '叶子' },
  { key: 'emoji_sun', unicode: '☀️', codepoint: '2600-fe0f', name: '太阳' },
  { key: 'emoji_moon', unicode: '🌙', codepoint: '1f319', name: '月亮' },
  { key: 'emoji_cloud', unicode: '☁️', codepoint: '2601-fe0f', name: '云' },
  { key: 'emoji_rainbow', unicode: '🌈', codepoint: '1f308', name: '彩虹' },
  { key: 'emoji_thunder', unicode: '⚡', codepoint: '26a1', name: '闪电' },
  { key: 'emoji_snow', unicode: '❄️', codepoint: '2744-fe0f', name: '雪花' },
  { key: 'emoji_rain', unicode: '☔', codepoint: '2614-fe0f', name: '雨伞' },
  { key: 'emoji_anchor', unicode: '⚓', codepoint: '2693', name: '锚' },
  { key: 'emoji_compass', unicode: '🧭', codepoint: '1f9ed', name: '指南针' },
  { key: 'emoji_earth', unicode: '🌍', codepoint: '1f30d', name: '地球' }
];

// 输出目录
const OUTPUT_DIR = path.join(__dirname, '../public/patterns');

// 创建输出目录
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`✅ 创建输出目录: ${OUTPUT_DIR}`);
}

/**
 * 下载文件
 */
function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      const data = [];
      response.on('data', (chunk) => {
        data.push(chunk);
      });

      response.on('end', () => {
        const buffer = Buffer.concat(data);
        fs.writeFileSync(filePath, buffer);
        console.log(`✅ 下载完成: ${path.basename(filePath)}`);
        resolve(filePath);
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * 下载单个emoji PNG
 */
async function downloadEmoji(emoji) {
  // Twemoji 72x72 PNG URL
  const url = `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${emoji.codepoint}.png`;
  const filePath = path.join(OUTPUT_DIR, `${emoji.key}.png`);

  try {
    await downloadFile(url, filePath);
    return true;
  } catch (error) {
    console.error(`❌ 下载失败 ${emoji.name} (${emoji.key}): ${error.message}`);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🎨 从Twemoji CDN下载emoji PNG图片\n');
  console.log('=' .repeat(60));

  let successCount = 0;
  let failCount = 0;

  for (const emoji of EMOJIS) {
    console.log(`\n📥 下载: ${emoji.name} (${emoji.unicode})`);
    console.log(`   URL: https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${emoji.codepoint}.png`);

    const success = await downloadEmoji(emoji);
    if (success) {
      successCount++;
    } else {
      failCount++;

      // 如果下载失败，创建一个占位符文件
      console.log(`⚠️ 创建占位符文件...`);
      const filePath = path.join(OUTPUT_DIR, `${emoji.key}.png`);
      const placeholderContent = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
      fs.writeFileSync(filePath, placeholderContent);
    }
  }

  console.log('\n' + '=' .repeat(60));
  console.log(`✅ 下载完成！成功: ${successCount}, 失败: ${failCount}`);
  console.log(`📁 输出目录: ${OUTPUT_DIR}`);

  console.log('\n📋 下一步操作：');
  console.log('1. 检查下载的图片是否正确');
  console.log('2. 运行数据库更新脚本: node scripts/update-emoji-to-complex.js');
  console.log('3. 重启服务器，测试emoji彩色渲染\n');

  // 生成数据库更新脚本
  generateUpdateScript();
}

/**
 * 生成数据库更新脚本
 */
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

// 运行主函数
main().catch(error => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});