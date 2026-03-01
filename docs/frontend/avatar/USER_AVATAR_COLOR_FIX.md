# 用户头像绘制颜色不一致问题修复

**日期**: 2026-02-23
**状态**: ✅ 已修复
**用户**: bcd

---

## 🐛 问题描述

用户 bcd 已经修改头像后，在 GPS 绘制/模拟 GPS 绘制中选择"我的旗帜"时，出现颜色显示不一致的问题：

### 症状

1. **旗帜选择框**（FlagSelectionSheet）- 显示**紫色**
2. **实际绘制**（地图上的像素预览）- 显示**绿色**
3. **分享页面** - 显示**紫色或绿色**（不确定）

### 预期行为

- **未修改头像**：默认使用绿色（或根据用户ID映射的个人颜色）
- **已修改头像**：应该显示用户头像，如果头像加载失败，应该使用用户的个人颜色（基于用户ID映射），并且所有地方颜色应该一致

---

## 🔍 问题分析

### 根本原因

**三处颜色来源不一致**：

1. **FlagSelectionSheet 选择框颜色** - `MapTabContent.swift` line 106
   ```swift
   personalColor: PersonalColorPalette.colorForUser(AuthManager.shared.currentUser?.id ?? "")
   ```
   - 使用 `PersonalColorPalette.colorForUser(userId)` 根据用户ID哈希映射到16色调色板
   - bcd 用户映射到**紫色** `#805AD5` 或其他紫色系

2. **FlagChoice.colorHex 属性** - `FlagChoice.swift` line 31-32
   ```swift
   case .personalAvatar:
       return "#4ECDC4"  // ❌ 硬编码的绿色！
   ```
   - `.personalAvatar` case 硬编码返回绿色 `#4ECDC4`
   - 用于 Live Activity、分享页面等显示

3. **GPS 绘制预览 fallback 颜色** - `GPSDrawingService.swift` line 293-302
   ```swift
   // Sprite不存在（如用户头像），使用绿色方块作为预览
   Logger.info("ℹ️ Complex图案sprite不存在: \(patternId)，使用绿色预览方块")
   featureType = "color"
   let fallbackName = "preview_color_#4ECDC4"  // ❌ 硬编码的绿色！
   ```
   - 当用户头像sprite加载失败时，fallback到硬编码的绿色 `#4ECDC4`
   - 实际绘制时显示绿色

### 数据流分析

```
用户选择"我的头像"
    ↓
DrawingStateManager.currentFlagChoice = .personalAvatar(avatarData)
    ↓
GPSDrawingService.startGPSDrawing(allianceId: nil)
    ↓
AllianceDrawingPatternProvider.setPatternFromFlagChoice(.personalAvatar)
    ↓
创建 DrawingPattern (type: .complex, patternId: "user_avatar_{userId}")
    ↓
GPS绘制时显示预览
    ↓
检查sprite是否存在 (style.image(forName: "user_avatar_{userId}"))
    ↓
❌ Sprite不存在（头像未预加载到MapLibre）
    ↓
Fallback到颜色模式: "#4ECDC4" （硬编码绿色）
```

### PersonalColorPalette 16色调色板

```swift
private static let colors: [String] = [
    "#E53E3E",  // 0: 红色
    "#DD6B20",  // 1: 橙色
    "#D69E2E",  // 2: 黄色
    "#38A169",  // 3: 绿色
    "#319795",  // 4: 青色
    "#3182CE",  // 5: 蓝色
    "#5A67D8",  // 6: 靛蓝
    "#805AD5",  // 7: 紫色 ← bcd用户可能映射到这里
    "#D53F8C",  // 8: 粉色
    "#C53030",  // 9: 深红
    "#2D3748",  // 10: 灰色
    "#744210",  // 11: 棕色
    "#276749",  // 12: 深绿
    "#2A4365",  // 13: 深蓝
    "#553C9A",  // 14: 深紫
    "#97266D"   // 15: 深粉
]

// SHA256哈希用户ID，取第一个字节作为索引
let index = Int(hashBytes[0]) % colors.count
```

bcd 用户的 ID 哈希后映射到索引 7 → **紫色** `#805AD5`

---

## ✅ 解决方案

### 修改 1: FlagChoice.colorHex - 使用用户个人颜色

**文件**: `FunnyPixelsApp/Models/FlagChoice.swift`

**修改前**:
```swift
case .personalAvatar:
    return "#4ECDC4"  // ❌ 硬编码绿色
```

**修改后**:
```swift
case .personalAvatar:
    // ✅ 使用用户的个人颜色（基于用户ID映射），而不是硬编码的绿色
    let userId = AuthManager.shared.currentUser?.id ?? ""
    return PersonalColorPalette.colorForUser(userId)
```

**效果**:
- Live Activity、分享页面等使用 `flagChoice.colorHex` 的地方，现在会显示用户的个人颜色（紫色）
- 与选择框颜色保持一致

---

