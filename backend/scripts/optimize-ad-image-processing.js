const sharp = require('sharp');

/**
 * 广告图片转像素画优化方案
 * 分析当前问题并提供改进建议
 */
class AdImageProcessingOptimizer {
  
  /**
   * 分析当前图片处理流程的问题
   */
  static analyzeCurrentIssues() {
    console.log('🔍 分析当前广告图片处理流程的问题...\n');
    
    const issues = [
      {
        category: '图片缩放',
        problem: '使用简单的resize可能导致细节丢失',
        current: 'sharp.resize(targetWidth, targetHeight, { fit: "cover" })',
        impact: '高',
        suggestion: '使用更智能的缩放算法，保持重要特征'
      },
      {
        category: '颜色量化',
        problem: '没有颜色量化，可能导致颜色过多',
        current: '直接使用原始RGB值',
        impact: '高',
        suggestion: '实现颜色量化，减少颜色数量，提高像素画效果'
      },
      {
        category: '透明度处理',
        problem: '透明度阈值固定，可能丢失半透明细节',
        current: 'if (pixel.a > 0) 保留像素',
        impact: '中',
        suggestion: '使用更智能的透明度处理，考虑半透明混合'
      },
      {
        category: '边缘检测',
        problem: '没有边缘增强，可能导致轮廓模糊',
        current: '无边缘处理',
        impact: '中',
        suggestion: '添加边缘检测和增强，保持清晰轮廓'
      },
      {
        category: '抖动处理',
        problem: '没有抖动算法，可能导致颜色过渡生硬',
        current: '无抖动处理',
        impact: '中',
        suggestion: '实现Floyd-Steinberg抖动，改善颜色过渡'
      }
    ];
    
    console.log('📋 发现的问题:');
    issues.forEach((issue, index) => {
      console.log(`\n${index + 1}. ${issue.category}`);
      console.log(`   问题: ${issue.problem}`);
      console.log(`   当前实现: ${issue.current}`);
      console.log(`   影响程度: ${issue.impact}`);
      console.log(`   建议: ${issue.suggestion}`);
    });
    
    return issues;
  }
  
  /**
   * 提供优化后的图片处理方案
   */
  static getOptimizedProcessingPipeline() {
    console.log('\n🚀 优化后的图片处理流程:\n');
    
    const pipeline = [
      {
        step: 1,
        name: '预处理',
        description: '图片格式标准化和基础优化',
        code: `
// 1. 预处理 - 标准化图片格式
const preprocessedBuffer = await sharp(imageBuffer)
  .ensureAlpha() // 确保有alpha通道
  .removeAlpha({ background: { r: 0, g: 0, b: 0, alpha: 0 } }) // 透明背景转黑色
  .png({ quality: 100 })
  .toBuffer();
        `
      },
      {
        step: 2,
        name: '智能缩放',
        description: '使用高质量算法进行缩放',
        code: `
// 2. 智能缩放 - 保持重要特征
const resizedBuffer = await sharp(preprocessedBuffer)
  .resize(targetWidth, targetHeight, {
    fit: 'inside', // 保持宽高比，不裁剪
    background: { r: 0, g: 0, b: 0, alpha: 0 }, // 透明背景
    kernel: sharp.kernel.lanczos3 // 高质量重采样
  })
  .png({ quality: 100 })
  .toBuffer();
        `
      },
      {
        step: 3,
        name: '颜色量化',
        description: '减少颜色数量，提高像素画效果',
        code: `
// 3. 颜色量化 - 减少颜色数量
const quantizedBuffer = await sharp(resizedBuffer)
  .png({
    palette: true, // 使用调色板
    colors: 16, // 限制颜色数量
    dither: 1.0 // 启用抖动
  })
  .toBuffer();
        `
      },
      {
        step: 4,
        name: '边缘增强',
        description: '增强边缘，保持清晰轮廓',
        code: `
// 4. 边缘增强 - 保持清晰轮廓
const edgeEnhancedBuffer = await sharp(quantizedBuffer)
  .convolve({
    width: 3,
    height: 3,
    kernel: [-1, -1, -1, -1, 9, -1, -1, -1, -1] // 锐化核
  })
  .png({ quality: 100 })
  .toBuffer();
        `
      },
      {
        step: 5,
        name: '像素数据提取',
        description: '提取并优化像素数据',
        code: `
// 5. 像素数据提取 - 智能处理
const { data, info } = await sharp(edgeEnhancedBuffer)
  .raw()
  .toBuffer({ resolveWithObject: true });

const pixels = [];
for (let i = 0; i < data.length; i += info.channels) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const a = info.channels === 4 ? data[i + 3] : 255;
  
  // 智能透明度处理
  if (a > 30) { // 降低透明度阈值，保留更多细节
    const color = this.quantizeColor(r, g, b); // 颜色量化
    pixels.push({
      r, g, b, a,
      color: color,
      position: Math.floor(i / info.channels)
    });
  }
}
        `
      }
    ];
    
    pipeline.forEach(step => {
      console.log(`步骤 ${step.step}: ${step.name}`);
      console.log(`描述: ${step.description}`);
      console.log(`代码:\n${step.code}\n`);
    });
    
    return pipeline;
  }
  
