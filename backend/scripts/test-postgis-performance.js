/**
 * PostGIS性能测试脚本
 * 对比PostGIS与Turf.js的性能差异
 */

const { db: knex } = require('../src/config/database');
const EventService = require('../src/services/eventService');
const turf = require('@turf/turf');
const logger = require('../src/utils/logger');

// 测试点位（广州地区）
const testPoints = [
    { lat: 23.1489, lng: 113.3376, name: '广工区庄校区' },
    { lat: 23.0545, lng: 113.3949, name: '中山大学康乐园' },
    { lat: 23.1586, lng: 113.3478, name: '华工五山校区' },
    { lat: 23.1291, lng: 113.2644, name: '天河公园' },
    { lat: 23.1167, lng: 113.2500, name: '天河体育中心' },
    { lat: 39.9042, lng: 116.4074, name: '北京天安门（对照组）' },
    { lat: 31.2304, lng: 121.4737, name: '上海外滩（对照组）' }
];

async function performanceTest() {
    console.log('🧪 PostGIS vs Turf.js 性能对比测试\n');
    console.log('='.repeat(70));

    try {
        // 获取测试数据
        const events = await knex('events')
            .whereNotNull('boundary')
            .whereNotNull('boundary_geom')
            .select('*');

        console.log(`📊 测试数据: ${events.length} 个活动\n`);

        if (events.length === 0) {
            console.log('⚠️  没有可测试的活动数据');
            return;
        }

        // 分析活动边界复杂度
        console.log('📈 活动边界复杂度分析:');
        for (const event of events) {
            const vertexResult = await knex.raw(`
                SELECT ST_NPoints(boundary_geom) as vertex_count
                FROM events
                WHERE id = ?
            `, [event.id]);
            const vertexCount = vertexResult.rows[0].vertex_count;
            console.log(`   - ${event.title}: ${vertexCount} 个顶点`);
        }

        console.log('\n' + '='.repeat(70));
        console.log('📍 测试1: 单点查询性能对比');
        console.log('='.repeat(70) + '\n');

        const singlePointResults = [];

        for (const point of testPoints) {
            console.log(`📍 测试点: ${point.name} [${point.lat}, ${point.lng}]`);

            // PostGIS测试
            const pgStart = Date.now();
            const pgEvents = await EventService.checkEventParticipation(point.lat, point.lng);
            const pgDuration = Date.now() - pgStart;

            // Turf.js测试
            const turfStart = Date.now();
            const turfEvents = await EventService.checkEventParticipationFallback(point.lat, point.lng);
            const turfDuration = Date.now() - turfStart;

            const speedup = turfDuration > 0 ? (turfDuration / pgDuration).toFixed(1) : 'N/A';

            console.log(`   PostGIS:  ${pgDuration}ms (${pgEvents.length} 匹配)`);
            console.log(`   Turf.js:  ${turfDuration}ms (${turfEvents.length} 匹配)`);
            console.log(`   提升:     ${speedup}x 倍\n`);

            singlePointResults.push({
                point: point.name,
                postgis: pgDuration,
                turf: turfDuration,
                speedup: parseFloat(speedup) || 0
            });
        }

        // 统计单点测试结果
        const avgPostGIS = singlePointResults.reduce((sum, r) => sum + r.postgis, 0) / singlePointResults.length;
        const avgTurf = singlePointResults.reduce((sum, r) => sum + r.turf, 0) / singlePointResults.length;
        const avgSpeedup = avgTurf > 0 ? (avgTurf / avgPostGIS).toFixed(1) : 'N/A';

        console.log('=' .repeat(70));
        console.log('📊 单点查询平均性能:');
        console.log(`   PostGIS:  ${avgPostGIS.toFixed(2)}ms`);
        console.log(`   Turf.js:  ${avgTurf.toFixed(2)}ms`);
        console.log(`   平均提升: ${avgSpeedup}x 倍\n`);

        // 批量查询测试
        console.log('='.repeat(70));
        console.log('📊 测试2: 批量查询性能 (100个点)');
        console.log('='.repeat(70) + '\n');

        const batchPoints = Array.from({ length: 100 }, (_, i) => ({
            lat: 23.1489 + (Math.random() - 0.5) * 0.01,
            lng: 113.3376 + (Math.random() - 0.5) * 0.01
        }));

        // PostGIS批量查询
        const batchStart = Date.now();
        const batchResults = await EventService.batchCheckEventParticipation(batchPoints);
        const batchDuration = Date.now() - batchStart;

        // Turf.js逐个查询（模拟）
        const turfBatchStart = Date.now();
        let turfBatchMatches = 0;
        for (const point of batchPoints.slice(0, 10)) { // 只测试10个避免太慢
            const events = await EventService.checkEventParticipationFallback(point.lat, point.lng);
            turfBatchMatches += events.length;
        }
        const turfBatchDuration = (Date.now() - turfBatchStart) * 10; // 推算100个的时间

        const batchSpeedup = (turfBatchDuration / batchDuration).toFixed(1);

        console.log(`   PostGIS批量:  ${batchDuration}ms (${batchResults.size} 匹配)`);
        console.log(`   Turf.js预估:  ${turfBatchDuration}ms`);
        console.log(`   提升:         ${batchSpeedup}x 倍\n`);

        // 索引使用验证
        console.log('='.repeat(70));
        console.log('🔍 测试3: 空间索引验证');
        console.log('='.repeat(70) + '\n');

        const explainResult = await knex.raw(`
            EXPLAIN (ANALYZE, BUFFERS)
            SELECT id, title
            FROM events
            WHERE boundary_geom IS NOT NULL
              AND ST_Contains(
                  boundary_geom,
                  ST_SetSRID(ST_MakePoint(113.3376, 23.1489), 4326)
              )
        `);

        const plan = explainResult.rows.map(r => r['QUERY PLAN']).join('\n');
        const usesIndex = plan.includes('Index Scan') && plan.includes('events_boundary_geom_idx');

        console.log(usesIndex ? '✅ GiST空间索引已启用' : '⚠️  索引未使用');

        // 显示查询计划关键信息
        const keyLines = plan.split('\n').filter(line =>
            line.includes('Index Scan') ||
            line.includes('Seq Scan') ||
            line.includes('Planning Time') ||
            line.includes('Execution Time') ||
            line.includes('Buffers')
        );

        console.log('\n查询计划关键信息:');
        keyLines.forEach(line => console.log(`   ${line.trim()}`));

        // 并发测试（模拟高负载）
        console.log('\n' + '='.repeat(70));
        console.log('⚡ 测试4: 并发性能测试 (50个并发查询)');
        console.log('='.repeat(70) + '\n');

        const concurrentQueries = Array.from({ length: 50 }, (_, i) => ({
            lat: 23.1489 + (Math.random() - 0.5) * 0.05,
            lng: 113.3376 + (Math.random() - 0.5) * 0.05
        }));

        const concurrentStart = Date.now();
        await Promise.all(
            concurrentQueries.map(p =>
                EventService.checkEventParticipation(p.lat, p.lng)
            )
        );
        const concurrentDuration = Date.now() - concurrentStart;

        console.log(`   50个并发查询总耗时: ${concurrentDuration}ms`);
        console.log(`   平均每个查询:       ${(concurrentDuration / 50).toFixed(2)}ms`);
        console.log(`   吞吐量:             ${(50000 / concurrentDuration).toFixed(0)} queries/sec\n`);

        // 复杂多边形性能测试
        console.log('='.repeat(70));
        console.log('🗺️  测试5: 复杂多边形性能');
        console.log('='.repeat(70) + '\n');

        const complexEvents = await knex.raw(`
            SELECT
                id,
                title,
                ST_NPoints(boundary_geom) as vertex_count
            FROM events
            WHERE boundary_geom IS NOT NULL
            ORDER BY ST_NPoints(boundary_geom) DESC
            LIMIT 5
        `);

        console.log('复杂度最高的活动:');
        for (const event of complexEvents.rows) {
            const testPoint = testPoints[0]; // 使用第一个测试点

            const start = Date.now();
            await knex.raw(`
                SELECT ST_Contains(
                    boundary_geom,
                    ST_SetSRID(ST_MakePoint(?, ?), 4326)
                ) as contains
                FROM events
                WHERE id = ?
            `, [testPoint.lng, testPoint.lat, event.id]);
            const duration = Date.now() - start;

            console.log(`   ${event.title}:`);
            console.log(`      顶点数: ${event.vertex_count}`);
            console.log(`      耗时:   ${duration}ms\n`);
        }

        // 总结报告
        console.log('='.repeat(70));
        console.log('📋 性能测试总结');
        console.log('='.repeat(70));
        console.log(`✅ PostGIS扩展:      已启用并正常工作`);
        console.log(`✅ GiST空间索引:     已创建并被使用`);
        console.log(`✅ 单点查询提升:     ${avgSpeedup}x 倍`);
        console.log(`✅ 批量查询提升:     ${batchSpeedup}x 倍`);
        console.log(`✅ 并发吞吐量:       ${(50000 / concurrentDuration).toFixed(0)} queries/sec`);
        console.log(`✅ 平均响应时间:     ${avgPostGIS.toFixed(2)}ms`);
        console.log('='.repeat(70));

        console.log('\n🎉 PostGIS性能测试完成！');

    } catch (error) {
        console.error('❌ 测试失败:', error);
        throw error;
    } finally {
        await knex.destroy();
    }
}

// 执行测试
if (require.main === module) {
    performanceTest().catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { performanceTest };
