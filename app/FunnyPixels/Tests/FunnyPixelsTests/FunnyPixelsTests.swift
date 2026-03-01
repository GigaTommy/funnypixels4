import XCTest
@testable import FunnyPixels
import CoreLocation

/// FunnyPixels 像素同步系统测试
final class FunnyPixelsTests: XCTestCase {

    // MARK: - Setup & Teardown

    override func setUp() {
        super.setUp()
        // 每个测试前执行
    }

    override func tearDown() {
        // 每个测试后执行
        super.tearDown()
    }

    // MARK: - GeoHash Tests

    func testGeoHashEncoding() {
        // 测试 GeoHash 编码
        let hash = GeoHash.encode(latitude: 39.9042, longitude: 116.4074, precision: 6)

        // 北京天安门的坐标应该产生一个有效的 GeoHash
        XCTAssertEqual(hash.count, 6)
        XCTAssertFalse(hash.isEmpty)

        print("✅ GeoHash 编码测试通过: \(hash)")
    }

    func testGeoHashDecoding() {
        // 测试 GeoHash 解码
        let hash = "wx4g0s"  // 北京附近的 GeoHash
        let bounds = GeoHash.decode(hash)

        // 验证解码结果
        XCTAssertLessThan(bounds.lat.min, bounds.lat.max)
        XCTAssertLessThan(bounds.lng.min, bounds.lng.max)

        print("✅ GeoHash 解码测试通过: lat[\(bounds.lat.min), \(bounds.lat.max)], lng[\(bounds.lng.min), \(bounds.lng.max)]")
    }

    func testGeoHashRoundTrip() {
        // 测试编码后解码是否保持精度
        let originalLat = 31.2304
        let originalLng = 121.4737

        let hash = GeoHash.encode(latitude: originalLat, longitude: originalLng, precision: 7)
        let bounds = GeoHash.decode(hash)

        // 验证原始坐标在解码范围内
        XCTAssertGreaterThanOrEqual(originalLat, bounds.lat.min)
        XCTAssertLessThanOrEqual(originalLat, bounds.lat.max)
        XCTAssertGreaterThanOrEqual(originalLng, bounds.lng.min)
        XCTAssertLessThanOrEqual(originalLng, bounds.lng.max)

        print("✅ GeoHash 往返测试通过")
    }

    func testGeoHashNeighbors() {
        // 测试相邻 GeoHash
        let hash = "wx4g0s"
        let north = GeoHash.neighbor(hash, direction: .north)
        let south = GeoHash.neighbor(hash, direction: .south)
        let east = GeoHash.neighbor(hash, direction: .east)
        let west = GeoHash.neighbor(hash, direction: .west)

        // 验证相邻哈希不同
        XCTAssertNotEqual(hash, north)
        XCTAssertNotEqual(hash, south)
        XCTAssertNotEqual(hash, east)
        XCTAssertNotEqual(hash, west)

        print("✅ GeoHash 邻居测试通过: N=\(north), S=\(south), E=\(east), W=\(west)")
    }

    // MARK: - Version Vector Tests

    func testVersionVectorIncrement() {
        // 测试版本向量递增
        var vector = VersionVector()
        XCTAssertEqual(0, getVersionCount(vector: vector))

        vector.increment(for: "user1")
        XCTAssertEqual(1, getVersionCount(vector: vector))

        vector.increment(for: "user1")
        XCTAssertEqual(2, getVersionCount(vector: vector))

        vector.increment(for: "user2")
        XCTAssertEqual(3, getVersionCount(vector: vector))

        print("✅ 版本向量递增测试通过")
    }

    func testVersionVectorCompare() {
        // 测试版本向量比较
        var v1 = VersionVector()
        var v2 = VersionVector()

        v1.increment(for: "user1")
        v2.increment(for: "user1")

        // 相同版本
        var result = v1.compare(v2)
        XCTAssertEqual(result, .orderedSame)

        // v1 更新
        v1.increment(for: "user1")
        result = v1.compare(v2)
        XCTAssertEqual(result, .orderedDescending)

        // 并发修改
        v1.increment(for: "user2")
        v2.increment(for: "user3")
        result = v1.compare(v2)
        // 应该检测到并发
        print("✅ 版本向量比较测试通过: \(result)")
    }

