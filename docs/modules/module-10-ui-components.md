# Module 10: 通用UI组件库 - 技术方案

> **模块代号**: Module 10
> **模块名称**: 通用UI组件库 (Common UI Components Library)
> **依赖模块**: 无
> **预计工作量**: 1周 (约35小时)
> **优先级**: 高 (贯穿所有模块)

---

## 一、设计系统规范

### 1.1 颜色系统

```swift
// FunnyPixelsApp/Design/Colors.swift
extension Color {
    // 主题色
    static let primaryBlue = Color(hex: "#007AFF")
    static let primaryGreen = Color(hex: "#34C759")
    static let primaryRed = Color(hex: "#FF3B30")
    static let primaryOrange = Color(hex: "#FF9500")

    // 文字颜色
    static let textPrimary = Color.primary
    static let textSecondary = Color.secondary
    static let textTertiary = Color(UIColor.tertiaryLabel)

    // 背景色
    static let bgPrimary = Color(UIColor.systemBackground)
    static let bgSecondary = Color(UIColor.secondarySystemBackground)
    static let bgTertiary = Color(UIColor.tertiarySystemBackground)

    // 卡片
    static let cardBackground = Color(UIColor.systemGray6)
    static let cardBorder = Color(UIColor.separator)
}
```

### 1.2 字体系统

```swift
// FunnyPixelsApp/Design/Typography.swift
extension Font {
    // 标题
    static let largeTitle = Font.system(size: 34, weight: .bold)
    static let title1 = Font.system(size: 28, weight: .bold)
    static let title2 = Font.system(size: 22, weight: .bold)
    static let title3 = Font.system(size: 20, weight: .semibold)

    // 正文
    static let body = Font.system(size: 17, weight: .regular)
    static let bodyBold = Font.system(size: 17, weight: .semibold)

    // 辅助
    static let caption1 = Font.system(size: 12, weight: .regular)
    static let caption2 = Font.system(size: 11, weight: .regular)
}
```

### 1.3 间距系统

```swift
// FunnyPixelsApp/Design/Spacing.swift
enum Spacing {
    static let xxs: CGFloat = 4
    static let xs: CGFloat = 8
    static let sm: CGFloat = 12
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32
    static let xxl: CGFloat = 48
}
```

---

## 二、核心组件

### 2.1 Sub-Tab 切换器

```swift
// FunnyPixelsApp/Components/SubTabPicker.swift
struct SubTabPicker<Item: Hashable & CustomStringConvertible>: View {
    let items: [Item]
    @Binding var selection: Item

    var body: some View {
        Picker("", selection: $selection) {
            ForEach(items, id: \.self) { item in
                Text(item.description).tag(item)
            }
        }
        .pickerStyle(.segmented)
        .padding(.horizontal, Spacing.md)
    }
}

// 使用示例
enum FeedSubTab: String, CaseIterable, CustomStringConvertible {
    case plaza, tracks, data

    var description: String {
        switch self {
        case .plaza: return "广场"
        case .tracks: return "足迹"
        case .data: return "数据"
        }
    }
}

SubTabPicker(items: FeedSubTab.allCases, selection: $selectedSubTab)
```

### 2.2 卡片容器

```swift
// FunnyPixelsApp/Components/CardView.swift
struct CardView<Content: View>: View {
    let content: () -> Content

    init(@ViewBuilder content: @escaping () -> Content) {
        self.content = content
    }

    var body: some View {
        content()
            .padding(Spacing.md)
            .background(Color.cardBackground)
            .cornerRadius(12)
            .shadow(color: Color.black.opacity(0.05), radius: 4, x: 0, y: 2)
    }
}

// 使用示例
CardView {
    VStack(alignment: .leading, spacing: 8) {
        Text("标题")
            .font(.headline)
        Text("内容")
            .font(.body)
    }
}
```

### 2.3 点赞按钮

```swift
// FunnyPixelsApp/Components/LikeButton.swift
struct LikeButton: View {
    @Binding var isLiked: Bool
    @Binding var likeCount: Int
    let onTap: () -> Void

    @State private var isAnimating: Bool = false

    var body: some View {
        Button(action: {
            isAnimating = true
            onTap()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                isAnimating = false
            }
        }) {
            HStack(spacing: 4) {
                Image(systemName: isLiked ? "heart.fill" : "heart")
                    .foregroundColor(isLiked ? .red : .gray)
                    .scaleEffect(isAnimating ? 1.3 : 1.0)
                    .animation(.spring(response: 0.3, dampingFraction: 0.5), value: isAnimating)

                Text("\(likeCount)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }
}
```

### 2.4 加载占位符 (Skeleton)

```swift
// FunnyPixelsApp/Components/SkeletonView.swift
struct SkeletonView: View {
    @State private var isAnimating = false

    var body: some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(
                LinearGradient(
                    colors: [Color.gray.opacity(0.3), Color.gray.opacity(0.1), Color.gray.opacity(0.3)],
                    startPoint: isAnimating ? .leading : .trailing,
                    endPoint: isAnimating ? .trailing : .leading
                )
            )
            .onAppear {
                withAnimation(Animation.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                    isAnimating = true
                }
            }
    }
}

// 使用示例
VStack(alignment: .leading, spacing: 8) {
    SkeletonView()
        .frame(height: 20)
        .frame(width: 200)

    SkeletonView()
        .frame(height: 16)
        .frame(width: 150)
}
```

### 2.5 空状态组件

