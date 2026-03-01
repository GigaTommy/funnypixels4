# iOS Unit Testing Skill

**描述**: 为FunnyPixels iOS App创建单元测试

**使用场景**:
- Model Codable测试
- API数据解析测试
- 业务逻辑测试（像素冲突、绘制限制）
- ViewModel状态测试

**参数**:
- `coverage_target`: 目标代码覆盖率，默认60%
- `test_framework`: XCTest（默认）

**实现步骤**:

## 1. 创建测试Target

```bash
#!/bin/bash

# 如果使用Swift Package Manager
# Package.swift中添加test target

cat >> Package.swift << 'EOF'
.testTarget(
    name: "FunnyPixelsTests",
    dependencies: ["FunnyPixels"],
    path: "Tests/FunnyPixelsTests"
)
EOF
```

## 2. Model Codable测试

```swift
// Tests/FunnyPixelsTests/Models/PixelTests.swift

import XCTest
@testable import FunnyPixels

final class PixelTests: XCTestCase {

    // MARK: - Codable Tests

    func testPixelEncoding() throws {
        let pixel = Pixel(
            id: "test-123",
            latitude: 39.9042,
            longitude: 116.4074,
            color: "#FF5733",
            authorId: "user-456",
            createdAt: Date(),
            updatedAt: Date()
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601

        let data = try encoder.encode(pixel)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]

        XCTAssertNotNil(json)
        XCTAssertEqual(json?["id"] as? String, "test-123")
        XCTAssertEqual(json?["latitude"] as? Double, 39.9042)
        XCTAssertEqual(json?["color"] as? String, "#FF5733")
    }

    func testPixelDecoding() throws {
        let json = """
        {
            "id": "test-123",
            "latitude": 39.9042,
            "longitude": 116.4074,
            "color": "#FF5733",
            "authorId": "user-456",
            "createdAt": "2024-01-01T12:00:00Z",
            "updatedAt": "2024-01-01T12:00:00Z"
        }
        """

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let data = json.data(using: .utf8)!
        let pixel = try decoder.decode(Pixel.self, from: data)

        XCTAssertEqual(pixel.id, "test-123")
        XCTAssertEqual(pixel.latitude, 39.9042)
        XCTAssertEqual(pixel.longitude, 116.4074)
        XCTAssertEqual(pixel.color, "#FF5733")
        XCTAssertEqual(pixel.authorId, "user-456")
    }

    func testPixelInvalidData() {
        let invalidJSON = """
        {
            "id": "test",
            "invalid_field": true
        }
        """

        let decoder = JSONDecoder()
        let data = invalidJSON.data(using: .utf8)!

        XCTAssertThrowsError(try decoder.decode(Pixel.self, from: data))
    }

    // MARK: - Coordinate Tests

    func testPixelCoordinate() {
        let pixel = Pixel(
            latitude: 39.9042,
            longitude: 116.4074,
            color: "#FF5733",
            authorId: "user-456"
        )

        let coordinate = pixel.coordinate

        XCTAssertEqual(coordinate.latitude, 39.9042)
        XCTAssertEqual(coordinate.longitude, 116.4074)
    }
}
```

## 3. API数据解析测试

