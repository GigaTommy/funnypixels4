/**
 * 分析颜色量化算法
 */

console.log('🎨 颜色量化算法分析\n');
console.log('='.repeat(60));

// 当前算法：除以51
console.log('📌 当前算法: Math.round(value / 51) * 51\n');

const values51 = [];
for (let i = 0; i <= 255; i++) {
  const quantized = Math.round(i / 51) * 51;
  if (!values51.includes(quantized)) {
    values51.push(quantized);
  }
}

console.log('可能的量化值:');
console.log(values51.join(', '));
console.log(`\n每个通道: ${values51.length} 个级别`);
console.log(`总颜色数: ${values51.length}³ = ${Math.pow(values51.length, 3)} 种颜色`);

console.log('\n' + '='.repeat(60));
console.log('📌 真正的256色调色板算法对比\n');

// 标准的 256色 (6x8x6) Web安全色
console.log('1. Web 216色 (6×6×6):');
console.log('   RGB值: 0, 51, 102, 153, 204, 255');
console.log('   总颜色: 216种');

// 真正的256色应该是 6x8x6 或其他组合
console.log('\n2. 真256色方案 (8×8×4):');
const r8 = [];
for (let i = 0; i < 8; i++) {
  r8.push(Math.round(i * 255 / 7));
}
const g8 = r8;
const b4 = [];
for (let i = 0; i < 4; i++) {
  b4.push(Math.round(i * 255 / 3));
}
console.log(`   R值 (8级): ${r8.join(', ')}`);
console.log(`   G值 (8级): ${g8.join(', ')}`);
console.log(`   B值 (4级): ${b4.join(', ')}`);
console.log(`   总颜色: 8×8×4 = ${8*8*4} 种`);

console.log('\n' + '='.repeat(60));
console.log('📊 测试图片颜色分布分析\n');

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

(async () => {
  try {
    const TEST_IMAGE_PATH = path.join(__dirname, '../test.jpeg');

    if (!fs.existsSync(TEST_IMAGE_PATH)) {
      console.log('❌ 测试图片不存在:', TEST_IMAGE_PATH);
      return;
    }

    const imageBuffer = fs.readFileSync(TEST_IMAGE_PATH);

    // 调整到64x64
    const { data: rawData, info } = await sharp(imageBuffer)
      .resize(64, 64, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
      .raw()
      .toBuffer({ resolveWithObject: true });

    // 统计原始颜色（未量化）
    const originalColors = new Set();
    for (let i = 0; i < rawData.length; i += info.channels) {
      const r = rawData[i];
      const g = rawData[i + 1];
      const b = rawData[i + 2];
      originalColors.add(`${r},${g},${b}`);
    }

    console.log(`原始图片颜色数: ${originalColors.size} 种`);

    // 统计量化后颜色
    const quantizedColors = new Map();
    for (let i = 0; i < rawData.length; i += info.channels) {
      const r = rawData[i];
      const g = rawData[i + 1];
      const b = rawData[i + 2];

      // 当前算法
      const qr = Math.round(r / 51) * 51;
      const qg = Math.round(g / 51) * 51;
      const qb = Math.round(b / 51) * 51;
      const color = `#${qr.toString(16).padStart(2,'0')}${qg.toString(16).padStart(2,'0')}${qb.toString(16).padStart(2,'0')}`.toUpperCase();

      quantizedColors.set(color, (quantizedColors.get(color) || 0) + 1);
    }

    console.log(`量化后颜色数: ${quantizedColors.size} 种`);

    // 显示Top 10颜色
    console.log('\nTop 10 使用的颜色:');
    const sorted = Array.from(quantizedColors.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    sorted.forEach(([color, count], i) => {
      const percentage = (count / 4096 * 100).toFixed(1);
      console.log(`  ${i+1}. ${color}: ${count}个像素 (${percentage}%)`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('💡 结论:\n');
    console.log('1. 当前算法是 Web 216色 (6×6×6)，不是真正的256色');
    console.log('2. 测试图片本身颜色较少，所以只用到40种');
    console.log('3. 如果需要更丰富的颜色表现，可以考虑:');
    console.log('   - 使用真正的256色调色板');
    console.log('   - 使用抖动算法增强视觉效果');
    console.log('   - 使用中值切分算法(Median Cut)生成自适应调色板');

  } catch (err) {
    console.error('错误:', err.message);
  }
})();
