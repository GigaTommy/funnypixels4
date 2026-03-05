import SwiftUI

/// 联盟选择弹窗
struct AllianceSelectionSheet: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    let alliances: [AllianceService.Alliance]
    let onSelect: (AllianceService.Alliance) -> Void
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            List(alliances) { alliance in
                Button(action: {
                    onSelect(alliance)
                }) {
                    HStack {
                         // 联盟旗帜显示
                         ZStack {
                             RoundedRectangle(cornerRadius: 6)
                                 .fill(resolveAllianceColor(alliance).opacity(0.1))
                                 .frame(width: 32, height: 32)
                             
                             if let renderType = alliance.flagRenderType,
                                (renderType == "emoji" || renderType == "color"),
                                let char = alliance.flagUnicodeChar {
                                 Text(char).responsiveFont(.headline)
                             } else if let renderType = alliance.flagRenderType,
                                       renderType == "complex",
                                       let payload = alliance.flagPayload {
                                 
                                 let cleanPayload = payload.replacingOccurrences(of: "data:image/png;base64,", with: "")
                                 if let data = Data(base64Encoded: cleanPayload, options: .ignoreUnknownCharacters),
                                    let uiImage = UIImage(data: data) {
                                     Image(uiImage: uiImage)
                                         .resizable()
                                         .aspectRatio(contentMode: .fit)
                                         .frame(width: 24, height: 24)
                                 } else {
                                     Image(systemName: "flag.fill")
                                         .responsiveFont(.subheadline)
                                         .foregroundColor(resolveAllianceColor(alliance))
                                 }
                             } else {
                                 Image(systemName: "flag.fill")
                                     .responsiveFont(.subheadline)
                                     .foregroundColor(resolveAllianceColor(alliance))
                             }
                         }
                        
                        Text(alliance.name)
                            .font(.body)
                            .foregroundColor(.primary)
                        
                        Spacer()
                        
                        if let role = alliance.userRole {
                            Text(localizeRole(role))
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.gray.opacity(0.1))
                                .cornerRadius(4)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
            .navigationTitle(NSLocalizedString("alliance.select.title", value: "Select Alliance", comment: "Select Alliance"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(NSLocalizedString("common.cancel", comment: "Cancel")) {
                        dismiss()
                    }
                }
            }
        }
    }

    
    private func resolveAllianceColor(_ alliance: AllianceService.Alliance) -> Color {
        // 1. Try Alliance Color
        if let colorHex = alliance.color, !colorHex.isEmpty, colorHex != "#000000", let color = Color(hex: colorHex) {
            return color
        }
        
        // 2. Try Cache (using patternId)
        if let pid = alliance.flagPatternId, let pattern = FlagPatternCache.shared.getPattern(for: pid), let colorHex = pattern.color, !colorHex.isEmpty, let color = Color(hex: colorHex) {
            return color
        }
        
        // 3. Fallback to AppColors.primary (Cyan) or Blue
        return Color(hex: "#4ECDC4") ?? .blue
    }
    
    private func localizeRole(_ role: String) -> String {
        switch role.lowercased() {
        case "leader", "owner":
            return NSLocalizedString("alliance.role.leader", comment: "Leader")
        case "admin":
            return NSLocalizedString("alliance.role.admin", comment: "Admin")
        case "member":
            return NSLocalizedString("alliance.role.member", comment: "Member")
        default:
            return role
        }
    }
}
