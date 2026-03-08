import SwiftUI

struct AllianceMemberListView: View {
    @ObservedObject var viewModel: AllianceViewModel
    @ObservedObject private var fontManager = FontSizeManager.shared
    let allianceId: Int
    @Environment(\.dismiss) private var dismiss
    @State private var showingTransferAlert = false
    @State private var showingKickAlert = false
    @State private var selectedMember: AllianceService.AllianceMember?
    @State private var memberToKick: AllianceService.AllianceMember?
    @State private var sortOption: MemberSortOption = .role
    @State private var searchText = ""

    enum MemberSortOption: String, CaseIterable {
        case role = "role"
        case pixels = "pixels"
        case joinDate = "joinDate"

        var title: String {
            switch self {
            case .role: return NSLocalizedString("alliance.sort.role", comment: "By Role")
            case .pixels: return NSLocalizedString("alliance.sort.pixels", comment: "By Pixels")
            case .joinDate: return NSLocalizedString("alliance.sort.date", comment: "By Join Date")
            }
        }
    }

    private var sortedMembers: [AllianceService.AllianceMember] {
        switch sortOption {
        case .role:
            return viewModel.members.sorted {
                rolePriority($0.role) < rolePriority($1.role)
            }
        case .pixels:
            return viewModel.members.sorted {
                ($0.totalPixels ?? 0) > ($1.totalPixels ?? 0)
            }
        case .joinDate:
            return viewModel.members.sorted {
                $0.joinedAt < $1.joinedAt
            }
        }
    }

    private var filteredMembers: [AllianceService.AllianceMember] {
        if searchText.isEmpty {
            return sortedMembers
        }
        return sortedMembers.filter {
            $0.username.localizedCaseInsensitiveContains(searchText)
        }
    }

    private func rolePriority(_ role: String) -> Int {
        switch role {
        case "leader": return 0
        case "admin": return 1
        default: return 2
        }
    }

    var body: some View {
        Group {
            if let error = viewModel.membersError, viewModel.members.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 40))
                        .foregroundColor(.secondary)
                    Text(error)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                    Button(NSLocalizedString("policy.retry", comment: "Retry")) {
                        Task { await viewModel.loadMembers(for: allianceId) }
                    }
                    .buttonStyle(.bordered)
                }
                .padding()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    Section(header: Text(String(format: NSLocalizedString("alliance.members.count", comment: "%d Members"), viewModel.members.count))) {
                        ForEach(filteredMembers) { member in
                            MemberRow(member: member,
                                      userRole: viewModel.userAlliance?.userRole ?? "member",
                                      onKick: {
                                memberToKick = member
                                showingKickAlert = true
                            }, onPromote: {
                                Task { await viewModel.updateMemberRole(member.id, role: "admin") }
                            }, onDemote: {
                                Task { await viewModel.updateMemberRole(member.id, role: "member") }
                            }, onTransfer: {
                                selectedMember = member
                                showingTransferAlert = true
                            })
                        }
                    }
                }
                .searchable(text: $searchText, prompt: NSLocalizedString("alliance.members.search", comment: "Search members"))
            }
        }
        .navigationTitle(NSLocalizedString("alliance.members.title", comment: "Member List"))
        .navigationBarTitleDisplayMode(.inline)
        .hideTabBar()
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    ForEach(MemberSortOption.allCases, id: \.self) { option in
                        Button(action: {
                            HapticManager.shared.selection()
                            sortOption = option
                        }) {
                            Label(option.title, systemImage: sortOption == option ? "checkmark" : "")
                        }
                    }
                } label: {
                    Image(systemName: "arrow.up.arrow.down")
                }
            }
        }
        .overlay {
            if viewModel.isLoadingMembers && viewModel.members.isEmpty {
                ProgressView()
            }
        }
        .task {
            await viewModel.loadMembers(for: allianceId)
        }
        .refreshable {
            await viewModel.loadMembers(for: allianceId)
        }
        .alert(NSLocalizedString("alliance.transfer.title", comment: "Confirm Transfer"), isPresented: $showingTransferAlert) {
            Button(NSLocalizedString("common.cancel", comment: "Cancel"), role: .cancel) {}
            Button(NSLocalizedString("common.confirm", comment: "Confirm"), role: .destructive) {
                if let member = selectedMember {
                    Task {
                        await viewModel.transferLeadership(member.id)
                        dismiss()
                    }
                }
            }
        } message: {
            if let member = selectedMember {
                Text(String(format: NSLocalizedString("alliance.transfer.message", comment: "Are you sure you want to transfer..."), member.username))
            }
        }
        .alert(NSLocalizedString("alliance.kick.confirm.title", comment: "Remove Member"), isPresented: $showingKickAlert) {
            Button(NSLocalizedString("common.cancel", comment: "Cancel"), role: .cancel) {}
            Button(NSLocalizedString("common.confirm", comment: "Confirm"), role: .destructive) {
                if let member = memberToKick {
                    HapticManager.shared.notification(type: .warning)
                    Task {
                        await viewModel.kickMember(member.id)
                    }
                }
            }
        } message: {
            if let member = memberToKick {
                Text(String(format: NSLocalizedString("alliance.kick.confirm.message", comment: "Remove %@ from the alliance?"), member.username))
            }
        }
    }
}

