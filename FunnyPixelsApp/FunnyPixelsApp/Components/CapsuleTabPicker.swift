import SwiftUI

/// 胶囊样式的Tab选择器
/// 统一UX设计：与排行榜的typeBar风格一致
struct CapsuleTabPicker<Item: Hashable & CustomStringConvertible>: View {
    // ✅ 响应式设计：监听字体设置变化
    @ObservedObject private var fontManager = FontSizeManager.shared

    let items: [Item]
    @Binding var selection: Item

    var body: some View {
        // ✅ 如果items ≤ 3个，使用HStack均匀分布；如果 > 3个，使用ScrollView
        if items.count <= 3 {
            // 固定3个或更少的tab - 使用HStack均匀分布，无需滚动
            HStack(spacing: AppSpacing.m) {
                ForEach(items, id: \.self) { item in
                    Button {
                        HapticManager.shared.impact(style: .light)
                        SoundManager.shared.play(.tabSwitch)
                        withAnimation(.easeInOut(duration: 0.2)) {
                            selection = item
                        }
                    } label: {
                        Text(item.description)
                            .responsiveFont(.subheadline, weight: .semibold)
                            .foregroundColor(selection == item ? .white : AppColors.textSecondary)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 10)
                            .frame(maxWidth: .infinity)  // ✅ 均匀分布
                            .background(
                                Capsule()
                                    .fill(selection == item ? AppColors.primary : Color(.systemGray6))
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, AppSpacing.l)
            .padding(.vertical, AppSpacing.s)
            .background(AppColors.background)
        } else {
            // 4个或更多tab - 使用ScrollView
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: AppSpacing.m) {
                    ForEach(items, id: \.self) { item in
                        Button {
                            HapticManager.shared.impact(style: .light)
                            SoundManager.shared.play(.tabSwitch)
                            withAnimation(.easeInOut(duration: 0.2)) {
                                selection = item
                            }
                        } label: {
                            Text(item.description)
                                .responsiveFont(.subheadline, weight: .semibold)
                                .foregroundColor(selection == item ? .white : AppColors.textSecondary)
                                .padding(.horizontal, 20)
                                .padding(.vertical, 10)
                                .background(
                                    Capsule()
                                        .fill(selection == item ? AppColors.primary : Color(.systemGray6))
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, AppSpacing.l)
                .padding(.vertical, AppSpacing.s)
            }
            .background(AppColors.background)
        }
    }
}

// MARK: - Preview

struct CapsuleTabPicker_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 20) {
            CapsuleTabPicker(
                items: FeedSubTab.allCases,
                selection: .constant(.plaza)
            )

            CapsuleTabPicker(
                items: AllianceSubTab.allCases,
                selection: .constant(.myAlliance)
            )
        }
        .padding()
        .background(AppColors.background)
    }
}
