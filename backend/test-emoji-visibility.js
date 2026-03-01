/**
 * 测试 a1 联盟 emoji 像素在不同 zoom 级别的可见性
 */

const { db } = require('./src/config/database');

async function testEmojiVisibility() {
  try {
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║         a1 联盟 Emoji 像素可见性测试                 ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    // 检查 a1 联盟的像素数据
    const a1Pixels = await db('pixels p')
      .leftJoin('pattern_assets pa', 'p.pattern_id', 'pa.key')
      .leftJoin('alliance_members am', 'p.user_id', 'am.user_id')
      .leftJoin('alliances a', 'am.alliance_id', 'a.id')
      .where('a.name', 'a1')
      .select(
        'p.id',
        'p.grid_id',
        'p.pixel_type',
        'pa.render_type',
        'pa.unicode_char',
        'p.lat_quantized',
        'p.lng_quantized'
      )
      .limit(5);

    console.log('📊 a1 联盟像素示例:');
    console.log(JSON.stringify(a1Pixels, null, 2));

    // 广州塔区域
    const centerLat = 23.109702;
    const centerLng = 113.324520;

    // 测试不同 zoom 级别的瓦片数据
    const zoomLevels = [14, 15, 16, 17, 18];

    for (const z of zoomLevels) {
      const n = Math.pow(2, z);
      const x = Math.floor((centerLng + 180) / 360 * n);
      const y = Math.floor((1 - Math.log(Math.tan(centerLat * Math.PI / 180) + 1 / Math.cos(centerLat * Math.PI / 180)) / Math.PI) / 2 * n);

      // 检查 a1 联盟的 emoji 像素是否在这个瓦片中
      const emojiInTile = await db('pixels p')
        .leftJoin('pattern_assets pa', 'p.pattern_id', 'pa.key')
        .leftJoin('alliance_members am', 'p.user_id', 'am.user_id')
        .leftJoin('alliances a', 'am.alliance_id', 'a.id')
        .where('a.name', 'a1')
        .whereRaw('ST_Intersects(p.geom_quantized, ST_Transform(ST_TileEnvelope(?, ?, ?), 4326))', [z, x, y])
        .where(function() {
          this.where('p.pixel_type', 'emoji')
            .orWhere('pa.render_type', 'emoji');
        })
        .select('p.id', 'p.grid_id', 'pa.unicode_char');

      // 检查后端采样配置
      let samplingRate = 1.0;
      if (z >= 12 && z <= 18) {
        samplingRate = 1.0; // 100%
      } else {
        samplingRate = 0.01; // 1%
      }

      console.log(\n📍 Zoom \${z}: 瓦片 (\${x}, \${y})\`);
      console.log(\"   采样率: \${(samplingRate * 100).toFixed(0)}% (预期显示 \${samplingRate === 1.0 ? '全部' : '1%'} 像素)\");
      console.log(\`   a1 emoji 像素数量: \${emojiInTile.length}\`);

      if (emojiInTile.length > 0) {
        console.log(\'   emoji 列表: \${emojiInTile.map(e => e.unicode_char).join(', ')}\');
      }
    }

    console.log(\\"\n╔══════════════════════════════════════════════════════╗\");
    console.log(\'║                    分析结论                          ║\');
    console.log(\'╚══════════════════════════════════════════════════════╝\n\');

    console.log(\'🔍 iOS App emoji 在 zoom 16+ 消失的可能原因:\n\');
    console.log(\'1. MVT 瓦片 maxZoom 配置问题\');
    console.log(\'   - 后端: maxZoom = 18 (采样范围 12-18)\');
    console.log(\'   - iOS 地图: maximumZoomLevel = 17.75\');
    console.log(\'   - iOS MVT source: maximumZoomLevel = 18\');
    console.log(\'   ✅ 配置看起来正常\n\');

    console.log(\'2. Emoji 图标未正确注册\');
    console.log(\'   - 检查日志中是否有 \"✅ Registered X alliance emoji icons from API\"\');
    console.log(\'   - 或是否有 \"❌ Failed to load alliance emoji patterns\"\n\');

    console.log(\'3. Emoji 图像尺寸问题\');
    console.log(\'   - Zoom 17: iconScale = 1.0 (64px)\');
    console.log(\'   - Zoom 18: iconScale = 1.5 (96px)\');
    console.log(\'   - 可能超过 MapLibre 的纹理大小限制\n\');

    console.log(\'4. 图层渲染顺序问题\');
    console.log(\'   - Emoji 图层可能被其他图层遮挡\');
    console.log(\'   - 检查 insertBelow 设置是否正确\n\');

    console.log(\'5. MVT 瓦片数据问题\');
    console.log(\'   - 后端 zoom 16+ 的 emoji 像素可能未正确分类\');
    console.log(\'   - 检查 pixel_type 和 render_type 字段\n\');

    console.log(\'📋 建议的排查步骤:\n\');
    console.log(\'1. 在 iOS App 日志中查找 MVT 瓦片请求日志\');
    console.log(\'2. 使用 Safari 开发者工具检查网络请求\');
    console.log(\'3. 检查 emoji 图标是否成功注册\');
    console.log(\'4. 尝试降低 zoom 17/18 的 iconScale 值\');

    process.exit(0);
  } catch (error) {
    console.error('\\n❌ 测试失败:', error);
    process.exit(1);
  }
}

testEmojiVisibility();
