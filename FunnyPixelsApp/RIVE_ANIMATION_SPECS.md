# Rive Animation Specifications for FunnyPixels

> 📋 **For Designers**: 本文档定义了FunnyPixels项目需要的3个Rive动画文件的完整规格。请严格按照此规格制作，以确保与iOS代码完美集成。

## 📁 文件命名和存放位置

| 动画文件名 | 用途 | 存放路径 |
|-----------|------|---------|
| `pixel_drop.riv` | 像素放置动画 | `FunnyPixelsApp/Resources/Animations/` |
| `cooldown_ring.riv` | 冷却环倒计时 | `FunnyPixelsApp/Resources/Animations/` |
| `achievement_unlock.riv` | 成就解锁庆祝 | `FunnyPixelsApp/Resources/Animations/` |

---

## 🎯 Animation 1: Pixel Drop（像素放置动画）

### 基本信息

- **文件名**: `pixel_drop.riv`
- **画板尺寸**: 120×120px (正方形)
- **动画时长**: 0.6秒
- **触发方式**: 代码触发Input `drop`
- **帧率**: 60fps

### 动画阶段分解

```
Timeline: 0.0s → 0.6s

┌─────────────────┐
│   0.0-0.1s      │  Anticipation (预备)
│   像素上提+挤压  │  - Y: 0 → -20
│                 │  - ScaleY: 1.0 → 1.1
└─────────────────┘
        ↓
┌─────────────────┐
│   0.1-0.3s      │  Drop (掉落)
│   快速下落      │  - Y: -20 → 80
│                 │  - ScaleY: 1.1 → 1.4
│                 │  - ScaleX: 1.0 → 0.8
└─────────────────┘
        ↓
┌─────────────────┐
│   0.3-0.35s     │  Impact (落地)
│   挤压变形      │  - Y: 80 → 100
│   + 涟漪扩散    │  - ScaleY: 1.4 → 0.7
│   + 粒子爆发    │  - ScaleX: 0.8 → 1.2
└─────────────────┘
        ↓
┌─────────────────┐
│   0.35-0.6s     │  Settle (稳定)
│   回弹到正常    │  - Scale: 回到 1.0
│                 │  - 轻微弹跳
└─────────────────┘
```

### 图层结构

```
📁 pixel_drop.riv
├─ 🎨 Pixel (像素方块)
│  ├─ Shape: RoundedRectangle (30×30px, radius=6)
│  ├─ Fill: Dynamic Color (见Input说明)
│  └─ Shadow: Blur=8, Offset=(0,4)
│
├─ 💧 Ripple_1 (涟漪1)
│  ├─ Shape: Circle (初始直径=15px)
│  ├─ Stroke: 2px, 同像素颜色, Opacity=0.8
│  └─ Animation: 0.35s开始, Scale 0.5→2.0, Opacity 0.8→0
│
├─ 💧 Ripple_2 (涟漪2)
│  └─ 延迟0.05s, 其他同Ripple_1
│
├─ 💧 Ripple_3 (涟漪3)
│  └─ 延迟0.1s, 其他同Ripple_1
│
└─ ✨ Particles (粒子组)
   ├─ 8-12个小星星/圆点
   ├─ 从中心放射状飞出
   └─ Animation: 0.35s开始, Scale+Opacity同时动画
```

### State Machine配置

```javascript
State Machine Name: "Drop Control"

States:
├─ Idle (默认状态)
│  └─ 像素悬停在画板中心, 轻微breathing动画 (可选)
│
└─ Dropping (Drop动画)
   └─ 播放完整的0.6s动画序列

Inputs:
├─ drop (Trigger)
│  └─ 触发: Idle → Dropping
│
└─ pixelColor (Color, RGB)
   ├─ 默认值: [0.3, 0.5, 1.0, 1.0] (蓝色)
   └─ 绑定到: Pixel Fill, Ripple Stroke

Transitions:
├─ Idle → Dropping: 监听 drop trigger
└─ Dropping → Idle: 动画完成后 (onComplete)
```

### Easing曲线

| 阶段 | 缓动函数 |
|------|---------|
| Anticipation | Ease Out |
| Drop | Ease In |
| Impact | Ease Out Bounce |
| Settle | Spring (response=0.25, damping=0.7) |

