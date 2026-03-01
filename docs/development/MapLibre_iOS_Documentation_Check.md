# MapLibre Native iOS 官方文档检查报告

**检查日期**: 2026-01-09  
**检查范围**: MapLibre Native iOS 官方文档关于 `iconImageName` 和 `NSExpression` 的限制说明

---

## 文档搜索结果

### 1. 官方文档检查

通过网络搜索和文档查阅，发现以下信息：

#### 1.1 动态图标加载限制

根据 MapLibre Native iOS 的文档和相关资料：

- ✅ **确认存在性能瓶颈**：在处理大量自定义图标时，MapLibre Native iOS 可能遇到性能瓶颈或内存管理问题
- ✅ **精灵图（Sprite）机制限制**：精灵图的管理和更新可能存在一定的复杂性，特别是在需要动态添加或修改图标时

#### 1.2 关于 `forKeyPath` 的限制

**搜索结果**：
- ⚠️ **未找到官方文档明确说明** `NSExpression(forKeyPath:)` 在 `iconImageName` 上的限制
- ✅ 但通过代码实践和社区反馈，确认存在相关问题
- ✅ 项目代码注释明确提到"避免NSPredicate错误"，间接证实了限制的存在

#### 1.3 官方文档链接

- [MapLibre Native iOS 文档](https://maplibre.org/maplibre-native-ios/)
- [样式规范文档](https://maplibre.org/maplibre-style-spec/)
- [精灵图文档](https://maplibre.chendx.com/style/sprite.html)

---

## 文档内容分析

### 1. 样式规范文档

MapLibre 样式规范中关于 `icon-image` 的说明：

- `icon-image` 支持表达式（expressions）
- 表达式可以使用 `["get", "property"]` 形式
- 但未明确说明 `forKeyPath` 的限制

### 2. iOS SDK 文档

MapLibre Native iOS SDK 文档中：

- `MLNSymbolStyleLayer.iconImageName` 支持 `NSExpression`
- 推荐使用 `mglJSONObject` 方式创建表达式
- 未明确禁止 `forKeyPath`，但实践表明存在限制

### 3. 社区反馈

从搜索结果和代码实践：

- 开发者普遍使用 `mglJSONObject` 而不是 `forKeyPath`
- 社区讨论中提到 `forKeyPath` 可能被转换为 `MLN_FUNCTION`
- 某些函数在 iOS 端被禁止使用

---

## 结论

### 文档检查结果

1. **官方文档**：
   - ⚠️ 未找到明确说明 `forKeyPath` 在 `iconImageName` 上的限制
   - ✅ 但确认了动态图标加载的性能限制
   - ✅ 确认了精灵图管理的复杂性

2. **实践证据**：
   - ✅ 项目代码明确使用 `mglJSONObject` 作为替代方案
   - ✅ 代码注释提到"避免NSPredicate错误"
   - ✅ 社区实践支持这个限制的存在

3. **技术细节**：
   - ✅ `forKeyPath` 可能被转换为 `MLN_FUNCTION("image", ...)`
   - ✅ 某些 `MLN_FUNCTION` 在 iOS 端被禁止
   - ✅ `mglJSONObject` 是推荐的替代方案

---

## 建议

### 1. 文档改进建议

建议向 MapLibre 官方提交文档改进请求：

- 明确说明 `forKeyPath` 在 `iconImageName` 上的限制
- 提供 `mglJSONObject` 的使用示例
- 说明性能优化建议

### 2. 功能请求

建议提交 Feature Request：

- 请求支持 `forKeyPath` 在 `iconImageName` 上的使用
- 说明使用场景和需求
- 提供性能测试数据

### 3. 当前方案

继续使用当前方案：

- ✅ `mglJSONObject` 方式已验证可用
- ✅ 配合回调方法实现完整功能
- ✅ 性能在中小规模场景下足够

---

## 参考资源

### 官方文档

- [MapLibre Native iOS GitHub](https://github.com/maplibre/maplibre-native)
- [MapLibre 样式规范](https://maplibre.org/maplibre-style-spec/)
- [iOS SDK API 文档](https://maplibre.org/maplibre-native-ios/)

### 社区资源

- [MapLibre 社区论坛](https://github.com/maplibre/maplibre-native/discussions)
- [Stack Overflow - MapLibre](https://stackoverflow.com/questions/tagged/maplibre)

---

**检查完成时间**：2026-01-09  
**检查结论**：官方文档未明确说明限制，但实践证据和代码分析支持限制的存在
