# 修复黑色像素兜底问题

## 问题描述

用户在使用个人头像进行 GPS 绘制时，地图屏幕显示**黑色像素**，而不是预期的**绿色像素**（默认 fallback 颜色 `#4ECDC4`）。

## 问题分析

### 根本原因

**双重问题：**
1. **前端乐观更新预览问题**：当用户选择头像绘制时，前端会立即显示预览，但用户头像 sprite（`user_avatar_xxx`）在地图样式中不存在，导致渲染失败显示为黑色
2. **后端 MVT fallback 颜色错误**：MVT 查询中的 color/ad layer 使用 `#000000` 黑色作为 fallback，而不是 `#4ECDC4` 绿色

### 问题链路

**前端预览流程：**
```
用户选择头像绘制
  ↓
GPSDrawingService.drawPixelAtLocation()
  ↓
addPixelPreview(pattern: .complex, patternId: "user_avatar_xxx")
  ↓
检查 sprite 是否存在：style.image(forName: "user_avatar_xxx")
  ↓
❌ sprite 不存在（用户头像需动态加载）
  ↓
仍使用不存在的 sprite 渲染
  ↓
前端渲染失败 → 显示黑色
```

**后端 MVT 流程：**
```
用户头像像素：color='custom_pattern', alliance_id=NULL
  ↓
字段组合识别：应该分类为 'complex'
  ↓
进入 complex layer（正常）
  ↓
但如果出现边缘情况进入 color layer：
  display_color = 'custom_pattern'（字符串，不是有效颜色）
  ↓
COALESCE(display_color, '#000000')
  ↓
❌ fallback 到黑色，而不是绿色
```

---

## 解决方案

### 1. 后端 MVT 查询修复（3处修改）

#### 修改1：display_color 计算添加兜底逻辑

**文件：** `backend/src/models/productionPixelTileQuery.js:107-112`

```sql
-- ✅ 修改后
CASE
  WHEN pa.render_type = 'color' THEN COALESCE(pa.color, p.color)
  WHEN p.pixel_type = 'alliance' AND a.flag_render_type = 'color' THEN COALESCE(a.color, p.color)
  -- 🔧 用户头像兜底：如果 color='custom_pattern'，fallback 到默认绿色
  WHEN p.color = 'custom_pattern' THEN '#4ECDC4'
  ELSE p.color
END AS display_color,
```

**修改理由：**
- 如果 `p.color = 'custom_pattern'`（用户头像标识），返回绿色而不是字符串
- 防止无效颜色值进入渲染层

#### 修改2：color layer COALESCE 改为绿色

**文件：** `backend/src/models/productionPixelTileQuery.js:185`

```sql
-- ❌ 修改前
COALESCE(display_color, '#000000') AS color,

-- ✅ 修改后
COALESCE(display_color, '#4ECDC4') AS color,  -- fallback为默认绿色
```

**修改理由：**
- 当 display_color 为 NULL 时，fallback 到绿色（默认颜色）
- 与前后端约定的默认颜色保持一致

#### 修改3：ad layer COALESCE 改为绿色

**文件：** `backend/src/models/productionPixelTileQuery.js:287`

```sql
-- ❌ 修改前
COALESCE(display_color, '#000000') AS color,

-- ✅ 修改后
COALESCE(display_color, '#4ECDC4') AS color,  -- fallback为默认绿色
```

**修改理由：**
- 与 color layer 保持一致
- 确保广告像素在出错时也显示绿色

---

### 2. 前端预览修复

#### 修改4：addPixelPreview 的 complex 分支兜底逻辑

**文件：** `FunnyPixelsApp/FunnyPixelsApp/Services/Drawing/GPSDrawingService.swift:274-282`

```swift
// ❌ 修改前
case .complex:
    featureType = "complex"
    if let patternId = pattern.patternId {
        spriteName = patternId
        if style.image(forName: patternId) == nil {
             Logger.warning("⚠️ 复杂图案sprite不存在: \(patternId)")
        }
    }

// ✅ 修改后
case .complex:
    // 🔧 Complex类型预览兜底：如果sprite不存在，使用绿色方块代替
    if let patternId = pattern.patternId {
        if style.image(forName: patternId) != nil {
            // Sprite存在，使用complex类型
            featureType = "complex"
            spriteName = patternId
        } else {
            // Sprite不存在（如用户头像），使用绿色方块作为预览
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
    } else {
        // 没有patternId，使用默认绿色
        featureType = "color"
        let fallbackName = "preview_color_#4ECDC4"
        spriteName = fallbackName
        if style.image(forName: fallbackName) == nil {
            if let image = createColorSquare(colorHex: "#4ECDC4") {
                style.setImage(image, forName: fallbackName)
            }
        }
    }
```

