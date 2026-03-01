const { db } = require('../src/config/database');

/**
 * 添加缺失的硬编码颜色到 pattern_assets 表
 */

// 缺失的颜色
const missingColors = [
  { color: '#FFD700', name: '金色', unicode_char: '🟡' },
  { color: '#800080', name: '紫色', unicode_char: '🟣' }
];

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
 * 添加缺失的颜色
 */
async function addMissingColors() {
  try {
    console.log('🎨 开始添加缺失的硬编码颜色...');
    
    let addedCount = 0;
    
    for (const colorItem of missingColors) {
      const { color, name, unicode_char } = colorItem;
      
      console.log(`\n🔍 处理颜色: ${color} (${name})`);
      
      // 检查是否已存在
      const existing = await db('pattern_assets')
        .where('render_type', 'color')
        .where('payload', color)
        .first();
      
      if (existing) {
        console.log(`  ✅ 颜色已存在: ${existing.key}`);
        continue;
      }
      
      // 生成新的 key
      const key = `color_${generateRandomKey()}`;
      
      // 创建颜色记录
      const colorData = {
        key: key,
        name: name,
        description: `基础色板 - ${name}`,
        category: 'color_palette',
        render_type: 'color',
        unicode_char: unicode_char,
        color: color,
        width: 32,
        height: 32,
        encoding: 'color',
        payload: color,
        verified: true,
        created_by: null, // 系统创建
        created_at: new Date(),
        updated_at: new Date()
      };
      
      console.log(`  📝 创建颜色记录:`);
      console.log(`    Key: ${key}`);
      console.log(`    Name: ${name}`);
      console.log(`    Color: ${color}`);
      console.log(`    Unicode: ${unicode_char}`);
      
      // 插入数据库
      await db('pattern_assets').insert(colorData);
      
      console.log(`  ✅ 颜色添加成功`);
      addedCount++;
    }
    
    console.log(`\n🎉 添加完成！`);
    console.log(`  ✅ 已添加: ${addedCount} 个颜色`);
    
    // 验证添加结果
    console.log('\n🔍 验证添加结果:');
    for (const colorItem of missingColors) {
      const existing = await db('pattern_assets')
        .where('render_type', 'color')
        .where('payload', colorItem.color)
        .first();
      
      if (existing) {
        console.log(`  ✅ ${colorItem.color} -> ${existing.key}`);
      } else {
        console.log(`  ❌ ${colorItem.color} -> 仍然缺失`);
      }
    }
    
  } catch (error) {
    console.error('❌ 添加失败:', error);
    throw error;
  } finally {
    await db.destroy();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  addMissingColors()
    .then(() => {
      console.log('✅ 脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { addMissingColors };
