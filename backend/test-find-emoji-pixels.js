/**
 * 查找所有emoji类型的像素（包括a1联盟成员的emoji像素）
 */

const { db } = require('./src/config/database');

async function findEmojiPixels() {
  try {
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║       查找所有Emoji类型像素                          ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    // 1. 查找pixel_type='emoji'的像素
    const emojiTypePixels = await db('pixels')
      .leftJoin('pattern_assets', 'pixels.pattern_id', 'pattern_assets.key')
      .where('pixels.pixel_type', 'emoji')
      .select(
        'pixels.id',
        'pixels.grid_id',
        'pixels.pattern_id',
        'pattern_assets.unicode_char',
        'pixels.lat_quantized',
        'pixels.lng_quantized'
      )
      .limit(5);

    console.log(`📊 pixel_type='emoji' 的像素: ${emojiTypePixels.length} 个`);
    if (emojiTypePixels.length > 0) {
      console.log('   示例:', JSON.stringify(emojiTypePixels[0], null, 2));
    }

    // 2. 查找pattern_id是emoji类型的像素
    const emojiPatternPixels = await db('pixels')
      .leftJoin('pattern_assets', 'pixels.pattern_id', 'pattern_assets.key')
      .where('pattern_assets.render_type', 'emoji')
      .leftJoin('alliance_members', 'pixels.user_id', 'alliance_members.user_id')
      .leftJoin('alliances', 'alliance_members.alliance_id', 'alliances.id')
      .select(
        'pixels.id',
        'pixels.grid_id',
        'pixels.pixel_type',
        'pixels.pattern_id',
        'pattern_assets.unicode_char',
        'alliances.name as alliance_name'
      )
      .limit(10);

    console.log(`\n📊 pattern.render_type='emoji' 的像素: ${emojiPatternPixels.length} 个`);
    if (emojiPatternPixels.length > 0) {
      console.log('   列表:');
      emojiPatternPixels.forEach(p => {
        console.log(`      ID ${p.id}: ${p.alliance_name || '(无联盟)'} - ${p.unicode_char} (pattern: ${p.pattern_id})`);
      });
    }

    // 3. 查找a1联盟成员拥有的emoji像素
    const a1EmojiPixels = await db('pixels')
      .leftJoin('alliance_members', 'pixels.user_id', 'alliance_members.user_id')
      .leftJoin('alliances', 'alliance_members.alliance_id', 'alliances.id')
      .leftJoin('pattern_assets', 'pixels.pattern_id', 'pattern_assets.key')
      .where('alliances.name', 'a1')
      .where(function() {
        this.where('pixels.pixel_type', 'emoji')
          .orWhere('pattern_assets.render_type', 'emoji');
      })
      .select(
        'pixels.id',
        'pixels.grid_id',
        'pixels.pixel_type',
        'pixels.pattern_id',
        'pattern_assets.unicode_char',
        'pixels.lat_quantized',
        'pixels.lng_quantized'
      )
      .limit(10);

    console.log(`\n📊 a1联盟成员的emoji像素: ${a1EmojiPixels.length} 个`);
    if (a1EmojiPixels.length > 0) {
      console.log('   列表:');
      a1EmojiPixels.forEach(p => {
        console.log(`      ID ${p.id}: ${p.unicode_char} at (${p.lat_quantized}, ${p.lng_quantized})`);
      });
    }

    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║                    分析结论                          ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    if (a1EmojiPixels.length === 0) {
      console.log('⚠️  a1联盟成员目前没有任何emoji类型的像素');
      console.log('   这就是为什么iOS app看不到a1的emoji像素');
      console.log('\n📋 解决方案:');
      console.log('   1. 创建一个emoji类型的像素，用户是a1联盟成员');
      console.log('   2. 或者修改现有像素的pattern_id为emoji类型');
    } else {
      console.log(`✅ a1联盟有 ${a1EmojiPixels.length} 个emoji像素`);
      console.log('   如果iOS app看不到，问题在于:');
      console.log('   - MVT瓦片生成问题');
      console.log('   - iOS端emoji图标注册问题');
      console.log('   - iOS端图层配置问题');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

findEmojiPixels();