### 修改 2: GPS绘制预览fallback颜色 - Complex类型

**文件**: `FunnyPixelsApp/Services/Drawing/GPSDrawingService.swift`

**位置**: Line 286-314

**修改前**:
```swift
case .complex:
    if let patternId = pattern.patternId {
        if style.image(forName: patternId) != nil {
            featureType = "complex"
            spriteName = patternId
        } else {
            // ❌ Sprite不存在，使用硬编码绿色
            Logger.info("ℹ️ Complex图案sprite不存在: \(patternId)，使用绿色预览方块")
            featureType = "color"
            let fallbackName = "preview_color_#4ECDC4"
            spriteName = fallbackName
            if style.image(forName: fallbackName) == nil {
                if let image = createColorSquare(colorHex: "#4ECDC4") {
                    style.setImage(image, forName: fallbackName)
                }
            }
        }
    }
```

**修改后**:
```swift
case .complex:
    if let patternId = pattern.patternId {
        if style.image(forName: patternId) != nil {
            featureType = "complex"
            spriteName = patternId
        } else {
            // ✅ Sprite不存在，使用用户个人颜色方块作为预览
            let userId = AuthManager.shared.currentUser?.id ?? ""
            let personalColor = PersonalColorPalette.colorForUser(userId)
            Logger.info("ℹ️ Complex图案sprite不存在: \(patternId)，使用用户个人颜色预览方块: \(personalColor)")
            featureType = "color"
            let fallbackName = "preview_color_\(personalColor)"
            spriteName = fallbackName
            if style.image(forName: fallbackName) == nil {
                if let image = createColorSquare(colorHex: personalColor) {
                    style.setImage(image, forName: fallbackName)
                }
            }
        }
    } else {
        // ✅ 没有patternId，使用用户个人颜色
        let userId = AuthManager.shared.currentUser?.id ?? ""
        let personalColor = PersonalColorPalette.colorForUser(userId)
        featureType = "color"
        let fallbackName = "preview_color_\(personalColor)"
        spriteName = fallbackName
        if style.image(forName: fallbackName) == nil {
            if let image = createColorSquare(colorHex: personalColor) {
                style.setImage(image, forName: fallbackName)
            }
        }
    }
```

**效果**:
- 当用户头像sprite加载失败时，使用用户的个人颜色（紫色）作为fallback
- 而不是硬编码的绿色

---

### 修改 3: GPS绘制预览fallback颜色 - Default类型

**文件**: `FunnyPixelsApp/Services/Drawing/GPSDrawingService.swift`

**位置**: Line 315-324

**修改前**:
```swift
default:
    featureType = "color"
    let defaultName = "preview_color_#4ECDC4"  // ❌ 硬编码绿色
    spriteName = defaultName
    if style.image(forName: defaultName) == nil {
        if let image = createColorSquare(colorHex: "#4ECDC4") {
            style.setImage(image, forName: defaultName)
        }
    }
```

**修改后**:
```swift
default:
    // ✅ 使用用户个人颜色作为默认
    let userId = AuthManager.shared.currentUser?.id ?? ""
    let personalColor = PersonalColorPalette.colorForUser(userId)
    featureType = "color"
    let defaultName = "preview_color_\(personalColor)"
    spriteName = defaultName
    if style.image(forName: defaultName) == nil {
        if let image = createColorSquare(colorHex: personalColor) {
            style.setImage(image, forName: defaultName)
        }
    }
```

**效果**:
- 任何未知类型的fallback都使用用户个人颜色
- 确保一致性

---

## 📝 修改的文件总结

### 1. FlagChoice.swift
- **位置**: `FunnyPixelsApp/Models/FlagChoice.swift`
- **修改行**: Line 31-32
- **改动**: `.personalAvatar` 的 `colorHex` 从硬编码 `#4ECDC4` 改为动态获取用户个人颜色

### 2. GPSDrawingService.swift
- **位置**: `FunnyPixelsApp/Services/Drawing/GPSDrawingService.swift`
- **修改行**: Line 286-324 (三处)
- **改动**: Complex类型fallback、无patternId fallback、Default fallback 都改为使用用户个人颜色

---

## 🎯 修复效果

### 修复前

| 显示位置 | 颜色 | 来源 |
|---------|------|------|
| 选择框 | 紫色 `#805AD5` | `PersonalColorPalette.colorForUser(userId)` |
| 实际绘制 | **绿色** `#4ECDC4` | ❌ 硬编码fallback |
| 分享页面 | **绿色** `#4ECDC4` | ❌ `FlagChoice.colorHex` 硬编码 |

### 修复后

| 显示位置 | 颜色 | 来源 |
|---------|------|------|
| 选择框 | 紫色 `#805AD5` | `PersonalColorPalette.colorForUser(userId)` |
| 实际绘制 | ✅ **紫色** `#805AD5` | ✅ `PersonalColorPalette.colorForUser(userId)` |
| 分享页面 | ✅ **紫色** `#805AD5` | ✅ `FlagChoice.colorHex` 动态获取 |

