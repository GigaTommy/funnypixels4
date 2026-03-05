import SwiftUI

/// 话题标签显示组件（简约设计）
struct HashtagView: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    let tags: [String]
    let onTagTap: ((String) -> Void)?

    init(tags: [String], onTagTap: ((String) -> Void)? = nil) {
        self.tags = tags
        self.onTagTap = onTagTap
    }

    var body: some View {
        // 方案1：纯文字，无背景（推荐）
        HStack(spacing: 12) {
            ForEach(tags, id: \.self) { tag in
                if let onTap = onTagTap {
                    Button {
                        onTap(tag)
                    } label: {
                        Text("#\(tag)")
                            .font(FeedDesign.Typography.caption)
                            .foregroundColor(FeedDesign.Colors.textSecondary)
                    }
                } else {
                    Text("#\(tag)")
                        .font(FeedDesign.Typography.caption)
                        .foregroundColor(FeedDesign.Colors.textSecondary)
                }
            }
        }
    }
}

/// 话题标签按钮（带浅色背景的备选方案）
struct HashtagButton: View {
    let tag: String
    let count: Int?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Text("#\(tag)")
                    .font(FeedDesign.Typography.caption)
                    .foregroundColor(FeedDesign.Colors.textSecondary)

                if let count = count {
                    Text("(\(count.feedFormatted))")
                        .font(FeedDesign.Typography.caption)
                        .foregroundColor(FeedDesign.Colors.textTertiary)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Color.black.opacity(0.03))
            .cornerRadius(FeedDesign.Layout.cornerRadiusSmall)
        }
    }
}

// MARK: - Preview

#if DEBUG
struct HashtagView_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 20) {
            // 纯文字样式
            HashtagView(tags: ["像素艺术", "打卡", "创作"])

            // 带背景样式
            HStack {
                HashtagButton(tag: "像素艺术", count: 1234) {}
                HashtagButton(tag: "打卡", count: 890) {}
            }
        }
        .padding()
    }
}
#endif
