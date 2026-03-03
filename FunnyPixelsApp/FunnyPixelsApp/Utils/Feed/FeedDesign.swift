import SwiftUI

/// Feed模块设计系统 - 遵循简约、克制的设计原则
enum FeedDesign {

    // MARK: - Colors（极简配色）

    struct Colors {
        // 主色调：黑白灰体系
        static let text = Color(hex: "#1A1A1A") ?? .black           // 主文字
        static let textSecondary = Color(hex: "#666666") ?? .gray   // 次要文字
        static let textTertiary = Color(hex: "#999999") ?? .gray    // 辅助文字
        static let line = Color(hex: "#E8E8E8") ?? .gray            // 分割线
        static let background = Color(hex: "#FFFFFF") ?? .white     // 背景

        // 品牌色：仅用于关键操作
        static let primary = Color(hex: "#2C2C2C") ?? .black        // 主按钮（黑色）

        // 功能色：极其克制使用
        static let like = Color(hex: "#FF3B30") ?? .red             // 仅点赞红心
        static let link = Color(hex: "#007AFF") ?? .blue            // 仅链接

        // 表面颜色
        static let surface = Color(hex: "#FAFAFA") ?? .white        // 卡片背景（可选）
        static let border = Color(hex: "#E8E8E8") ?? .gray          // 边框
    }

    // MARK: - Spacing（呼吸感间距）

    struct Spacing {
        static let xxs: CGFloat = 4
        static let xs: CGFloat = 8
        static let s: CGFloat = 12
        static let m: CGFloat = 16   // 默认间距
        static let l: CGFloat = 24
        static let xl: CGFloat = 32
        static let xxl: CGFloat = 48
    }

    // MARK: - Typography（层级清晰）

    struct Typography {
        // 只有3个字号，避免混乱
        static let title = Font.system(size: 17, weight: .semibold)    // 标题
        static let body = Font.system(size: 15, weight: .regular)      // 正文
        static let caption = Font.system(size: 13, weight: .regular)   // 辅助

        // 特殊场景
        static let numeric = Font.system(size: 15, weight: .regular).monospacedDigit()
    }

    // MARK: - Layout（统一布局规范）

    struct Layout {
        // 圆角：统一0或4
        static let cornerRadius: CGFloat = 0          // 默认无圆角
        static let cornerRadiusSmall: CGFloat = 4     // 小元素（标签）

        // 阴影：统一去除
        static let shadowRadius: CGFloat = 0

        // 边框：1px浅色
        static let borderWidth: CGFloat = 0.5

        // 图片：无边框、无圆角
        static let imageCornerRadius: CGFloat = 0

        // 按钮：高度固定
        static let buttonHeight: CGFloat = 44

        // 分割线：0.5px
        static let dividerHeight: CGFloat = 0.5

        // 卡片间距
        static let cardSpacing: CGFloat = 0  // 无间距，紧凑排列
    }

    // MARK: - Animation（自然动画）

    struct Animation {
        static let duration: Double = 0.2
        static let curve: SwiftUI.Animation = .easeOut

        // 标准动画
        static var standard: SwiftUI.Animation {
            .easeOut(duration: duration)
        }

        // 弹性动画（点赞等）
        static var spring: SwiftUI.Animation {
            .spring(response: 0.3, dampingFraction: 0.5)
        }
    }

    // MARK: - Icon（系统图标）

    struct Icon {
        // 使用SF Symbols，保持简洁
        static let like = "heart"
        static let liked = "heart.fill"
        static let comment = "bubble.right"
        static let share = "square.and.arrow.up"
        static let bookmark = "bookmark"
        static let bookmarked = "bookmark.fill"
        static let more = "ellipsis"
        static let location = "location"
        static let hashtag = "number"
        static let photo = "photo"
        static let close = "xmark"
        static let send = "paperplane.fill"
    }
}


// MARK: - Design Checklist (内部使用，部署前删除)

/*
 设计检查清单（每个组件开发完成后检查）：

 □ 是否有不必要的emoji？ → 删除
 □ 是否有多余的图标？ → 保留核心功能图标
 □ 圆角是否过大（>8px）？ → 改为0或4px
 □ 是否有阴影？ → 删除
 □ 配色是否超过3种？ → 统一为黑白灰
 □ 文案是否过于热情？ → 改为冷静客观
 □ 间距是否为8的倍数？ → 统一间距系统
 □ 按钮是否过大？ → 保持44px高度
 □ 是否有不必要的背景色？ → 保持留白
 □ 动画是否过于花哨？ → 简单淡入淡出
 */
