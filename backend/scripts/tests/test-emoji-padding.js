/**
 * 测试emoji sprite的padding
 * 验证emoji是否与SDF square大小一致
 */

const sharp = require('sharp');
const { getSprite, clearCache } = require('./src/services/spriteService');

async function testEmojiPadding() {
  console.log('🧪 Testing emoji sprite padding...\n');

  // 清除缓存以确保获取新版本
  console.log('🗑️ Clearing sprite cache...');
  clearCache();
  console.log('✅ Cache cleared\n');

  const emoji = '⚔️';
  const scale = 1;

  console.log(`📦 Generating emoji sprite: "${emoji}" at scale ${scale}`);
  const spriteBuffer = await getSprite(emoji, scale, 'emoji');

  // 获取图片尺寸和元数据
  const metadata = await sharp(spriteBuffer).metadata();
  console.log('\n📐 Sprite metadata:');
  console.log(`  Width: ${metadata.width}px`);
  console.log(`  Height: ${metadata.height}px`);
  console.log(`  Format: ${metadata.format}`);
  console.log(`  Size: ${spriteBuffer.length} bytes`);

  // 分析像素数据
  const { data, info } = await sharp(spriteBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  console.log(`\n🔍 Pixel analysis (${info.width}x${info.height}):`);

  // 找到非透明像素的边界
  let minX = info.width, minY = info.height, maxX = 0, maxY = 0;
  let hasNonTransparent = false;

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      const alpha = data[i + 3];
      if (alpha > 0) {
        hasNonTransparent = true;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (hasNonTransparent) {
    const actualWidth = maxX - minX + 1;
    const actualHeight = maxY - minY + 1;
    const paddingLeft = minX;
    const paddingRight = info.width - maxX - 1;
    const paddingTop = minY;
    const paddingBottom = info.height - maxY - 1;

    console.log('\n📏 Effective emoji area:');
    console.log(`  Top-left: (${minX}, ${minY})`);
    console.log(`  Bottom-right: (${maxX}, ${maxY})`);
    console.log(`  Actual size: ${actualWidth}x${actualHeight}px`);

    console.log('\n🔲 Padding:');
    console.log(`  Top: ${paddingTop}px`);
    console.log(`  Bottom: ${paddingBottom}px`);
    console.log(`  Left: ${paddingLeft}px`);
    console.log(`  Right: ${paddingRight}px`);

    console.log('\n✅ Expected values (SDF square):');
    console.log(`  Total size: 64x64px`);
    console.log(`  Effective size: 48x48px`);
    console.log(`  Padding: 8px on all sides`);

    const paddingMatches =
      paddingTop === 8 && paddingBottom === 8 &&
      paddingLeft === 8 && paddingRight === 8 &&
      actualWidth === 48 && actualHeight === 48;

    if (paddingMatches) {
      console.log('\n✅ PASS: Emoji padding matches SDF square!');
    } else {
      console.log('\n❌ FAIL: Emoji padding does NOT match SDF square!');
      console.log('   Expected: 8px padding, 48px effective size');
      console.log(`   Got: ${paddingTop}/${paddingBottom}/${paddingLeft}/${paddingRight}px padding, ${actualWidth}x${actualHeight}px effective size`);
    }
  } else {
    console.log('\n⚠️ No non-transparent pixels found!');
  }

  // 保存测试图片供视觉检查
  const testFile = '/tmp/emoji_padding_test.png';
  require('fs').writeFileSync(testFile, spriteBuffer);
  console.log(`\n💾 Test image saved to: ${testFile}`);

  process.exit(0);
}

testEmojiPadding().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
