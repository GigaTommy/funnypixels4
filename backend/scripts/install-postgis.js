#!/usr/bin/env node

/**
 * 在生产环境安装PostGIS扩展
 */

const fs = require('fs');
const path = require('path');
const knex = require('knex');

async function installPostGIS() {
  console.log('🔧 在生产环境安装PostGIS扩展...');

  // 生产环境配置
  let productionConfig = {
    client: 'postgresql',
    connection: {
      host: process.env.PROD_DB_HOST || 'localhost',
      port: process.env.PROD_DB_PORT || 5432,
      user: process.env.PROD_DB_USER || 'postgres',
      password: process.env.PROD_DB_PASSWORD || '',
      database: process.env.PROD_DB_NAME || 'funnypixels_prod',
      ssl: process.env.PROD_DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    }
  };

  const prodConfigPath = path.join(__dirname, '../config/production-database.json');
  if (fs.existsSync(prodConfigPath)) {
    const prodConfig = JSON.parse(fs.readFileSync(prodConfigPath, 'utf8'));
    productionConfig = {
      client: 'postgresql',
      connection: {
        host: prodConfig.database.host,
        port: prodConfig.database.port,
        user: prodConfig.database.user,
        password: prodConfig.database.password,
        database: prodConfig.database.database,
        ssl: prodConfig.database.ssl ? { rejectUnauthorized: false } : false
      }
    };
  }

  const db = knex(productionConfig);

  try {
    console.log('\n📋 1. 检查PostgreSQL版本...');
    const version = await db.raw('SELECT version()');
    console.log(`PostgreSQL版本: ${version.rows[0].version}`);

    console.log('\n📋 2. 检查PostGIS可用性...');
    try {
      const availableExtensions = await db.raw(`
        SELECT name, default_version, installed_version
        FROM pg_available_extensions
        WHERE name = 'postgis'
      `);

      if (availableExtensions.rows.length > 0) {
        const postgis = availableExtensions.rows[0];
        console.log(`PostGIS可用版本: ${postgis.default_version}`);
        console.log(`PostGIS已安装版本: ${postgis.installed_version || '未安装'}`);
      } else {
        console.log('❌ PostGIS扩展不可用，需要先在系统级别安装PostGIS包');
        return false;
      }
    } catch (error) {
      console.log('⚠️  无法查询可用扩展，可能权限不足');
    }

    console.log('\n📋 3. 检查PostGIS是否已安装...');
    const installedExtensions = await db.raw(`
      SELECT extname, extversion
      FROM pg_extension
      WHERE extname = 'postgis'
    `);

    if (installedExtensions.rows.length > 0) {
      console.log(`✅ PostGIS已安装，版本: ${installedExtensions.rows[0].extversion}`);
    } else {
      console.log('📋 4. 安装PostGIS扩展...');

      try {
        await db.raw('CREATE EXTENSION IF NOT EXISTS postgis');
        console.log('✅ PostGIS扩展安装成功');
      } catch (error) {
        console.error('❌ PostGIS安装失败:', error.message);

        if (error.message.includes('permission denied')) {
          console.log('\n💡 解决方案:');
          console.log('1. 请使用超级用户权限连接数据库');
          console.log('2. 或者联系数据库管理员安装PostGIS扩展');
          console.log('3. 手动执行: CREATE EXTENSION IF NOT EXISTS postgis;');
        }

        return false;
      }
    }

    console.log('\n📋 5. 验证PostGIS安装...');
    try {
      const postgisVersion = await db.raw('SELECT PostGIS_Version() as version');
      console.log(`✅ PostGIS版本: ${postgisVersion.rows[0].version}`);
    } catch (error) {
      console.error('❌ PostGIS验证失败:', error.message);
      return false;
    }

    console.log('\n📋 6. 测试空间功能...');
    try {
      const pointTest = await db.raw("SELECT ST_AsText(ST_Point(116.4074, 39.9042)) as point");
      console.log(`✅ 空间点测试: ${pointTest.rows[0].point}`);
    } catch (error) {
      console.error('❌ 空间功能测试失败:', error.message);
      return false;
    }

    console.log('\n📋 7. 检查空间参考系统...');
    try {
      const srsTest = await db.raw(`
        SELECT auth_name, auth_srid, COUNT(*) as count
        FROM spatial_ref_sys
        WHERE auth_srid = 4326
        GROUP BY auth_name, auth_srid
      `);

      if (srsTest.rows.length > 0) {
        console.log(`✅ WGS84坐标系 (EPSG:4326) 可用`);
      } else {
        console.log('⚠️  WGS84坐标系不可用');
      }
    } catch (error) {
      console.log('⚠️  无法检查空间参考系统:', error.message);
    }

    console.log('\n📋 8. 显示已安装的空间扩展...');
    try {
      const extensions = await db.raw(`
        SELECT e.extname, e.extversion, n.nspname
        FROM pg_extension e
        JOIN pg_namespace n ON e.extnamespace = n.oid
        WHERE e.extname LIKE 'postgis%'
      `);

      console.log('已安装的PostGIS相关扩展:');
      extensions.rows.forEach(ext => {
        console.log(`  ${ext.extname} v${ext.extversion} (schema: ${ext.nspname})`);
      });
    } catch (error) {
      console.log('⚠️  无法列出扩展:', error.message);
    }

    console.log('\n✅ PostGIS安装验证完成！');
    return true;

  } catch (error) {
    console.error('❌ PostGIS安装失败:', error.message);
    console.error('📄 错误详情:', error);
    return false;
  } finally {
    await db.destroy();
  }
}

// 执行安装
if (require.main === module) {
  installPostGIS()
    .then(success => {
      if (success) {
        console.log('\n🎉 PostGIS安装成功！现在可以使用空间查询功能。');
        process.exit(0);
      } else {
        console.log('\n❌ PostGIS安装失败！请检查权限和系统配置。');
        process.exit(1);
      }
    });
}

module.exports = { installPostGIS };