#!/usr/bin/env node
/**
 * 修复现有赛事的PostGIS几何列
 *
 * 问题：旧版本创建的赛事只有boundary（JSONB），没有boundary_geom（Geometry）
 * 影响：空间索引无效，查询性能降级10-50倍
 *
 * 解决：批量更新所有缺失几何列的赛事
 *
 * 使用方法：
 *   node backend/scripts/fix-existing-events-geometry.js
 */

const { db: knex } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function fixExistingEvents() {
    console.log('🔧 开始修复现有赛事的PostGIS几何列...\n');

    try {
        // 1. 验证PostGIS扩展是否可用
        try {
            const versionCheck = await knex.raw("SELECT PostGIS_version()");
            const version = versionCheck.rows[0].postgis_version;
            console.log(`✅ PostGIS版本: ${version}\n`);
        } catch (err) {
            console.error('❌ PostGIS扩展未启用，请先运行: CREATE EXTENSION postgis;');
            process.exit(1);
        }

        // 2. 查找所有有boundary但没有boundary_geom的赛事
        const events = await knex('events')
            .whereNotNull('boundary')
            .whereNull('boundary_geom')
            .select('id', 'title', 'boundary');

        if (events.length === 0) {
            console.log('✅ 所有赛事的几何列都已正确设置，无需修复');
            return;
        }

        console.log(`📊 找到 ${events.length} 个需要修复的赛事\n`);
        console.log('事件列表:');
        events.forEach((e, idx) => {
            console.log(`  ${idx + 1}. ${e.title} (${e.id})`);
        });
        console.log();

        // 3. 批量修复
        let success = 0;
        let failed = 0;
        const failedEvents = [];

        for (const event of events) {
            try {
                const boundaryJSON = typeof event.boundary === 'string'
                    ? event.boundary
                    : JSON.stringify(event.boundary);

                // 验证GeoJSON格式
                let parsedBoundary;
                try {
                    parsedBoundary = JSON.parse(boundaryJSON);
                } catch (parseErr) {
                    throw new Error(`Invalid JSON: ${parseErr.message}`);
                }

                if (parsedBoundary.type !== 'Polygon') {
                    throw new Error(`Not a Polygon, got: ${parsedBoundary.type}`);
                }

                // 使用ST_GeomFromGeoJSON更新几何列
                await knex.raw(`
                    UPDATE events
                    SET
                        boundary_geom = ST_GeomFromGeoJSON(?),
                        center_geom = ST_Centroid(ST_GeomFromGeoJSON(?)),
                        bbox = ST_Envelope(ST_GeomFromGeoJSON(?))::box2d
                    WHERE id = ?
                `, [boundaryJSON, boundaryJSON, boundaryJSON, event.id]);

                success++;
                console.log(`✅ [${success}/${events.length}] ${event.title}`);

            } catch (err) {
                failed++;
                failedEvents.push({ title: event.title, id: event.id, error: err.message });
                console.error(`❌ [${failed}/${events.length}] ${event.title}: ${err.message}`);
            }
        }

        // 4. 结果统计
        console.log('\n' + '='.repeat(60));
        console.log(`✅ 成功修复: ${success}`);
        console.log(`❌ 失败: ${failed}`);
        console.log('='.repeat(60));

        if (failedEvents.length > 0) {
            console.log('\n失败的赛事详情:');
            failedEvents.forEach(e => {
                console.log(`  - ${e.title} (${e.id}): ${e.error}`);
            });
        }

        // 5. 验证修复结果
        console.log('\n🔍 验证修复结果...');
        const stillBroken = await knex('events')
            .whereNotNull('boundary')
            .whereNull('boundary_geom')
            .count('* as count')
            .first();

        const stillBrokenCount = parseInt(stillBroken.count);
        if (stillBrokenCount === 0) {
            console.log('✅ 所有赛事的几何列已修复');
        } else {
            console.warn(`⚠️ 仍有 ${stillBrokenCount} 个赛事缺少几何列`);
        }

        // 6. 优化索引
        console.log('\n🔍 优化数据库索引...');
        await knex.raw('VACUUM ANALYZE events');
        console.log('✅ 索引优化完成');

        // 7. 性能测试
        console.log('\n⚡ 运行性能测试...');
        const start = Date.now();
        const testResult = await knex.raw(`
            SELECT COUNT(*) as count
            FROM events
            WHERE boundary_geom IS NOT NULL
              AND ST_Contains(
                  boundary_geom,
                  ST_SetSRID(ST_MakePoint(120.1365, 30.2489), 4326)
              )
        `);
        const elapsed = Date.now() - start;
        console.log(`✅ PostGIS查询测试: ${elapsed}ms (结果: ${testResult.rows[0].count} 个匹配赛事)`);

        if (elapsed < 50) {
            console.log('✅ 性能良好 (<50ms)');
        } else if (elapsed < 200) {
            console.log('⚠️ 性能可接受 (50-200ms)');
        } else {
            console.warn('❌ 性能较差 (>200ms)，请检查索引');
        }

        console.log('\n✅ 修复完成！');

    } catch (err) {
        console.error('\n❌ 修复失败:', err);
        throw err;
    } finally {
        await knex.destroy();
    }
}

// 执行脚本
if (require.main === module) {
    fixExistingEvents()
        .then(() => {
            console.log('\n🎉 脚本执行成功');
            process.exit(0);
        })
        .catch(err => {
            console.error('\n💥 脚本执行失败:', err);
            process.exit(1);
        });
}

module.exports = { fixExistingEvents };