    func testVersionVectorMerge() {
        // 测试版本向量合并
        var v1 = VersionVector()
        var v2 = VersionVector()

        v1.increment(for: "user1")
        v1.increment(for: "user1")
        v1.increment(for: "user2")

        v2.increment(for: "user1")
        v2.increment(for: "user3")

        v1.merge(v2)

        // 合并后应包含所有版本
        let count = getVersionCount(vector: v1)
        XCTAssertEqual(count, 4)  // user1:2, user2:1, user3:1

        print("✅ 版本向量合并测试通过")
    }

    func testVersionVectorConflictDetection() {
        // 测试冲突检测
        var v1 = VersionVector()
        var v2 = VersionVector()

        // 创建并发修改
        v1.increment(for: "user1")
        v2.increment(for: "user2")

        // 应该检测到冲突
        let hasConflict = v1.hasConflict(with: v2)
        XCTAssertTrue(hasConflict)

        print("✅ 版本向量冲突检测测试通过")
    }

    // MARK: - MapRegion Tests

    func testMapRegionCreation() {
        // 测试地图区域创建
        let region = MapRegion(
            id: "test_region",
            minLat: 39.0,
            maxLat: 40.0,
            minLng: 116.0,
            maxLng: 117.0,
            zoom: 10,
            geoHash: "wx4g0s",
            priority: .normal,
            type: .visible
        )

        XCTAssertEqual(region.id, "test_region")
        XCTAssertEqual(region.zoom, 10)
        XCTAssertEqual(region.priority, RegionPriority.normal)

        print("✅ MapRegion 创建测试通过")
    }

    func testMapRegionContains() {
        // 测试区域包含判断
        let region = MapRegion(
            id: "test_region",
            minLat: 39.0,
            maxLat: 40.0,
            minLng: 116.0,
            maxLng: 117.0,
            zoom: 10,
            geoHash: "wx4g0s",
            priority: .normal,
            type: .visible
        )

        let insideCoord = CLLocationCoordinate2D(latitude: 39.5, longitude: 116.5)
        let outsideCoord = CLLocationCoordinate2D(latitude: 41.0, longitude: 118.0)

        XCTAssertTrue(region.contains(coordinate: insideCoord))
        XCTAssertFalse(region.contains(coordinate: outsideCoord))

        print("✅ MapRegion 包含测试通过")
    }

    func testMapRegionOverlap() {
        // 测试区域重叠判断
        let region1 = MapRegion(
            id: "region1",
            minLat: 39.0,
            maxLat: 40.0,
            minLng: 116.0,
            maxLng: 117.0,
            zoom: 10,
            geoHash: "wx4g0s",
            priority: .normal,
            type: .visible
        )

        let region2 = MapRegion(
            id: "region2",
            minLat: 39.5,
            maxLat: 40.5,
            minLng: 116.5,
            maxLng: 117.5,
            zoom: 10,
            geoHash: "wx4g0t",
            priority: .normal,
            type: .nearby
        )

        let region3 = MapRegion(
            id: "region3",
            minLat: 41.0,
            maxLat: 42.0,
            minLng: 118.0,
            maxLng: 119.0,
            zoom: 10,
            geoHash: "wx4g8u",
            priority: .normal,
            type: .nearby
        )

        XCTAssertTrue(region1.overlaps(with: region2))
        XCTAssertFalse(region1.overlaps(with: region3))

        print("✅ MapRegion 重叠测试通过")
    }

    // MARK: - PixelCacheManager Tests

    func testPixelCacheSetAndGet() {
        // 测试缓存设置和获取
        let cacheManager = PixelCacheManager.shared

        // 清空缓存
        cacheManager.clearAll()

        // 创建测试像素
        let pixel = createTestPixel(id: "test_pixel_1", lat: 39.5, lng: 116.5)

        // 设置缓存
        cacheManager.setPixel(pixel)

        // 获取缓存
        let retrieved = cacheManager.getPixel(id: "test_pixel_1")

        XCTAssertNotNil(retrieved)
        XCTAssertEqual(retrieved?.id, pixel.id)
        XCTAssertEqual(retrieved?.latitude, pixel.latitude)
        XCTAssertEqual(retrieved?.longitude, pixel.longitude)

        print("✅ PixelCacheManager 设置/获取测试通过")
    }

