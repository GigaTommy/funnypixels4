# 默认头像渲染修正 - 方格（像素格子）而非圆形

## 🔧 问题

之前的实现渲染的是**圆形**头像，但这是一个像素艺术游戏，应该渲染**方格（像素格子）**以保持像素艺术风格。

```javascript
// ❌ 错误：渲染圆形
const svg = `
  <svg width="${size}" height="${size}">
    <circle cx="${size/2}" cy="${size/2}" r="${circleSize/2}" fill="${color}"/>
  </svg>`;
```

## ✅ 修正方案

使用 `renderColorSquare` 函数渲染方格，与其他颜色pattern保持一致：

```javascript
// ✅ 正确：渲染方格（像素格子）
const padding = 8;
const innerSize = size - 2 * padding;
return renderColorSquare(pattern.color, size, padding, innerSize, 1);
```

## 📝 修改内容

**文件**: `backend/src/services/spriteService.js`

### 修改函数：renderPersonalColorAvatar

```javascript
async function renderPersonalColorAvatar(userId, size) {
  // ... SHA256计算索引，查询数据库获取颜色 ...
  
  // ✅ 渲染方格（像素格子），与其他颜色pattern保持一致
  const padding = 8;
  const innerSize = size - 2 * padding;
  return renderColorSquare(pattern.color, size, padding, innerSize, 1);
}
```

### 同时修正fallback情况

```javascript
if (!pattern || !pattern.color) {
  logger.warn(`⚠️ Personal color pattern not found in DB: ${patternKey}, using fallback`);
  const fallbackColor = `#${colorHex.toUpperCase()}`;
  const padding = 8;
  const innerSize = size - 2 * padding;
  return renderColorSquare(fallbackColor, size, padding, innerSize, 1);
}
```

## 🎨 渲染效果

### 方格特征
- 尺寸: 64x64 PNG
- Padding: 8px（四周）
- 内部方格: 48x48
- 圆角: rx = innerSize * 0.125 (约6px)
- 风格: 像素艺术风格，与游戏整体风格一致

### 文件大小对比
- 圆形: 797 bytes
- 方格: 365 bytes（更小、更简洁）

## 🧪 测试结果

```bash
# HTTP端点测试
curl -o test.png "http://localhost:3001/api/sprites/icon/1/complex/user_avatar_661bdcc1-b4dd-4c76-8c73-7331a80732e0.png"

# 文件信息
file test.png
# → PNG image data, 64 x 64, 8-bit/color RGBA, non-interlaced

ls -lh test.png
# → 365B (方格渲染)
```

testuser1测试结果：
- Pattern key: `personal_color_dd6b20`
- 数据库颜色: `#DD6B20` (橙色)
- ✅ 成功渲染365字节PNG（方格，像素艺术风格）

## ✅ 优势

1. **视觉一致性**: 与其他颜色pattern渲染方式一致
2. **像素艺术风格**: 保持游戏整体像素艺术美学
3. **文件更小**: 方格比圆形简单，PNG文件更小
4. **复用代码**: 使用现有的`renderColorSquare`函数，避免重复代码

---

**修复日期**: 2026-03-03  
**修复状态**: ✅ 完成  
**影响范围**: 默认头像用户GPS绘制、DiceBear头像失败回退
