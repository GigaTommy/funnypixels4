import SwiftUI

/// 交易记录视图
struct TransactionsView: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = TransactionsViewModel()

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // 筛选栏
                VStack(spacing: AppSpacing.m) {
                    // 类型选择
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: AppSpacing.s) {
                            ForEach(TransactionsViewModel.TransactionType.allCases) { type in
                                Button(action: {
                                    viewModel.selectedType = type
                                    viewModel.loadData()
                                }) {
                                    Text(type.rawValue)
                                        .font(AppTypography.subheadline())
                                        .foregroundColor(viewModel.selectedType == type ? .white : AppColors.primary)
                                        .padding(.horizontal, 16)
                                        .padding(.vertical, 8)
                                        .background(viewModel.selectedType == type ? AppColors.primary : AppColors.primary.opacity(0.1))
                                        .cornerRadius(AppRadius.l)
                                }
                            }
                        }
                        .padding(.horizontal, AppSpacing.l)
                    }

                    // 日期选择
                    HStack {
                        DatePicker(NSLocalizedString("transaction.date.start", comment: ""), selection: $viewModel.startDate, displayedComponents: .date)
                            .labelsHidden()
                        Text("-")
                            .foregroundColor(AppColors.textSecondary)
                        DatePicker(NSLocalizedString("transaction.date.end", comment: ""), selection: $viewModel.endDate, displayedComponents: .date)
                            .labelsHidden()

                        Spacer()

                        Button(action: {
                            viewModel.loadData()
                        }) {
                            Image(systemName: "magnifyingglass")
                                .foregroundColor(.white)
                                .padding(8)
                                .background(AppColors.primary)
                                .clipShape(Circle())
                        }
                    }
                    .padding(.horizontal, AppSpacing.l)
                }
                .padding(.vertical, AppSpacing.m)
                .background(AppColors.surface)
                .modifier(AppShadows.small())
                .zIndex(1) // Keep above list on transition

                // 统一列表
                ZStack {
                    AppColors.background.ignoresSafeArea()

                    if viewModel.isLoading && viewModel.transactions.isEmpty {
                        ProgressView(NSLocalizedString("common.loading", comment: ""))
                    } else if viewModel.transactions.isEmpty {
                        EmptyStateView(
                            title: NSLocalizedString("transaction.empty.title", comment: ""),
                            message: NSLocalizedString("transaction.empty.message", comment: ""),
                            systemImage: "doc.text"
                        )
                    } else {
                        List {
                            ForEach(viewModel.transactions) { transaction in
                                TransactionRow(transaction: transaction)
                                    .listRowBackground(AppColors.surface)
                            }
                        }
                        .listStyle(.plain)
                        .refreshable {
                            viewModel.loadData()
                        }
                    }
                }
            }
            .navigationTitle(NSLocalizedString("transaction.title", comment: ""))
            .navigationBarTitleDisplayMode(.inline)
        .hideTabBar()
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: { dismiss() }) {
                        Text(NSLocalizedString("common.done", comment: ""))
                            .font(AppTypography.body())
                            .fontWeight(.medium)
                            .foregroundColor(AppColors.primary)
                    }
                }
            }
            .onAppear {
                viewModel.loadData()
            }
        }
    }
}

/// 交易记录行
struct TransactionRow: View {
    let transaction: ShopService.Transaction

    var body: some View {
        HStack(spacing: AppSpacing.m) {
            // 类型图标
            ZStack {
                Circle()
                    .fill(typeColor.opacity(0.1))
                    .frame(width: 40, height: 40)

                Image(systemName: typeIcon)
                    .responsiveFont(.headline)
                    .foregroundColor(typeColor)
            }

            // 信息
            VStack(alignment: .leading, spacing: 4) {
                Text(transaction.itemName)
                    .font(AppTypography.body())
                    .fontWeight(.medium)
                    .foregroundColor(AppColors.textPrimary)
                    .lineLimit(1)

                HStack(spacing: 6) {
                    Text(typeText)
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.textSecondary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(AppColors.background)
                        .cornerRadius(4)

                    Text(statusText)
                        .font(AppTypography.caption())
                        .foregroundColor(statusColor)
                }

                Text(formatDate(transaction.createdAt))
                    .font(AppTypography.caption())
                    .foregroundColor(AppColors.textTertiary)
            }

            Spacer()

            // 积分变化
            VStack(alignment: .trailing, spacing: 4) {
                Text(pointsChangeText)
                    .font(AppTypography.subheadline())
                    .fontWeight(.semibold)
                    .foregroundColor(pointsChangeColor)

                Text("x\(transaction.quantity)")
                    .font(AppTypography.caption())
                    .foregroundColor(AppColors.textSecondary)
            }
        }
        .padding(.vertical, AppSpacing.xs)
    }

    private var typeColor: Color {
        switch transaction.type {
        case "purchase": return .blue
        case "use": return .orange
        case "refund": return .purple
        default: return .gray
        }
    }

    private var typeIcon: String {
        switch transaction.type {
        case "purchase": return "cart.fill"
        case "use": return "hand.tap.fill"
        case "refund": return "arrow.uturn.backward"
        default: return "doc.fill"
    }
    }

    private var typeText: String {
        switch transaction.type {
        case "purchase": return NSLocalizedString("transaction.type.purchase", comment: "")
        case "use": return NSLocalizedString("transaction.type.use", comment: "")
        case "refund": return NSLocalizedString("transaction.type.refund", comment: "")
        default: return NSLocalizedString("transaction.type.other", comment: "")
        }
    }

    private var statusColor: Color {
        switch transaction.status {
        case "completed", "success": return .green
        case "pending": return .orange
        case "failed": return .red
        default: return .secondary
        }
    }

    private var statusText: String {
        switch transaction.status {
        case "completed", "success": return NSLocalizedString("transaction.status.completed", comment: "")
        case "pending": return NSLocalizedString("transaction.status.pending", comment: "")
        case "failed": return NSLocalizedString("transaction.status.failed", comment: "")
        default: return transaction.status
        }
    }

    private var pointsChangeText: String {
        switch transaction.type {
        case "purchase": return "-\(transaction.price)"
        case "use": return NSLocalizedString("transaction.points.used", comment: "")
        case "refund": return "+\(transaction.price)"
        default: return "\(transaction.price)"
        }
    }

    private var pointsChangeColor: Color {
        switch transaction.type {
        case "purchase": return .red
        case "refund": return .green
        default: return AppColors.textPrimary
        }
    }

    private func formatDate(_ dateString: String) -> String {
        // Simple formatter, in real app might use a shared Helper
        // Assuming dateString is ISO8601 or similar, returning it as is or simple tweak
        // For now, let's just return prefix to keep it short if it's long
        return String(dateString.prefix(19)).replacingOccurrences(of: "T", with: " ")
    }
}