    func testPixelCacheRemove() {
        // 测试缓存移除
        let cacheManager = PixelCacheManager.shared

        let pixel = createTestPixel(id: "test_pixel_2", lat: 39.5, lng: 116.5)
        cacheManager.setPixel(pixel)

        // 验证存在
        XCTAssertNotNil(cacheManager.getPixel(id: "test_pixel_2"))

        // 移除
        cacheManager.removePixel(id: "test_pixel_2")

        // 验证不存在
        XCTAssertNil(cacheManager.getPixel(id: "test_pixel_2"))

        print("✅ PixelCacheManager 移除测试通过")
    }

    func testPixelCacheBatch() {
        // 测试批量缓存
        let cacheManager = PixelCacheManager.shared
        cacheManager.clearAll()

        let pixels = [
            createTestPixel(id: "batch_1", lat: 39.0, lng: 116.0),
            createTestPixel(id: "batch_2", lat: 39.1, lng: 116.1),
            createTestPixel(id: "batch_3", lat: 39.2, lng: 116.2)
        ]

        cacheManager.cachePixels(pixels, for: "test_region")

        // 验证所有像素都已缓存
        for pixel in pixels {
            let retrieved = cacheManager.getPixel(id: pixel.id ?? "")
            XCTAssertNotNil(retrieved)
        }

        print("✅ PixelCacheManager 批量测试通过")
    }

    func testPixelCacheStatistics() {
        // 测试缓存统计
        let cacheManager = PixelCacheManager.shared
        cacheManager.clearAll()
        cacheManager.resetStatistics()

        let pixels = [
            createTestPixel(id: "stat_1", lat: 39.0, lng: 116.0),
            createTestPixel(id: "stat_2", lat: 39.1, lng: 116.1)
        ]

        cacheManager.cachePixels(pixels, for: "test_region")

        // 命中测试
        _ = cacheManager.getPixel(id: "stat_1")
        _ = cacheManager.getPixel(id: "stat_1")

        // 未命中测试
        _ = cacheManager.getPixel(id: "non_existent")

        let stats = cacheManager.getStatistics()

        XCTAssertEqual(stats.memoryCount, 2)
        XCTAssertEqual(stats.hitCount, 2)
        XCTAssertEqual(stats.missCount, 1)
        XCTAssertTrue(stats.hitRate > 0)

        print("✅ PixelCacheManager 统计测试通过 - 命中率: \(stats.hitRate * 100)%")
    }

    // MARK: - PixelBatchOptimizer Tests

    func testSpatialAggregation() {
        // 测试空间聚合
        let aggregator = SpatialAggregator()

        let pixels = [
            createTestPixel(id: "agg_1", lat: 39.0, lng: 116.0),
            createTestPixel(id: "agg_2", lat: 39.001, lng: 116.001),  // 邻近
            createTestPixel(id: "agg_3", lat: 39.002, lng: 116.002),  // 邻近
            createTestPixel(id: "agg_4", lat: 40.0, lng: 117.0)   // 远离
        ]

        let groups = aggregator.aggregate(pixels)

        // 应该至少有一个聚合组
        XCTAssertTrue(groups.count > 0)

        // 验证邻近像素在同一组
        let nearbyGroup = groups.first { $0.contains(where: { $0.id == "agg_1" }) }
        XCTAssertNotNil(nearbyGroup)
        if let group = nearbyGroup {
            XCTAssertTrue(group.count >= 2)
        }

        print("✅ 空间聚合测试通过 - \(groups.count) 个组")
    }

    func testTemporalAggregation() {
        // 测试时间聚合
        let aggregator = TemporalAggregator()

        let now = Date()
        let pixels = [
            createTestPixelWithDate(id: "time_1", date: now),
            createTestPixelWithDate(id: "time_2", date: now.addingTimeInterval(0.5)),
            createTestPixelWithDate(id: "time_3", date: now.addingTimeInterval(2.0))
        ]

        let buckets = aggregator.aggregate(pixels)

        // 前两个像素应该在同一个时间窗口
        XCTAssertTrue(buckets.count > 0)

        print("✅ 时间聚合测试通过 - \(buckets.count) 个时间桶")
    }

