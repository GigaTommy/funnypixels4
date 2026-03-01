# 用户头像像素地图显示调试指南

## 问题描述
用户头像像素（使用 GPS 绘制）在数据库中存在，在历史记录页面显示正常，但在地图上无法显示。

示例：grid_2932939_1131364 应该在新大新显示，但地图上看不到。

## 诊断结果

### ✅ 已确认正常的部分

1. **数据库记录存在**
   - grid_id: grid_2932939_1131364
   - color: custom_pattern
   - pattern_id: user_avatar_a79a1fbe-0f97-4303-b922-52b35e6948d5
   - alliance_id: null (正确，用于识别用户头像)
   - user.avatar_url: /uploads/materials/avatars/.../avatar_...png

2. **MVT 查询逻辑正确**
   - 能正确识别 color='custom_pattern' AND alliance_id=NULL 为用户头像
   - 能正确从 users.avatar_url 获取图片路径
   - MVT complex 层包含 image_url 字段

3. **iOS 相对路径处理正确**
   - `registerComplexSpriteFromURL` 会将 `/uploads/...` 拼接为 `http://localhost:3001/uploads/...`

### ❓ 可能的问题点

1. **MVT 瓦片扫描未触发**
   - 扫描只在 zoom >= 12 时触发
   - 扫描有 3 秒节流
   - 可能用户缩放级别不对或位置不对

2. **Sprite 加载失败**
   - 网络请求失败
   - 图片解码失败
   - URL 拼接错误

3. **MapLibre 渲染问题**
   - Sprite 加载成功但未渲染
   - Layer 配置问题

## 调试步骤

### 步骤 1: 重新编译 iOS App

```bash
cd FunnyPixelsApp
xcodebuild clean
xcodebuild build
```

### 步骤 2: 清除缓存并重启

1. 完全关闭 App
2. 删除并重新安装
3. 清除浏览器缓存（如果有 web 版本）

### 步骤 3: 定位到正确位置

1. 打开地图
2. 搜索并定位到 **新大新购物广场**（广州）
3. 确保缩放级别在 **zoom 14-18** 之间
4. 经纬度：23.13645, 113.29395

### 步骤 4: 查看详细日志

在 Xcode Console 中搜索以下关键字：

#### A. 扫描触发
```
[MVT Scan] Starting scan
```
- 如果没有看到：检查缩放级别是否 >= 12

#### B. 扫描结果
```
[MVT Scan] Found X complex features in viewport
```
- 如果 X = 0：MVT 瓦片可能没有包含该像素

#### C. 缺失 Sprite 检测
```
[MVT Scan] Found missing sprite: patternId=user_avatar_...
```
- 应该能看到 pattern_id 和 imageUrl

#### D. Sprite 加载
```
🎨 [MVT Scan] Loading sprite: user_avatar_...
    imageUrl: /uploads/materials/avatars/...
    ✅ SUCCESS
```
或
```
    ❌ FAILED
```

#### E. 具体错误
如果失败，查找：
```
❌ [Renderer] Failed to register sprite from URL
❌ [Renderer] Failed to decode image from URL
❌ [Renderer] Invalid sprite URL
```

### 步骤 5: 验证 MVT 瓦片

使用 curl 测试瓦片是否包含该像素：

```bash
# 计算瓦片坐标（zoom 14）
# 新大新：23.13645, 113.29395
# 瓦片：14/13516/6782

curl -v "http://localhost:3001/api/tiles/pixels/14/13516/6782.pbf" > /tmp/tile.pbf

# 检查瓦片大小
ls -lh /tmp/tile.pbf
```

如果瓦片为空或很小（< 1KB），说明 MVT 查询有问题。

### 步骤 6: 手动测试 URL

在浏览器中打开：
```
http://localhost:3001/uploads/materials/avatars/a7/9a/avatar_013cbbec0135658e716272220a9c0b2d_medium.png
```

如果图片无法加载，说明：
- 文件路径不对
- 静态文件服务配置有问题

## 已实施的修复

### 1. WebSocket imageUrl 修复
**文件**: HighPerformanceMVTRenderer.swift:1490
```swift
imageUrl: pixel.imageUrl  // ✅ 修复前是 nil
```

