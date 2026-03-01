const { db } = require('../src/config/database');

async function addAdvertisementItems() {
  try {
    console.log('📢 添加广告商品...');
    
    const adItems = [
      {
        name: '广告投放额度',
        description: '获得1次广告投放机会，支持多种尺寸选择 (16×16到100×40像素)，可在指定区域展示广告，有效期7天',
        price_points: 200,
        item_type: 'advertisement',
        category: 'advertisement',
        metadata: {
          ad_type: 'single_use',
          duration_hours: 168, // 7天
          max_size: '100x40',
          min_size: '16x16',
          features: ['basic_targeting', 'schedule', 'size_selection']
        }
      },
      {
        name: '高级广告套餐',
        description: '获得5次广告投放机会，支持大尺寸广告 (最大100×40像素，共4000个像素点)，可在多个区域展示广告，有效期30天',
        price_points: 800,
        item_type: 'advertisement',
        category: 'advertisement',
        metadata: {
          ad_type: 'multi_use',
          uses: 5,
          duration_hours: 720, // 30天
          max_size: '100x40',
          min_size: '16x16',
          features: ['advanced_targeting', 'schedule', 'analytics', 'priority', 'size_selection']
        }
      },
      {
        name: '联盟广告包',
        description: '联盟专用广告包，10次投放机会，支持超大尺寸广告 (最大100×40像素，共4000个像素点)，支持联盟品牌展示',
        price_points: 1500,
        item_type: 'advertisement',
        category: 'advertisement',
        metadata: {
          ad_type: 'alliance_package',
          uses: 10,
          duration_hours: 1440, // 60天
          max_size: '100x40',
          min_size: '16x16',
          features: ['alliance_branding', 'advanced_targeting', 'schedule', 'analytics', 'priority', 'custom_pattern', 'size_selection']
        }
      }
    ];
    
    for (const item of adItems) {
      await db('store_items').insert({
        ...item,
        price: item.price_points,
        currency_type: 'points',
        is_available: true,
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      });
      console.log(`✅ 添加广告商品: ${item.name} (${item.price_points} 积分)`);
    }
    
    console.log('\n🎉 所有广告商品添加完成！');
    
    // 显示所有广告商品
    const allAds = await db('store_items')
      .where('item_type', 'advertisement')
      .select('id', 'name', 'description', 'price_points', 'metadata');
    
    console.log('\n📋 当前广告商品列表:');
    allAds.forEach(ad => {
      console.log(`  ${ad.id}. ${ad.name}: ${ad.description}`);
      console.log(`     价格: ${ad.price_points} 积分`);
      console.log(`     类型: ${ad.metadata?.ad_type || '未知'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ 添加广告商品失败:', error);
  } finally {
    process.exit(0);
  }
}

addAdvertisementItems();
