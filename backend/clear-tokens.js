const knex = require('knex')({
  client: 'postgresql',
  connection: {
    host: 'localhost',
    port: 5432,
    database: 'funnypixels_postgres',
    user: 'postgres',
    password: 'password'
  }
});

console.log('🗑️  清空设备令牌表...');

knex('device_tokens')
  .del()
  .then(count => {
    console.log(`✅ 已删除 ${count} 个设备令牌`);
    console.log('');
    console.log('📱 请在 iPhone 上重新启动 FunnyPixels App');
    console.log('   App 会自动注册新的设备令牌');
    console.log('');
    console.log('然后运行:');
    console.log('  node test-push.js $(node simple-query.js)');
    knex.destroy();
  })
  .catch(err => {
    console.error('删除失败:', err.message);
    knex.destroy();
    process.exit(1);
  });
