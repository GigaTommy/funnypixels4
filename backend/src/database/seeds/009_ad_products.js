// 广告商品种子数据
exports.seed = async function(knex) {
  // 清空现有数据
  await knex('ad_products').del();
  
  // 插入广告商品数据
  const adProducts = [
    {
      name: '小长方形广告',
      description: '小尺寸长方形广告位 (20×10像素，共200个像素点)，适合简单文字或小图标展示',
      size_type: 'rectangle',
      width: 20,
      height: 10,
      price: 2000,
      active: true
    },
    {
      name: '大长方形广告',
      description: '大尺寸长方形广告位 (100×40像素，共4000个像素点)，适合复杂图片或详细内容展示',
      size_type: 'rectangle',
      width: 100,
      height: 40,
      price: 10000,
      active: true
    },
    {
      name: '小正方形广告',
      description: '小尺寸正方形广告位 (16×16像素，共256个像素点)，适合Logo或简单图案展示',
      size_type: 'square',
      width: 16,
      height: 16,
      price: 1500,
      active: true
    },
    {
      name: '大正方形广告',
      description: '大尺寸正方形广告位 (64×64像素，共4096个像素点)，适合复杂图案或详细设计展示',
      size_type: 'square',
      width: 64,
      height: 64,
      price: 8000,
      active: true
    }
  ];
  
  await knex('ad_products').insert(adProducts);
  console.log('✅ ad_products: 插入了 4 条广告商品记录');
};