```swift
// FunnyPixelsApp/Components/EmptyStateView.swift
struct EmptyStateView: View {
    let icon: String
    let title: String
    let description: String
    let actionTitle: String?
    let action: (() -> Void)?

    init(
        icon: String,
        title: String,
        description: String,
        actionTitle: String? = nil,
        action: (() -> Void)? = nil
    ) {
        self.icon = icon
        self.title = title
        self.description = description
        self.actionTitle = actionTitle
        self.action = action
    }

    var body: some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: icon)
                .resizable()
                .scaledToFit()
                .frame(width: 80, height: 80)
                .foregroundColor(.gray)

            Text(title)
                .font(.title3)
                .fontWeight(.semibold)

            Text(description)
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.xl)

            if let actionTitle = actionTitle, let action = action {
                Button(action: action) {
                    Text(actionTitle)
                        .font(.bodyBold)
                        .foregroundColor(.white)
                        .padding(.horizontal, Spacing.lg)
                        .padding(.vertical, Spacing.sm)
                        .background(Color.primaryBlue)
                        .cornerRadius(8)
                }
                .padding(.top, Spacing.sm)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// 使用示例
EmptyStateView(
    icon: "tray.fill",
    title: "暂无数据",
    description: "开始你的第一次绘画吧！",
    actionTitle: "开始绘画",
    action: { /* 跳转到绘画页面 */ }
)
```

### 2.6 Toast 通知

```swift
// FunnyPixelsApp/Components/ToastView.swift
struct ToastView: View {
    let message: String
    let type: ToastType

    enum ToastType {
        case success, error, info

        var color: Color {
            switch self {
            case .success: return .green
            case .error: return .red
            case .info: return .blue
            }
        }

        var icon: String {
            switch self {
            case .success: return "checkmark.circle.fill"
            case .error: return "xmark.circle.fill"
            case .info: return "info.circle.fill"
            }
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: type.icon)
                .foregroundColor(type.color)

            Text(message)
                .font(.body)
                .foregroundColor(.white)

            Spacer()
        }
        .padding()
        .background(Color.black.opacity(0.8))
        .cornerRadius(12)
        .shadow(radius: 10)
        .padding(.horizontal, Spacing.md)
    }
}

// Toast Manager (全局单例)
class ToastManager: ObservableObject {
    static let shared = ToastManager()

    @Published var toast: ToastData?

    struct ToastData: Identifiable {
        let id = UUID()
        let message: String
        let type: ToastView.ToastType
    }

    func show(message: String, type: ToastView.ToastType = .info, duration: TimeInterval = 2.0) {
        toast = ToastData(message: message, type: type)

        DispatchQueue.main.asyncAfter(deadline: .now() + duration) { [weak self] in
            self?.toast = nil
        }
    }
}

// 使用示例（在App根View中添加）
@StateObject private var toastManager = ToastManager.shared

.overlay(
    VStack {
        if let toast = toastManager.toast {
            ToastView(message: toast.message, type: toast.type)
                .transition(.move(edge: .top).combined(with: .opacity))
                .animation(.spring(), value: toastManager.toast)
        }
        Spacer()
    }
)

// 调用方式
ToastManager.shared.show(message: "保存成功", type: .success)
```

### 2.7 标准按钮

```swift
// FunnyPixelsApp/Components/PrimaryButton.swift
struct PrimaryButton: View {
    let title: String
    let isLoading: Bool
    let action: () -> Void

    init(
        _ title: String,
        isLoading: Bool = false,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.isLoading = isLoading
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                } else {
                    Text(title)
                        .font(.bodyBold)
                        .foregroundColor(.white)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.sm)
            .background(isLoading ? Color.gray : Color.primaryBlue)
            .cornerRadius(12)
        }
        .disabled(isLoading)
    }
}
```

---

## 三、组件目录结构

```
FunnyPixelsApp/
├── Design/
│   ├── Colors.swift
│   ├── Typography.swift
│   ├── Spacing.swift
│   └── Shadows.swift
├── Components/
│   ├── Cards/
│   │   ├── CardView.swift
│   │   ├── FeedCard.swift
│   │   └── StatCard.swift
│   ├── Buttons/
│   │   ├── PrimaryButton.swift
│   │   ├── LikeButton.swift
│   │   └── FollowButton.swift
│   ├── Inputs/
│   │   ├── CommentInputView.swift
│   │   └── SearchBar.swift
│   ├── Feedback/
│   │   ├── ToastView.swift
│   │   ├── SkeletonView.swift
│   │   └── EmptyStateView.swift
│   ├── Navigation/
│   │   ├── SubTabPicker.swift
│   │   └── BackButton.swift
│   └── Common/
│       ├── Avatar.swift
│       ├── Badge.swift
│       └── Divider.swift
```

---

## 四、实施步骤

| 任务 | 时间 |
|------|------|
| 设计系统规范（颜色/字体/间距） | 3h |
| SubTabPicker 组件 | 2h |
| CardView + 卡片变体 | 4h |
| LikeButton + 点赞动画 | 3h |
| SkeletonView 加载占位 | 3h |
| EmptyStateView 空状态 | 3h |
| ToastView + ToastManager | 4h |
| 标准按钮组件库 | 3h |
| 组件文档编写 | 4h |
| 组件单元测试 | 6h |

**总计**: 约35小时

---

## 五、验收标准

- [ ] 所有组件符合设计系统规范
- [ ] 组件可复用性强，配置灵活
- [ ] 组件动画流畅（60fps）
- [ ] 组件支持Dark Mode
- [ ] 组件通过单元测试
- [ ] 组件文档完整

---

**文档版本**: v1.0
**最后更新**: 2026-02-28
