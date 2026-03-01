exports.seed = async function(knex) {
  try {
    console.log('🌱 开始安全插入pattern_assets种子数据...');
    
    // 首先检查表结构，确定哪些字段存在
    const tableInfo = await knex.raw(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'pattern_assets' 
      AND table_schema = current_schema()
    `);
    
    const availableColumns = tableInfo.rows.map(row => row.column_name);
    console.log('pattern_assets 表可用字段:', availableColumns);
    
    // 清空现有数据
    await knex('pattern_assets').del();
    
    // 构建基础数据，只包含存在的字段
    const basePatterns = [
      {
        key: 'color_red',
        name: '红色',
        description: '基础红色',
        image_url: '/patterns/color_red.png',
        category: 'color',
        tags: ['红色', '基础', '颜色'],
        is_public: true,
        created_by: null,
        width: 32,
        height: 32,
        encoding: 'rle',
        payload: JSON.stringify([{ count: 1024, color: '#FF0000' }]),
        verified: true,
        unicode_char: '🔴',
        render_type: 'color',
        color: '#FF0000'
      },
      {
        key: 'color_blue',
        name: '蓝色',
        description: '基础蓝色',
        image_url: '/patterns/color_blue.png',
        category: 'color',
        tags: ['蓝色', '基础', '颜色'],
        is_public: true,
        created_by: null,
        width: 32,
        height: 32,
        encoding: 'rle',
        payload: JSON.stringify([{ count: 1024, color: '#0000FF' }]),
        verified: true,
        unicode_char: '🔵',
        render_type: 'color',
        color: '#0000FF'
      },
      {
        key: 'color_green',
        name: '绿色',
        description: '基础绿色',
        image_url: '/patterns/color_green.png',
        category: 'color',
        tags: ['绿色', '基础', '颜色'],
        is_public: true,
        created_by: null,
        width: 32,
        height: 32,
        encoding: 'rle',
        payload: JSON.stringify([{ count: 1024, color: '#00FF00' }]),
        verified: true,
        unicode_char: '🟢',
        render_type: 'color',
        color: '#00FF00'
      },
      {
        key: 'color_yellow',
        name: '黄色',
        description: '基础黄色',
        image_url: '/patterns/color_yellow.png',
        category: 'color',
        tags: ['黄色', '基础', '颜色'],
        is_public: true,
        created_by: null,
        width: 32,
        height: 32,
        encoding: 'rle',
        payload: JSON.stringify([{ count: 1024, color: '#FFFF00' }]),
        verified: true,
        unicode_char: '🟡',
        render_type: 'color',
        color: '#FFFF00'
      },
      {
        key: 'color_black',
        name: '黑色',
        description: '基础黑色',
        image_url: '/patterns/color_black.png',
        category: 'color',
        tags: ['黑色', '基础', '颜色'],
        is_public: true,
        created_by: null,
        width: 32,
        height: 32,
        encoding: 'rle',
        payload: JSON.stringify([{ count: 1024, color: '#000000' }]),
        verified: true,
        unicode_char: '⚫',
        render_type: 'color',
        color: '#000000'
      },
      {
        key: 'color_white',
        name: '白色',
        description: '基础白色',
        image_url: '/patterns/color_white.png',
        category: 'color',
        tags: ['白色', '基础', '颜色'],
        is_public: true,
        created_by: null,
        width: 32,
        height: 32,
        encoding: 'rle',
        payload: JSON.stringify([{ count: 1024, color: '#FFFFFF' }]),
        verified: true,
        unicode_char: '⚪',
        render_type: 'color',
        color: '#FFFFFF'
      }
    ];
    
    // 过滤数据，只保留存在的字段
    const filteredPatterns = basePatterns.map(pattern => {
      const filteredPattern = {};
      for (const [key, value] of Object.entries(pattern)) {
        if (availableColumns.includes(key)) {
          filteredPattern[key] = value;
        }
      }
      return filteredPattern;
    });
    
    console.log('📊 过滤后的数据字段:', Object.keys(filteredPatterns[0]));
    
    // 插入数据
    await knex('pattern_assets').insert(filteredPatterns);
    
    console.log('✅ pattern_assets 种子数据插入成功，共', filteredPatterns.length, '条记录');
    
  } catch (error) {
    console.error('❌ pattern_assets 种子数据插入失败:', error.message);
    throw error;
  }
};
