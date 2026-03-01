import XCTest
#if canImport(MapLibre)
import MapLibre
#endif
@testable import FunnyPixelsApp

/// 测试 MapLibre Native iOS 对 NSExpression 的限制
/// 验证 forKeyPath 在 iconImageName 上的使用是否会被禁止
@available(iOS 13.0, *)
class MapLibreExpressionTest: XCTestCase {
    
    /// 测试1: 验证 forKeyPath 在 iconImageName 上的行为
    /// 预期：可能会失败或产生错误
    func testForKeyPathWithIconImageName() {
        #if canImport(MapLibre)
        // 创建一个测试图层
        let source = MLNShapeSource(identifier: "test-source", shapes: [])
        let layer = MLNSymbolStyleLayer(identifier: "test-layer", source: source)
        
        // 尝试使用 forKeyPath 设置 iconImageName
        let expression = NSExpression(forKeyPath: "emoji")
        
        // 记录测试信息
        print("🔍 Testing NSExpression(forKeyPath: \"emoji\")")
        print("   Expression type: \(type(of: expression))")
        print("   Expression description: \(expression)")
        
        // 尝试设置 iconImageName
        var didSet = false
        var errorOccurred = false
        var errorMessage: String?
        
        do {
            // 尝试设置属性
            layer.iconImageName = expression
            didSet = true
            print("   ✅ Successfully set iconImageName with forKeyPath")
        } catch {
            errorOccurred = true
            errorMessage = error.localizedDescription
            print("   ❌ Error setting iconImageName: \(error.localizedDescription)")
        }
        
        // 验证结果
        if didSet {
            // 如果成功设置，检查表达式是否被转换
            let currentExpression = layer.iconImageName
            print("   Current iconImageName expression: \(String(describing: currentExpression))")
            
            // 检查是否被转换为其他形式
            let expressionString = currentExpression?.description ?? "nil"
            if expressionString.contains("MLN_FUNCTION") {
                print("   ⚠️ Expression was converted to MLN_FUNCTION (may be forbidden)")
            }
        }
        
        // 记录测试结果
        print("   Test result: didSet=\(didSet), errorOccurred=\(errorOccurred)")
        
        // 注意：这个测试不会自动失败，因为我们需要观察实际行为
        // 如果 forKeyPath 被禁止，可能会在运行时失败或静默转换
        #else
        print("⚠️ MapLibre not available, skipping test")
        #endif
    }
    
    /// 测试2: 验证 mglJSONObject 方式是否正常工作
    func testMglJSONObjectWithIconImageName() {
        #if canImport(MapLibre)
        let source = MLNShapeSource(identifier: "test-source-2", shapes: [])
        let layer = MLNSymbolStyleLayer(identifier: "test-layer-2", source: source)
        
        // 使用 mglJSONObject 方式（当前项目使用的方法）
        let expression = NSExpression(mglJSONObject: ["get", "emoji"])
        
        print("🔍 Testing NSExpression(mglJSONObject: [\"get\", \"emoji\"])")
        print("   Expression type: \(type(of: expression))")
        print("   Expression description: \(expression)")
        
        var didSet = false
        var errorOccurred = false
        
        do {
            layer.iconImageName = expression
            didSet = true
            print("   ✅ Successfully set iconImageName with mglJSONObject")
        } catch {
            errorOccurred = true
            print("   ❌ Error setting iconImageName: \(error.localizedDescription)")
        }
        
        XCTAssertTrue(didSet, "mglJSONObject should work for iconImageName")
        XCTAssertFalse(errorOccurred, "mglJSONObject should not cause errors")
        #else
        print("⚠️ MapLibre not available, skipping test")
        #endif
    }
    
    /// 测试3: 对比 forKeyPath 和 mglJSONObject 的行为差异
    func testExpressionComparison() {
        #if canImport(MapLibre)
        let forKeyPathExpr = NSExpression(forKeyPath: "emoji")
        let mglJSONExpr = NSExpression(mglJSONObject: ["get", "emoji"])
        
        print("🔍 Comparing expression types:")
        print("   forKeyPath type: \(type(of: forKeyPathExpr))")
        print("   mglJSONObject type: \(type(of: mglJSONExpr))")
        print("   forKeyPath description: \(forKeyPathExpr)")
        print("   mglJSONObject description: \(mglJSONExpr)")
        
        // 检查表达式是否相等
        let areEqual = forKeyPathExpr == mglJSONExpr
        print("   Expressions are equal: \(areEqual)")
        
        // 检查表达式哈希值
        print("   forKeyPath hash: \(forKeyPathExpr.hashValue)")
        print("   mglJSONObject hash: \(mglJSONExpr.hashValue)")
        #else
        print("⚠️ MapLibre not available, skipping test")
        #endif
    }
    
    /// 测试4: 验证 iconColor 使用 forKeyPath 是否正常（应该可以工作）
    func testForKeyPathWithIconColor() {
        #if canImport(MapLibre)
        let source = MLNShapeSource(identifier: "test-source-3", shapes: [])
        let layer = MLNSymbolStyleLayer(identifier: "test-layer-3", source: source)
        
        // iconColor 应该可以使用 forKeyPath（根据报告）
        let expression = NSExpression(forKeyPath: "color")
        
        print("🔍 Testing NSExpression(forKeyPath: \"color\") for iconColor")
        
        var didSet = false
        do {
            layer.iconColor = expression
            didSet = true
            print("   ✅ Successfully set iconColor with forKeyPath")
        } catch {
            print("   ❌ Error setting iconColor: \(error.localizedDescription)")
        }
        
        // iconColor 应该可以使用 forKeyPath
        XCTAssertTrue(didSet, "forKeyPath should work for iconColor")
        #else
        print("⚠️ MapLibre not available, skipping test")
        #endif
    }
}
