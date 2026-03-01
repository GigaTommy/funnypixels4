/**
 * 数据迁移脚本：将现有GeoJSON boundary数据转换为PostGIS geometry格式
 */

const { db: knex } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function migrateToPostGIS() {
    console.log('🚀 开始PostGIS数据迁移...\n');

    try {
        // 1. 获取所有有boundary的events
        const events = await knex('events')
            .whereNotNull('boundary')
            .select('id', 'boundary', 'config');

        console.log(`📊 找到 ${events.length} 个需要迁移的活动\n`);

        if (events.length === 0) {
            console.log('✅ 没有需要迁移的数据');
            return;
        }

        let success = 0;
        let failed = 0;
        const errors = [];

        // 2. 逐个转换
        for (const event of events) {
            try {
                // 解析GeoJSON boundary
                const boundary = typeof event.boundary === 'string'
                    ? JSON.parse(event.boundary)
                    : event.boundary;

                // 验证GeoJSON格式
                if (!boundary || !boundary.type || !boundary.coordinates) {
                    throw new Error('Invalid GeoJSON format');
                }

                // 转换为PostGIS geometry
                await knex.raw(`
                    UPDATE events
                    SET boundary_geom = ST_GeomFromGeoJSON(?)
                    WHERE id = ?
                `, [JSON.stringify(boundary), event.id]);

                // 计算并设置中心点
                const config = typeof event.config === 'string'
                    ? JSON.parse(event.config)
                    : event.config;

                if (config?.area?.center) {
                    const { lat, lng } = config.area.center;
                    await knex.raw(`
                        UPDATE events
                        SET center_geom = ST_SetSRID(ST_MakePoint(?, ?), 4326)
                        WHERE id = ?
                    `, [lng, lat, event.id]);
                } else {
                    // 如果没有center，使用边界的质心
                    await knex.raw(`
                        UPDATE events
                        SET center_geom = ST_Centroid(boundary_geom)
                        WHERE id = ?
                    `, [event.id]);
                }

                // 计算并设置BBox
                await knex.raw(`
                    UPDATE events
                    SET bbox = ST_Envelope(boundary_geom)::box2d
                    WHERE id = ?
                `, [event.id]);

                success++;
                console.log(`✅ [${success}/${events.length}] 迁移成功: ${event.id}`);

            } catch (err) {
                failed++;
                const errorMsg = `迁移失败 ${event.id}: ${err.message}`;
                errors.push(errorMsg);
                console.error(`❌ [${failed}/${events.length}] ${errorMsg}`);
            }
        }

        // 3. 验证数据
        console.log('\n📋 验证迁移数据...');
        const validCount = await knex('events')
            .whereNotNull('boundary_geom')
            .count('* as count')
            .first();

        const centerCount = await knex('events')
            .whereNotNull('center_geom')
            .count('* as count')
            .first();

        const bboxCount = await knex('events')
            .whereNotNull('bbox')
            .count('* as count')
            .first();

        console.log(`   boundary_geom: ${validCount.count} 条记录`);
        console.log(`   center_geom: ${centerCount.count} 条记录`);
        console.log(`   bbox: ${bboxCount.count} 条记录`);

        // 4. 统计信息
        console.log('\n' + '='.repeat(60));
        console.log('📊 迁移统计');
        console.log('='.repeat(60));
        console.log(`   成功: ${success}`);
        console.log(`   失败: ${failed}`);
        console.log(`   总计: ${events.length}`);

        if (errors.length > 0) {
            console.log('\n❌ 错误列表:');
            errors.forEach(err => console.log(`   - ${err}`));
        }

        // 5. 性能测试
        if (success > 0) {
            console.log('\n⏱️  PostGIS性能测试...');
            const testPoint = { lat: 23.1489, lng: 113.3376 };

            // PostGIS查询
            const pgStart = Date.now();
            const pgResult = await knex.raw(`
                SELECT id, title
                FROM events
                WHERE boundary_geom IS NOT NULL
                  AND ST_Contains(
                      boundary_geom,
                      ST_SetSRID(ST_MakePoint(?, ?), 4326)
                  )
                LIMIT 10
            `, [testPoint.lng, testPoint.lat]);
            const pgDuration = Date.now() - pgStart;

            console.log(`   PostGIS查询耗时: ${pgDuration}ms`);
            console.log(`   找到匹配活动: ${pgResult.rows.length} 个`);

            // 验证索引使用情况
            console.log('\n🔍 验证空间索引使用情况...');
            const explainResult = await knex.raw(`
                EXPLAIN (ANALYZE, BUFFERS)
                SELECT id, title
                FROM events
                WHERE boundary_geom IS NOT NULL
                  AND ST_Contains(
                      boundary_geom,
                      ST_SetSRID(ST_MakePoint(?, ?), 4326)
                  )
            `, [testPoint.lng, testPoint.lat]);

            const plan = explainResult.rows.map(r => r['QUERY PLAN']).join('\n');
            const usesIndex = plan.includes('Index Scan') && plan.includes('events_boundary_geom_idx');

            if (usesIndex) {
                console.log('   ✅ GiST空间索引已被使用！');
            } else {
                console.log('   ⚠️  索引未使用，可能需要运行 VACUUM ANALYZE events;');
            }

            // 显示查询计划的关键部分
            const keyLines = plan.split('\n').filter(line =>
                line.includes('Index Scan') ||
                line.includes('Seq Scan') ||
                line.includes('Planning Time') ||
                line.includes('Execution Time')
            );
            if (keyLines.length > 0) {
                console.log('\n   查询计划关键信息:');
                keyLines.forEach(line => console.log(`   ${line.trim()}`));
            }
        }

        console.log('\n' + '='.repeat(60));
        if (failed === 0) {
            console.log('🎉 PostGIS数据迁移完成！所有数据已成功转换。');
        } else {
            console.log(`⚠️  PostGIS数据迁移完成，但有 ${failed} 条记录失败。`);
        }
        console.log('='.repeat(60));

        // 6. 优化建议
        console.log('\n💡 后续优化建议:');
        console.log('   1. 运行 VACUUM ANALYZE 优化索引:');
        console.log('      VACUUM ANALYZE events;');
        console.log('   2. 更新 eventService.js 使用PostGIS查询');
        console.log('   3. 运行性能测试验证提升效果');
        console.log('   4. 监控生产环境的查询性能\n');

    } catch (err) {
        console.error('❌ 迁移失败:', err);
        throw err;
    } finally {
        await knex.destroy();
    }
}

// 执行迁移
if (require.main === module) {
    migrateToPostGIS()
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}

module.exports = { migrateToPostGIS };
