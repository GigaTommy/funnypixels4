/**
 * 修复256色Pattern数据缺失问题
 * 生成完整的256色调色板Pattern数据
 */

const { db } = require('./src/config/database');

// 生成256色调色板
function generate256ColorPalette() {
  const palette = [];
  const rgbLevels = [0, 51, 102, 153, 204, 255];

  // 生成216个Web安全色
  for (const r of rgbLevels) {
    for (const g of rgbLevels) {
      for (const b of rgbLevels) {
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
        palette.push({ r, g, b, hex });
      }
    }
  }

  // 添加40个灰度级
  for (let i = 0; i < 40; i++) {
    const gray = Math.floor((i / 39) * 255);
    const hex = `#${gray.toString(16).padStart(2, '0')}${gray.toString(16).padStart(2, '0')}${gray.toString(16).padStart(2, '0')}`.toUpperCase();
    palette.push({ r: gray, g: gray, b: gray, hex });
  }

  return palette;
}

async function fix256ColorPatterns() {
  try {
    console.log('🔧 开始修复256色Pattern数据...');
    
    const palette = generate256ColorPalette();
    console.log(`📊 生成256色调色板: ${palette.length}种颜色`);
    
    let inserted = 0;
    let updated = 0;
    
    for (const color of palette) {
      const patternKey = `color_256_${color.hex.toLowerCase()}`;
      
      // 检查是否已存在
      const existing = await db('pattern_assets')
        .where('key', patternKey)
        .first();
      
      if (existing) {
        console.log(`✅ Pattern已存在: ${patternKey}`);
        continue;
      }
      
      // 创建Pattern数据
      const patternData = {
        key: patternKey,
        category: 'base256color',
        render_type: 'color',
        payload: color.hex,
        metadata: JSON.stringify({
          r: color.r,
          g: color.g,
          b: color.b,
          hex: color.hex,
          palette: '256color'
        }),
        created_at: new Date(),
        updated_at: new Date()
      };
      
      try {
        await db('pattern_assets').insert(patternData);
        inserted++;
        console.log(`✅ 插入Pattern: ${patternKey}`);
      } catch (error) {
        if (error.code === '23505') { // 唯一约束冲突
          console.log(`⚠️ Pattern已存在: ${patternKey}`);
          updated++;
        } else {
          console.error(`❌ 插入失败: ${patternKey}`, error.message);
        }
      }
    }
    
    console.log(`\n🎉 256色Pattern修复完成:`);
    console.log(`  - 新插入: ${inserted}个`);
    console.log(`  - 已存在: ${updated}个`);
    console.log(`  - 总计: ${palette.length}个`);
    
    // 验证修复结果
    const count = await db('pattern_assets')
      .where('category', 'base256color')
      .count('* as count')
      .first();
    
    console.log(`\n📊 数据库验证: 当前有${count.count}个256色Pattern`);
    
  } catch (error) {
    console.error('❌ 修复失败:', error);
  } finally {
    await db.destroy();
  }
}

fix256ColorPatterns();
