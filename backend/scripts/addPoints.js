const knex = require('knex');

// 直接配置数据库连接，不依赖Redis
const db = knex({
  client: 'postgresql',
  connection: {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password',
    database: 'funnypixels_postgres'
  }
});

async function addPoints() {
  try {
    console.log('💰 开始给用户充值积分...');
    
    // 1. 查找用户
    const user = await db('users').where('username', 'buyer').first();
    
    if (!user) {
      console.log('❌ 用户 buyer 不存在，请先创建用户');
      return;
    }
    
    console.log('✅ 找到用户:', user.username, 'ID:', user.id);
    
    // 2. 检查用户积分记录是否存在
    let userPoints = await db('user_points').where('user_id', user.id).first();
    
    if (!userPoints) {
      console.log('创建用户积分记录...');
      await db('user_points').insert({
        user_id: user.id,
        total_points: 0
      });
      userPoints = { total_points: 0 };
    }
    
    console.log('当前积分:', userPoints.total_points);
    
    // 3. 充值积分
    const addPoints = 1000; // 充值1000积分
    const newTotal = userPoints.total_points + addPoints;
    
    await db('user_points')
      .where('user_id', user.id)
      .update({ total_points: newTotal });
    
    // 4. 记录到账本
    await db('wallet_ledger').insert({
      user_id: user.id,
      delta_points: addPoints,
      reason: '管理员充值',
      ref_id: 'admin_recharge'
    });
    
    // 5. 验证结果
    const updatedPoints = await db('user_points').where('user_id', user.id).first();
    
    console.log('✅ 充值成功！');
    console.log(`积分变化: ${userPoints.total_points} → ${updatedPoints.total_points} (+${addPoints})`);
    
  } catch (error) {
    console.error('❌ 充值失败:', error);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

addPoints();