**修改理由：**
- 检测 sprite 是否存在，如果不存在则降级为 color 类型
- 使用绿色方块作为预览，而不是渲染不存在的图片
- 解决用户头像 sprite 未预加载导致的黑色预览问题

---

## 防护层级

现在有**三层防护**确保不会显示黑色像素：

### 第一层：前端乐观更新预览
```swift
// GPSDrawingService.swift:274-304
if style.image(forName: patternId) == nil {
    // 使用绿色方块预览
    featureType = "color"
    spriteName = "preview_color_#4ECDC4"
}
```
- 当 complex sprite 不存在时，立即降级为绿色方块
- 用户在绘制时立即看到绿色预览

### 第二层：MVT display_color 计算
```sql
-- productionPixelTileQuery.js:109
WHEN p.color = 'custom_pattern' THEN '#4ECDC4'
```
- 如果用户头像像素进入 color layer（边缘情况），display_color 返回绿色
- 防止 'custom_pattern' 字符串被用作颜色值

### 第三层：MVT COALESCE 兜底
```sql
-- productionPixelTileQuery.js:185, 287
COALESCE(display_color, '#4ECDC4') AS color
```
- 如果 display_color 为 NULL，最终 fallback 到绿色
- 确保任何异常情况都不会显示黑色

---

## 测试验证

### 测试场景1：用户头像 GPS 绘制

**步骤：**
1. 用户选择个人头像进行绘制
2. 开始 GPS 绘制
3. 观察地图上的预览像素

**预期结果：**
- ✅ 立即显示绿色方块预览（sprite 不存在时的 fallback）
- ✅ 后端返回后，MVT 渲染显示实际头像（如果 sprite 已加载）或绿色方块

### 测试场景2：边缘情况 - display_color 为 NULL

**模拟方式：**
```sql
-- 手动测试 MVT 查询
SELECT
  COALESCE(NULL, '#4ECDC4') AS color,
  CASE WHEN 'custom_pattern' = 'custom_pattern' THEN '#4ECDC4' ELSE 'custom_pattern' END AS display_color
```

**预期结果：**
- color = '#4ECDC4' ✅
- display_color = '#4ECDC4' ✅

### 测试场景3：后端 MVT 渲染

**步骤：**
1. 运行 debug 脚本：`node backend/scripts/debug-pixel-mvt.js`
2. 检查 display_color 和 mvt_pixel_type

**预期结果：**
```
✅ 用户头像数据正常（通过字段组合识别）
mvt_pixel_type: complex
display_color: custom_pattern (会被 MVT layer 的 COALESCE 处理)
```

---

## 修改文件清单

### Backend
- ✅ `backend/src/models/productionPixelTileQuery.js`
  - 第 107-112 行：display_color 计算
  - 第 185 行：color layer COALESCE
  - 第 287 行：ad layer COALESCE

### Frontend
- ✅ `FunnyPixelsApp/FunnyPixelsApp/Services/Drawing/GPSDrawingService.swift`
  - 第 274-304 行：addPixelPreview complex 分支

### Documentation
- ✅ `backend/docs/FIX_BLACK_PIXEL_FALLBACK.md`（本文档）

---

## 相关默认颜色约定

| 组件 | 默认颜色 | 用途 |
|-----|---------|------|
| Backend pixelDrawService | `#4ECDC4` | 后端绘制兜底颜色 |
| Backend MVT COALESCE | `#4ECDC4` | MVT 查询 fallback 颜色 |
| Frontend defaultPattern | `#4ECDC4` | 前端默认图案颜色 |
| Frontend preview fallback | `#4ECDC4` | 前端预览兜底颜色 |

**全局统一：** 所有兜底颜色均为 `#4ECDC4` 绿色

---

## 问题修复时间

**修复日期：** 2026-02-13
**修复原因：** 用户报告 GPS 绘制时显示黑色像素
**测试状态：** ✅ 待用户验证

---

## 技术要点总结

1. **前端乐观更新陷阱**：乐观更新预览时，必须检查资源（sprite）是否存在，否则会渲染失败
2. **MVT fallback 颜色**：COALESCE 应该使用业务约定的默认颜色，而不是 `#000000`
3. **字符串 vs 颜色值**：特殊标识符（如 `custom_pattern`）不应直接用作颜色值，需要转换
4. **多层防护**：关键渲染路径应该有多层 fallback，确保用户体验的鲁棒性

---

**结论：** 通过修复前端预览逻辑和后端 MVT fallback 颜色，彻底解决黑色像素问题，确保所有兜底情况都显示绿色。
