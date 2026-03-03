/**
 * 测试MVT瓦片的属性内容
 * 验证color和emoji字段是否正确编码在MVT数据中
 */

const { getMVTTile } = require('./src/models/productionPixelTileQuery');
const vtpbf = require('vt-pbf');
const Protobuf = require('pbf');

async function testMVTProperties() {
  // 测试多个缩放级别和位置
  const testCases = [
    { z: 12, x: 1724, y: 1586, desc: '北京区域 zoom 12' },
    { z: 14, x: 6896, y: 6344, desc: '北京区域 zoom 14' },
    { z: 16, x: 27586, y: 25377, desc: '北京区域 zoom 16' },
    { z: 17, x: 55173, y: 50754, desc: '北京区域 zoom 17' },
    { z: 18, x: 110346, y: 101508, desc: '北京区域 zoom 18' }
  ];

  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`测试: ${testCase.desc}`);
    console.log(`瓦片坐标: z=${testCase.z}, x=${testCase.x}, y=${testCase.y}`);
    console.log('='.repeat(60));

    try {
      const mvtBuffer = await getMVTTile(testCase.z, testCase.x, testCase.y);

      if (!mvtBuffer || mvtBuffer.length === 0) {
        console.log('❌ 瓦片为空或不存在');
        continue;
      }

      console.log(`✅ MVT数据大小: ${mvtBuffer.length} bytes`);

      // 解析MVT
      const pbf = new Protobuf(mvtBuffer);
      const tile = vtpbf.read(pbf);

      // 检查每个图层
      const layerNames = Object.keys(tile.layers || {});
      console.log(`\n📊 图层列表: ${layerNames.join(', ')}`);

      for (const layerName of layerNames) {
        const layer = tile.layers[layerName];
        const featureCount = layer.length || 0;

        console.log(`\n🔍 图层 "${layerName}":`);
        console.log(`  - Features数量: ${featureCount}`);

        if (featureCount > 0) {
          // 检查第一个feature的属性
          const firstFeature = layer.feature(0);
          const props = firstFeature.properties || {};
          const propNames = Object.keys(props);

          console.log(`  - 属性字段: ${propNames.join(', ')}`);

          // 特别检查关键字段
          if (layerName === 'pixels-color') {
            if ('color' in props) {
              console.log(`  ✅ color字段存在: ${props.color}`);
            } else {
              console.log(`  ❌ color字段缺失！`);
            }
          }

          if (layerName === 'pixels-emoji') {
            if ('emoji' in props) {
              console.log(`  ✅ emoji字段存在: ${props.emoji}`);
            } else {
              console.log(`  ❌ emoji字段缺失！`);
            }
          }

          // 显示前3个feature的完整属性
          console.log(`\n  前3个features的完整属性:`);
          for (let i = 0; i < Math.min(3, featureCount); i++) {
            const feature = layer.feature(i);
            console.log(`    [${i}] ${JSON.stringify(feature.properties, null, 2).split('\n').join('\n      ')}`);
          }
        }
      }
    } catch (error) {
      console.error(`❌ 测试失败: ${error.message}`);
      console.error(error.stack);
    }
  }

  process.exit(0);
}

testMVTProperties().catch(console.error);
