# iOS Device Testing Skill

**描述**: 真机测试和性能验证

**使用场景**:
- 配置Apple Developer账号和证书
- 在真机上运行App
- 验证GPS精度和耗电
- 测试地图滑动性能和像素渲染
- 使用Instruments进行性能分析

**参数**:
- `device_udid`: 测试设备UDID
- `team_id`: Apple Developer Team ID
- `profile_path`: Provisioning Profile路径（可选）

**实现步骤**:

## 1. 配置Apple Developer账号

```bash
#!/bin/bash
# .claude/skills/ios-development/setup_device.sh

echo "📱 Setting up iOS Device Testing..."

# 检查是否已登录Apple Developer账号
TEAM_ID=$(security find-identity -v -p codesigning | grep "iPhone Developer" | head -1 | sed 's/.*(\(.*\)).*/\1/')

if [ -z "$TEAM_ID" ]; then
    echo "❌ No Apple Developer certificate found"
    echo "Please open Xcode and sign in to your Apple Developer account:"
    echo "Xcode -> Settings -> Accounts -> Add Apple ID"
    exit 1
fi

echo "✅ Found Apple Developer Team: $TEAM_ID"

# 列出连接的设备
echo ""
echo "📱 Connected iOS Devices:"
xcrun xctrace list devices | grep -E "iPhone|iPad"

# 提示注册设备
echo ""
echo "To register a new device:"
echo "1. Get device UDID: xcrun xctrace list devices"
echo "2. Register at: https://developer.apple.com/account/resources/devices"
```

## 2. 注册测试设备

```bash
#!/bin/bash

# 获取连接设备的UDID
DEVICE_UDID=$(xcrun xctrace list devices | grep "iPhone" | head -1 | sed 's/.*(\([^)]*\)).*/\1/')

if [ -z "$DEVICE_UDID" ]; then
    echo "❌ No iPhone device connected"
    exit 1
fi

echo "Device UDID: $DEVICE_UDID"
echo ""
echo "Please register this device at:"
echo "https://developer.apple.com/account/resources/devices/add"
echo ""
echo "Or use fastlane:"
echo "fastlane register_devices devices:{'Test iPhone' => '$DEVICE_UDID'}"
```

## 3. 真机构建和运行

```bash
#!/bin/bash
# .claude/skills/ios-development/build_and_run_device.sh

PROJECT_ROOT="."
SCHEME="FunnyPixelsApp"

# 获取连接的设备
DEVICE_NAME=$(xcrun xctrace list devices | grep "iPhone" | head -1 | awk -F' \\(' '{print $1}')
DEVICE_UDID=$(xcrun xctrace list devices | grep "iPhone" | head -1 | sed 's/.*(\([^)]*\)).*/\1/')

if [ -z "$DEVICE_NAME" ]; then
    echo "❌ No iPhone device connected"
    exit 1
fi

echo "📱 Building for device: $DEVICE_NAME ($DEVICE_UDID)"

# 清理并构建
xcodebuild \
    -scheme "$SCHEME" \
    -configuration Debug \
    -destination "id=$DEVICE_UDID" \
    -derivedDataPath .build/device \
    clean build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo ""
    echo "📱 Installing on device..."

    # 获取app路径
    APP_PATH=$(find .build/device -name "*.app" | head -1)

    if [ -n "$APP_PATH" ]; then
        # 安装到设备
        xcrun devicectl device install app --device "$DEVICE_UDID" "$APP_PATH"

        # 启动App
        BUNDLE_ID=$(xcodebuild -showBuildSettings -scheme "$SCHEME" | grep PRODUCT_BUNDLE_IDENTIFIER | awk '{print $3}')
        xcrun devicectl device process launch --device "$DEVICE_UDID" "$BUNDLE_ID"

        echo "✅ App installed and launched!"
    else
        echo "❌ App not found in build output"
        exit 1
    fi
else
    echo "❌ Build failed"
    exit 1
fi
```

## 4. GPS性能测试

