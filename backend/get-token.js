require('dotenv').config();
const { db } = require('./src/config/database');

db('device_tokens')
  .where('is_active', true)
  .orderBy('updated_at', 'desc')
  .limit(1)
  .select('device_token', 'platform', 'updated_at')
  .then(tokens => {
    if (tokens.length === 0) {
      console.log('NO_TOKEN');
      process.exit(1);
    }
    // 只输出令牌，不输出其他信息
    console.log(tokens[0].device_token);
    process.exit(0);
  })
  .catch(() => {
    console.log('ERROR');
    process.exit(1);
  });
