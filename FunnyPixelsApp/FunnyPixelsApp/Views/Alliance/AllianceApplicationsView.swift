import SwiftUI

struct AllianceApplicationsView: View {
    @ObservedObject var viewModel: AllianceViewModel
    let allianceId: Int
    @State private var reviewMessage: String = ""
    @State private var showingReviewSheet = false
    @State private var selectedApplication: AllianceService.AllianceApplication?
    @State private var actionType: String = "approve"
    @State private var filterMode: ApplicationFilter = .pending

    enum ApplicationFilter: String, CaseIterable {
        case pending = "pending"
        case all = "all"

        var title: String {
            switch self {
            case .pending: return NSLocalizedString("alliance.applications.filter.pending", comment: "Pending")
            case .all: return NSLocalizedString("alliance.applications.filter.all", comment: "All")
            }
        }
    }

    private var filteredApplications: [AllianceService.AllianceApplication] {
        switch filterMode {
        case .pending:
            return viewModel.applications.filter { $0.status == "pending" }
        case .all:
            return viewModel.applications
        }
    }

    var body: some View {
        Group {
            if let error = viewModel.applicationsError, viewModel.applications.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 40))
                        .foregroundColor(.secondary)
                    Text(error)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                    Button(NSLocalizedString("policy.retry", comment: "Retry")) {
                        Task { await viewModel.loadApplications(for: allianceId) }
                    }
                    .buttonStyle(.bordered)
                }
                .padding()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    Section {
                        Picker(NSLocalizedString("alliance.applications.filter.pending", comment: ""), selection: $filterMode) {
                            ForEach(ApplicationFilter.allCases, id: \.self) { filter in
                                Text(filter.title).tag(filter)
                            }
                        }
                        .pickerStyle(.segmented)
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 8, trailing: 0))
                    }

                    if filteredApplications.isEmpty {
                        Text(NSLocalizedString("alliance.applications.empty", comment: "No applications"))
                            .foregroundColor(.secondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .listRowBackground(Color.clear)
                    } else {
                        ForEach(filteredApplications) { application in
                            ApplicationRow(application: application, onApprove: {
                                selectedApplication = application
                                actionType = "approve"
                                showingReviewSheet = true
                            }, onReject: {
                                selectedApplication = application
                                actionType = "reject"
                                showingReviewSheet = true
                            })
                        }
                    }
                }
            }
        }
        .navigationTitle(NSLocalizedString("alliance.applications.title", comment: "Join Applications"))
        .navigationBarTitleDisplayMode(.inline)
        .hideTabBar()
        .overlay {
            if viewModel.isLoadingApplications && viewModel.applications.isEmpty {
                ProgressView()
            }
        }
        .task {
            await viewModel.loadApplications(for: allianceId)
        }
        .refreshable {
            await viewModel.loadApplications(for: allianceId)
        }
        .sheet(isPresented: $showingReviewSheet) {
            NavigationView {
                Form {
                    Section(header: Text(NSLocalizedString("alliance.applications.review_placeholder", comment: "Review comments"))) {
                        TextEditor(text: $reviewMessage)
                            .frame(height: 100)
                    }
                }
                .navigationTitle(actionType == "approve" ? NSLocalizedString("alliance.applications.approve_title", comment: "Approve") : NSLocalizedString("alliance.applications.reject_title", comment: "Reject"))
                .navigationBarTitleDisplayMode(.inline)
        .hideTabBar()
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button(NSLocalizedString("common.cancel", comment: "Cancel")) {
                            showingReviewSheet = false
                            reviewMessage = ""
                        }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button(actionType == "approve" ? NSLocalizedString("common.approve", comment: "Approve") : NSLocalizedString("common.reject", comment: "Reject")) {
                            if let app = selectedApplication {
                                Task {
                                    await viewModel.reviewApplication(app.id, action: actionType, message: reviewMessage.isEmpty ? nil : reviewMessage)
                                    showingReviewSheet = false
                                    reviewMessage = ""
                                }
                            }
                        }
                        .foregroundColor(actionType == "approve" ? .blue : .red)
                    }
                }
            }
            .presentationDetents([.medium])
        }
    }
}

struct ApplicationRow: View {
    let application: AllianceService.AllianceApplication
    let onApprove: () -> Void
    let onReject: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                // Avatar
                AvatarView(
                    avatarUrl: application.avatarUrl,
                    avatar: nil,
                    displayName: application.username,
                    size: 40
                )

                VStack(alignment: .leading, spacing: 2) {
                    Text(application.username)
                        .font(.system(size: 16, weight: .semibold))

                    HStack(spacing: 8) {
                        if let totalPixels = application.totalPixels {
                            Label("\(totalPixels)", systemImage: "square.grid.3x3.fill")
                                .font(.system(size: 11))
                                .foregroundColor(.secondary)
                        }
                        if let currentPixels = application.currentPixels {
                            Label("\(currentPixels)", systemImage: "square.grid.2x2.fill")
                                .font(.system(size: 11))
                                .foregroundColor(.secondary)
                        }
                    }

                    Text(formatDate(application.createdAt))
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                }

                Spacer()

                if application.status == "pending" {
                    HStack(spacing: 8) {
                        Button(action: onReject) {
                            Text(NSLocalizedString("common.reject", comment: "Reject"))
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(.red)
                                .padding(.horizontal, 14)
                                .padding(.vertical, 6)
                                .background(Color.red.opacity(0.1))
                                .cornerRadius(8)
                        }

                        Button(action: onApprove) {
                            Text(NSLocalizedString("common.approve", comment: "Approve"))
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 14)
                                .padding(.vertical, 6)
                                .background(Color.blue)
                                .cornerRadius(8)
                        }
                    }
                } else {
                    Text(statusDisplayName(application.status))
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(statusColor(application.status))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(statusColor(application.status).opacity(0.1))
                        .cornerRadius(6)
                }
            }

            if let message = application.message, !message.isEmpty {
                Text(message)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.gray.opacity(0.05))
                    .cornerRadius(8)
            }
        }
        .padding(.vertical, 8)
    }

    private func statusDisplayName(_ status: String) -> String {
        switch status {
        case "approved": return NSLocalizedString("alliance.status.approved", comment: "Approved")
        case "rejected": return NSLocalizedString("alliance.status.rejected", comment: "Rejected")
        default: return NSLocalizedString("alliance.status.pending", comment: "Pending")
        }
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "approved": return .green
        case "rejected": return .red
        default: return .orange
        }
    }

    private func formatDate(_ dateStr: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: dateStr) {
            let displayFormatter = DateFormatter()
            displayFormatter.dateStyle = .short
            displayFormatter.timeStyle = .short
            return displayFormatter.string(from: date)
        }
        return dateStr
    }
}