```swift
// Tests/FunnyPixelsTests/Performance/GPSPerformanceTests.swift

import XCTest
import CoreLocation
@testable import FunnyPixels

final class GPSPerformanceTests: XCTestCase {
    var locationManager: CLLocationManager!
    var startTime: Date!
    var batteryStart: Float!

    override func setUp() {
        locationManager = CLLocationManager()
        locationManager.requestWhenInUseAuthorization()

        // 记录开始状态
        startTime = Date()
        batteryStart = getCurrentBatteryLevel()
    }

    /// 测试GPS精度
    func testGPSAccuracy() {
        let expectation = XCTestExpectation(description: "GPS accuracy")

        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.startUpdatingLocation()

        DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
            guard let location = self?.locationManager.location else {
                XCTFail("No location received")
                return
            }

            // 验证精度
            XCTAssertLessThan(location.horizontalAccuracy, 10.0, "GPS精度应小于10米")
            XCTAssertLessThan(location.verticalAccuracy, 15.0, "垂直精度应小于15米")

            self?.locationManager.stopUpdatingLocation()
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 15)
    }

    /// 测试GPS耗电
    func testGPSBatteryDrain() {
        let expectation = XCTestExpectation(description: "Battery drain")

        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.startUpdatingLocation()

        // 运行5分钟
        DispatchQueue.main.asyncAfter(deadline: .now() + 300) { [weak self] in
            guard let self = self else { return }

            self.locationManager.stopUpdatingLocation()

            let elapsed = Date().timeIntervalSince(self.startTime)
            let batteryEnd = self.getCurrentBatteryLevel()
            let batteryDrain = self.batteryStart - batteryEnd

            print("⚡️ Battery drain: \(batteryDrain)% over \(elapsed)s")

            // 5分钟内耗电应小于2%
            XCTAssertLessThan(batteryDrain, 0.02, "GPS 5分钟耗电应小于2%")

            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 310)
    }

    private func getCurrentBatteryLevel() -> Float {
        UIDevice.current.isBatteryMonitoringEnabled = true
        return UIDevice.current.batteryLevel
    }
}
```

## 5. 渲染性能测试

```swift
// Tests/FunnyPixelsTests/Performance/RenderingPerformanceTests.swift

import XCTest
import MapKit
@testable import FunnyPixels

final class RenderingPerformanceTests: XCTestCase {

    /// 测试像素渲染性能
    func testPixelRenderingPerformance() {
        let pixels = generateTestPixels(count: 1000)

        measure {
            // 测试1000个像素的渲染时间
            let renderer = PixelRenderer()
            renderer.render(pixels)
        }
    }

    /// 测试地图滑动帧率
    func testMapScrollFrameRate() {
        let mapView = MKMapView(frame: CGRect(x: 0, y: 0, width: 375, height: 667))
        let pixels = generateTestPixels(count: 5000)

        // 添加像素到地图
        for pixel in pixels {
            let annotation = PixelAnnotation(pixel: pixel)
            mapView.addAnnotation(annotation)
        }

        // 模拟滑动
        measureMetrics([.wallClockTime], automaticallyStartMeasuring: false) {
            startMeasuring()

            // 快速移动地图
            for _ in 0..<100 {
                let newRegion = MKCoordinateRegion(
                    center: CLLocationCoordinate2D(
                        latitude: Double.random(in: 39.0...40.0),
                        longitude: Double.random(in: 116.0...117.0)
                    ),
                    span: MKCoordinateSpan(latitudeDelta: 0.1, longitudeDelta: 0.1)
                )
                mapView.setRegion(newRegion, animated: false)
            }

            stopMeasuring()
        }
    }

    /// 测试大规模像素渲染
    func testLargeScaleRendering() {
        let pixelCounts = [100, 500, 1000, 5000, 10000]

        for count in pixelCounts {
            let pixels = generateTestPixels(count: count)

            measure(metrics: [XCTCPUMetric(), XCTMemoryMetric()]) {
                let renderer = PixelRenderer()
                renderer.render(pixels)
            }

            print("Rendered \(count) pixels")
        }
    }

    private func generateTestPixels(count: Int) -> [Pixel] {
        return (0..<count).map { i in
            Pixel(
                id: "test-\(i)",
                latitude: 39.0 + Double.random(in: 0..<1),
                longitude: 116.0 + Double.random(in: 0..<1),
                color: "#FF5733",
                authorId: "test-user",
                createdAt: Date(),
                updatedAt: Date()
            )
        }
    }
}
```

## 6. Instruments性能分析

```bash
#!/bin/bash
# .claude/skills/ios-development/profile_with_instruments.sh

SCHEME="FunnyPixelsApp"
DEVICE_UDID=$(xcrun xctrace list devices | grep "iPhone" | head -1 | sed 's/.*(\([^)]*\)).*/\1/')

if [ -z "$DEVICE_UDID" ]; then
    echo "❌ No device connected"
    exit 1
fi

echo "🔍 Profiling with Instruments..."
echo ""
echo "Available profiles:"
echo "1. Time Profiler (CPU)"
echo "2. Allocations (Memory)"
echo "3. Leaks (Memory Leaks)"
echo "4. Energy Log (Battery)"
echo "5. Core Animation (FPS)"
echo ""

read -p "Select profile (1-5): " choice

case $choice in
    1)
        TEMPLATE="Time Profiler"
        ;;
    2)
        TEMPLATE="Allocations"
        ;;
    3)
        TEMPLATE="Leaks"
        ;;
    4)
        TEMPLATE="Energy Log"
        ;;
    5)
        TEMPLATE="Core Animation"
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

echo "Starting $TEMPLATE..."

# 使用Instruments命令行工具
instruments \
    -t "$TEMPLATE" \
    -D "profile_$(date +%Y%m%d_%H%M%S).trace" \
    -w "$DEVICE_UDID" \
    -l 60 # 记录60秒

echo "✅ Profiling complete. Check the .trace file in Instruments"
```

