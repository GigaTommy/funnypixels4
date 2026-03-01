/**
 * 确保16色基础调色板在pattern_assets表中存在
 * 这个迁移文件确保广告图案压缩转像素画功能所需的16色基础调色板正确配置
 * 
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  console.log('🎨 开始确保16色基础调色板...');
  
  // 16色基础调色板定义（与AdPixelRenderer.js中的调色板保持一致）
  const base16Colors = [
    { color: '#000000', name: '黑色', key: 'black' },
    { color: '#FFFFFF', name: '白色', key: 'white' },
    { color: '#FF0000', name: '红色', key: 'red' },
    { color: '#00FF00', name: '绿色', key: 'green' },
    { color: '#0000FF', name: '蓝色', key: 'blue' },
    { color: '#FFFF00', name: '黄色', key: 'yellow' },
    { color: '#FF00FF', name: '紫色', key: 'purple' },
    { color: '#00FFFF', name: '青色', key: 'cyan' },
    { color: '#FFA500', name: '橙色', key: 'orange' },
    { color: '#FFC0CB', name: '粉色', key: 'pink' },
    { color: '#8B4513', name: '棕色', key: 'brown' },
    { color: '#006400', name: '深绿色', key: 'dark_green' },
    { color: '#000080', name: '深蓝色', key: 'dark_blue' },
    { color: '#8B0000', name: '深红色', key: 'dark_red' },
    { color: '#808080', name: '灰色', key: 'gray' },
    { color: '#C0C0C0', name: '浅灰色', key: 'light_gray' }
  ];
  
  let createdCount = 0;
  let updatedCount = 0;
  let existingCount = 0;
  
  for (const colorItem of base16Colors) {
    const { color, name, key } = colorItem;
    
    // 检查是否已存在该颜色（按payload查找）
    const existingByPayload = await knex('pattern_assets')
      .where('render_type', 'color')
      .where('payload', color)
      .first();
    
    // 检查是否已存在该key
    const existingByKey = await knex('pattern_assets')
      .where('key', key)
      .first();
    
    if (existingByPayload) {
      // 如果按payload找到了，检查key是否正确
      if (existingByPayload.key !== key) {
        // 如果key不同，需要处理冲突
        if (existingByKey) {
          // 如果目标key已存在，删除旧的记录
          await knex('pattern_assets')
            .where('id', existingByKey.id)
            .del();
          console.log(`  🗑️ 删除冲突记录: key=${key}`);
        }
        
        // 更新现有记录
        await knex('pattern_assets')
          .where('id', existingByPayload.id)
          .update({
            key: key,
            name: name,
            updated_at: new Date()
          });
        console.log(`  🔄 更新: ${color} - key从 ${existingByPayload.key} 更新为 ${key}`);
        updatedCount++;
      } else {
        console.log(`  ✅ 已存在: ${color} - ${name} (${key})`);
        existingCount++;
      }
    } else if (existingByKey) {
      // 如果按key找到了，但payload不同，更新payload
      await knex('pattern_assets')
        .where('id', existingByKey.id)
        .update({
          payload: color,
          name: name,
          updated_at: new Date()
        });
      console.log(`  🔄 更新: ${key} - payload更新为 ${color}`);
      updatedCount++;
    } else {
      // 如果都不存在，创建新的颜色模式
      await knex('pattern_assets')
        .insert({
          key: key,
          name: name,
          description: `基础颜色 - ${name}`,
          image_url: '', // 颜色模式不需要图片URL
          render_type: 'color',
          encoding: 'color_hex',
          payload: color,
          verified: true,
          created_at: new Date(),
          updated_at: new Date()
        });
      console.log(`  🆕 创建: ${color} - ${name} (${key})`);
      createdCount++;
    }
  }
  
  console.log('📊 16色基础调色板确保完成:');
  console.log(`  ✅ 已存在: ${existingCount} 个`);
  console.log(`  🔄 已更新: ${updatedCount} 个`);
  console.log(`  🆕 已创建: ${createdCount} 个`);
  console.log(`  📈 总计: ${existingCount + updatedCount + createdCount} 个颜色模式`);
  
  // 验证结果
  const allColorPatterns = await knex('pattern_assets')
    .where('render_type', 'color')
    .select('key', 'payload', 'name')
    .orderBy('payload');
  
  let matchedCount = 0;
  for (const colorItem of base16Colors) {
    const found = allColorPatterns.find(p => p.payload === colorItem.color);
    if (found) {
      matchedCount++;
    }
  }
  
  console.log(`🎯 最终验证: ${matchedCount}/${base16Colors.length} 个16色基础调色板匹配`);
  
  if (matchedCount === base16Colors.length) {
    console.log('🎉 16色基础调色板确保完成！所有颜色都已正确配置。');
  } else {
    console.log('⚠️ 警告: 仍有颜色未正确配置，请检查。');
  }
};

/**
 * 回滚操作：删除16色基础调色板
 * 注意：这个回滚操作会删除所有16色基础调色板，请谨慎使用
 * 
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  console.log('🔄 开始回滚16色基础调色板...');
  
  // 16色基础调色板的key列表
  const base16Keys = [
    'black', 'white', 'red', 'green', 'blue', 'yellow',
    'purple', 'cyan', 'orange', 'pink', 'brown', 'dark_green',
    'dark_blue', 'dark_red', 'gray', 'light_gray'
  ];
  
  // 删除16色基础调色板
  const deletedCount = await knex('pattern_assets')
    .whereIn('key', base16Keys)
    .where('render_type', 'color')
    .del();
  
  console.log(`🗑️ 已删除 ${deletedCount} 个16色基础调色板记录`);
  console.log('⚠️ 注意: 回滚操作已完成，但可能影响现有的像素数据');
};
