const fs = require('fs');
const path = require('path');

console.log('🔥 Emoji Atlas 文件验证工具');
console.log('================================');

const emojiDir = path.join(__dirname, '..', 'assets', 'emoji');
const atlasPath = path.join(emojiDir, 'atlas.png');
const mapPath = path.join(emojiDir, 'emoji_map.json');

console.log(`📂 检查目录: ${emojiDir}`);
console.log('');

// 检查目录是否存在
if (!fs.existsSync(emojiDir)) {
    console.log('❌ Emoji目录不存在!');
    console.log(`   路径: ${emojiDir}`);
    process.exit(1);
}

console.log('✅ Emoji目录存在');

// 检查atlas.png
if (fs.existsSync(atlasPath)) {
    const stats = fs.statSync(atlasPath);
    const sizeKB = (stats.size / 1024).toFixed(1);
    console.log(`✅ atlas.png 存在 (${sizeKB}KB)`);
} else {
    console.log('❌ atlas.png 不存在!');
    console.log(`   路径: ${atlasPath}`);
}

// 检查emoji_map.json
if (fs.existsSync(mapPath)) {
    const stats = fs.statSync(mapPath);
    const sizeKB = (stats.size / 1024).toFixed(1);
    console.log(`✅ emoji_map.json 存在 (${sizeKB}KB)`);

    // 读取并解析JSON
    try {
        const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
        console.log(`✅ JSON解析成功`);
        console.log(`📊 总emoji数量: ${mapData.meta.totalEmojis}`);

        // 检查🔥
        if (mapData.emojis && mapData.emojis['🔥']) {
            const fireData = mapData.emojis['🔥'];
            console.log(`✅ 🔥 找到: key=${fireData.key}`);
            console.log(`📍 UV坐标: (${fireData.uv.u0}, ${fireData.uv.v0}, ${fireData.uv.u1}, ${fireData.uv.v1})`);
            console.log(`🗺️  位置: x=${fireData.position.x}, y=${fireData.position.y}`);
        } else {
            console.log('❌ 🔥 未在emoji_map.json中找到!');
        }

        // 显示前几个emoji
        const emojiKeys = Object.keys(mapData.emojis).slice(0, 10);
        console.log(`📋 前10个emoji: ${emojiKeys.join(' ')}`);

    } catch (error) {
        console.log(`❌ JSON解析失败: ${error.message}`);
    }
} else {
    console.log('❌ emoji_map.json 不存在!');
    console.log(`   路径: ${mapPath}`);
}

console.log('');
console.log('================================');
console.log('🎯 总结:');
console.log('- 如果所有文件都存在，说明Atlas文件没有问题');
console.log('- 问题可能在于前端代码没有重新编译或浏览器缓存');
console.log('- 请检查浏览器控制台的emoji相关调试日志');
console.log('');