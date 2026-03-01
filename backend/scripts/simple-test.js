const axios = require('axios');

async function simpleTest() {
  try {
    console.log('🧪 简单测试API...\n');
    
    const response = await axios.get('http://localhost:3001/api/store-payment/items');
    
    if (response.data.ok && response.data.data) {
      const items = response.data.data;
      console.log(`📦 商品总数: ${items.length}`);
      
      // 查找广告商品
      const adItems = items.filter(item => {
        return item.item_type === 'advertisement' || 
               item.type === 'advertisement' ||
               (item.id && item.id.toString().startsWith('ad_'));
      });
      
      console.log(`\n📢 找到 ${adItems.length} 个广告商品:`);
      adItems.forEach(item => {
        console.log(`  ${item.name}: ${item.price_points || item.price || 0} 积分`);
      });
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

simpleTest();
