const axios = require('axios');
const fs = require('fs');
const zlib = require('zlib');
const Pbf = require('pbf');
const { VectorTile } = require('@mapbox/vector-tile');

// 测试坐标：新大新
const lat = 23.13645;
const lng = 113.29395;
const zoom = 17;

// 计算瓦片坐标
const n = Math.pow(2, zoom);
const x = Math.floor((lng + 180) / 360 * n);
const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);

console.log('='.repeat(80));
console.log('测试 MVT 瓦片 Complex 层');
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
        console.log();

        if (data.length === 0) {
            console.log('❌ 瓦片为空！');
            return;
        }

        // 解析 MVT
        console.log('🔍 解析 MVT 瓦片...');
        const tile = new VectorTile(new Pbf(data));

        console.log('📊 瓦片包含的层:');
        const layerNames = Object.keys(tile.layers);
        layerNames.forEach(name => {
            const layer = tile.layers[name];
            console.log(`  - ${name}: ${layer.length} features`);
        });
        console.log();

        // 检查 pixels-complex 层
        if (!tile.layers['pixels-complex']) {
            console.log('❌ pixels-complex 层不存在！');
            console.log('   可用的层:', layerNames.join(', '));
            return;
        }

        const complexLayer = tile.layers['pixels-complex'];
        console.log(`✅ pixels-complex 层存在，包含 ${complexLayer.length} 个 features`);
        console.log();

        if (complexLayer.length === 0) {
            console.log('⚠️  complex 层为空，没有任何 features');
            return;
        }

        // 分析前 10 个 features
        console.log('📋 Features 详情 (前 10 个):');
        const limit = Math.min(10, complexLayer.length);

        for (let i = 0; i < limit; i++) {
            const feature = complexLayer.feature(i);
            const props = feature.properties;

            console.log(`\n  [${i + 1}/${complexLayer.length}]`);
            console.log(`    grid_id: ${props.grid_id || 'null'}`);
            console.log(`    pattern_id: ${props.pattern_id || 'null'}`);
            console.log(`    image_url: ${props.image_url || 'null'}`);
            console.log(`    pixel_type: ${props.pixel_type || 'null'}`);

            // 检查是否是用户头像
            if (props.pattern_id && props.pattern_id.startsWith('user_avatar_')) {
                console.log(`    ⭐ 这是用户头像像素！`);
            }
        }

        console.log();
        console.log('='.repeat(80));
        console.log('统计汇总:');
        console.log(`  总 complex features: ${complexLayer.length}`);

        // 统计用户头像数量
        let avatarCount = 0;
        let allianceComplexCount = 0;
        let otherComplexCount = 0;

        for (let i = 0; i < complexLayer.length; i++) {
            const feature = complexLayer.feature(i);
            const props = feature.properties;

            if (props.pattern_id && props.pattern_id.startsWith('user_avatar_')) {
                avatarCount++;
            } else if (props.alliance_name) {
                allianceComplexCount++;
            } else {
                otherComplexCount++;
            }
        }

        console.log(`  - 用户头像: ${avatarCount}`);
        console.log(`  - 联盟旗帜: ${allianceComplexCount}`);
        console.log(`  - 其他: ${otherComplexCount}`);
        console.log('='.repeat(80));

    } catch (error) {
        console.error('❌ 错误:', error.message);
        if (error.response) {
            console.error('   状态码:', error.response.status);
            console.error('   响应:', error.response.data);
        }
    }
}

testMVTTile();
