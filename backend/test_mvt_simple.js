const axios = require('axios');

// 测试坐标：新大新
const lat = 23.13645;
const lng = 113.29395;
const zoom = 17;

// 计算瓦片坐标
const n = Math.pow(2, zoom);
const x = Math.floor((lng + 180) / 360 * n);
const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);

console.log('='.repeat(80));
console.log('测试 MVT 瓦片是否包含数据');
console.log('='.repeat(80));
console.log(`坐标: (${lat}, ${lng})`);
console.log(`瓦片: zoom=${zoom}, x=${x}, y=${y}`);
console.log();

const url = `http://localhost:3001/api/tiles/pixels/${zoom}/${x}/${y}.pbf`;
console.log(`URL: ${url}`);
console.log();

async function testMVTTile() {
    try {
        // 下载瓦片
        console.log('📥 下载瓦片...');
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 10000
        });

        const data = Buffer.from(response.data);
        console.log(`✅ 瓦片大小: ${data.length} bytes`);

        if (data.length === 0) {
            console.log('❌ 瓦片为空！');
            return;
        }

        if (data.length < 100) {
            console.log('⚠️  瓦片太小，可能没有数据');
            console.log('瓦片内容:', data.toString('utf8'));
            return;
        }

        // 检查是否包含 "pixels-complex" 字符串
        const tileStr = data.toString('utf8', 0, Math.min(5000, data.length));
        const hasComplexLayer = tileStr.includes('pixels-complex');
        const hasColorLayer = tileStr.includes('pixels-color');
        const hasEmojiLayer = tileStr.includes('pixels-emoji');

        console.log();
        console.log('🔍 层检测 (字符串搜索):');
        console.log(`  pixels-color: ${hasColorLayer ? '✅ 存在' : '❌ 不存在'}`);
        console.log(`  pixels-emoji: ${hasEmojiLayer ? '✅ 存在' : '❌ 不存在'}`);
        console.log(`  pixels-complex: ${hasComplexLayer ? '✅ 存在' : '❌ 不存在'}`);

        // 搜索 user_avatar 和 image_url
        const hasUserAvatar = tileStr.includes('user_avatar');
        const hasImageUrl = tileStr.includes('image_url');

        console.log();
        console.log('🔍 字段检测:');
        console.log(`  user_avatar: ${hasUserAvatar ? '✅ 存在' : '❌ 不存在'}`);
        console.log(`  image_url: ${hasImageUrl ? '✅ 存在' : '❌ 不存在'}`);

        if (hasUserAvatar) {
            // 尝试找到 user_avatar 出现的位置
            const matches = tileStr.match(/user_avatar_[a-f0-9-]+/g);
            if (matches) {
                console.log();
                console.log('📋 找到的 user_avatar pattern_ids:');
                const unique = [...new Set(matches)];
                unique.forEach((match, i) => {
                    console.log(`  [${i + 1}] ${match}`);
                });
            }
        }

        console.log();
        console.log('='.repeat(80));
        console.log('结论:');
        if (hasComplexLayer && hasUserAvatar && hasImageUrl) {
            console.log('✅ MVT 瓦片包含 complex 层和用户头像数据');
            console.log('   问题可能在 iOS 端解析 MVT 数据');
        } else if (hasComplexLayer && !hasUserAvatar) {
            console.log('⚠️  MVT 瓦片包含 complex 层，但没有用户头像数据');
            console.log('   问题可能在后端 MVT 查询逻辑或采样率');
        } else if (!hasComplexLayer) {
            console.log('❌ MVT 瓦片不包含 complex 层');
            console.log('   问题在后端 MVT 生成');
        }
        console.log('='.repeat(80));

    } catch (error) {
        console.error('❌ 错误:', error.message);
        if (error.response) {
            console.error('   状态码:', error.response.status);
        }
    }
}

testMVTTile();
