/**
 * 测试联盟旗帜 API
 */

const jwt = require('jsonwebtoken');
const { db } = require('./src/config/database');

async function testFlagAPI() {
  try {
    // 获取一个测试用户
    const user = await db('users').first();
    if (!user) {
      console.log('❌ 数据库中没有用户');
      process.exit(1);
    }

    console.log('📋 使用用户:', user.email || user.username);

    // 创建token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1h' }
    );

    const response = await fetch('http://localhost:3001/api/alliances/flag-patterns', {
      headers: { 'Authorization': 'Bearer ' + token }
    });

    const data = await response.json();

    if (data.success && data.patterns) {
      console.log('\n✅ API 响应成功');
      console.log('\n📊 颜色旗帜数量:', data.patterns.colors?.length || 0);
      console.log('📊 Emoji旗帜数量:', data.patterns.emojis?.length || 0);
      console.log('📊 总数量:', data.total || 0);

      if (data.patterns.colors && data.patterns.colors.length > 0) {
        console.log('\n✅ 示例颜色旗帜:');
        const c = data.patterns.colors[0];
        console.log('  key:', c.key);
        console.log('  name:', c.name);
        console.log('  color:', c.color);
        console.log('  category:', c.category);
        console.log('  unicode_char:', c.unicode_char);
      }

      if (data.patterns.emojis && data.patterns.emojis.length > 0) {
        console.log('\n✅ 示例Emoji旗帜:');
        const e = data.patterns.emojis[0];
        console.log('  key:', e.key);
        console.log('  name:', e.name);
        console.log('  color:', e.color);
        console.log('  category:', e.category);
        console.log('  unicode_char:', e.unicode_char);
      }

      console.log('\n✅ Web前端和iOS端联盟创建界面应该可以正常显示旗帜信息');
    } else {
      console.log('\n❌ API 响应失败:', JSON.stringify(data, null, 2));
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

testFlagAPI();