### 导出设置

```
Format: Binary (.riv)
Optimize for Runtime: ✅
Include State Machines: ✅
Max File Size: 50KB
```

---

## ⏱️ Animation 2: Cooldown Ring（冷却环动画）

### 基本信息

- **文件名**: `cooldown_ring.riv`
- **画板尺寸**: 80×80px
- **动画类型**: 实时控制（非固定时长）
- **更新频率**: 约10fps（0.1s更新一次）

### 动画说明

这是一个**实时控制的进度环**，不是固定时长的动画。iOS代码会持续更新`progress`输入值（0.0→1.0），环形进度条同步填充。

### 图层结构

```
📁 cooldown_ring.riv
├─ ⭕ Ring_Base (底层灰环)
│  ├─ Shape: Circle, Stroke=6px
│  ├─ Color: Gray 20% opacity
│  └─ Diameter: 60px
│
├─ ⭕ Ring_Progress (进度环)
│  ├─ Shape: Circle, Stroke=6px
│  ├─ Color: Blue (冷却中) / Green (ready)
│  ├─ Trim Path:
│  │  ├─ Start: 0%
│  │  └─ End: 绑定到 progress Input
│  ├─ Line Cap: Round
│  └─ Rotation: -90° (从顶部12点开始)
│
├─ 💡 Glow (外发光, ready状态)
│  ├─ Shape: Circle, Stroke=8px
│  ├─ Color: Green 30% opacity
│  ├─ Diameter: 70px
│  ├─ Visibility: 仅在Ready状态显示
│  └─ Animation: Pulse (1.0 → 1.3 → 1.0, 1.5s loop)
│
└─ 🎯 Center_Icon (中心图标占位)
   └─ 透明圆形占位 (iOS代码会叠加数字/图标)
```

### State Machine配置

```javascript
State Machine Name: "Cooldown Control"

States:
├─ Cooldown (冷却中)
│  ├─ Ring_Progress颜色: Blue
│  └─ Glow隐藏
│
└─ Ready (可用)
   ├─ Ring_Progress颜色: Green, 进度=100%
   ├─ Glow显示并pulse
   └─ 轻微缩放动画 (1.0 → 1.05 → 1.0)

Inputs:
├─ progress (Number, 0.0-1.0)
│  ├─ 默认值: 0.0
│  └─ 绑定到: Ring_Progress的Trim Path End
│
├─ isReady (Boolean)
│  ├─ 默认值: false
│  └─ 控制: Cooldown ↔ Ready 状态切换
│
└─ readyPulse (Trigger, 可选)
   └─ 触发: Ready状态下的pulse动画

Transitions:
├─ Cooldown → Ready: 当 isReady = true
└─ Ready → Cooldown: 当 isReady = false
```

### 特殊要求

1. **平滑插值**: Trim Path动画必须使用Linear缓动（匀速），否则进度会跳跃
2. **颜色过渡**: Cooldown→Ready切换时，颜色应该有0.2s的过渡动画
3. **性能**: 这个动画会频繁更新，优化图层数量（不超过5层）

---

## 🏆 Animation 3: Achievement Unlock（成就解锁动画）

### 基本信息

- **文件名**: `achievement_unlock.riv`
- **画板尺寸**: 375×400px (竖屏，留白供iOS叠加文字)
- **动画时长**: 4.0秒（分4个阶段）
- **触发方式**: 代码触发Input `triggerUnlock`

### 动画阶段分解

```
Timeline: 0.0s → 4.0s

┌──────────────────┐
│   0.0-0.5s       │  Intro (宝箱入场)
│   从底部滑入     │  - Y: -200 → 0
│   + 晃动         │  - Rotation: -5° → 5° → 0°
└──────────────────┘
        ↓
┌──────────────────┐
│   0.5-1.2s       │  Unlock (开箱)
│   盖子打开       │  - Lid Rotation: 0° → -120°
│   + 金光爆发     │  - 30-50个粒子放射
│   + 成就图标飞出 │  - Icon Scale: 0 → 1.2 → 1.0
└──────────────────┘
        ↓
┌──────────────────┐
│   1.2-3.5s       │  Display (展示)
│   悬浮breathing  │  - Scale: 1.0 → 1.05 → 1.0 (loop)
│   + 背景光晕pulse│  - Glow opacity pulse
└──────────────────┘
        ↓
┌──────────────────┐
│   3.5-4.0s       │  Outro (退场, 可选)
│   缩小淡出       │  - Scale: 1.0 → 0.5
│                  │  - Opacity: 1.0 → 0.0
└──────────────────┘
```

