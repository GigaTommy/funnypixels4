/**
 * 检查a1联盟像素的pattern设置
 */

const { db } = require('./src/config/database');

async function testPixelPattern() {
  try {
    const pixel = await db('pixels')
      .leftJoin('alliance_members', 'pixels.user_id', 'alliance_members.user_id')
      .leftJoin('alliances', 'alliance_members.alliance_id', 'alliances.id')
      .leftJoin('pattern_assets', 'pixels.pattern_id', 'pattern_assets.key')
      .where('alliances.name', 'a1')
      .select(
        'pixels.id',
        'pixels.grid_id',
        'pixels.pixel_type',
        'pixels.pattern_id',
        'pixels.color',
        'alliances.name as alliance_name',
        'alliances.flag_unicode_char',
        'alliances.flag_pattern_id',
        'pattern_assets.render_type',
        'pattern_assets.unicode_char',
        'pattern_assets.color as pattern_color'
      )
      .first();

    console.log('📊 a1 联盟像素的 pattern 配置:');
    console.log(JSON.stringify(pixel, null, 2));

    console.log('\n🔍 分析:');
    console.log(`   pixel.pixel_type = "${pixel.pixel_type}"`);
    console.log(`   pixel.pattern_id = "${pixel.pattern_id}"`);
    console.log(`   pattern_assets.render_type = "${pixel.render_type}"`);
    console.log(`   alliance.flag_unicode_char = "${pixel.flag_unicode_char}"`);

    console.log('\n📋 MVT分类逻辑:');
    console.log('   1. 如果pixel_type="alliance"，且有flag_unicode_char，归类为emoji');
    console.log('   2. 如果pixel_type="basic"，且pattern.render_type="emoji"，归类为emoji');
    console.log('   3. 否则归类为color');

    const mvtType = pixel.pixel_type === 'alliance'
      ? (pixel.flag_unicode_char ? 'emoji' : 'color')
      : (pixel.render_type === 'emoji' ? 'emoji' : 'color');

    console.log(`\n✅ MVT类型: ${mvtType}`);

    if (mvtType === 'emoji') {
      const emojiChar = pixel.render_type === 'emoji' ? pixel.unicode_char : pixel.flag_unicode_char;
      console.log(`   emoji_char: "${emojiChar}"`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

testPixelPattern();