  /**
   * 提供颜色量化算法
   */
  static getColorQuantizationAlgorithm() {
    console.log('🎨 颜色量化算法:\n');
    
    const algorithm = `
/**
 * 颜色量化 - 将RGB颜色映射到调色板
 * @param {number} r - 红色值 (0-255)
 * @param {number} g - 绿色值 (0-255)
 * @param {number} b - 蓝色值 (0-255)
 * @returns {string} 量化后的十六进制颜色
 */
static quantizeColor(r, g, b) {
  // 定义像素画调色板 - 16种常用颜色
  const palette = [
    { r: 0, g: 0, b: 0, hex: '#000000' },      // 黑色
    { r: 255, g: 255, b: 255, hex: '#FFFFFF' }, // 白色
    { r: 128, g: 128, b: 128, hex: '#808080' }, // 灰色
    { r: 255, g: 0, b: 0, hex: '#FF0000' },     // 红色
    { r: 0, g: 255, b: 0, hex: '#00FF00' },     // 绿色
    { r: 0, g: 0, b: 255, hex: '#0000FF' },     // 蓝色
    { r: 255, g: 255, b: 0, hex: '#FFFF00' },   // 黄色
    { r: 255, g: 0, b: 255, hex: '#FF00FF' },   // 洋红
    { r: 0, g: 255, b: 255, hex: '#00FFFF' },   // 青色
    { r: 128, g: 0, b: 0, hex: '#800000' },     // 深红
    { r: 0, g: 128, b: 0, hex: '#008000' },     // 深绿
    { r: 0, g: 0, b: 128, hex: '#000080' },     // 深蓝
    { r: 128, g: 128, b: 0, hex: '#808000' },   // 橄榄色
    { r: 128, g: 0, b: 128, hex: '#800080' },   // 紫色
    { r: 0, g: 128, b: 128, hex: '#008080' },   // 青绿色
    { r: 192, g: 192, b: 192, hex: '#C0C0C0' }  // 银灰色
  ];
  
  // 找到最接近的颜色
  let minDistance = Infinity;
  let closestColor = palette[0];
  
  for (const color of palette) {
    const distance = Math.sqrt(
      Math.pow(r - color.r, 2) +
      Math.pow(g - color.g, 2) +
      Math.pow(b - color.b, 2)
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      closestColor = color;
    }
  }
  
  return closestColor.hex;
}
    `;
    
    console.log(algorithm);
    return algorithm;
  }
  
  /**
   * 提供抖动算法
   */
  static getDitheringAlgorithm() {
    console.log('\n🌊 Floyd-Steinberg抖动算法:\n');
    
    const algorithm = `
/**
 * Floyd-Steinberg抖动算法
 * 改善颜色过渡，减少颜色条带效应
 * @param {Array} pixels - 像素数据数组
 * @param {number} width - 图片宽度
 * @param {number} height - 图片高度
 * @returns {Array} 抖动后的像素数据
 */
static applyFloydSteinbergDithering(pixels, width, height) {
  const ditheredPixels = [...pixels];
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const pixel = ditheredPixels[index];
      
      if (!pixel) continue;
      
      // 量化颜色
      const quantizedColor = this.quantizeColor(pixel.r, pixel.g, pixel.b);
      const quantizedRgb = this.hexToRgb(quantizedColor);
      
      // 计算误差
      const errorR = pixel.r - quantizedRgb.r;
      const errorG = pixel.g - quantizedRgb.g;
      const errorB = pixel.b - quantizedRgb.b;
      
      // 更新当前像素
      ditheredPixels[index] = {
        ...pixel,
        r: quantizedRgb.r,
        g: quantizedRgb.g,
        b: quantizedRgb.b,
        color: quantizedColor
      };
      
      // 扩散误差到邻近像素
      this.diffuseError(ditheredPixels, x, y, width, height, errorR, errorG, errorB);
    }
  }
  
  return ditheredPixels;
}

/**
 * 扩散误差到邻近像素
 */
static diffuseError(pixels, x, y, width, height, errorR, errorG, errorB) {
  const diffusionMatrix = [
    { dx: 1, dy: 0, factor: 7/16 },
    { dx: -1, dy: 1, factor: 3/16 },
    { dx: 0, dy: 1, factor: 5/16 },
    { dx: 1, dy: 1, factor: 1/16 }
  ];
  
  diffusionMatrix.forEach(({ dx, dy, factor }) => {
    const newX = x + dx;
    const newY = y + dy;
    
    if (newX >= 0 && newX < width && newY >= 0 && newY < height) {
      const index = newY * width + newX;
      const pixel = pixels[index];
      
      if (pixel) {
        pixels[index] = {
          ...pixel,
          r: Math.max(0, Math.min(255, pixel.r + errorR * factor)),
          g: Math.max(0, Math.min(255, pixel.g + errorG * factor)),
          b: Math.max(0, Math.min(255, pixel.b + errorB * factor))
        };
      }
    }
  });
}
    `;
    
    console.log(algorithm);
    return algorithm;
  }
  