### 图层结构

```
📁 achievement_unlock.riv
├─ 📦 Chest (宝箱)
│  ├─ Chest_Body (箱体)
│  │  ├─ RoundedRectangle 80×60px
│  │  └─ Fill: Gradient (Gold → Dark Gold)
│  │
│  └─ Chest_Lid (箱盖)
│     ├─ Trapezoid 90×30px
│     ├─ Anchor Point: 底部中心
│     └─ Rotation Animation: 0° → -120° (开盖)
│
├─ ✨ Particles (粒子系统)
│  ├─ 30-50个星星/金币形状
│  ├─ Radial Layout (放射状)
│  ├─ 从箱子中心向外飞散
│  └─ Animation:
│     ├─ 0.5s开始触发
│     ├─ Distance: 0 → 100-200px
│     ├─ Scale: 0 → 1 → 0.5
│     └─ Opacity: 0 → 1 → 0
│
├─ 🏆 Achievement_Icon (成就图标占位)
│  ├─ Circle 100×100px (占位符)
│  ├─ 从宝箱飞出: Y: 0 → -80px
│  ├─ Scale: 0 → 1.2 → 1.0 (bounce)
│  └─ Rotation: 0° → 360° (旋转一圈)
│
├─ 💫 Background_Glow (背景光晕)
│  ├─ RadialGradient Circle 200px
│  ├─ Colors: Rarity Color → Transparent
│  └─ Display阶段pulse动画
│
└─ 🌟 Star_Twinkles (闪烁星星, 可选)
   └─ 8-12个小星星，随机位置闪烁
```

### State Machine配置

```javascript
State Machine Name: "Unlock Machine"

States:
├─ Idle (等待状态)
│  └─ 所有元素隐藏或位于初始位置
│
├─ Intro (入场)
│  └─ 播放0.0-0.5s的Timeline
│
├─ Unlock (开箱)
│  └─ 播放0.5-1.2s的Timeline
│
├─ Display (展示)
│  └─ 播放1.2-3.5s的循环动画
│
└─ Outro (退场)
   └─ 播放3.5-4.0s的Timeline

Inputs:
├─ triggerUnlock (Trigger)
│  └─ 触发: Idle → Intro
│
├─ triggerOutro (Trigger)
│  └─ 触发: Display → Outro
│
└─ achievementRarity (String: "common" | "rare" | "epic" | "legendary")
   ├─ 默认值: "common"
   └─ 控制颜色方案:
      ├─ common: Blue (#3B82F6)
      ├─ rare: Purple (#A855F7)
      ├─ epic: Orange (#F97316)
      └─ legendary: Gold (#FBBF24)

Transitions:
├─ Idle → Intro: 监听 triggerUnlock
├─ Intro → Unlock: Timeline完成后自动切换
├─ Unlock → Display: Timeline完成后自动切换
├─ Display → Outro: 监听 triggerOutro
└─ Outro → Idle: Timeline完成后重置
```

### 动态颜色配置

**重要**: 必须支持4种稀有度颜色，通过`achievementRarity` Input动态切换：

| 稀有度 | 主色 | 粒子数量 | 特效强度 |
|--------|------|---------|---------|
| Common | Blue | 30个 | 1x |
| Rare | Purple | 40个 | 1.2x |
| Epic | Orange | 50个 | 1.5x |
| Legendary | Gold | 60个 | 2x (最炫) |

### Easing曲线

| 阶段 | 缓动函数 |
|------|---------|
| Intro滑入 | Ease Out Back |
| 宝箱晃动 | Ease In Out |
| 开盖 | Ease Out |
| 粒子爆发 | Ease Out Cubic |
| 图标飞出 | Bounce |
| Display breathing | Sine In Out |
| Outro | Ease In |

