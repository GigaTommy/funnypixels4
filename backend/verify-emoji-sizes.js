/**
 * 验证所有scale的emoji sprite尺寸
 */

const sharp = require('sharp');
const { getSprite, clearCache } = require('./src/services/spriteService');
const fs = require('fs');

async function verifyAllScales() {
  console.log('🔍 Verifying emoji sprite sizes for all scales...\n');

  // 清除缓存
  console.log('🗑️ Clearing cache...');
  clearCache();

  const emoji = '⚔️';
  const scales = [1, 2, 3];
  const results = [];

  for (const scale of scales) {
    console.log(`\n📦 Scale ${scale}:`);
    console.log('Generating sprite...');

    const spriteBuffer = await getSprite(emoji, scale, 'emoji');
    const metadata = await sharp(spriteBuffer).metadata();

    console.log(`  Total size: ${metadata.width}x${metadata.height}px`);

    // 分析实际绘制区域
    const { data, info } = await sharp(spriteBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });

    let minX = info.width, minY = info.height, maxX = 0, maxY = 0;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * 4;
        if (data[i + 3] > 0) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    const actualWidth = maxX - minX + 1;
    const actualHeight = maxY - minY + 1;
    const paddingLeft = minX;
    const paddingRight = info.width - maxX - 1;
    const paddingTop = minY;
    const paddingBottom = info.height - maxY - 1;

    console.log(`  Effective size: ${actualWidth}x${actualHeight}px`);
    console.log(`  Padding: T=${paddingTop}, B=${paddingBottom}, L=${paddingLeft}, R=${paddingRight}`);

    // 预期值
    const expectedTotal = 64 * scale;
    const expectedPadding = 8 * scale;
    const expectedEffective = expectedTotal - 2 * expectedPadding;

    console.log(`  Expected: total=${expectedTotal}px, padding=${expectedPadding}px, effective=${expectedEffective}px`);

    const isCorrect =
      Math.abs(paddingTop - expectedPadding) <= 1 &&
      Math.abs(paddingBottom - expectedPadding) <= 1 &&
      Math.abs(paddingLeft - expectedPadding) <= 1 &&
      Math.abs(paddingRight - expectedPadding) <= 1;

    results.push({ scale, isCorrect, actualWidth, actualHeight });

    // 保存测试图片
    const testFile = `/tmp/emoji_scale_${scale}.png`;
    fs.writeFileSync(testFile, spriteBuffer);
    console.log(`  Saved to: ${testFile}`);

    if (isCorrect) {
      console.log(`  ✅ PASS`);
    } else {
      console.log(`  ❌ FAIL`);
    }
  }

  console.log('\n📊 Summary:');
  results.forEach(r => {
    console.log(`  Scale ${r.scale}: ${r.isCorrect ? '✅' : '❌'} (${r.actualWidth}x${r.actualHeight}px)`);
  });

  process.exit(0);
}

verifyAllScales().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
