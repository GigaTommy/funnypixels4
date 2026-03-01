import SwiftUI

/// 旗帜选择器 — 替代 AllianceSelectionSheet，支持个人颜色/头像 + 联盟旗帜
struct FlagSelectionSheet: View {
    let personalColor: String
    let hasPixelAvatar: Bool
    let avatarData: String?
    let alliances: [AllianceService.Alliance]
    let currentChoice: FlagChoice?
    let onSelect: (FlagChoice) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            List {
                // MARK: - Section 1: Personal Style (头像优先，否则显示颜色)
                Section(header: Text(NSLocalizedString("flag.section.personal", comment: "Personal Style"))) {
                    if hasPixelAvatar, let avatarUrl = avatarData {
                        // 已设置头像 → 只显示"我的头像"
                        Button(action: {
                            onSelect(.personalAvatar(avatarData: avatarUrl))
                            dismiss()
                        }) {
                            HStack {
                                AvatarView(
                                    avatarUrl: avatarUrl,
                                    displayName: AuthManager.shared.currentUser?.username ?? "",
                                    size: 32
                                )
                                .overlay(Circle().stroke(Color.white, lineWidth: 1.5))
                                .shadow(color: .black.opacity(0.15), radius: 2)

                                Text(NSLocalizedString("flag.my_avatar", comment: "My Avatar"))
                                    .font(.body)
                                    .foregroundColor(.primary)

                                Spacer()

                                if case .personalAvatar = currentChoice {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundColor(.blue)
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    } else {
                        // 未设置头像 → 显示"我的颜色"
                        Button(action: {
                            onSelect(.personalColor(colorHex: personalColor))
                            dismiss()
                        }) {
                            HStack {
                                Circle()
                                    .fill(Color(hex: personalColor) ?? .blue)
                                    .frame(width: 32, height: 32)
                                    .overlay(Circle().stroke(Color.white, lineWidth: 1.5))
                                    .shadow(color: .black.opacity(0.15), radius: 2)

                                Text(NSLocalizedString("flag.personal_color", comment: "My Color"))
                                    .font(.body)
                                    .foregroundColor(.primary)

                                Spacer()

                                if case .personalColor = currentChoice {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundColor(.blue)
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }

                // MARK: - Section 2: Alliance Flags
                if !alliances.isEmpty {
                    Section(header: Text(NSLocalizedString("flag.section.alliance", comment: "Alliance Flags"))) {
                        ForEach(alliances) { alliance in
                            Button(action: {
                                onSelect(.alliance(allianceId: alliance.id, allianceName: alliance.name))
                                dismiss()
                            }) {
                                HStack {
                                    // Alliance flag display (reused from AllianceSelectionSheet)
                                    ZStack {
                                        RoundedRectangle(cornerRadius: 6)
                                            .fill(resolveAllianceColor(alliance).opacity(0.1))
                                            .frame(width: 32, height: 32)

                                        if let renderType = alliance.flagRenderType,
                                           (renderType == "emoji" || renderType == "color"),
                                           let char = alliance.flagUnicodeChar {
                                            Text(char).font(.system(size: 16))
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
                                                    .font(.system(size: 14))
                                                    .foregroundColor(resolveAllianceColor(alliance))
                                            }
                                        } else {
                                            Image(systemName: "flag.fill")
                                                .font(.system(size: 14))
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

                                    if case .alliance(let id, _) = currentChoice, id == alliance.id {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundColor(.blue)
                                    }
                                }
                                .padding(.vertical, 4)
                            }
                        }
                    }
                }
            }
            .navigationTitle(NSLocalizedString("flag.picker.title", comment: "Choose Flag"))
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

    // MARK: - Helpers

    private func resolveAllianceColor(_ alliance: AllianceService.Alliance) -> Color {
        if let colorHex = alliance.color, !colorHex.isEmpty, colorHex != "#000000", let color = Color(hex: colorHex) {
            return color
        }
        if let pid = alliance.flagPatternId, let pattern = FlagPatternCache.shared.getPattern(for: pid), let colorHex = pattern.color, !colorHex.isEmpty, let color = Color(hex: colorHex) {
            return color
        }
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