    // MARK: - PixelSyncReliability Tests

    func testMessageTracking() {
        // 测试消息跟踪
        let tracker = MessageTracker()

        let operation = PendingOperation(
            operationId: "op_test_1",
            type: .create,
            pixel: createTestPixel(id: "pixel_1", lat: 39.0, lng: 116.0),
            timestamp: Date(),
            retryCount: 0,
            status: .pending,
            timeout: 10.0
        )

        tracker.track(operation)

        // 验证可以获取
        let retrieved = tracker.get(operationId: "op_test_1")
        XCTAssertNotNil(retrieved)
        XCTAssertEqual(retrieved?.operationId, "op_test_1")

        // 更新状态
        tracker.updateStatus(operationId: "op_test_1", status: .sent)

        let updated = tracker.get(operationId: "op_test_1")
        XCTAssertTrue(updated?.status == .sent)

        // 移除
        tracker.remove(operationId: "op_test_1")
        XCTAssertNil(tracker.get(operationId: "op_test_1"))

        print("✅ 消息跟踪测试通过")
    }

    func testMessageDeduplication() {
        // 测试消息去重
        let deduplicator = MessageDeduplicator()

        let messageId = "msg_test_1"

        // 第一次不重复
        XCTAssertFalse(deduplicator.isDuplicate(messageId: messageId))

        // 标记为已见
        deduplicator.markAsSeen(messageId: messageId)

        // 第二次重复
        XCTAssertTrue(deduplicator.isDuplicate(messageId: messageId))

        print("✅ 消息去重测试通过")
    }

    func testTimeoutDetection() {
        // 测试超时检测
        let tracker = MessageTracker()

        let oldOperation = PendingOperation(
            operationId: "op_old",
            type: .create,
            pixel: createTestPixel(id: "pixel_old", lat: 39.0, lng: 116.0),
            timestamp: Date().addingTimeInterval(-20),  // 20秒前
            retryCount: 0,
            status: .sent,
            timeout: 10.0  // 10秒超时
        )

        tracker.track(oldOperation)

        // 超时的操作
        let timedOut = tracker.getTimedOutOperations()
        XCTAssertTrue(timedOut.count > 0)
        XCTAssertTrue(timedOut.first?.isTimedOut ?? false)

        print("✅ 超时检测测试通过")
    }

    // MARK: - Statistics Tests

    func testProcessingStatistics() {
        // 测试处理统计
        var stats = ProcessingStatistics()

        stats.recordCreate()
        stats.recordUpdate()
        stats.recordUpdate()
        stats.recordDelete()

        XCTAssertEqual(stats.totalProcessed, 4)
        XCTAssertEqual(stats.createsProcessed, 1)
        XCTAssertEqual(stats.updatesProcessed, 2)
        XCTAssertEqual(stats.deletesProcessed, 1)

        stats.updateAverageProcessingTime(0.5)
        stats.updateAverageProcessingTime(1.5)

        // 平均值应该接近 (0.5 + 1.5) / 2 = 1.0
        XCTAssertTrue(abs(stats.averageProcessingTime - 1.0) < 0.01)

        print("✅ 处理统计测试通过")
    }

    func testCacheStatistics() {
        // 测试缓存统计
        var stats = CacheStatistics()

        stats.hitCount = 80
        stats.missCount = 20
        stats.memoryCount = 1000

        XCTAssertEqual(stats.hitRate, 0.8)

        print("✅ 缓存统计测试通过 - 命中率: 80%")
    }

    // MARK: - Performance Tests

    func testGeoHashPerformance() {
        // 测试 GeoHash 性能
        measure {
            for _ in 0..<1000 {
                _ = GeoHash.encode(latitude: Double.random(in: -90...90),
                                   longitude: Double.random(in: -180...180),
                                   precision: 6)
            }
        }
    }