---

## 📐 通用规范

### 1. 文件尺寸限制

- **单个文件**: ≤ 50KB
- **总体积**: 3个文件合计 ≤ 120KB
- **优化建议**:
  - 使用Simple Shapes (不用复杂路径)
  - 减少关键帧数量
  - 合并相似图层

### 2. 性能要求

- **帧率**: 全程60fps
- **图层数**: 单个动画≤30层
- **粒子数**: ≤60个
- **测试设备**: 在iPhone SE 2nd Gen上流畅运行

### 3. 颜色规范

| 用途 | 色值 | 说明 |
|------|------|------|
| 主色调 | #3B82F6 | 蓝色，用于默认状态 |
| 成功色 | #10B981 | 绿色，用于Ready状态 |
| 错误色 | #EF4444 | 红色，用于失败反馈 |
| 金色 | #FBBF24 | 传说成就 |
| 紫色 | #A855F7 | 稀有成就 |
| 橙色 | #F97316 | 史诗成就 |

### 4. 导出清单

```bash
# 导出前检查清单
✅ 文件名正确 (pixel_drop.riv, cooldown_ring.riv, achievement_unlock.riv)
✅ 画板尺寸正确
✅ State Machine已配置并测试
✅ 所有Input已定义
✅ 颜色使用动态绑定（不硬编码）
✅ 在Rive Preview中测试流畅（60fps）
✅ 文件大小 ≤ 50KB
✅ Export Settings:
   - Format: Binary
   - Optimize for Runtime: On
   - Include State Machines: On
```

---

## 🧪 测试流程

### 在Rive编辑器中测试

1. **预览模式**: 点击右上角Play按钮
2. **State Machine测试**:
   - 手动触发Inputs
   - 拖动Number滑块测试进度
   - 切换Boolean测试状态切换
3. **性能检查**: 查看FPS指示器（应保持60fps）

### 交付前验证

```bash
# 设计师自检清单
□ 动画流畅，无卡顿
□ 所有Inputs响应正常
□ 颜色动态绑定生效
□ 文件大小符合要求
□ 已在Rive Community分享并获得反馈（可选）
```

---

## 📦 交付说明

### 文件交付

请将3个`.riv`文件通过以下任一方式交付：

1. **直接放入项目**:
   ```bash
   /FunnyPixelsApp/Resources/Animations/
   ├─ pixel_drop.riv
   ├─ cooldown_ring.riv
   └─ achievement_unlock.riv
   ```

2. **或提供下载链接**:
   - Rive Community链接
   - 或Google Drive/Dropbox链接

### 集成步骤（开发者执行）

```bash
# 1. 将.riv文件拖入Xcode项目
# 2. Target Membership勾选 FunnyPixelsApp
# 3. 运行App测试
# 4. 如有问题，参考本文档调整Rive文件
```

---

## 🆘 常见问题

### Q1: Input绑定到属性后不生效？

**A**: 检查：
1. Input类型是否正确（Number/Boolean/Trigger）
2. 属性是否正确绑定到Input（右键属性 → Bind to Input）
3. State Machine是否设置为Active

### Q2: 颜色无法动态改变？

**A**:
1. Color Input类型应为`Color (RGB)`
2. 确保Fill/Stroke属性绑定到Input
3. iOS代码传入格式：`[R, G, B, A]`（0.0-1.0范围）

### Q3: 动画在iOS上卡顿？

**A**: 优化策略：
1. 减少Blur/Shadow效果
2. 使用Simple Shapes替代Path
3. 降低粒子数量
4. 合并相似图层

### Q4: 文件过大（>50KB）？

**A**: 压缩技巧：
1. Export → Binary格式（比JSON小50%）
2. 删除未使用的素材
3. 降低关键帧精度（从每帧到每5帧）
4. 使用Rive的Optimize工具

---

## 📞 联系支持

如有任何疑问，请联系：

- **技术负责人**: [Your Name]
- **Rive官方文档**: https://help.rive.app
- **Rive Discord**: https://discord.gg/FGjmaTp

---

**Version**: 1.0
**Last Updated**: 2026-03-06
**Status**: ✅ Ready for Implementation
