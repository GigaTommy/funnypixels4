/**
 * 检查PostgreSQL数据库中是否已安装PostGIS扩展
 */

const { db: knex } = require('../src/config/database');

async function checkPostGIS() {
    console.log('🔍 检查PostGIS安装状态...\n');

    try {
        // 测试数据库连接
        console.log('📡 测试数据库连接...');
        await knex.raw('SELECT 1');
        console.log('✅ 数据库连接成功\n');

        // 检查PostGIS版本
        console.log('🗺️  检查PostGIS扩展...');
        try {
            const versionResult = await knex.raw('SELECT PostGIS_Version() as version');
            const version = versionResult.rows[0].version;
            console.log(`✅ PostGIS已安装！版本: ${version}\n`);

            // 检查PostGIS相关函数是否可用
            console.log('🧪 测试PostGIS核心函数...');

            // 测试1: ST_MakePoint
            await knex.raw('SELECT ST_MakePoint(113.3376, 23.1489) as point');
            console.log('   ✅ ST_MakePoint - 可用');

            // 测试2: ST_GeomFromGeoJSON
            const testGeoJSON = JSON.stringify({
                type: "Polygon",
                coordinates: [[[113.33, 23.14], [113.34, 23.14], [113.34, 23.15], [113.33, 23.15], [113.33, 23.14]]]
            });
            await knex.raw('SELECT ST_GeomFromGeoJSON(?) as geom', [testGeoJSON]);
            console.log('   ✅ ST_GeomFromGeoJSON - 可用');

            // 测试3: ST_Contains
            await knex.raw(`
                SELECT ST_Contains(
                    ST_GeomFromGeoJSON(?),
                    ST_SetSRID(ST_MakePoint(113.335, 23.145), 4326)
                ) as contains
            `, [testGeoJSON]);
            console.log('   ✅ ST_Contains - 可用');

            // 检查是否已有PostGIS几何列
            console.log('\n📊 检查events表结构...');
            const tableInfo = await knex.raw(`
                SELECT
                    column_name,
                    data_type,
                    udt_name
                FROM information_schema.columns
                WHERE table_name = 'events'
                AND column_name IN ('boundary', 'boundary_geom', 'center_geom')
                ORDER BY column_name
            `);

            if (tableInfo.rows.length > 0) {
                console.log('   当前events表中的空间相关列:');
                tableInfo.rows.forEach(row => {
                    const isGeometry = row.udt_name === 'geometry';
                    const icon = isGeometry ? '🗺️' : '📝';
                    console.log(`   ${icon} ${row.column_name}: ${row.data_type} (${row.udt_name})`);
                });
            } else {
                console.log('   ⚠️  未找到空间相关列');
            }

            // 检查空间索引
            console.log('\n🔍 检查空间索引...');
            const indexInfo = await knex.raw(`
                SELECT
                    indexname,
                    indexdef
                FROM pg_indexes
                WHERE tablename = 'events'
                AND (indexname LIKE '%geom%' OR indexdef LIKE '%GIST%')
            `);

            if (indexInfo.rows.length > 0) {
                console.log('   已创建的空间索引:');
                indexInfo.rows.forEach(row => {
                    console.log(`   ✅ ${row.indexname}`);
                });
            } else {
                console.log('   ⚠️  未找到空间索引（GiST）');
            }

            // 检查是否有boundary数据
            console.log('\n📈 检查现有数据...');
            const [boundaryCount] = await knex('events')
                .whereNotNull('boundary')
                .count('* as count');

            console.log(`   包含boundary的活动数: ${boundaryCount.count}`);

            if (tableInfo.rows.some(r => r.column_name === 'boundary_geom')) {
                const [geomCount] = await knex('events')
                    .whereNotNull('boundary_geom')
                    .count('* as count');
                console.log(`   已迁移到boundary_geom的活动数: ${geomCount.count}`);
            }

            // 总结
            console.log('\n' + '='.repeat(60));
            console.log('📋 PostGIS状态总结');
            console.log('='.repeat(60));

            const hasGeomColumn = tableInfo.rows.some(r => r.column_name === 'boundary_geom');
            const hasIndex = indexInfo.rows.length > 0;
            const needsMigration = parseInt(boundaryCount.count) > 0 && !hasGeomColumn;

            if (hasGeomColumn && hasIndex) {
                console.log('✅ PostGIS扩展: 已安装并可用');
                console.log('✅ 几何列: 已创建');
                console.log('✅ 空间索引: 已创建');
                console.log('\n🎉 PostGIS已完全配置，可直接使用！');
            } else if (!hasGeomColumn) {
                console.log('✅ PostGIS扩展: 已安装并可用');
                console.log('⚠️  几何列: 未创建');
                console.log('⚠️  空间索引: 未创建');
                console.log(`\n📝 下一步: 运行数据库迁移`);
                console.log('   cd backend && npm run migrate:latest');
                if (needsMigration) {
                    console.log('   然后运行数据迁移脚本: node scripts/migrate-to-postgis.js');
                }
            } else if (!hasIndex) {
                console.log('✅ PostGIS扩展: 已安装并可用');
                console.log('✅ 几何列: 已创建');
                console.log('⚠️  空间索引: 未创建');
                console.log('\n📝 下一步: 创建空间索引以提升性能');
            }

        } catch (err) {
            console.log('❌ PostGIS未安装或未启用\n');
            console.log('错误信息:', err.message);
            console.log('\n📝 安装PostGIS步骤:');
            console.log('   1. 连接到数据库:');
            console.log('      psql -h localhost -p 5432 -U postgres -d funnypixels_postgres');
            console.log('   2. 启用PostGIS扩展:');
            console.log('      CREATE EXTENSION IF NOT EXISTS postgis;');
            console.log('      CREATE EXTENSION IF NOT EXISTS postgis_topology;');
            console.log('   3. 验证安装:');
            console.log('      SELECT PostGIS_Version();');
        }

    } catch (error) {
        console.error('❌ 数据库连接失败:', error.message);
        console.log('\n请检查:');
        console.log('   1. PostgreSQL服务是否运行');
        console.log('   2. 数据库配置是否正确 (knexfile.js)');
        console.log('   3. 数据库 funnypixels_postgres 是否存在');
    } finally {
        await knex.destroy();
    }
}

// 执行检查
checkPostGIS().catch(console.error);
