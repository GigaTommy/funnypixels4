# 🎨 FunnyPixels Live Activity Widget

## 文件结构

```
FunnyPixelsWidget/
├── LiveActivitySVGIcons.swift                    # ✨ SVG 图标库
├── GPSDrawingLiveActivity_Optimized.swift        # ✨ 优化版 Live Activity
├── GPSDrawingLiveActivity.swift                  # 原版（待替换）
├── GPSDrawingActivityAttributes.swift            # 数据模型
├── EventLiveActivity.swift                       # 赛事 Live Activity
├── EventActivityAttributes.swift                 # 赛事数据模型
├── FunnyPixelsWidgetBundle.swift                 # Widget 入口
├── LIVE_ACTIVITY_OPTIMIZATION.md                 # 📚 优化完整指南
├── VISUAL_COMPARISON.md                          # 📊 视觉对比文档
└── README.md                                     # 本文件
```

## 🚀 快速启用优化版本

```bash
# 从项目根目录运行
./enable-optimized-live-activity.sh
```

## 📖 文档导航

- **快速上手** → `../LIVE_ACTIVITY_OPTIMIZATION_SUMMARY.md`
- **完整指南** → `LIVE_ACTIVITY_OPTIMIZATION.md`
- **视觉对比** → `VISUAL_COMPARISON.md`

## ✨ 核心改进

1. **FunnyPixels Logo** - 自定义 SVG 品牌标识
2. **7 个 SVG 图标** - 替代所有 emoji 和系统图标
3. **渐变设计** - 青色 (#4ECDC4) → 黄色 (#FFE66D)
4. **三栏布局** - 像素数 | 状态 | 点数
5. **实时速率** - 显示 px/min 绘制速度
6. **动画效果** - GPS 波纹、雪花旋转

## 🎯 关键文件

| 文件 | 用途 |
|------|------|
| `LiveActivitySVGIcons.swift` | SVG 图标库（7个自定义图标） |
| `GPSDrawingLiveActivity_Optimized.swift` | 优化后的 Live Activity |
| `LIVE_ACTIVITY_OPTIMIZATION.md` | 完整使用文档 |

## 预览

在 Xcode 中打开 `GPSDrawingLiveActivity_Optimized.swift` 查看 3 个实时预览。