```swift
// Tests/FunnyPixelsTests/Services/APIManagerTests.swift

import XCTest
@testable import FunnyPixels

final class APIManagerTests: XCTestCase {

    // MARK: - Mock URLSession

    class MockURLProtocol: URLProtocol {
        static var requestHandler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

        override class func canInit(with request: URLRequest) -> Bool {
            return true
        }

        override class func canonicalRequest(for request: URLRequest) -> URLRequest {
            return request
        }

        override func startLoading() {
            guard let handler = MockURLProtocol.requestHandler else {
                fatalError("Handler is unavailable")
            }

            do {
                let (response, data) = try handler(request)
                client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
                client?.urlProtocol(self, didLoad: data)
                client?.urlProtocolDidFinishLoading(self)
            } catch {
                client?.urlProtocol(self, didFailWithError: error)
            }
        }

        override func stopLoading() {}
    }

    // MARK: - Tests

    func testFetchPixelsSuccess() async throws {
        // 配置mock响应
        let mockJSON = """
        {
            "pixels": [
                {
                    "id": "1",
                    "latitude": 39.9042,
                    "longitude": 116.4074,
                    "color": "#FF5733",
                    "authorId": "user-1",
                    "createdAt": "2024-01-01T12:00:00Z",
                    "updatedAt": "2024-01-01T12:00:00Z"
                }
            ]
        }
        """

        MockURLProtocol.requestHandler = { request in
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: ["Content-Type": "application/json"]
            )!
            let data = mockJSON.data(using: .utf8)!
            return (response, data)
        }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MockURLProtocol.self]
        let session = URLSession(configuration: configuration)

        let apiManager = APIManager(session: session)

        let pixels = try await apiManager.fetchPixels(in: TileBounds(
            minLatitude: 39.0,
            maxLatitude: 40.0,
            minLongitude: 116.0,
            maxLongitude: 117.0
        ))

        XCTAssertEqual(pixels.count, 1)
        XCTAssertEqual(pixels[0].id, "1")
        XCTAssertEqual(pixels[0].color, "#FF5733")
    }

    func testFetchPixelsError() async {
        MockURLProtocol.requestHandler = { request in
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 500,
                httpVersion: nil,
                headerFields: nil
            )!
            return (response, Data())
        }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MockURLProtocol.self]
        let session = URLSession(configuration: configuration)

        let apiManager = APIManager(session: session)

        do {
            _ = try await apiManager.fetchPixels(in: TileBounds(
                minLatitude: 39.0,
                maxLatitude: 40.0,
                minLongitude: 116.0,
                maxLongitude: 117.0
            ))
            XCTFail("Should throw error")
        } catch {
            // Expected
        }
    }
}
```

## 4. 业务逻辑测试

```swift
// Tests/FunnyPixelsTests/Business/PixelDrawingTests.swift

import XCTest
@testable import FunnyPixels

final class PixelDrawingTests: XCTestCase {

    // MARK: - Drawing Rate Limit Tests

    func testDrawingRateLimit() async throws {
        let rateLimit = DrawingRateLimiter(maxPerSecond: 1)

        // 第一次绘制应该允许
        let allowed1 = await rateLimit.canDraw()
        XCTAssertTrue(allowed1)

        // 立即再次绘制应该被限制
        let allowed2 = await rateLimit.canDraw()
        XCTAssertFalse(allowed2)

        // 等待1秒后应该允许
        try await Task.sleep(nanoseconds: 1_000_000_000)
        let allowed3 = await rateLimit.canDraw()
        XCTAssertTrue(allowed3)
    }

    // MARK: - Pixel Conflict Tests

    func testPixelConflictDetection() {
        let existingPixels = [
            Pixel(
                latitude: 39.9042,
                longitude: 116.4074,
                color: "#FF5733",
                authorId: "user-1"
            )
        ]

        let newPixel = Pixel(
            latitude: 39.9042,
            longitude: 116.4074,
            color: "#00FF00",
            authorId: "user-2"
        )

        let hasConflict = PixelConflictDetector.hasConflict(
            newPixel: newPixel,
            existingPixels: existingPixels,
            tolerance: 0.0001 // 约10米
        )

        XCTAssertTrue(hasConflict)
    }

    func testNoPixelConflict() {
        let existingPixels = [
            Pixel(
                latitude: 39.9042,
                longitude: 116.4074,
                color: "#FF5733",
                authorId: "user-1"
            )
        ]

        let newPixel = Pixel(
            latitude: 39.9052, // 约1km外
            longitude: 116.4084,
            color: "#00FF00",
            authorId: "user-2"
        )

        let hasConflict = PixelConflictDetector.hasConflict(
            newPixel: newPixel,
            existingPixels: existingPixels,
            tolerance: 0.0001
        )

        XCTAssertFalse(hasConflict)
    }

    // MARK: - Color Validation Tests

    func testValidColorFormat() {
        let validColors = [
            "#FF5733",
            "#00FF00",
            "#0000FF",
            "#FFFFFF",
            "#000000"
        ]

        for color in validColors {
            XCTAssertTrue(ColorValidator.isValid(color), "Color \(color) should be valid")
        }
    }

    func testInvalidColorFormat() {
        let invalidColors = [
            "#FFF",           // Too short
            "#GGGGGG",        // Invalid hex
            "FF5733",         // Missing #
            "#FF57330",       // Too long
            ""                // Empty
        ]

        for color in invalidColors {
            XCTAssertFalse(ColorValidator.isValid(color), "Color \(color) should be invalid")
        }
    }
}

// Helper类

class DrawingRateLimiter {
    private let maxPerSecond: Int
    private var lastDrawTime: Date?

    init(maxPerSecond: Int) {
        self.maxPerSecond = maxPerSecond
    }

    func canDraw() async -> Bool {
        let now = Date()

        if let last = lastDrawTime {
            let interval = now.timeIntervalSince(last)
            if interval < 1.0 / Double(maxPerSecond) {
                return false
            }
        }

        lastDrawTime = now
        return true
    }
}

class PixelConflictDetector {
    static func hasConflict(
        newPixel: Pixel,
        existingPixels: [Pixel],
        tolerance: Double
    ) -> Bool {
        for existing in existingPixels {
            let latDiff = abs(newPixel.latitude - existing.latitude)
            let lonDiff = abs(newPixel.longitude - existing.longitude)

            if latDiff < tolerance && lonDiff < tolerance {
                return true
            }
        }
        return false
    }
}

class ColorValidator {
    static func isValid(_ hex: String) -> Bool {
        let pattern = "^#[0-9A-Fa-f]{6}$"
        let regex = try? NSRegularExpression(pattern: pattern)
        let range = NSRange(location: 0, length: hex.utf16.count)
        return regex?.firstMatch(in: hex, range: range) != nil
    }
}
```

