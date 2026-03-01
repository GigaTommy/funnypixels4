#!/usr/bin/env node

/**
 * 验证迁移文件完整性
 * 确保所有迁移文件都存在且格式正确
 */

const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function verifyMigrationFiles() {
  try {
    log('🔍 开始验证迁移文件完整性...', 'blue');
    
    // 获取迁移文件目录
    const migrationsDir = path.join(__dirname, '../src/database/migrations');
    
    // 读取所有迁移文件
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.js'))
      .sort();
    
    log(`📊 发现 ${migrationFiles.length} 个迁移文件`, 'blue');
    
    // 检查特定问题迁移文件
    const requiredMigrations = [
      '20250108_add_grid_id_unique_constraint.js',
      '20250908_add_avatar_field_to_users.js',
      '20250108_create_pixels_history_partitioned.js'
    ];
    
    log('\n1️⃣ 检查特定问题迁移文件...', 'cyan');
    let allRequiredExist = true;
    
    requiredMigrations.forEach(migration => {
      const exists = migrationFiles.includes(migration);
      if (exists) {
        log(`✅ ${migration} - 存在`, 'green');
      } else {
        log(`❌ ${migration} - 缺失`, 'red');
        allRequiredExist = false;
      }
    });
    
    // 验证迁移文件格式
    log('\n2️⃣ 验证迁移文件格式...', 'cyan');
    let allValid = true;
    
    migrationFiles.forEach(file => {
      const filePath = path.join(migrationsDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // 检查是否包含必要的导出
        if (!content.includes('exports.up') || !content.includes('exports.down')) {
          log(`❌ ${file} - 缺少必要的导出函数`, 'red');
          allValid = false;
        } else {
          log(`✅ ${file} - 格式正确`, 'green');
        }
      } catch (error) {
        log(`❌ ${file} - 读取失败: ${error.message}`, 'red');
        allValid = false;
      }
    });
    
    // 检查重复的迁移文件
    log('\n3️⃣ 检查重复的迁移文件...', 'cyan');
    const duplicates = [];
    const seen = new Set();
    
    migrationFiles.forEach(file => {
      if (seen.has(file)) {
        duplicates.push(file);
      } else {
        seen.add(file);
      }
    });
    
    if (duplicates.length > 0) {
      log('⚠️ 发现重复的迁移文件:', 'yellow');
      duplicates.forEach(file => {
        log(`  ❌ ${file}`, 'red');
      });
    } else {
      log('✅ 没有重复的迁移文件', 'green');
    }
    
    // 显示所有迁移文件列表
    log('\n4️⃣ 所有迁移文件列表:', 'cyan');
    log('┌─────────────────────────────────────────────────────────────────┐', 'blue');
    log('│ 迁移文件名                                                    │', 'blue');
    log('├─────────────────────────────────────────────────────────────────┤', 'blue');
    
    migrationFiles.forEach(file => {
      const name = file.padEnd(65);
      log(`│ ${name} │`, 'blue');
    });
    
    log('└─────────────────────────────────────────────────────────────────┘', 'blue');
    
    // 总结
    log('\n📋 验证总结:', 'cyan');
    log(`✅ 迁移文件总数: ${migrationFiles.length}`, 'green');
    log(`✅ 特定问题迁移: ${allRequiredExist ? '完整' : '缺失'}`, allRequiredExist ? 'green' : 'red');
    log(`✅ 文件格式验证: ${allValid ? '通过' : '失败'}`, allValid ? 'green' : 'red');
    log(`✅ 重复文件检查: ${duplicates.length === 0 ? '通过' : '发现重复'}`, duplicates.length === 0 ? 'green' : 'yellow');
    
    if (allRequiredExist && allValid && duplicates.length === 0) {
      log('\n🎉 所有迁移文件验证通过！', 'green');
      log('✅ 生产环境部署应该能够成功', 'green');
    } else {
      log('\n⚠️ 迁移文件验证发现问题，需要修复', 'yellow');
    }
    
  } catch (error) {
    log(`\n❌ 验证失败: ${error.message}`, 'red');
  }
}

// 执行验证
verifyMigrationFiles();
