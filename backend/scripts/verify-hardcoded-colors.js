const { db } = require('../src/config/database');

/**
 * 验证广告图案转成颜色像素矩阵图案的逻辑中，硬编码的颜色是否已经全部存在于pattern_assets中
 */

// AdPixelRenderer.js 中的16色基础调色板
const adPixelRendererColors = [
  '#000000', // 黑色
  '#FFFFFF', // 白色
  '#FF0000', // 红色
  '#00FF00', // 绿色
  '#0000FF', // 蓝色
  '#FFFF00', // 黄色
  '#FF00FF', // 紫色
  '#00FFFF', // 青色
  '#FFA500', // 橙色
  '#FFC0CB', // 粉色
  '#8B4513', // 棕色
  '#006400', // 深绿色
  '#000080', // 深蓝色
  '#8B0000', // 深红色
  '#808080', // 灰色
  '#C0C0C0'  // 浅灰色
];

// 其他硬编码颜色
const otherHardcodedColors = [
  '#FF0000', // pixelDrawService.js 中的默认颜色
  '#808080', // imageProcessor.js 中的默认图案颜色
  '#FFD700', // customFlagProcessor.js 中的金色
  '#800080', // customFlagProcessor.js 中的紫色
  'transparent' // 透明色（特殊处理）
];

/**
 * 验证硬编码颜色是否存在于数据库中
 */
async function verifyHardcodedColors() {
  try {
    console.log('🔍 开始验证硬编码颜色是否存在于 pattern_assets 中...');
    
    // 获取数据库中所有颜色图案
    const dbColors = await db('pattern_assets')
      .where('render_type', 'color')
      .select('key', 'color', 'payload');
    
    console.log(`📋 数据库中找到 ${dbColors.length} 个颜色图案`);
    
    // 创建颜色映射表
    const colorMap = new Map();
    dbColors.forEach(item => {
      if (item.color) {
        colorMap.set(item.color.toUpperCase(), item.key);
      }
      if (item.payload) {
        colorMap.set(item.payload.toUpperCase(), item.key);
      }
    });
    
    console.log('\n🎨 验证 AdPixelRenderer.js 中的16色基础调色板:');
    let missingColors = [];
    
    for (const color of adPixelRendererColors) {
      const upperColor = color.toUpperCase();
      if (colorMap.has(upperColor)) {
        const key = colorMap.get(upperColor);
        console.log(`  ✅ ${color} -> ${key}`);
      } else {
        console.log(`  ❌ ${color} -> 缺失`);
        missingColors.push(color);
      }
    }
    
    console.log('\n🎨 验证其他硬编码颜色:');
    for (const color of otherHardcodedColors) {
      if (color === 'transparent') {
        console.log(`  ℹ️ ${color} -> 特殊处理（透明色）`);
        continue;
      }
      
      const upperColor = color.toUpperCase();
      if (colorMap.has(upperColor)) {
        const key = colorMap.get(upperColor);
        console.log(`  ✅ ${color} -> ${key}`);
      } else {
        console.log(`  ❌ ${color} -> 缺失`);
        missingColors.push(color);
      }
    }
    
    console.log('\n📊 验证结果:');
    if (missingColors.length === 0) {
      console.log('  ✅ 所有硬编码颜色都已存在于 pattern_assets 中');
      console.log('  ✅ 用户端渲染不会失败');
    } else {
      console.log(`  ❌ 发现 ${missingColors.length} 个缺失的颜色:`);
      missingColors.forEach(color => {
        console.log(`    - ${color}`);
      });
      console.log('  ⚠️ 这可能导致用户端渲染失败');
    }
    
    // 额外检查：验证数据库中的颜色是否与硬编码颜色一致
    console.log('\n🔍 额外检查：数据库中的颜色与硬编码颜色的一致性:');
    const dbColorValues = Array.from(colorMap.keys());
    const hardcodedColorValues = [...adPixelRendererColors, ...otherHardcodedColors.filter(c => c !== 'transparent')].map(c => c.toUpperCase());
    
    const inconsistentColors = [];
    for (const dbColor of dbColorValues) {
      if (!hardcodedColorValues.includes(dbColor)) {
        inconsistentColors.push(dbColor);
      }
    }
    
    if (inconsistentColors.length > 0) {
      console.log(`  ⚠️ 发现 ${inconsistentColors.length} 个数据库中存在但硬编码中未定义的颜色:`);
      inconsistentColors.forEach(color => {
        console.log(`    - ${color}`);
      });
    } else {
      console.log('  ✅ 数据库中的颜色与硬编码颜色完全一致');
    }
    
    return {
      success: missingColors.length === 0,
      missingColors,
      inconsistentColors,
      totalDbColors: dbColors.length,
      totalHardcodedColors: adPixelRendererColors.length + otherHardcodedColors.length - 1 // 减去 transparent
    };
    
  } catch (error) {
    console.error('❌ 验证失败:', error);
    throw error;
  } finally {
    await db.destroy();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  verifyHardcodedColors()
    .then((result) => {
      if (result.success) {
        console.log('\n🎉 验证通过！所有硬编码颜色都已存在于数据库中。');
        process.exit(0);
      } else {
        console.log('\n❌ 验证失败！存在缺失的颜色，需要修复。');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ 验证脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { verifyHardcodedColors };
