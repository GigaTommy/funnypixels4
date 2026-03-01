const { db } = require('../src/config/database');

/**
 * 更新 pattern_assets 表中 render_type = 'color' 的记录
 * 按照要求更新 key、unicode_char、color 和 payload 字段
 */

// 颜色名称映射（英文名 -> 中文名）
const colorNameMap = {
  'black': '黑色',
  'white': '白色', 
  'gray': '灰色',
  'light_gray': '浅灰色',
  'dark_gray': '暗灰色',
  'red': '红色',
  'green': '绿色',
  'blue': '蓝色',
  'yellow': '黄色',
  'purple': '紫色',
  'cyan': '青色',
  'orange': '橙色',
  'pink': '粉色',
  'brown': '棕色',
  'dark_green': '深绿色',
  'dark_blue': '深蓝色',
  'dark_red': '深红色'
};

// 颜色对应的 Unicode 字符
const colorUnicodeMap = {
  '#000000': '⬛', // 黑色
  '#FFFFFF': '⬜', // 白色
  '#808080': '🔲', // 灰色
  '#C0C0C0': '🔲', // 浅灰色
  '#666666': '🔳', // 暗灰色
  '#FF0000': '🔴', // 红色
  '#00FF00': '🟢', // 绿色
  '#0000FF': '🔵', // 蓝色
  '#FFFF00': '🟡', // 黄色
  '#FF00FF': '🟣', // 紫色
  '#00FFFF': '🔵', // 青色
  '#FFA500': '🟠', // 橙色
  '#FFC0CB': '🩷', // 粉色
  '#8B4513': '🤎', // 棕色
  '#006400': '🟫', // 深绿色
  '#000080': '🔷', // 深蓝色
  '#8B0000': '🔺'  // 深红色
};

/**
 * 生成随机 key（6位字母+数字组合）
 */
function generateRandomKey() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 根据颜色值获取合适的 key
 */
function getColorKey(colorValue, existingKey) {
  // 如果有英文名，使用 color_英文名 格式
  for (const [englishName, chineseName] of Object.entries(colorNameMap)) {
    if (existingKey === englishName) {
      return `color_${englishName}`;
    }
  }
  
  // 否则生成随机 key
  return `color_${generateRandomKey()}`;
}

/**
 * 更新颜色图案记录
 */
async function updateColorPatterns() {
  try {
    console.log('🎨 开始更新颜色图案记录...');
    
    // 获取所有颜色图案记录
    const colorPatterns = await db('pattern_assets')
      .where('render_type', 'color')
      .select('id', 'key', 'name', 'color', 'unicode_char', 'payload');
    
    console.log(`📋 找到 ${colorPatterns.length} 个颜色图案记录`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const pattern of colorPatterns) {
      console.log(`\n🔍 处理记录 ID: ${pattern.id}`);
      console.log(`  当前 Key: ${pattern.key}`);
      console.log(`  当前 Name: ${pattern.name}`);
      console.log(`  当前 Color: ${pattern.color}`);
      console.log(`  当前 Unicode: ${pattern.unicode_char}`);
      console.log(`  当前 Payload: ${pattern.payload}`);
      
      // 从 payload 中提取颜色值（如果 color 字段为空）
      let colorValue = pattern.color;
      if (!colorValue && pattern.payload) {
        // 从 payload 中提取颜色值
        const colorMatch = pattern.payload.match(/#[0-9A-Fa-f]{6}/);
        if (colorMatch) {
          colorValue = colorMatch[0].toUpperCase();
        }
      }
      
      if (!colorValue) {
        console.log(`  ⚠️ 跳过：无法确定颜色值`);
        skippedCount++;
        continue;
      }
      
      // 生成新的 key
      const newKey = getColorKey(colorValue, pattern.key);
      
      // 获取对应的 Unicode 字符
      const unicodeChar = colorUnicodeMap[colorValue] || null;
      
      // 准备更新数据
      const updateData = {
        key: newKey,
        color: colorValue,
        payload: colorValue,
        updated_at: new Date()
      };
      
      // 如果有 Unicode 字符，也更新
      if (unicodeChar) {
        updateData.unicode_char = unicodeChar;
      }
      
      console.log(`  📝 更新数据:`);
      console.log(`    Key: ${pattern.key} -> ${newKey}`);
      console.log(`    Color: ${pattern.color} -> ${colorValue}`);
      console.log(`    Unicode: ${pattern.unicode_char} -> ${unicodeChar}`);
      console.log(`    Payload: ${pattern.payload} -> ${colorValue}`);
      
      // 执行更新
      await db('pattern_assets')
        .where('id', pattern.id)
        .update(updateData);
      
      console.log(`  ✅ 更新成功`);
      updatedCount++;
    }
    
    console.log(`\n🎉 更新完成！`);
    console.log(`  ✅ 已更新: ${updatedCount} 个记录`);
    console.log(`  ⚠️ 跳过: ${skippedCount} 个记录`);
    
  } catch (error) {
    console.error('❌ 更新失败:', error);
    throw error;
  } finally {
    await db.destroy();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  updateColorPatterns()
    .then(() => {
      console.log('✅ 脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { updateColorPatterns };