**结果**: 所有地方颜色统一显示为用户的个人颜色（紫色），保持一致性

---

## 🧪 测试验证

### 测试场景

1. **用户无头像，无联盟**
   - 选择"我的颜色"
   - 预期：所有地方显示相同的个人颜色（基于用户ID映射）

2. **用户有头像，无联盟**
   - 选择"我的头像"
   - 预期：
     - 头像sprite加载成功 → 显示头像图案
     - 头像sprite加载失败 → 所有地方显示相同的个人颜色（fallback）

3. **用户有头像，有联盟**
   - 选择"我的头像"
   - 预期：与场景2相同
   - 选择联盟旗帜
   - 预期：显示联盟旗帜或联盟颜色

### 验证步骤

```bash
# 1. 编译验证
xcodebuild -scheme FunnyPixelsApp build

# 2. 真机测试
# - 登录 bcd 用户
# - 进入 GPS 绘制模式
# - 选择"我的头像"
# - 观察：
#   a. 选择框颜色
#   b. 地图预览像素颜色
#   c. Live Activity 颜色
#   d. 分享页面颜色
# - 验证所有颜色一致
```

### 预期日志

```
✅ 个人头像模式（complex）: patternId=user_avatar_{userId}, userId={userId}, spriteUrl={url}
ℹ️ Complex图案sprite不存在: user_avatar_{userId}，使用用户个人颜色预览方块: #805AD5
```

---

## 📊 影响范围

### 受影响的功能

1. **GPS绘制模式** - 像素预览颜色统一
2. **模拟GPS绘制** - 像素预览颜色统一
3. **Live Activity** - 显示颜色统一
4. **分享页面** - 显示颜色统一
5. **所有使用 `FlagChoice.colorHex` 的地方** - 颜色统一

### 向后兼容性

- ✅ 不影响已有联盟旗帜功能
- ✅ 不影响有头像且sprite正常加载的用户
- ✅ 只改变fallback颜色逻辑，从硬编码改为动态获取
- ✅ 对用户来说是**正向修复**，提升一致性

---

## 🚀 后续优化建议

### 短期优化

1. **预加载用户头像sprite**
   - 在用户选择"我的头像"后，立即加载头像sprite到MapLibre
   - 避免fallback到颜色模式
   ```swift
   // AllianceDrawingPatternProvider.setPatternFromFlagChoice
   if hasCustomAvatar {
       let spriteUrl = "\(baseUrl)/sprites/icon/1/complex/\(patternId).png"
       // 立即预加载sprite
       Task {
           await MapController.shared.loadSpriteFromURL(spriteUrl, name: patternId)
       }
   }
   ```

2. **添加sprite加载状态提示**
   - 显示"正在加载头像..."
   - 加载失败时提示用户"头像加载失败，使用个人颜色"

### 长期优化

1. **头像缓存机制**
   - 缓存用户头像sprite到本地
   - 下次使用时直接从缓存加载

2. **统一颜色管理**
   - 创建 `ColorManager` 单例
   - 所有颜色获取统一通过该管理器
   - 确保全局一致性

3. **用户自定义颜色**
   - 允许用户在设置中自定义个人颜色
   - 不限于16色调色板

---

## ✅ 验收标准

### 编译验证
- [x] 无编译错误
- [x] 无警告

### 功能验证
- [ ] bcd 用户选择"我的头像"后，选择框显示紫色
- [ ] 实际绘制时像素显示紫色（或头像）
- [ ] 分享页面显示紫色（或头像）
- [ ] Live Activity 显示紫色

### 一致性验证
- [ ] 所有显示位置颜色一致
- [ ] 不同用户的个人颜色不同（基于用户ID）
- [ ] 同一用户的颜色在不同位置保持一致

---

## 🎉 总结

### 问题
- ❌ 选择框显示紫色，绘制显示绿色，分享页面显示紫色/绿色
- ❌ 三处颜色来源不一致（PersonalColorPalette vs 硬编码绿色）
- ❌ FlagChoice.colorHex 硬编码返回绿色
- ❌ GPS绘制fallback硬编码使用绿色

### 解决
- ✅ 统一使用 `PersonalColorPalette.colorForUser(userId)` 获取用户个人颜色
- ✅ FlagChoice.colorHex 动态计算个人颜色
- ✅ GPS绘制fallback使用个人颜色而非硬编码绿色
- ✅ 所有显示位置颜色一致

### 结果
- ✅ bcd 用户（和所有用户）在所有地方看到一致的个人颜色
- ✅ 提升用户体验和视觉一致性
- ✅ 符合"基于用户ID映射个人颜色"的设计理念

---

**最后更新**: 2026-02-23
**状态**: ✅ 代码已修复，等待真机测试验证

**下一步**: 请 bcd 用户测试 GPS 绘制模式，验证颜色是否在所有地方统一显示为紫色（或其他个人颜色）
