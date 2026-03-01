/**
 * 生成Emoji PNG图片
 * 将每个emoji转换为高质量PNG图片，用于complex类型渲染
 */

const fs = require('fs');
const path = require('path');

// Emoji列表（从pattern_assets中提取）
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
 * 方案1：使用浏览器环境生成（推荐）
 * 生成HTML页面，在浏览器中渲染emoji并导出PNG
 */
function generateBrowserScript() {
  const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Emoji PNG Generator</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            padding: 20px;
            background: #f0f0f0;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            margin-bottom: 20px;
        }
        .emoji-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        .emoji-item {
            text-align: center;
            padding: 15px;
            border: 2px solid #ddd;
            border-radius: 8px;
            background: #fafafa;
        }
        .emoji-preview {
            font-size: 64px;
            margin: 10px 0;
        }
        .emoji-name {
            font-size: 12px;
            color: #666;
            margin: 5px 0;
        }
        .emoji-key {
            font-size: 11px;
            color: #999;
            font-family: monospace;
        }
        button {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin: 5px;
        }
        button:hover {
            background: #45a049;
        }
        button.download {
            background: #2196F3;
        }
        button.download:hover {
            background: #0b7dda;
        }
        .status {
            margin: 15px 0;
            padding: 10px;
            background: #e7f3ff;
            border-left: 4px solid #2196F3;
            border-radius: 4px;
        }
        canvas {
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎨 Emoji PNG 生成器</h1>
        <p>将emoji转换为高质量PNG图片（128x128），用于complex类型渲染</p>

        <div>
            <button onclick="generateAll()">🚀 批量生成所有Emoji PNG</button>
            <button onclick="downloadAll()" class="download">📦 下载所有PNG (ZIP)</button>
        </div>

        <div class="status" id="status">
            准备就绪，点击"批量生成"开始...
        </div>

        <div class="emoji-grid" id="emojiGrid"></div>
        <canvas id="canvas" width="128" height="128"></canvas>
    </div>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js"></script>

    <script>
        const EMOJIS = ${JSON.stringify(EMOJIS, null, 2)};

        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        const generatedImages = new Map();

        // 初始化显示
        function init() {
            const grid = document.getElementById('emojiGrid');
            EMOJIS.forEach(emoji => {
                const item = document.createElement('div');
                item.className = 'emoji-item';
                item.id = \`item-\${emoji.key}\`;
                item.innerHTML = \`
                    <div class="emoji-preview">\${emoji.unicode}</div>
                    <div class="emoji-name">\${emoji.name}</div>
                    <div class="emoji-key">\${emoji.key}</div>
                    <button onclick="generateSingle('\${emoji.key}')">生成PNG</button>
                    <button class="download" onclick="downloadSingle('\${emoji.key}')" style="display:none" id="btn-\${emoji.key}">下载</button>
                \`;
                grid.appendChild(item);
            });
        }

        // 生成单个emoji PNG
        function generateSingle(key) {
            const emoji = EMOJIS.find(e => e.key === key);
            if (!emoji) return;

            // 清空canvas
            ctx.clearRect(0, 0, 128, 128);

            // 设置高质量渲染
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // 绘制emoji（居中）
            ctx.font = '100px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(emoji.unicode, 64, 64);

            // 转换为PNG DataURL
            const dataUrl = canvas.toDataURL('image/png');
            generatedImages.set(key, dataUrl);

            // 显示下载按钮
            document.getElementById(\`btn-\${key}\`).style.display = 'inline-block';

            updateStatus(\`✅ 生成成功: \${emoji.name} (\${key})\`);
        }

        // 下载单个PNG
        function downloadSingle(key) {
            const dataUrl = generatedImages.get(key);
            if (!dataUrl) {
                alert('请先生成该emoji的PNG');
                return;
            }

            const link = document.createElement('a');
            link.download = \`\${key}.png\`;
            link.href = dataUrl;
            link.click();
        }

        // 批量生成所有emoji
        async function generateAll() {
            updateStatus('🔄 开始批量生成...');

            for (let i = 0; i < EMOJIS.length; i++) {
                const emoji = EMOJIS[i];
                generateSingle(emoji.key);
                await new Promise(resolve => setTimeout(resolve, 100)); // 短暂延迟
            }

            updateStatus(\`✅ 批量生成完成！共 \${EMOJIS.length} 个emoji\`);
        }

        // 下载所有PNG为ZIP
        async function downloadAll() {
            if (generatedImages.size === 0) {
                alert('请先生成emoji PNG');
                return;
            }

            updateStatus('📦 正在打包ZIP...');

            const zip = new JSZip();

            // 添加所有图片到ZIP
            for (const [key, dataUrl] of generatedImages.entries()) {
                // 将DataURL转换为Blob
                const base64 = dataUrl.split(',')[1];
                const blob = await fetch(\`data:image/png;base64,\${base64}\`).then(r => r.blob());
                zip.file(\`\${key}.png\`, blob);
            }

            // 生成ZIP文件
            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, 'emoji-pngs.zip');

            updateStatus(\`✅ ZIP打包完成！共 \${generatedImages.size} 个文件\`);
        }

        function updateStatus(message) {
            document.getElementById('status').innerHTML = message;
        }

        // 页面加载完成后初始化
        init();
    </script>
</body>
</html>`;

  const htmlPath = path.join(__dirname, '../public/emoji-png-generator.html');
  fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
  console.log(`✅ 生成浏览器版本脚本: ${htmlPath}`);
  console.log(`\n📌 使用方法：`);
  console.log(`1. 在浏览器中打开: http://localhost:3002/emoji-png-generator.html`);
  console.log(`2. 点击"批量生成所有Emoji PNG"`);
  console.log(`3. 点击"下载所有PNG (ZIP)"`);
  console.log(`4. 解压ZIP，将PNG文件移动到 public/patterns/ 目录\n`);
}

/**
 * 生成数据库更新SQL
 */
function generateUpdateSQL() {
  const sqlStatements = EMOJIS.map(emoji => {
    return `-- 更新 ${emoji.name} (${emoji.key})
UPDATE pattern_assets
SET
  render_type = 'complex',
  encoding = 'image_url',
  image_url = '/patterns/${emoji.key}.png',
  unicode_char = '${emoji.unicode}'
WHERE key = '${emoji.key}';`;
  }).join('\n\n');

  const sqlContent = `-- ================================================
-- Emoji转Complex图片方案 - 数据库更新脚本
-- ================================================
-- 说明：将所有emoji的render_type改为complex，使用PNG图片渲染
-- 执行前提：已将所有emoji PNG文件上传到 public/patterns/ 目录
-- ================================================

${sqlStatements}

-- ================================================
-- 验证更新
-- ================================================
SELECT key, render_type, encoding, image_url, unicode_char
FROM pattern_assets
WHERE key LIKE 'emoji_%'
ORDER BY key;
`;

  const sqlPath = path.join(__dirname, 'update-emoji-to-complex.sql');
  fs.writeFileSync(sqlPath, sqlContent, 'utf-8');
  console.log(`✅ 生成SQL更新脚本: ${sqlPath}\n`);
}

/**
 * 生成Node.js更新脚本
 */
function generateNodeUpdateScript() {
  const scriptContent = `/**
 * 更新Emoji为Complex类型
 * 执行前提：已将所有emoji PNG文件上传到 public/patterns/ 目录
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
  console.log(`✅ 生成Node.js更新脚本: ${scriptPath}\n`);
}

// 主函数
function main() {
  console.log('🎨 Emoji转Complex图片方案 - 脚本生成器\n');
  console.log('=' .repeat(60));

  generateBrowserScript();
  generateUpdateSQL();
  generateNodeUpdateScript();

  console.log('=' .repeat(60));
  console.log('\n✅ 所有脚本生成完成！');
  console.log('\n📋 下一步操作：');
  console.log('1. 启动开发服务器');
  console.log('2. 在浏览器中打开 http://localhost:3002/emoji-png-generator.html');
  console.log('3. 批量生成并下载所有emoji PNG');
  console.log('4. 将PNG文件解压到 public/patterns/ 目录');
  console.log('5. 执行数据库更新: node scripts/update-emoji-to-complex.js');
  console.log('6. 重启服务器，测试emoji彩色渲染\n');
}

main();