## 5. ViewModel测试

```swift
// Tests/FunnyPixelsTests/ViewModels/MapViewModelTests.swift

import XCTest
import Combine
@testable import FunnyPixels

@MainActor
final class MapViewModelTests: XCTestCase {
    var viewModel: MapViewModel!
    var cancellables: Set<AnyCancellable>!

    override func setUp() async throws {
        viewModel = MapViewModel()
        cancellables = []
    }

    override func tearDown() {
        cancellables = nil
        viewModel = nil
    }

    func testInitialState() {
        XCTAssertEqual(viewModel.pixels.count, 0)
        XCTAssertFalse(viewModel.isLoading)
        XCTAssertNil(viewModel.errorMessage)
    }

    func testLoadPixels() async {
        let expectation = XCTestExpectation(description: "Pixels loaded")

        viewModel.$pixels
            .dropFirst() // Skip initial value
            .sink { pixels in
                if !pixels.isEmpty {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        await viewModel.loadPixels(in: TileBounds(
            minLatitude: 39.0,
            maxLatitude: 40.0,
            minLongitude: 116.0,
            maxLongitude: 117.0
        ))

        await fulfillment(of: [expectation], timeout: 5)
        XCTAssertGreaterThan(viewModel.pixels.count, 0)
    }

    func testDrawPixel() async {
        let initialCount = viewModel.pixels.count

        await viewModel.drawPixel(
            at: CLLocationCoordinate2D(latitude: 39.9042, longitude: 116.4074),
            color: "#FF5733"
        )

        XCTAssertEqual(viewModel.pixels.count, initialCount + 1)
    }
}
```

## 6. 运行测试脚本

```bash
#!/bin/bash
# .claude/skills/ios-development/run_tests.sh

echo "🧪 Running Unit Tests..."

# 运行所有测试
swift test

# 生成覆盖率报告
swift test --enable-code-coverage

# 导出覆盖率
xcrun llvm-cov export \
    .build/debug/FunnyPixelsPackageTests.xctest/Contents/MacOS/FunnyPixelsPackageTests \
    -instr-profile=.build/debug/codecov/default.profdata \
    -format=lcov > coverage.lcov

# 生成HTML报告
if command -v genhtml &> /dev/null; then
    genhtml coverage.lcov -o coverage_report
    echo "📊 Coverage report: coverage_report/index.html"
fi

echo "✅ Tests completed"
```

## 验收标准

- ✅ Model Codable测试通过
- ✅ API解析测试通过
- ✅ 业务逻辑测试覆盖核心场景
- ✅ 代码覆盖率 > 60%
- ✅ 所有测试在CI中可运行

## 测试最佳实践

1. **AAA模式**: Arrange-Act-Assert
2. **单一职责**: 每个测试只测试一个功能点
3. **独立性**: 测试之间互不依赖
4. **可重复**: 测试结果稳定，不依赖外部状态
5. **快速**: 单元测试应该快速执行

## 依赖工具

- XCTest
- swift test
- llvm-cov (覆盖率)
