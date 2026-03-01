const { db } = require('../src/config/database');

async function addFlagPatterns() {
  try {
    console.log('🚩 添加基本旗帜图案...');

    // 基本旗帜图案数据 - 根据实际表结构
    const flagPatterns = [
      {
        name: 'flag_cn',
        description: '中国国旗',
        category: 'flags',
        width: 5,
        height: 5,
        encoding: 'png',
        // 创建简单的红色图案作为占位符
        payload: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==',
        is_public: true,
        verified: true,
        render_type: 'pattern',
        color: '#FF0000',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: '🌍',
        description: '地球联盟旗帜',
        category: 'alliance_flags',
        width: 3,
        height: 3,
        encoding: 'png',
        unicode_char: '🌍',
        // 创建简单的蓝色图案作为占位符
        payload: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAYAAABWKLW/AAAAFklEQVQI12NkwAIYocqYkAkmXAZCAAA6AAIgNj/CfgAAAABJRU5ErkJggg==',
        is_public: true,
        verified: true,
        render_type: 'pattern',
        color: '#0066CC',
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    for (const pattern of flagPatterns) {
      // 检查图案是否已存在
      const existing = await db('pattern_assets')
        .where('name', pattern.name)
        .first();

      if (existing) {
        console.log(`⚠️  图案 ${pattern.name} 已存在，跳过`);
        continue;
      }

      // 插入新图案
      await db('pattern_assets').insert(pattern);
      console.log(`✅ 添加图案: ${pattern.name} - ${pattern.description}`);
    }

    // 验证添加结果
    console.log('\n📊 验证添加结果:');
    for (const patternName of ['flag_cn', '🌍']) {
      const pattern = await db('pattern_assets')
        .where('name', patternName)
        .first();

      if (pattern) {
        console.log(`✅ ${patternName}: ID=${pattern.id}, 类别=${pattern.category}`);
      } else {
        console.log(`❌ ${patternName}: 仍然缺失`);
      }
    }

    await db.destroy();
    console.log('\n🎉 旗帜图案添加完成！');
  } catch (error) {
    console.error('❌ 添加旗帜图案失败:', error);
    process.exit(1);
  }
}

addFlagPatterns();