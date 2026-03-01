/**
 * 检查联盟旗帜初始化状态
 */

const { db } = require('./src/config/database');

async function checkAllianceFlags() {
  try {
    console.log('🔍 检查联盟旗帜初始化状态...\n');

    const alliances = await db('alliances')
      .select('id', 'name', 'flag_payload', 'color', 'created_at')
      .limit(20);

    console.log(`📊 找到 ${alliances.length} 个联盟:\n`);

    let withoutFlag = 0;
    let withFlag = 0;

    for (const alliance of alliances) {
      const hasFlag = !!alliance.flag_payload && alliance.flag_payload.length > 0;
      if (hasFlag) {
        withFlag++;
        console.log(`✅ [${alliance.id}] ${alliance.name}`);
        console.log(`   旗帜: ${alliance.flag_payload.substring(0, 50)}...`);
        console.log(`   颜色: ${alliance.color || 'N/A'}\n`);
      } else {
        withoutFlag++;
        console.log(`❌ [${alliance.id}] ${alliance.name}`);
        console.log(`   旗帜: 未初始化`);
        console.log(`   颜色: ${alliance.color || 'N/A'}\n`);
      }
    }

    console.log('\n📈 统计:');
    console.log(`   有旗帜: ${withFlag}`);
    console.log(`   无旗帜: ${withoutFlag}`);

    // 检查是否有需要初始化的联盟
    if (withoutFlag > 0) {
      console.log('\n⚠️  发现没有旗帜的联盟，需要初始化');
    } else {
      console.log('\n✅ 所有联盟都已初始化旗帜');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ 检查失败:', error);
    process.exit(1);
  }
}

checkAllianceFlags();
