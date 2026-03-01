# GPS绘制测试指南

## 🔧 已修复的问题

### 1. 头像URL路径错误 ✅
**问题**: URL包含错误的`/api`前缀
**修复**:
- 添加`AppConfig.serverBaseURL`（不带/api）
- 修改`HighPerformanceMVTRenderer.swift`使用正确的baseURL

**修改文件**:
- `FunnyPixelsApp/Config/AppConfig.swift`
- `FunnyPixelsApp/Services/Map/HighPerformanceMVTRenderer.swift`

### 2. 前后端坐标对齐不一致 ✅
**问题**: iOS使用动态gridSize，后端使用固定0.0001度
**修复**: iOS端改为固定gridSize=0.0001度

**修改文件**:
- `FunnyPixelsApp/Services/Drawing/DrawingService.swift`

### 3. 切换页签后地图重建 ✅
**问题**: MapView被销毁导致hotpatch像素丢失
**修复**: 改用opacity控制显示

**修改文件**:
- `FunnyPixelsApp/Views/ContentView.swift`

### 4. 位置选择器UX改进 ✅
**修复**: 添加实时地理编码，显示地址名称

**修改文件**:
- `FunnyPixelsApp/Views/TestLocationPickerView.swift`

### 5. 智能URL配置系统 ✅
**修复**: 后端自动环境适配

**新增文件**:
- `backend/src/config/urlConfig.js`

## 🧪 测试步骤

### 第1步：重启后端
```bash
cd backend
npm restart
```

**预期输出**:
```
🌐 URL Configuration:
   Base URL: http://192.168.0.3:3001
   CDN Base URL: http://192.168.0.3:3001/uploads
```

### 第2步：验证头像文件可访问
```bash
curl -I "http://192.168.0.3:3001/uploads/materials/avatars/a7/9a/avatar_013cbbec0135658e716272220a9c0b2d_medium.png"
```

**预期**: HTTP/1.1 200 OK ✅

### 第3步：清理MVT瓦片缓存（重要！）

**方式1：重启后端**（推荐）
```bash
cd backend
npm restart
```

**方式2：手动删除缓存文件**
```bash
# 如果使用文件缓存
rm -rf backend/cache/mvt/*
```

**方式3：数据库查询确认**
```bash
node -e "
require('./src/config/env').loadEnvConfig();
const { db } = require('./src/config/database');

(async () => {
  const pixels = await db('pixels')
    .where('grid_id', 'grid_2932946_1131422')
    .select('id', 'grid_id', 'latitude', 'longitude', 'color', 'pattern_id')
    .first();

  console.log('Pixel in database:', pixels);
  await db.destroy();
})();
"
```

### 第4步：重新编译iOS App
1. 清理build目录：Product → Clean Build Folder (⌘⇧K)
2. 重新编译：Product → Build (⌘B)
3. 运行：Product → Run (⌘R)

### 第5步：测试GPS绘制

#### 5.1 选择位置
1. 打开TestLocationPicker
2. **注意观察地址名称**（如"中星小学"）
3. 确认是正确的位置后点击"Start Test Here"

#### 5.2 开始绘制
1. 选择"我的头像"绘制
2. 点击启动
3. 观察：
   - ✅ 绘制时应该显示绿色预览（头像sprite加载需要时间）
   - ✅ Xcode日志应该显示尝试加载头像URL

**预期日志**:
```
🖼️ [Renderer] Registering complex sprite from URL: user_avatar_xxx,
   URL: http://192.168.0.3:3001/uploads/materials/avatars/...
```

**❌ 不应该看到**:
```
URL: http://192.168.0.3:3001/api/uploads/...  ← 错误的/api前缀
```

#### 5.3 结束绘制
1. 停止GPS绘制
2. 查看分享页面
3. **预期**: 应该显示头像像素点（不是绿色）

#### 5.4 检查地图显示

**方式1：切换页签测试**
1. 切换到其他页签（如"历史"）
2. 切换回"地图"页签
3. 放大到绘制位置（中星小学）
4. **预期**: 应该看到刚才绘制的像素

**方式2：完全重启App**
1. 关闭App
2. 重新打开
3. 导航到绘制位置
4. **预期**: 应该看到像素（从MVT瓦片加载）

## 🔍 问题诊断

### 问题A：头像URL还是404
**检查**:
```bash
# Xcode日志中查找
grep "Registering complex sprite" 日志文件

# 应该看到:
URL: http://192.168.0.3:3001/uploads/...  ✅

# 不应该看到:
URL: http://192.168.0.3:3001/api/uploads/...  ❌
```

**解决**: 确保重新编译了iOS App

### 问题B：绘制位置不对
**检查**:
```bash
# 查看TestLocationPicker显示的地址名称
# 应该清楚显示当前位置（如"中星小学"）
```

**解决**: 注意TestLocationPicker中显示的地址名称，确认是正确位置

### 问题C：地图上看不到像素

**检查1：数据库是否有像素**
```bash
node -e "
require('./src/config/env').loadEnvConfig();
const { db } = require('./src/config/database');

(async () => {
  const count = await db('pixels')
    .whereBetween('latitude', [23.142, 23.143])
    .whereBetween('longitude', [113.294, 113.295])
    .count('* as count')
    .first();

  console.log('Pixels in 中星小学 area:', count.count);
  await db.destroy();
})();
"
```

**检查2：MVT瓦片是否包含像素**
```bash
# 请求瓦片
curl -s "http://192.168.0.3:3001/api/mvt/15/26696/14217.pbf" | wc -c

# 应该 > 1000 bytes（包含像素数据）
# 如果 < 500 bytes，可能是空瓦片或缓存问题
```

**解决**: 重启后端清理缓存

### 问题D：切换页签后像素消失

**检查**: Xcode日志中查找
```
MapLibreMapView init/deinit
```

**预期**: 不应该看到MapView被重复init/deinit

**解决**: 确保ContentView使用了opacity方案

## 📊 验证清单

- [ ] 后端启动日志显示正确的URL配置
- [ ] 头像文件URL可访问（200 OK）
- [ ] iOS编译无警告
- [ ] TestLocationPicker显示正确的地址名称
- [ ] 绘制时Xcode日志显示正确的头像URL（无/api前缀）
- [ ] 分享页面显示头像像素（不是绿色）
- [ ] 切换页签后像素仍然存在
- [ ] 数据库中有像素记录
- [ ] MVT瓦片包含像素数据
- [ ] 重启App后地图上能看到像素

## 🎯 成功标准

1. ✅ 选择位置时能清楚看到地址名称
2. ✅ 绘制过程中头像URL正确（无/api前缀）
3. ✅ 分享页面显示用户头像像素
4. ✅ 切换页签后像素不消失
5. ✅ 重启App后地图上能看到像素
6. ✅ 数据库坐标和地图显示位置一致

## 📞 调试支持

如果问题仍然存在，请提供：

1. **Xcode完整日志**（从启动到绘制结束）
2. **后端启动日志**（URL配置部分）
3. **数据库查询结果**（像素详情）
4. **MVT瓦片大小**（字节数）
5. **屏幕截图**（地址选择器、绘制过程、地图显示）

## 🔗 相关文档

- [URL配置指南](backend/docs/URL_CONFIG_GUIDE.md)
- [修复总结](BUGFIX_SUMMARY.md)
- [坐标对齐测试](backend/scripts/test-url-config.js)