  /**
   * 生成完整的优化代码
   */
  static generateOptimizedCode() {
    console.log('📝 生成完整的优化代码:\n');
    
    const optimizedCode = `
/**
 * 优化后的广告图片处理函数
 * @param {string} imageData - base64图片数据
 * @param {number} targetWidth - 目标宽度
 * @param {number} targetHeight - 目标高度
 * @returns {Object} 处理结果
 */
static async processAdImageOptimized(imageData, targetWidth, targetHeight) {
  try {
    console.log(\`🖼️ 开始优化处理广告图片: \${targetWidth}x\${targetHeight}\`);
    
    // 1. 解析base64数据
    const base64Data = imageData.split(',')[1];
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // 2. 预处理 - 标准化图片格式
    const preprocessedBuffer = await sharp(imageBuffer)
      .ensureAlpha()
      .removeAlpha({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ quality: 100 })
      .toBuffer();
    
    // 3. 智能缩放
    const resizedBuffer = await sharp(preprocessedBuffer)
      .resize(targetWidth, targetHeight, {
        fit: 'inside',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        kernel: sharp.kernel.lanczos3
      })
      .png({ quality: 100 })
      .toBuffer();
    
    // 4. 颜色量化
    const quantizedBuffer = await sharp(resizedBuffer)
      .png({
        palette: true,
        colors: 16,
        dither: 1.0
      })
      .toBuffer();
    
    // 5. 边缘增强
    const edgeEnhancedBuffer = await sharp(quantizedBuffer)
      .convolve({
        width: 3,
        height: 3,
        kernel: [-1, -1, -1, -1, 9, -1, -1, -1, -1]
      })
      .png({ quality: 100 })
      .toBuffer();
    
    // 6. 提取像素数据
    const { data, info } = await sharp(edgeEnhancedBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const pixels = [];
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = info.channels === 4 ? data[i + 3] : 255;
      
      if (a > 30) {
        const color = this.quantizeColor(r, g, b);
        pixels.push({
          r, g, b, a,
          color: color,
          position: Math.floor(i / info.channels)
        });
      }
    }
    
    // 7. 应用抖动算法
    const ditheredPixels = this.applyFloydSteinbergDithering(pixels, targetWidth, targetHeight);
    
    // 8. 转换为像素点集合
    const pixelPoints = this.convertToPixelPointsOptimized(ditheredPixels, targetWidth, targetHeight);
    
    console.log(\`✅ 优化处理完成，共\${pixelPoints.length}个像素点\`);
    
    return {
      width: targetWidth,
      height: targetHeight,
      pixelData: pixelPoints,
      pixelCount: pixelPoints.length,
      encoding: 'pixel_points',
      render_type: 'advertisement',
      processing_method: 'optimized'
    };
    
  } catch (error) {
    console.error('❌ 优化处理失败:', error);
    throw new Error(\`广告图片优化处理失败: \${error.message}\`);
  }
}
    `;
    
    console.log(optimizedCode);
    return optimizedCode;
  }
}

// 运行分析
console.log('🎯 广告图片转像素画优化分析\n');
console.log('=' * 50);

const issues = AdImageProcessingOptimizer.analyzeCurrentIssues();
const pipeline = AdImageProcessingOptimizer.getOptimizedProcessingPipeline();
AdImageProcessingOptimizer.getColorQuantizationAlgorithm();
AdImageProcessingOptimizer.getDitheringAlgorithm();
AdImageProcessingOptimizer.generateOptimizedCode();

console.log('\n🎉 优化分析完成！');
console.log('\n📋 总结:');
console.log('1. 当前实现存在5个主要问题');
console.log('2. 提供了完整的优化流程');
console.log('3. 包含了颜色量化和抖动算法');
console.log('4. 生成了可直接使用的优化代码');
console.log('\n💡 建议: 逐步实施这些优化，先测试颜色量化，再添加抖动算法。');
