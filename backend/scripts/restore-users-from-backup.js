// backend/scripts/restore-users-from-backup.js
/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const knex = require('knex')({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'funnypixels_postgres',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  },
  pool: { min: 0, max: 10 }
});

async function main() {
  // 允许从 .json 或 .js 读取
  const backupBase = process.argv[2] || path.join(__dirname, '..', 'data-export', '20250914_001_funnypixels_postgres_backup.json');
  let backup;
  if (backupBase.endsWith('.js')) {
    // CommonJS 导出
    // eslint-disable-next-line import/no-dynamic-require, global-require
    backup = require(backupBase);
  } else {
    const raw = fs.readFileSync(backupBase, 'utf8');
    backup = JSON.parse(raw);
  }

  const usersSection = backup.tables?.users;
  if (!usersSection?.data || !Array.isArray(usersSection.data)) {
    throw new Error('未在备份中找到 users 表数据');
  }

  const rows = usersSection.data;

  // 可选：是否清空后再导入（谨慎）
  const shouldTruncate = (process.env.TRUNCATE_USERS || 'false').toLowerCase() === 'true';

  await knex.transaction(async (trx) => {
    if (shouldTruncate) {
      // 先解除依赖（如有外键依赖 users），这里简单处理，复杂依赖请按需调整
      await trx.raw('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    }

    // 针对唯一约束，采用 upsert（email 唯一 + username 唯一）
    // 注意：确保目标库 PostgreSQL 版本支持 ON CONFLICT
    for (const r of rows) {
      // 只传入备份中存在的列，避免不存在列导致报错
      const payload = { ...r };

      // 如果目标库有与备份不同的默认函数（例如 uuid_generate_v4 vs gen_random_uuid）不影响这里，因为我们带 id 插入
      await trx('users')
        .insert(payload)
        .onConflict(['email']) // 以 email 作为主冲突键；如需更稳妥，可改为 ['id'] 或创建复合策略
        .merge();
    }
  });

  console.log(`✅ 已导入/更新 users 表 ${rows.length} 行`);
}

main()
  .catch((err) => {
    console.error('❌ 恢复失败:', err);
    process.exit(1);
  })
  .finally(() => {
    knex.destroy();
  });