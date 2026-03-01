#!/usr/bin/env node
/**
 * 生成测试用户数据
 *
 * 使用方式:
 * node generate-test-users.js --count 1000 --output test-users.json
 */

const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

program
  .option('--count <number>', 'Number of test users to generate', '100')
  .option('--prefix <string>', 'User ID prefix', 'load_test_')
  .option('--output <file>', 'Output file path', '../data/test-users.json')
  .option('--csv', 'Also generate CSV file', false)
  .option('--db-insert', 'Generate SQL INSERT statements', false)
  .parse(process.argv);

const options = program.opts();

// ==================== 数据生成 ====================

function generateUsers(count, prefix) {
  console.log(`Generating ${count} test users...`);

  const users = [];
  const password = 'TestPassword123!'; // 统一密码
  const hashedPassword = bcrypt.hashSync(password, 10);

  for (let i = 0; i < count; i++) {
    const userId = crypto.randomUUID();
    const username = `${prefix}${i}`;
    const user = {
      id: userId,
      email: `${username}@loadtest.example.com`,
      username: username,
      password: password, // 明文密码（仅用于测试）
      hashedPassword: hashedPassword,
      token: generateToken(userId),
      createdAt: new Date().toISOString(),
    };
    users.push(user);

    if ((i + 1) % 100 === 0) {
      console.log(`  Generated ${i + 1}/${count} users...`);
    }
  }

  console.log(`✓ Generated ${count} users`);
  return users;
}

function generateToken(userId) {
  // 简单的测试Token（实际应该使用JWT）
  return Buffer.from(`${userId}:${Date.now()}`).toString('base64');
}

// ==================== 文件输出 ====================

function saveJSON(users, outputPath) {
  const absolutePath = path.resolve(__dirname, outputPath);
  const dir = path.dirname(absolutePath);

  // 确保目录存在
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(absolutePath, JSON.stringify(users, null, 2));
  console.log(`✓ Saved JSON to: ${absolutePath}`);
  console.log(`  File size: ${(fs.statSync(absolutePath).size / 1024).toFixed(2)} KB`);
}

function saveCSV(users, outputPath) {
  const csvPath = outputPath.replace('.json', '.csv');
  const absolutePath = path.resolve(__dirname, csvPath);

  // CSV header
  let csv = 'userId,email,username,password,token\n';

  // CSV rows
  users.forEach(user => {
    csv += `${user.id},${user.email},${user.username},${user.password},${user.token}\n`;
  });

  fs.writeFileSync(absolutePath, csv);
  console.log(`✓ Saved CSV to: ${absolutePath}`);
  console.log(`  File size: ${(fs.statSync(absolutePath).size / 1024).toFixed(2)} KB`);
}

function generateSQLInserts(users, outputPath) {
  const sqlPath = outputPath.replace('.json', '.sql');
  const absolutePath = path.resolve(__dirname, sqlPath);

  let sql = '-- Generated test users\n';
  sql += '-- Run this SQL to insert test users into the database\n\n';
  sql += 'BEGIN;\n\n';

  users.forEach(user => {
    sql += `INSERT INTO users (id, email, username, password_hash, role, created_at, updated_at)\n`;
    sql += `VALUES ('${user.id}', '${user.email}', '${user.username}', '${user.hashedPassword}', 'user', NOW(), NOW())\n`;
    sql += `ON CONFLICT (email) DO NOTHING;\n\n`;

    // 初始化用户像素状态
    sql += `INSERT INTO user_pixel_states (user_id, pixel_points, item_pixel_points, natural_pixel_points, max_natural_pixel_points, freeze_until, created_at, updated_at)\n`;
    sql += `VALUES ('${user.id}', 100, 0, 100, 64, 0, NOW(), NOW())\n`;
    sql += `ON CONFLICT DO NOTHING;\n\n`;
  });

  sql += 'COMMIT;\n';

  fs.writeFileSync(absolutePath, sql);
  console.log(`✓ Saved SQL to: ${absolutePath}`);
  console.log(`  File size: ${(fs.statSync(absolutePath).size / 1024).toFixed(2)} KB`);
}

// ==================== 主程序 ====================

function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║            FunnyPixels Test Users Generator                  ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Configuration:`);
  console.log(`  User Count:      ${options.count}`);
  console.log(`  ID Prefix:       ${options.prefix}`);
  console.log(`  Output File:     ${options.output}`);
  console.log(`  Generate CSV:    ${options.csv}`);
  console.log(`  Generate SQL:    ${options.dbInsert}`);
  console.log('');

  // 生成用户
  const users = generateUsers(parseInt(options.count), options.prefix);

  // 保存为JSON
  saveJSON(users, options.output);

  // 可选: 保存为CSV
  if (options.csv) {
    saveCSV(users, options.output);
  }

  // 可选: 生成SQL插入语句
  if (options.dbInsert) {
    generateSQLInserts(users, options.output);
  }

  // 输出使用示例
  console.log('');
  console.log('Usage Examples:');
  console.log('');
  console.log('1. Import to database (if SQL generated):');
  console.log(`   psql -U postgres -d funnypixels_test -f ${options.output.replace('.json', '.sql')}`);
  console.log('');
  console.log('2. Use in k6 tests:');
  console.log(`   k6 run --env TEST_USERS_FILE=${options.output} canvas-draw-load.js`);
  console.log('');
  console.log('3. Use in Artillery tests:');
  console.log(`   artillery run -p ${options.output.replace('.json', '.csv')} canvas-scenario.yml`);
  console.log('');
  console.log('4. Use in Node.js simulator:');
  console.log(`   node realistic-user-simulator.js --users 100`);
  console.log('');

  console.log('✓ Generation completed!');
}

main();