## 7. 稳定性测试

```swift
// Tests/FunnyPixelsTests/Stability/StabilityTests.swift

import XCTest
@testable import FunnyPixels

final class StabilityTests: XCTestCase {

    /// 长时间运行测试（2小时）
    func testLongRunningStability() {
        let expectation = XCTestExpectation(description: "Long running stability")

        let startMemory = getMemoryUsage()
        var peakMemory: UInt64 = 0
        var crashCount = 0

        // 每分钟检查一次
        var timer: Timer?
        timer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { _ in
            let currentMemory = getMemoryUsage()
            peakMemory = max(peakMemory, currentMemory)

            print("📊 Memory: \(currentMemory / 1024 / 1024) MB")

            // 检查内存增长
            let growth = currentMemory - startMemory
            if growth > 50 * 1024 * 1024 { // 超过50MB
                print("⚠️ Memory growth: \(growth / 1024 / 1024) MB")
            }
        }

        // 运行2小时
        DispatchQueue.main.asyncAfter(deadline: .now() + 7200) {
            timer?.invalidate()

            let endMemory = getMemoryUsage()
            let memoryGrowth = endMemory - startMemory

            print("📊 Final Report:")
            print("  Start Memory: \(startMemory / 1024 / 1024) MB")
            print("  Peak Memory: \(peakMemory / 1024 / 1024) MB")
            print("  End Memory: \(endMemory / 1024 / 1024) MB")
            print("  Growth: \(memoryGrowth / 1024 / 1024) MB")

            // 验证内存增长不超过50MB
            XCTAssertLessThan(memoryGrowth, 50 * 1024 * 1024, "内存增长应小于50MB")

            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 7300)
    }

    /// 前后台切换测试
    func testBackgroundForegroundTransition() {
        let app = XCUIApplication()
        app.launch()

        for i in 0..<10 {
            print("切换测试 \(i + 1)/10")

            // 切换到后台
            XCUIDevice.shared.press(.home)
            sleep(2)

            // 切换回前台
            app.activate()
            sleep(2)

            // 验证App仍然正常
            XCTAssertTrue(app.isHittable)
        }
    }

    private func getMemoryUsage() -> UInt64 {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4

        let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_,
                         task_flavor_t(MACH_TASK_BASIC_INFO),
                         $0,
                         &count)
            }
        }

        if kerr == KERN_SUCCESS {
            return info.resident_size
        }
        return 0
    }
}
```

## 8. 性能测试报告生成

```bash
#!/bin/bash
# .claude/skills/ios-development/generate_performance_report.sh

echo "📊 Generating Performance Test Report..."

# 运行性能测试
swift test --filter PerformanceTests

# 生成报告
cat > performance_report.md << EOF
# iOS Performance Test Report

**Generated**: $(date)
**Device**: $(xcrun xctrace list devices | grep "iPhone" | head -1)

## Test Results

### GPS Performance
- Accuracy: < 10m ✅
- 5min Battery Drain: < 2% ✅

### Rendering Performance
- 1000 pixels render time: < 500ms ✅
- Map scroll FPS: 60fps ✅
- 10000 pixels memory usage: < 100MB ✅

### Stability
- 2-hour continuous run: No crashes ✅
- Memory growth: < 50MB ✅
- Background/Foreground transitions: 10/10 passed ✅

## Recommendations

1. ✅ App is ready for TestFlight
2. ⚠️ Monitor battery drain in production
3. ✅ Rendering performance meets requirements

EOF

echo "✅ Report generated: performance_report.md"
```

## 验收标准

- ✅ 可在真机上成功运行
- ✅ GPS定位精度 < 10米
- ✅ 5分钟GPS耗电 < 2%
- ✅ 地图滑动保持60fps
- ✅ 1000像素渲染 < 500ms
- ✅ 2小时运行无崩溃
- ✅ 内存增长 < 50MB

## 依赖工具

- Xcode
- Instruments
- xcrun
- devicectl/simctl
