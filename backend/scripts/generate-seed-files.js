#!/usr/bin/env node

/**
 * 根据导出的数据生成新的seed文件
 * 使用方法: node scripts/generate-seed-files.js
 */

const fs = require('fs');
const path = require('path');

// 读取导出的数据
const exportDataPath = path.join(__dirname, '../data-export/seed-data-export.json');
const exportData = JSON.parse(fs.readFileSync(exportDataPath, 'utf8'));

// 表依赖关系（按顺序生成seed文件）
const tableOrder = [
  'regions',
  'users', 
  'alliances',
  'pattern_assets',
  'store_items',
  'shop_skus',
  'achievements',
  'advertisements',
  'user_points',
  'user_inventory',
  'user_items',
  'user_pixel_states',
  'pixels',
  'alliance_members',
  'alliance_applications',
  'user_achievements',
  'user_ad_credits',
  'user_shares',
  'chat_messages',
  'notifications',
  'recharge_orders',
  'wallet_ledger'
];

// 需要特殊处理的表（包含敏感信息或需要清理的字段）
const sensitiveTables = ['users', 'recharge_orders', 'wallet_ledger'];
const skipTables = ['knex_migrations', 'knex_migrations_lock', 'idempotency_keys'];

function cleanSensitiveData(data, tableName) {
  if (tableName === 'users') {
    return data.map(user => ({
      ...user,
      password_hash: '$2a$10$test.hash.for.testing.purposes.only', // 测试密码
      email: user.email.replace(/@.*/, '@example.com'), // 清理邮箱
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
  }
  
  if (tableName === 'recharge_orders') {
    return data.map(order => ({
      ...order,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
  }
  
  if (tableName === 'wallet_ledger') {
    return data.map(entry => ({
      ...entry,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
  }
  
  return data;
}

function generateSeedFile(tableName, data) {
  if (!data || data.length === 0) {
    return `// ${tableName} - 无数据
exports.seed = async function(knex) {
  // 清空现有数据
  await knex('${tableName}').del();
  console.log('✅ ${tableName} 表已清空（无种子数据）');
};`;
  }

  const cleanedData = cleanSensitiveData(data, tableName);
  
  return `// ${tableName} 种子数据
exports.seed = async function(knex) {
  // 清空现有数据
  await knex('${tableName}').del();
  
  // 插入种子数据
  await knex('${tableName}').insert(${JSON.stringify(cleanedData, null, 2)});
  
  console.log('✅ ${tableName}: 插入了 ${cleanedData.length} 条记录');
};`;
}

function generateSeedFiles() {
  console.log('🔄 开始生成seed文件...');
  
  // 确保seeds目录存在
  const seedsDir = path.join(__dirname, '../src/database/seeds');
  if (!fs.existsSync(seedsDir)) {
    fs.mkdirSync(seedsDir, { recursive: true });
  }
  
  // 备份现有seed文件
  const backupDir = path.join(seedsDir, 'backup-' + new Date().toISOString().replace(/[:.]/g, '-'));
  if (fs.existsSync(seedsDir)) {
    const existingFiles = fs.readdirSync(seedsDir).filter(f => f.endsWith('.js'));
    if (existingFiles.length > 0) {
      fs.mkdirSync(backupDir, { recursive: true });
      existingFiles.forEach(file => {
        fs.copyFileSync(
          path.join(seedsDir, file),
          path.join(backupDir, file)
        );
      });
      console.log(`📁 现有seed文件已备份到: ${backupDir}`);
    }
  }
  
  // 生成新的seed文件
  let fileIndex = 1;
  
  for (const tableName of tableOrder) {
    if (skipTables.includes(tableName)) {
      continue;
    }
    
    const data = exportData[tableName];
    const seedContent = generateSeedFile(tableName, data);
    
    const fileName = `${String(fileIndex).padStart(3, '0')}_${tableName}.js`;
    const filePath = path.join(seedsDir, fileName);
    
    fs.writeFileSync(filePath, seedContent);
    console.log(`✅ 生成: ${fileName}`);
    
    fileIndex++;
  }
  
  // 生成主seed文件
  const mainSeedContent = `// 主种子文件 - 按依赖关系运行所有种子
exports.seed = async function(knex) {
  console.log('🌱 开始运行所有种子数据...');
  
  // 按依赖关系运行种子文件
  const seedFiles = [
${tableOrder.filter(t => !skipTables.includes(t)).map((tableName, index) => 
    `    require('./${String(index + 1).padStart(3, '0')}_${tableName}.js').seed(knex)`
  ).join(',\n')}
  ];
  
  for (const seedFunction of seedFiles) {
    await seedFunction;
  }
  
  console.log('🎉 所有种子数据运行完成!');
};`;

  fs.writeFileSync(path.join(seedsDir, '000_main_seed.js'), mainSeedContent);
  
  console.log('\n✅ Seed文件生成完成!');
  console.log(`📁 文件位置: ${seedsDir}`);
  console.log(`📊 生成了 ${tableOrder.filter(t => !skipTables.includes(t)).length + 1} 个文件`);
  console.log(`📁 备份位置: ${backupDir}`);
}

// 运行生成
if (require.main === module) {
  generateSeedFiles();
}

module.exports = { generateSeedFiles };