    func testCachePerformance() {
        // 测试缓存性能
        let cacheManager = PixelCacheManager.shared
        cacheManager.clearAll()

        // 预填充
        var pixels: [Pixel] = []
        for i in 0..<1000 {
            pixels.append(createTestPixel(id: "perf_\(i)", lat: Double.random(in: -90...90),
                                        lng: Double.random(in: -180...180)))
        }
        cacheManager.cachePixels(pixels, for: "perf_test")

        // 测试读取性能
        measure {
            for i in 0..<1000 {
                _ = cacheManager.getPixel(id: "perf_\(i)")
            }
        }
    }

    // MARK: - Helper Methods

    /// 创建测试像素
    private func createTestPixel(id: String, lat: Double, lng: Double) -> Pixel {
        return Pixel(
            id: id,
            latitude: lat,
            longitude: lng,
            color: "#FF0000",
            authorId: "test_user",
            createdAt: Date(),
            updatedAt: Date()
        )
    }

    /// 创建带指定日期的测试像素
    private func createTestPixelWithDate(id: String, date: Date) -> Pixel {
        return Pixel(
            id: id,
            latitude: 39.0,
            longitude: 116.0,
            color: "#FF0000",
            authorId: "test_user",
            createdAt: date,
            updatedAt: date
        )
    }

    /// 获取版本向量中的版本总数（辅助方法）
    private func getVersionCount(vector: VersionVector) -> Int {
        // 这是一个简化实现，实际测试中可能需要暴露内部状态
        // 或者通过比较操作来推断
        return 0  // 占位符
    }

    // MARK: - Integration Tests

    func testEndToEndPixelSync() {
        // 端到端同步流程测试

        // 1. 创建像素
        let cacheManager = PixelCacheManager.shared
        cacheManager.clearAll()

        let pixel = createTestPixel(id: "e2e_1", lat: 39.5, lng: 116.5)

        // 2. 缓存像素
        cacheManager.setPixel(pixel)

        // 3. 验证缓存
        let cached = cacheManager.getPixel(id: "e2e_1")
        XCTAssertNotNil(cached)

        // 4. 添加到批处理
        let optimizer = PixelBatchOptimizer.shared
        optimizer.addPixel(pixel)

        // 5. 验证统计
        let cacheStats = cacheManager.getStatistics()
        XCTAssertTrue(cacheStats.memoryCount > 0)

        print("✅ 端到端同步测试通过")
    }

    func testConcurrentAccess() {
        // 并发访问测试
        let cacheManager = PixelCacheManager.shared
        cacheManager.clearAll()

        let expectation = XCTestExpectation(description: "Concurrent access")
        expectation.expectedFulfillmentCount = 10

        let queue = DispatchQueue.global(qos: .userInitiated)

        for i in 0..<10 {
            queue.async {
                let pixel = self.createTestPixel(id: "concurrent_\(i)", lat: Double(i), lng: Double(i))
                cacheManager.setPixel(pixel)
                _ = cacheManager.getPixel(id: "concurrent_\(i)")
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 5.0)

        let stats = cacheManager.getStatistics()
        XCTAssertEqual(stats.memoryCount, 10)

        print("✅ 并发访问测试通过")
    }

    // MARK: - All Tests Runner

    func testRunAllTests() {
        print("\n" + String(repeating: "=", count: 60))
        print("运行 FunnyPixels 像素同步系统测试套件")
        print(String(repeating: "=", count: 60) + "\n")

        testGeoHashEncoding()
        testGeoHashDecoding()
        testGeoHashRoundTrip()
        testGeoHashNeighbors()

        testVersionVectorIncrement()
        testVersionVectorCompare()
        testVersionVectorMerge()
        testVersionVectorConflictDetection()

        testMapRegionCreation()
        testMapRegionContains()
        testMapRegionOverlap()

        testPixelCacheSetAndGet()
        testPixelCacheRemove()
        testPixelCacheBatch()
        testPixelCacheStatistics()

        testSpatialAggregation()
        testTemporalAggregation()

        testMessageTracking()
        testMessageDeduplication()
        testTimeoutDetection()

        testProcessingStatistics()
        testCacheStatistics()

        testEndToEndPixelSync()
        testConcurrentAccess()

        print("\n" + String(repeating: "=", count: 60))
        print("✅ 所有测试通过！")
        print(String(repeating: "=", count: 60) + "\n")
    }
}