struct MemberRow: View {
    let member: AllianceService.AllianceMember
    let userRole: String
    let onKick: () -> Void
    let onPromote: () -> Void
    let onDemote: () -> Void
    let onTransfer: () -> Void

    var body: some View {
        HStack {
            // Avatar
            DecoratedAvatarView(
                avatarUrl: member.avatarUrl,
                displayName: member.username,
                size: 40
            )

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Text(member.username)
                        .responsiveFont(.headline, weight: .semibold)

                    Text(roleDisplayName(member.role))
                        .font(.system(size: 10, weight: .bold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(roleColor(member.role).opacity(0.1))
                        .foregroundColor(roleColor(member.role))
                        .cornerRadius(6)
                }

                HStack(spacing: 10) {
                    Label("\(member.totalPixels ?? 0)", systemImage: "square.grid.3x3.fill")
                        .responsiveFont(.caption2)
                        .foregroundColor(.secondary)

                    Label("\(member.currentPixels ?? 0)", systemImage: "square.grid.2x2.fill")
                        .responsiveFont(.caption2)
                        .foregroundColor(.secondary)

                    Text(formatDate(member.joinedAt))
                        .responsiveFont(.caption2)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            // Actions
            if canManage(member) {
                Menu {
                    if userRole == "leader" {
                        if member.role == "member" {
                            Button(action: {
                                HapticManager.shared.notification(type: .warning)
                                onPromote()
                            }) {
                                Label(NSLocalizedString("alliance.action.promote", comment: "Promote"), systemImage: "person.badge.shield.check")
                            }
                        } else if member.role == "admin" {
                            Button(action: {
                                HapticManager.shared.notification(type: .warning)
                                onDemote()
                            }) {
                                Label(NSLocalizedString("alliance.action.demote", comment: "Demote"), systemImage: "person.badge.minus")
                            }
                        }

                        Button(action: onTransfer) {
                            Label(NSLocalizedString("alliance.action.transfer", comment: "Transfer"), systemImage: "arrow.2.squarepath")
                        }
                    }

                    Button(role: .destructive, action: onKick) {
                        Label(NSLocalizedString("alliance.action.kick", comment: "Kick"), systemImage: "person.badge.minus")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .font(.title3)
                        .foregroundColor(.blue)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private func canManage(_ targetMember: AllianceService.AllianceMember) -> Bool {
        if targetMember.role == "leader" { return false }
        if userRole == "leader" { return true }
        if userRole == "admin" && targetMember.role == "member" { return true }
        return false
    }

    private func roleDisplayName(_ role: String) -> String {
        switch role {
        case "leader": return NSLocalizedString("alliance.role.leader", comment: "Leader")
        case "admin": return NSLocalizedString("alliance.role.admin", comment: "Admin")
        default: return NSLocalizedString("alliance.role.member", comment: "Member")
        }
    }

    private func roleColor(_ role: String) -> Color {
        switch role {
        case "leader": return .red
        case "admin": return .blue
        default: return .gray
        }
    }

    private func formatDate(_ dateStr: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: dateStr) {
            let displayFormatter = DateFormatter()
            displayFormatter.dateStyle = .short
            return displayFormatter.string(from: date)
        }
        return dateStr
    }
}
