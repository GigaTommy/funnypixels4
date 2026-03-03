import SwiftUI

/// Sub-Tab 切换器组件
/// 用于在Tab内部切换不同的子标签
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
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }
}

// MARK: - Preview

struct SubTabPicker_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 20) {
            SubTabPicker(
                items: FeedSubTab.allCases,
                selection: .constant(.plaza)
            )

            SubTabPicker(
                items: AllianceSubTab.allCases,
                selection: .constant(.myAlliance)
            )
        }
        .padding()
    }
}
