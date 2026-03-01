import SwiftUI
import Combine

struct DailyTaskListView: View {
    @StateObject private var viewModel = DailyTaskViewModel()
    @ObservedObject private var fontManager = FontSizeManager.shared

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: AppSpacing.l) {
                // Progress Overview
                progressHeader

                // Task List
                if viewModel.isLoading && viewModel.tasks.isEmpty {
                    loadingView
                } else if viewModel.tasks.isEmpty {
                    emptyView
                } else {
                    taskList
                }

                // Bonus Card
                if viewModel.totalCount > 0 {
                    bonusCard
                        .animation(.spring(response: 0.4, dampingFraction: 0.6), value: viewModel.bonusClaimed)
                }
            }
            .padding(.horizontal, AppSpacing.l)
            .padding(.top, AppSpacing.l)
            .padding(.bottom, 40)
        }
        .background(AppColors.background)
        .navigationTitle(NSLocalizedString("daily_task.title", comment: "Daily Tasks"))
        .navigationBarTitleDisplayMode(.inline)
        .hideTabBar()
        .task {
            await viewModel.loadTasks()
        }
        .refreshable {
            await viewModel.loadTasks()
        }
        .overlay(alignment: .top) {
            if let toast = viewModel.toastMessage {
                toastOverlay(toast)
            }
        }
    }

    // MARK: - Progress Header

    private var progressHeader: some View {
        StandardCard(padding: AppSpacing.l) {
            VStack(spacing: 12) {
                HStack {
                    Image(systemName: "checklist")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(AppColors.primary)
                    Text(NSLocalizedString("daily_task.progress", comment: "Today's Progress"))
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(AppColors.textPrimary)
                    Spacer()
                    Text("\(viewModel.completedCount)/\(viewModel.totalCount)")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(AppColors.primary)
                }

                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 6)
                            .fill(Color(.systemGray5))
                            .frame(height: 10)

                        RoundedRectangle(cornerRadius: 6)
                            .fill(
                                LinearGradient(
                                    colors: [AppColors.primary, AppColors.secondary],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(
                                width: viewModel.totalCount > 0
                                    ? geo.size.width * CGFloat(viewModel.completedCount) / CGFloat(viewModel.totalCount)
                                    : 0,
                                height: 10
                            )
                            .animation(.easeInOut(duration: 0.3), value: viewModel.completedCount)
                    }
                }
                .frame(height: 10)
            }
        }
    }

    // MARK: - Task List

    private var taskList: some View {
        StandardCard(padding: 0) {
            VStack(spacing: 0) {
                ForEach(Array(viewModel.tasks.enumerated()), id: \.element.id) { index, task in
                    taskRow(task)

                    if index < viewModel.tasks.count - 1 {
                        Divider().padding(.leading, 56)
                    }
                }
            }
        }
    }

    private func taskRow(_ task: DailyTaskService.DailyTask) -> some View {
        HStack(spacing: 12) {
            // Icon
            taskIcon(task)

            // Info
            VStack(alignment: .leading, spacing: 4) {
                Text(task.title)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(AppColors.textPrimary)
                Text(task.description)
                    .font(.system(size: 11))
                    .foregroundColor(AppColors.textTertiary)

                // Progress bar
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color(.systemGray5))
                            .frame(height: 5)

                        RoundedRectangle(cornerRadius: 3)
                            .fill(taskColorForType(task.type))
                            .frame(width: geo.size.width * CGFloat(task.progress), height: 5)
                    }
                }
                .frame(height: 5)

                Text("\(task.current)/\(task.target)")
                    .font(.system(size: 10))
                    .foregroundColor(AppColors.textTertiary)
            }

            Spacer()

            // Reward / Claim button
            claimButton(task)
        }
        .padding(AppSpacing.l)
    }

    private func taskIcon(_ task: DailyTaskService.DailyTask) -> some View {
        ZStack {
            Circle()
                .fill(taskColorForType(task.type).opacity(task.isCompleted ? 0.15 : 0.08))
                .frame(width: 36, height: 36)

            Image(systemName: task.taskIcon)
                .font(.system(size: 15))
                .foregroundColor(
                    task.isCompleted ? taskColorForType(task.type) : AppColors.textTertiary
                )
        }
    }

    @ViewBuilder
    private func claimButton(_ task: DailyTaskService.DailyTask) -> some View {
        if task.isClaimed {
            // Already claimed
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 22))
                .foregroundColor(.green)
        } else if task.isCompleted {
            // Can claim
            Button {
                Task {
                    await viewModel.claimReward(taskId: task.id)
                }
            } label: {
                HStack(spacing: 3) {
                    Image(systemName: "star.fill")
                        .font(.system(size: 10))
                    Text("+\(task.rewardPoints)")
                        .font(.system(size: 12, weight: .bold))
                }
                .foregroundColor(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(
                    LinearGradient(
                        colors: [.orange, .orange.opacity(0.8)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .clipShape(Capsule())
            }
            .disabled(viewModel.claimingTaskId == task.id)
            .opacity(viewModel.claimingTaskId == task.id ? 0.6 : 1)
        } else {
            // Not completed yet
            VStack(spacing: 2) {
                Image(systemName: "star.fill")
                    .font(.system(size: 10))
                    .foregroundColor(.orange.opacity(0.4))
                Text("\(task.rewardPoints)")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(AppColors.textTertiary)
            }
        }
    }

    // MARK: - Bonus Card

    private var bonusCard: some View {
        StandardCard(padding: AppSpacing.l) {
            VStack(spacing: 12) {
                HStack {
                    Image(systemName: "gift.fill")
                        .font(.system(size: 16))
                        .foregroundColor(.orange)
                    Text(NSLocalizedString("daily_task.bonus_title", comment: "All Complete Bonus"))
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(AppColors.textPrimary)
                    Spacer()
                    HStack(spacing: 3) {
                        Image(systemName: "star.fill")
                            .font(.system(size: 11))
                            .foregroundColor(.orange)
                        Text("+\(viewModel.bonusPoints)")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(.orange)
                    }
                }

                Text(NSLocalizedString("daily_task.bonus_desc", comment: "Complete all tasks to earn bonus"))
                    .font(.system(size: 12))
                    .foregroundColor(AppColors.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                if viewModel.bonusClaimed {
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                        Text(NSLocalizedString("daily_task.bonus_claimed", comment: "Bonus claimed"))
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.green)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(Color.green.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                } else if viewModel.bonusAvailable {
                    Button {
                        Task {
                            await viewModel.claimBonus()
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "gift.fill")
                                .font(.system(size: 13))
                            Text(NSLocalizedString("daily_task.claim_bonus", comment: "Claim Bonus"))
                                .font(.system(size: 14, weight: .bold))
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(
                            LinearGradient(
                                colors: [.orange, .red],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    .disabled(viewModel.claimingBonus)
                    .opacity(viewModel.claimingBonus ? 0.6 : 1)
                } else {
                    // Not all completed yet
                    HStack(spacing: 4) {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 11))
                            .foregroundColor(AppColors.textTertiary)
                        Text(String(format: NSLocalizedString("daily_task.bonus_locked", comment: "Complete all %d tasks"), viewModel.totalCount))
                            .font(.system(size: 12))
                            .foregroundColor(AppColors.textTertiary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(Color(.systemGray6))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
            }
        }
    }

    // MARK: - Supporting Views

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
            Text(NSLocalizedString("common.loading", comment: "Loading"))
                .font(.system(size: 13))
                .foregroundColor(AppColors.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }

    private var emptyView: some View {
        VStack(spacing: 12) {
            Image(systemName: "checklist")
                .font(.system(size: 40))
                .foregroundColor(AppColors.textTertiary.opacity(0.5))
            Text(NSLocalizedString("daily_task.empty", comment: "No tasks today"))
                .font(.system(size: 14))
                .foregroundColor(AppColors.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }

    private func toastOverlay(_ message: String) -> some View {
        Text(message)
            .font(.system(size: 14, weight: .semibold))
            .foregroundColor(.white)
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
            .background(Color.black.opacity(0.75))
            .clipShape(Capsule())
            .padding(.top, 8)
            .transition(.move(edge: .top).combined(with: .opacity))
            .onAppear {
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                    withAnimation { viewModel.toastMessage = nil }
                }
            }
    }

    // MARK: - Helpers

    private func taskColorForType(_ type: String) -> Color {
        switch type {
        case "draw_pixels": return .blue
        case "draw_sessions": return .purple
        case "checkin": return .green
        case "social_interact": return .pink
        case "explore_map": return .cyan
        default: return .orange
        }
    }
}