### 2. 动态 Sprite 加载
**文件**: HighPerformanceMVTRenderer.swift:1621-1640
- WebSocket 同步时自动加载缺失的 sprite

### 3. 增强 MVT 扫描
**文件**: HighPerformanceMVTRenderer.swift:1835-1935
- 同时扫描 MVT 层和 hotpatch 层
- 支持 pattern_id fallback 到 grid_id
- 详细日志输出
- 强制重新渲染

### 4. Layer Z-Order 修复
**文件**: HighPerformanceMVTRenderer.swift
- 所有 hotpatch 层添加 `symbolZOrder = "source"`
- 确保新像素显示在旧像素上方

## 预期日志输出（成功场景）

```
🔍 [MVT Scan] Starting scan at zoom=14.5, center=(23.13645, 113.29395)
🔍 [MVT Scan] Found 15 complex features in viewport
🔍 [MVT Scan] Found missing sprite: patternId=user_avatar_a79a1fbe-0f97-4303-b922-52b35e6948d5, imageUrl=/uploads/materials/avatars/a7/9a/avatar_013cbbec0135658e716272220a9c0b2d_medium.png, gridId=grid_2932939_1131364
🔍 [MVT Scan] Found 1 missing complex sprites in viewport, loading...
🎨 [MVT Scan] [1/1] Loading sprite: user_avatar_a79a1fbe-0f97-4303-b922-52b35e6948d5
    imageUrl: /uploads/materials/avatars/a7/9a/avatar_013cbbec0135658e716272220a9c0b2d_medium.png
    gridId: grid_2932939_1131364
🖼️ [Renderer] Registering complex sprite from URL: user_avatar_a79a1fbe-0f97-4303-b922-52b35e6948d5, URL: http://localhost:3001/uploads/materials/avatars/a7/9a/avatar_013cbbec0135658e716272220a9c0b2d_medium.png
✅ [Renderer] Downloaded and registered sprite SUCCESS: user_avatar_a79a1fbe-0f97-4303-b922-52b35e6948d5 from http://localhost:3001/uploads/materials/avatars/...
    ✅ SUCCESS
🔄 [MVT Scan] Refreshed hotpatch source
✅ [MVT Scan] Dynamic sprite loading complete: 1 succeeded, 0 failed
🔄 [MVT Scan] Forced layer re-render
```

## 可能的失败原因

### A. MVT 瓦片不包含像素

**症状**: `Found 0 complex features in viewport`

**原因**:
1. 像素的 geom_quantized 不在瓦片范围内
2. MVT 查询的 SRID 不匹配（4326 vs 3857）
3. 采样率过低导致像素被过滤

**解决**:
- 检查 pixels.geom_quantized 字段
- 验证 SRID 是否为 4326
- 降低 MVT 查询的采样率

### B. image_url 字段缺失

**症状**: `Skipped pattern '...' with no imageUrl`

**原因**:
1. MVT 查询没有包含 image_url 字段
2. users.avatar_url 为 NULL
3. 字段名不匹配（image_url vs imageUrl）

**解决**:
- 确认用户有 avatar_url
- 检查 MVT 查询的 SELECT 列表

### C. 网络请求失败

**症状**: `Failed to register sprite from URL ... URLError`

**原因**:
1. 后端服务器未运行
2. URL 拼接错误
3. 文件不存在

**解决**:
- 确认后端服务运行在 http://localhost:3001
- 手动访问图片 URL 验证
- 检查 uploads 目录权限

### D. 图片解码失败

**症状**: `Failed to decode image from URL`

**原因**:
1. 文件损坏
2. 格式不支持
3. 文件为空

**解决**:
- 用图片查看器打开文件验证
- 检查文件大小和格式

## 后续优化建议

1. **添加失败重试机制**
   - Sprite 加载失败时自动重试 2-3 次

2. **缓存已加载的 Sprite**
   - 避免重复下载同一用户的头像

3. **预加载可视区域周围的 Sprite**
   - 提前加载用户可能看到的像素

4. **优化 MVT 瓦片生成**
   - 考虑将 image_url 转换为完整 URL（后端处理）
   - 减少客户端 URL 拼接逻辑

5. **添加 Sprite 加载失败的 UI 提示**
   - 显示占位符或错误图标
   - 允许用户手动重试
